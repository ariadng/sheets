import { GoogleSheetsCore } from '../client';
import { GoogleSheetsError } from '../errors';
import { google } from 'googleapis';

// Mock googleapis
jest.mock('googleapis', () => ({
	google: {
		sheets: jest.fn(),
	},
}));

describe('GoogleSheetsCore', () => {
	let mockSheets: any;
	let client: GoogleSheetsCore;
	let mockAuth: any;

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks();

		mockAuth = { authorize: jest.fn() };

		// Create mock sheets API
		mockSheets = {
			spreadsheets: {
				values: {
					get: jest.fn(),
					update: jest.fn(),
					append: jest.fn(),
					clear: jest.fn(),
					batchGet: jest.fn(),
					batchUpdate: jest.fn(),
					batchClear: jest.fn(),
				},
				get: jest.fn(),
			},
		};

		// Mock google.sheets to return our mock
		(google.sheets as jest.Mock).mockReturnValue(mockSheets);

		// Create client instance
		client = new GoogleSheetsCore({ auth: mockAuth });
	});

	describe('read', () => {
		it('should read values from spreadsheet', async () => {
			const mockData = [
				['Name', 'Age'],
				['Alice', '30'],
				['Bob', '25'],
			];

			mockSheets.spreadsheets.values.get.mockResolvedValue({
				data: { values: mockData },
			});

			const result = await client.read('spreadsheetId', 'Sheet1!A1:B3');

			expect(result).toEqual(mockData);
			expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith({
				spreadsheetId: 'spreadsheetId',
				range: 'Sheet1!A1:B3',
			});
		});

		it('should return empty array when no values', async () => {
			mockSheets.spreadsheets.values.get.mockResolvedValue({
				data: { values: null },
			});

			const result = await client.read('spreadsheetId', 'Sheet1!A1:B3');

			expect(result).toEqual([]);
		});

		it('should retry on retryable errors', async () => {
			const error = new Error('Network error');
			(error as any).code = 'ECONNRESET';

			mockSheets.spreadsheets.values.get
				.mockRejectedValueOnce(error)
				.mockResolvedValueOnce({
					data: { values: [['test']] },
				});

			const result = await client.read('spreadsheetId', 'Sheet1!A1');

			expect(result).toEqual([['test']]);
			expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledTimes(2);
		});

		it('should throw GoogleSheetsError on non-retryable error', async () => {
			const error = new Error('Permission denied');
			(error as any).response = { status: 403 };

			mockSheets.spreadsheets.values.get.mockRejectedValue(error);

			await expect(client.read('spreadsheetId', 'Sheet1!A1')).rejects.toThrow(
				GoogleSheetsError
			);
		});
	});

	describe('write', () => {
		it('should write values to spreadsheet', async () => {
			const values = [
				['Name', 'Age'],
				['Alice', '30'],
			];

			mockSheets.spreadsheets.values.update.mockResolvedValue({
				data: {
					updatedRows: 2,
					updatedColumns: 2,
					updatedCells: 4,
				},
			});

			const result = await client.write('spreadsheetId', 'Sheet1!A1:B2', values);

			expect(result).toHaveProperty('updatedRows', 2);
			expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith({
				spreadsheetId: 'spreadsheetId',
				range: 'Sheet1!A1:B2',
				valueInputOption: 'USER_ENTERED',
				requestBody: { values },
			});
		});
	});

	describe('append', () => {
		it('should append values to spreadsheet', async () => {
			const values = [['New', 'Row']];

			mockSheets.spreadsheets.values.append.mockResolvedValue({
				data: {
					updates: {
						updatedRows: 1,
						updatedColumns: 2,
						updatedCells: 2,
					},
				},
			});

			const result = await client.append('spreadsheetId', 'Sheet1!A:B', values);

			expect(result).toHaveProperty('updates');
			expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
				spreadsheetId: 'spreadsheetId',
				range: 'Sheet1!A:B',
				valueInputOption: 'USER_ENTERED',
				insertDataOption: 'INSERT_ROWS',
				requestBody: { values },
			});
		});
	});

	describe('clear', () => {
		it('should clear values in range', async () => {
			mockSheets.spreadsheets.values.clear.mockResolvedValue({
				data: {
					clearedRange: 'Sheet1!A1:B10',
				},
			});

			const result = await client.clear('spreadsheetId', 'Sheet1!A1:B10');

			expect(result).toHaveProperty('clearedRange');
			expect(mockSheets.spreadsheets.values.clear).toHaveBeenCalledWith({
				spreadsheetId: 'spreadsheetId',
				range: 'Sheet1!A1:B10',
			});
		});
	});

	describe('batchRead', () => {
		it('should read multiple ranges', async () => {
			const ranges = ['Sheet1!A1:B2', 'Sheet2!C1:D2'];
			const mockData = [
				{ range: ranges[0], values: [['A', 'B']] },
				{ range: ranges[1], values: [['C', 'D']] },
			];

			mockSheets.spreadsheets.values.batchGet.mockResolvedValue({
				data: { valueRanges: mockData },
			});

			const result = await client.batchRead('spreadsheetId', ranges);

			expect(result).toEqual(mockData);
			expect(mockSheets.spreadsheets.values.batchGet).toHaveBeenCalledWith({
				spreadsheetId: 'spreadsheetId',
				ranges,
			});
		});
	});

	describe('retry logic', () => {
		it('should apply exponential backoff', async () => {
			const error = new Error('Rate limit');
			(error as any).response = { status: 429 };

			mockSheets.spreadsheets.values.get
				.mockRejectedValueOnce(error)
				.mockRejectedValueOnce(error)
				.mockResolvedValueOnce({
					data: { values: [['success']] },
				});

			const startTime = Date.now();
			const result = await client.read('spreadsheetId', 'A1');
			const duration = Date.now() - startTime;

			expect(result).toEqual([['success']]);
			expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledTimes(3);
			// Should have delays between retries
			expect(duration).toBeGreaterThan(1000);
		});

		it('should stop retrying after max attempts', async () => {
			const error = new Error('Server error');
			(error as any).response = { status: 500 };

			mockSheets.spreadsheets.values.get.mockRejectedValue(error);

			const client = new GoogleSheetsCore({
				auth: mockAuth,
				retryConfig: { maxAttempts: 2 },
			});

			await expect(client.read('spreadsheetId', 'A1')).rejects.toThrow(
				GoogleSheetsError
			);
			expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledTimes(2);
		});
	});
});