import { GoogleSheetsCore } from '../core';
import { sheets_v4 } from 'googleapis';

export interface CacheConfig {
	ttlSeconds?: number; // Default: 60
	maxEntries?: number; // Default: 100
}

interface CacheEntry {
	value: any;
	expiry: number;
}

export class SimpleCache {
	private cache = new Map<string, CacheEntry>();
	private config: Required<CacheConfig>;

	constructor(config?: CacheConfig) {
		this.config = {
			ttlSeconds: config?.ttlSeconds ?? 60,
			maxEntries: config?.maxEntries ?? 100,
		};
	}

	get(key: string): any | null {
		const entry = this.cache.get(key);

		if (!entry) return null;

		if (Date.now() > entry.expiry) {
			this.cache.delete(key);
			return null;
		}

		return entry.value;
	}

	set(key: string, value: any, ttlOverride?: number): void {
		// Evict oldest if at capacity
		if (this.cache.size >= this.config.maxEntries) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey) {
				this.cache.delete(firstKey);
			}
		}

		const ttl = ttlOverride ?? this.config.ttlSeconds;
		this.cache.set(key, {
			value,
			expiry: Date.now() + ttl * 1000,
		});
	}

	invalidate(pattern?: string): void {
		if (!pattern) {
			this.cache.clear();
			return;
		}

		// Simple wildcard support
		const regex = new RegExp(pattern.replace('*', '.*'));
		for (const key of this.cache.keys()) {
			if (regex.test(key)) {
				this.cache.delete(key);
			}
		}
	}

	size(): number {
		return this.cache.size;
	}

	clear(): void {
		this.cache.clear();
	}
}

/**
 * Wrapper to add caching to GoogleSheetsCore
 */
export function withCache(
	client: GoogleSheetsCore,
	config?: CacheConfig
): GoogleSheetsCore & { cache: SimpleCache } {
	const cache = new SimpleCache(config);
	const wrappedClient = Object.create(client) as GoogleSheetsCore & { cache: SimpleCache };

	// Override read method to use cache
	const originalRead = client.read.bind(client);
	wrappedClient.read = async function (
		spreadsheetId: string,
		range: string
	): Promise<any[][]> {
		const cacheKey = `${spreadsheetId}:${range}`;

		const cached = cache.get(cacheKey);
		if (cached !== null) {
			return cached;
		}

		const result = await originalRead(spreadsheetId, range);
		cache.set(cacheKey, result);
		return result;
	};

	// Override batchRead method to use cache
	const originalBatchRead = client.batchRead.bind(client);
	wrappedClient.batchRead = async function (
		spreadsheetId: string,
		ranges: string[]
	): Promise<sheets_v4.Schema$ValueRange[]> {
		const uncachedRanges: string[] = [];
		const cachedResults = new Map<string, sheets_v4.Schema$ValueRange>();

		// Check cache for each range
		for (const range of ranges) {
			const cacheKey = `${spreadsheetId}:${range}`;
			const cached = cache.get(cacheKey);
			if (cached !== null) {
				cachedResults.set(range, {
					range,
					values: cached,
				});
			} else {
				uncachedRanges.push(range);
			}
		}

		// Fetch uncached ranges
		let freshResults: sheets_v4.Schema$ValueRange[] = [];
		if (uncachedRanges.length > 0) {
			freshResults = await originalBatchRead(spreadsheetId, uncachedRanges);
			// Cache the fresh results
			for (const result of freshResults) {
				if (result.range) {
					const cacheKey = `${spreadsheetId}:${result.range}`;
					cache.set(cacheKey, result.values || []);
				}
			}
		}

		// Combine cached and fresh results in original order
		const results: sheets_v4.Schema$ValueRange[] = [];
		for (const range of ranges) {
			const cached = cachedResults.get(range);
			if (cached) {
				results.push(cached);
			} else {
				const fresh = freshResults.find((r) => r.range === range);
				if (fresh) {
					results.push(fresh);
				}
			}
		}

		return results;
	};

	// Override write methods to invalidate cache
	const originalWrite = client.write.bind(client);
	wrappedClient.write = async function (
		spreadsheetId: string,
		range: string,
		values: any[][]
	): Promise<sheets_v4.Schema$UpdateValuesResponse> {
		const result = await originalWrite(spreadsheetId, range, values);
		// Invalidate cache for this range
		cache.invalidate(`${spreadsheetId}:${range}*`);
		return result;
	};

	const originalAppend = client.append.bind(client);
	wrappedClient.append = async function (
		spreadsheetId: string,
		range: string,
		values: any[][]
	): Promise<sheets_v4.Schema$AppendValuesResponse> {
		const result = await originalAppend(spreadsheetId, range, values);
		// Invalidate cache for this spreadsheet
		cache.invalidate(`${spreadsheetId}:*`);
		return result;
	};

	const originalClear = client.clear.bind(client);
	wrappedClient.clear = async function (
		spreadsheetId: string,
		range: string
	): Promise<sheets_v4.Schema$ClearValuesResponse> {
		const result = await originalClear(spreadsheetId, range);
		// Invalidate cache for this range
		cache.invalidate(`${spreadsheetId}:${range}*`);
		return result;
	};

	// Add cache property for manual control
	wrappedClient.cache = cache;

	return wrappedClient;
}