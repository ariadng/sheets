import { google, sheets_v4 } from 'googleapis';
import { GoogleAuth, OAuth2Client, JWT } from 'google-auth-library';
import { GoogleSheetsError } from './errors';

export interface GoogleSheetsConfig {
	auth: GoogleAuth | OAuth2Client | JWT;
	retryConfig?: {
		maxAttempts?: number; // default: 3
		maxDelay?: number; // default: 10000ms
		initialDelay?: number; // default: 1000ms
	};
}

export interface RetryConfig {
	maxAttempts: number;
	maxDelay: number;
	initialDelay: number;
}

export class GoogleSheetsCore {
	private sheets: sheets_v4.Sheets;
	private retryConfig: RetryConfig;

	constructor(config: GoogleSheetsConfig) {
		this.sheets = google.sheets({
			version: 'v4',
			auth: config.auth,
		});

		this.retryConfig = {
			maxAttempts: config.retryConfig?.maxAttempts ?? 3,
			maxDelay: config.retryConfig?.maxDelay ?? 10000,
			initialDelay: config.retryConfig?.initialDelay ?? 1000,
		};
	}

	/**
	 * Read values from a spreadsheet
	 * @param spreadsheetId The spreadsheet ID
	 * @param range A1 notation range (e.g., 'Sheet1!A1:B10')
	 * @returns 2D array of values
	 */
	async read(spreadsheetId: string, range: string): Promise<any[][]> {
		return this.withRetry(async () => {
			const response = await this.sheets.spreadsheets.values.get({
				spreadsheetId,
				range,
			});
			return response.data.values || [];
		});
	}

	/**
	 * Write values to a spreadsheet
	 * @param spreadsheetId The spreadsheet ID
	 * @param range A1 notation range
	 * @param values 2D array of values to write
	 */
	async write(
		spreadsheetId: string,
		range: string,
		values: any[][]
	): Promise<sheets_v4.Schema$UpdateValuesResponse> {
		return this.withRetry(async () => {
			const response = await this.sheets.spreadsheets.values.update({
				spreadsheetId,
				range,
				valueInputOption: 'USER_ENTERED',
				requestBody: { values },
			});
			return response.data;
		});
	}

	/**
	 * Append values to a spreadsheet
	 */
	async append(
		spreadsheetId: string,
		range: string,
		values: any[][]
	): Promise<sheets_v4.Schema$AppendValuesResponse> {
		return this.withRetry(async () => {
			const response = await this.sheets.spreadsheets.values.append({
				spreadsheetId,
				range,
				valueInputOption: 'USER_ENTERED',
				insertDataOption: 'INSERT_ROWS',
				requestBody: { values },
			});
			return response.data;
		});
	}

	/**
	 * Clear values in a range
	 */
	async clear(
		spreadsheetId: string,
		range: string
	): Promise<sheets_v4.Schema$ClearValuesResponse> {
		return this.withRetry(async () => {
			const response = await this.sheets.spreadsheets.values.clear({
				spreadsheetId,
				range,
			});
			return response.data;
		});
	}

	/**
	 * Batch read multiple ranges
	 */
	async batchRead(
		spreadsheetId: string,
		ranges: string[]
	): Promise<sheets_v4.Schema$ValueRange[]> {
		return this.withRetry(async () => {
			const response = await this.sheets.spreadsheets.values.batchGet({
				spreadsheetId,
				ranges,
			});
			return response.data.valueRanges || [];
		});
	}

	/**
	 * Batch update multiple ranges
	 */
	async batchWrite(
		spreadsheetId: string,
		data: Array<{ range: string; values: any[][] }>
	): Promise<sheets_v4.Schema$BatchUpdateValuesResponse> {
		return this.withRetry(async () => {
			const response = await this.sheets.spreadsheets.values.batchUpdate({
				spreadsheetId,
				requestBody: {
					data: data.map((item) => ({
						range: item.range,
						values: item.values,
					})),
					valueInputOption: 'USER_ENTERED',
				},
			});
			return response.data;
		});
	}

	/**
	 * Batch clear multiple ranges
	 */
	async batchClear(
		spreadsheetId: string,
		ranges: string[]
	): Promise<sheets_v4.Schema$BatchClearValuesResponse> {
		return this.withRetry(async () => {
			const response = await this.sheets.spreadsheets.values.batchClear({
				spreadsheetId,
				requestBody: { ranges },
			});
			return response.data;
		});
	}

	/**
	 * Get spreadsheet metadata
	 */
	async getSpreadsheet(spreadsheetId: string): Promise<sheets_v4.Schema$Spreadsheet> {
		return this.withRetry(async () => {
			const response = await this.sheets.spreadsheets.get({
				spreadsheetId,
			});
			return response.data;
		});
	}

	/**
	 * Get the underlying Sheets API instance for advanced usage
	 */
	getApi(): sheets_v4.Sheets {
		return this.sheets;
	}

	/**
	 * Simple exponential backoff retry logic
	 */
	private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
		let lastError: any;

		for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
			try {
				return await fn();
			} catch (error: any) {
				lastError = error;

				// Don't retry if not retryable or last attempt
				if (!this.isRetryable(error) || attempt === this.retryConfig.maxAttempts - 1) {
					throw new GoogleSheetsError(error);
				}

				// Calculate delay with exponential backoff
				const baseDelay = Math.min(
					this.retryConfig.initialDelay * Math.pow(2, attempt),
					this.retryConfig.maxDelay
				);

				// Add jitter to prevent thundering herd
				const jitter = Math.random() * 1000;
				const delay = baseDelay + jitter;

				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		throw new GoogleSheetsError(lastError);
	}

	private isRetryable(error: any): boolean {
		const retryableCodes = [429, 500, 502, 503, 504];
		const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];

		return (
			retryableCodes.includes(error.code) ||
			retryableCodes.includes(error.response?.status) ||
			retryableErrors.includes(error.code)
		);
	}
}