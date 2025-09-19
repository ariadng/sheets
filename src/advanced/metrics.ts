import { GoogleSheetsCore } from '../core';
import { GoogleSheetsError } from '../core/errors';

export interface Metrics {
	totalRequests: number;
	successfulRequests: number;
	failedRequests: number;
	retryCount: number;
	averageLatency: number;
	rateLimitHits: number;
	errorsByCode: Map<string | number, number>;
	requestsByMethod: Map<string, number>;
}

export class MetricsCollector {
	private metrics: Metrics = {
		totalRequests: 0,
		successfulRequests: 0,
		failedRequests: 0,
		retryCount: 0,
		averageLatency: 0,
		rateLimitHits: 0,
		errorsByCode: new Map(),
		requestsByMethod: new Map(),
	};

	private latencies: number[] = [];
	private readonly maxLatencySamples = 100;
	private startTime = Date.now();

	recordRequest(
		method: string,
		duration: number,
		success: boolean,
		retries = 0,
		error?: any
	): void {
		this.metrics.totalRequests++;

		// Track by method
		const currentCount = this.metrics.requestsByMethod.get(method) || 0;
		this.metrics.requestsByMethod.set(method, currentCount + 1);

		if (success) {
			this.metrics.successfulRequests++;
		} else {
			this.metrics.failedRequests++;

			// Track error codes
			if (error) {
				const code =
					error.code ||
					error.response?.status ||
					(error instanceof GoogleSheetsError ? error.code : 'unknown');
				const errorCount = this.metrics.errorsByCode.get(code) || 0;
				this.metrics.errorsByCode.set(code, errorCount + 1);

				// Track rate limit hits
				if (code === 429) {
					this.metrics.rateLimitHits++;
				}
			}
		}

		this.metrics.retryCount += retries;

		// Update average latency
		this.latencies.push(duration);
		if (this.latencies.length > this.maxLatencySamples) {
			this.latencies.shift();
		}

		this.metrics.averageLatency =
			this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
	}

	recordRateLimitHit(): void {
		this.metrics.rateLimitHits++;
	}

	getMetrics(): Readonly<Metrics> {
		return {
			...this.metrics,
			errorsByCode: new Map(this.metrics.errorsByCode),
			requestsByMethod: new Map(this.metrics.requestsByMethod),
		};
	}

	getSummary(): {
		totalRequests: number;
		successRate: number;
		averageLatency: number;
		rateLimitHits: number;
		uptimeSeconds: number;
		requestsPerSecond: number;
	} {
		const uptimeSeconds = (Date.now() - this.startTime) / 1000;
		const successRate =
			this.metrics.totalRequests > 0
				? this.metrics.successfulRequests / this.metrics.totalRequests
				: 0;

		return {
			totalRequests: this.metrics.totalRequests,
			successRate,
			averageLatency: this.metrics.averageLatency,
			rateLimitHits: this.metrics.rateLimitHits,
			uptimeSeconds,
			requestsPerSecond: this.metrics.totalRequests / uptimeSeconds,
		};
	}

	reset(): void {
		this.metrics = {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			retryCount: 0,
			averageLatency: 0,
			rateLimitHits: 0,
			errorsByCode: new Map(),
			requestsByMethod: new Map(),
		};
		this.latencies = [];
		this.startTime = Date.now();
	}
}

/**
 * Wrap client with metrics collection
 */
export function withMetrics(
	client: GoogleSheetsCore
): GoogleSheetsCore & { metrics: MetricsCollector } {
	const metrics = new MetricsCollector();
	const wrappedClient = Object.create(client) as GoogleSheetsCore & {
		metrics: MetricsCollector;
	};

	// Wrap all public methods that make API calls
	const methodsToWrap = [
		'read',
		'write',
		'append',
		'clear',
		'batchRead',
		'batchWrite',
		'batchClear',
		'getSpreadsheet',
	];

	for (const method of methodsToWrap) {
		const original = (client as any)[method];
		if (typeof original === 'function') {
			(wrappedClient as any)[method] = async function (...args: any[]) {
				const startTime = Date.now();
				let retries = 0;
				let lastError: any;

				// Try to execute with retries
				while (retries < 3) {
					try {
						const result = await original.apply(client, args);
						const duration = Date.now() - startTime;
						metrics.recordRequest(method, duration, true, retries);
						return result;
					} catch (error) {
						lastError = error;
						retries++;

						// Check if retryable
						const isRetryable =
							error instanceof GoogleSheetsError && error.isRetryable;

						if (!isRetryable || retries >= 3) {
							const duration = Date.now() - startTime;
							metrics.recordRequest(method, duration, false, retries - 1, error);
							throw error;
						}

						// Wait before retry
						await new Promise((r) => setTimeout(r, 1000 * retries));
					}
				}

				// Should never reach here, but for safety
				throw lastError;
			};
		}
	}

	// Add metrics property for manual access
	wrappedClient.metrics = metrics;

	return wrappedClient;
}

/**
 * Performance monitor for tracking operation performance
 */
export class PerformanceMonitor {
	private operations = new Map<
		string,
		{
			count: number;
			totalDuration: number;
			minDuration: number;
			maxDuration: number;
		}
	>();

	record(operation: string, duration: number): void {
		const current = this.operations.get(operation) || {
			count: 0,
			totalDuration: 0,
			minDuration: Infinity,
			maxDuration: 0,
		};

		current.count++;
		current.totalDuration += duration;
		current.minDuration = Math.min(current.minDuration, duration);
		current.maxDuration = Math.max(current.maxDuration, duration);

		this.operations.set(operation, current);
	}

	getStats(
		operation: string
	): {
		count: number;
		average: number;
		min: number;
		max: number;
	} | null {
		const stats = this.operations.get(operation);
		if (!stats) return null;

		return {
			count: stats.count,
			average: stats.totalDuration / stats.count,
			min: stats.minDuration,
			max: stats.maxDuration,
		};
	}

	getAllStats(): Map<
		string,
		{
			count: number;
			average: number;
			min: number;
			max: number;
		}
	> {
		const result = new Map();

		for (const [operation, stats] of this.operations) {
			result.set(operation, {
				count: stats.count,
				average: stats.totalDuration / stats.count,
				min: stats.minDuration,
				max: stats.maxDuration,
			});
		}

		return result;
	}

	reset(): void {
		this.operations.clear();
	}
}