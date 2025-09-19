import { SimpleCache, withCache } from '../cache';
import { GoogleSheetsCore } from '../../core';

describe('SimpleCache', () => {
	let cache: SimpleCache;

	beforeEach(() => {
		cache = new SimpleCache({ ttlSeconds: 60, maxEntries: 3 });
	});

	it('should store and retrieve values', () => {
		cache.set('key1', 'value1');
		expect(cache.get('key1')).toBe('value1');
	});

	it('should return null for non-existent keys', () => {
		expect(cache.get('nonexistent')).toBeNull();
	});

	it('should expire entries after TTL', async () => {
		cache.set('key1', 'value1', 0.1); // 100ms TTL
		expect(cache.get('key1')).toBe('value1');

		await new Promise((r) => setTimeout(r, 150));
		expect(cache.get('key1')).toBeNull();
	});

	it('should evict oldest entry when at max capacity', () => {
		cache.set('key1', 'value1');
		cache.set('key2', 'value2');
		cache.set('key3', 'value3');
		cache.set('key4', 'value4'); // Should evict key1

		expect(cache.get('key1')).toBeNull();
		expect(cache.get('key2')).toBe('value2');
		expect(cache.get('key3')).toBe('value3');
		expect(cache.get('key4')).toBe('value4');
		expect(cache.size()).toBe(3);
	});

	it('should invalidate by pattern', () => {
		cache.set('user:1', 'data1');
		cache.set('user:2', 'data2');
		cache.set('post:1', 'data3');

		cache.invalidate('user:*');

		expect(cache.get('user:1')).toBeNull();
		expect(cache.get('user:2')).toBeNull();
		expect(cache.get('post:1')).toBe('data3');
	});

	it('should clear all entries', () => {
		cache.set('key1', 'value1');
		cache.set('key2', 'value2');

		cache.clear();

		expect(cache.get('key1')).toBeNull();
		expect(cache.get('key2')).toBeNull();
		expect(cache.size()).toBe(0);
	});
});

describe('withCache wrapper', () => {
	let mockClient: jest.Mocked<GoogleSheetsCore>;
	let cachedClient: GoogleSheetsCore & { cache: SimpleCache };

	beforeEach(() => {
		// Create a mock client
		mockClient = {
			read: jest.fn(),
			write: jest.fn(),
			append: jest.fn(),
			clear: jest.fn(),
			batchRead: jest.fn(),
			batchWrite: jest.fn(),
			batchClear: jest.fn(),
			getSpreadsheet: jest.fn(),
			getApi: jest.fn(),
		} as any;

		cachedClient = withCache(mockClient, { ttlSeconds: 60 });
	});

	it('should cache read operations', async () => {
		const mockData = [['A', 'B'], ['C', 'D']];
		mockClient.read.mockResolvedValue(mockData);

		// First read - should hit API
		const result1 = await cachedClient.read('sheet1', 'A1:B2');
		expect(result1).toEqual(mockData);
		expect(mockClient.read).toHaveBeenCalledTimes(1);

		// Second read - should use cache
		const result2 = await cachedClient.read('sheet1', 'A1:B2');
		expect(result2).toEqual(mockData);
		expect(mockClient.read).toHaveBeenCalledTimes(1); // Still 1
	});

	it('should invalidate cache on write', async () => {
		const mockData = [['A', 'B']];
		mockClient.read.mockResolvedValue(mockData);
		mockClient.write.mockResolvedValue({} as any);

		// Read to populate cache
		await cachedClient.read('sheet1', 'A1:B1');

		// Write should invalidate cache
		await cachedClient.write('sheet1', 'A1:B1', [['X', 'Y']]);

		// Next read should hit API again
		await cachedClient.read('sheet1', 'A1:B1');
		expect(mockClient.read).toHaveBeenCalledTimes(2);
	});

	it('should cache batch read operations', async () => {
		const mockResults = [
			{ range: 'A1:B2', values: [['A', 'B']] },
			{ range: 'C1:D2', values: [['C', 'D']] },
		];
		mockClient.batchRead.mockResolvedValue(mockResults);

		// First batch read
		const result1 = await cachedClient.batchRead('sheet1', ['A1:B2', 'C1:D2']);
		expect(result1).toEqual(mockResults);
		expect(mockClient.batchRead).toHaveBeenCalledTimes(1);

		// Second read with partial overlap - should use cache for A1:B2
		mockClient.batchRead.mockResolvedValue([
			{ range: 'E1:F2', values: [['E', 'F']] },
		]);

		const result2 = await cachedClient.batchRead('sheet1', ['A1:B2', 'E1:F2']);
		expect(result2).toHaveLength(2);
		expect(mockClient.batchRead).toHaveBeenCalledWith('sheet1', ['E1:F2']);
	});

	it('should invalidate cache on append', async () => {
		mockClient.append.mockResolvedValue({} as any);

		// Populate cache
		cachedClient.cache.set('sheet1:A1:B2', [['cached']]);

		// Append should invalidate all ranges for spreadsheet
		await cachedClient.append('sheet1', 'A:B', [['new']]);

		expect(cachedClient.cache.get('sheet1:A1:B2')).toBeNull();
	});

	it('should provide direct cache access', () => {
		expect(cachedClient.cache).toBeDefined();
		expect(cachedClient.cache).toBeInstanceOf(SimpleCache);

		// Can manually control cache
		cachedClient.cache.set('manual', 'value');
		expect(cachedClient.cache.get('manual')).toBe('value');
		cachedClient.cache.clear();
		expect(cachedClient.cache.get('manual')).toBeNull();
	});
});