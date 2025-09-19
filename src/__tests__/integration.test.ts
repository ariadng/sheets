import * as path from 'path';
import { GoogleSheetsCore, createServiceAccountAuth } from '../core';
import { withCache, BatchOperations, A1, Parsers, Serializers } from '../plus';
import { withAdaptiveRateLimit, withMetrics } from '../advanced';

const TEST_SPREADSHEET_ID = '1aOBzgPyNoQnKAuoEoxdHXZd2-8vXGyNTk6LNrnYicp8';
const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service_account.json');

describe('Integration Tests', () => {
	let client: GoogleSheetsCore;

	beforeAll(async () => {
		// Create authenticated client
		const auth = await createServiceAccountAuth(SERVICE_ACCOUNT_PATH);
		client = new GoogleSheetsCore({ auth });
	});

	describe('Basic CRUD operations', () => {
		const testRange = 'Sheet1!A1:C3';

		beforeEach(async () => {
			// Clear test area before each test
			await client.clear(TEST_SPREADSHEET_ID, testRange).catch(() => {});
		});

		it('should write and read data', async () => {
			const testData = [
				['Name', 'Age', 'City'],
				['Alice', '30', 'NYC'],
				['Bob', '25', 'LA'],
			];

			// Write data
			const writeResult = await client.write(TEST_SPREADSHEET_ID, testRange, testData);
			expect(writeResult).toBeDefined();
			expect(writeResult.updatedCells).toBeGreaterThan(0);

			// Read data back
			const readResult = await client.read(TEST_SPREADSHEET_ID, testRange);
			expect(readResult).toEqual(testData);
		});

		it('should append data', async () => {
			// Initial data
			await client.write(TEST_SPREADSHEET_ID, 'Sheet1!A1:B2', [
				['Header1', 'Header2'],
				['Data1', 'Data2'],
			]);

			// Append new data
			const appendData = [['Data3', 'Data4']];
			const appendResult = await client.append(
				TEST_SPREADSHEET_ID,
				'Sheet1!A:B',
				appendData
			);
			expect(appendResult).toBeDefined();

			// Verify appended data
			const allData = await client.read(TEST_SPREADSHEET_ID, 'Sheet1!A1:B3');
			expect(allData).toHaveLength(3);
			expect(allData[2]).toEqual(['Data3', 'Data4']);
		});

		it('should clear data', async () => {
			// Write data
			await client.write(TEST_SPREADSHEET_ID, testRange, [
				['Test', 'Data'],
				['To', 'Clear'],
			]);

			// Clear data
			const clearResult = await client.clear(TEST_SPREADSHEET_ID, testRange);
			expect(clearResult).toBeDefined();
			expect(clearResult.clearedRange).toBeDefined();

			// Verify cleared
			const readResult = await client.read(TEST_SPREADSHEET_ID, testRange);
			expect(readResult).toEqual([]);
		});
	});

	describe('Batch operations', () => {
		it('should perform batch reads', async () => {
			// Setup test data in different ranges
			await client.write(TEST_SPREADSHEET_ID, 'Sheet1!A10:B11', [
				['Batch1', 'Data1'],
				['Batch2', 'Data2'],
			]);
			await client.write(TEST_SPREADSHEET_ID, 'Sheet1!D10:E11', [
				['Batch3', 'Data3'],
				['Batch4', 'Data4'],
			]);

			// Batch read
			const ranges = ['Sheet1!A10:B11', 'Sheet1!D10:E11'];
			const results = await client.batchRead(TEST_SPREADSHEET_ID, ranges);

			expect(results).toHaveLength(2);
			expect(results[0]?.values).toEqual([
				['Batch1', 'Data1'],
				['Batch2', 'Data2'],
			]);
			expect(results[1]?.values).toEqual([
				['Batch3', 'Data3'],
				['Batch4', 'Data4'],
			]);
		});

		it('should perform batch writes', async () => {
			const operations = [
				{ range: 'Sheet1!A15:B16', values: [['BW1', 'BW2'], ['BW3', 'BW4']] },
				{ range: 'Sheet1!D15:E16', values: [['BW5', 'BW6'], ['BW7', 'BW8']] },
			];

			const result = await client.batchWrite(TEST_SPREADSHEET_ID, operations);
			expect(result).toBeDefined();

			// Verify writes
			const verifyResult = await client.batchRead(TEST_SPREADSHEET_ID, [
				'Sheet1!A15:B16',
				'Sheet1!D15:E16',
			]);
			expect(verifyResult[0]?.values).toEqual(operations[0]?.values);
			expect(verifyResult[1]?.values).toEqual(operations[1]?.values);
		});
	});

	describe('Plus package features', () => {
		it('should work with cache', async () => {
			const cachedClient = withCache(client, { ttlSeconds: 5 });

			// First read - hits API
			const start1 = Date.now();
			const data1 = await cachedClient.read(TEST_SPREADSHEET_ID, 'Sheet1!A1:A1');
			const time1 = Date.now() - start1;

			// Second read - uses cache (should be much faster)
			const start2 = Date.now();
			const data2 = await cachedClient.read(TEST_SPREADSHEET_ID, 'Sheet1!A1:A1');
			const time2 = Date.now() - start2;

			expect(data1).toEqual(data2);
			expect(time2).toBeLessThan(time1 / 2); // Cache should be much faster
		});

		it('should handle batch operations with manager', async () => {
			const batchOps = new BatchOperations(client);

			// Create many operations (more than single batch limit)
			const operations = Array.from({ length: 5 }, (_, i) => ({
				range: `Sheet1!A${20 + i}:B${20 + i}`,
				values: [[`Batch${i}`, `Value${i}`]],
			}));

			const results = await batchOps.batchWrite(TEST_SPREADSHEET_ID, operations);
			expect(results).toBeDefined();
			expect(results.length).toBeGreaterThan(0);

			// Verify all were written
			for (let i = 0; i < 5; i++) {
				const data = await client.read(TEST_SPREADSHEET_ID, `Sheet1!A${20 + i}:B${20 + i}`);
				expect(data[0]).toEqual([`Batch${i}`, `Value${i}`]);
			}
		});

		it('should parse and serialize data with type utilities', async () => {
			// Test A1 utilities
			expect(A1.columnToIndex('C')).toBe(2);
			expect(A1.indexToColumn(2)).toBe('C');
			expect(A1.build('Sheet1', 'A', 1, 'C', 3)).toBe('Sheet1!A1:C3');

			// Write test data
			const objects = [
				{ name: 'John', age: 30, city: 'Boston' },
				{ name: 'Jane', age: 25, city: 'Seattle' },
			];
			const rows = Serializers.objectsToRows(objects);

			await client.write(TEST_SPREADSHEET_ID, 'Sheet1!A30:C32', rows);

			// Read and parse back
			const readData = await client.read(TEST_SPREADSHEET_ID, 'Sheet1!A30:C32');
			const parsed = Parsers.rowsToObjects<typeof objects[0]>(readData);

			expect(parsed).toHaveLength(2);
			expect(parsed[0]?.name).toBe('John');
			expect(parsed[1]?.name).toBe('Jane');
		});
	});

	describe('Advanced package features', () => {
		it('should handle rate limiting gracefully', async () => {
			const rateLimitedClient = withAdaptiveRateLimit(client);

			// Perform multiple rapid requests
			const promises = Array.from({ length: 10 }, (_, i) =>
				rateLimitedClient.read(TEST_SPREADSHEET_ID, `Sheet1!A${40 + i}`)
			);

			// Should complete without errors despite rapid requests
			const results = await Promise.all(promises);
			expect(results).toHaveLength(10);
		});

		it('should collect metrics', async () => {
			const metricsClient = withMetrics(client);

			// Perform some operations
			await metricsClient.read(TEST_SPREADSHEET_ID, 'Sheet1!A50');
			await metricsClient.write(TEST_SPREADSHEET_ID, 'Sheet1!A51', [['Test']]);

			// Check metrics
			const metrics = metricsClient.metrics.getMetrics();
			expect(metrics.totalRequests).toBeGreaterThanOrEqual(2);
			expect(metrics.successfulRequests).toBeGreaterThanOrEqual(2);
			expect(metrics.averageLatency).toBeGreaterThan(0);

			const summary = metricsClient.metrics.getSummary();
			expect(summary.successRate).toBeGreaterThan(0.5);
		});
	});

	describe('Error handling', () => {
		it('should handle invalid spreadsheet ID gracefully', async () => {
			await expect(
				client.read('invalid-id', 'Sheet1!A1')
			).rejects.toThrow();
		});

		it('should handle invalid range gracefully', async () => {
			await expect(
				client.read(TEST_SPREADSHEET_ID, 'InvalidSheet!A1')
			).rejects.toThrow();
		});
	});

	afterAll(async () => {
		// Clean up test data
		try {
			await client.clear(TEST_SPREADSHEET_ID, 'Sheet1!A1:Z100');
		} catch {
			// Ignore cleanup errors
		}
	});
});