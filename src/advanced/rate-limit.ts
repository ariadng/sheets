import { GoogleSheetsCore } from '../core';
import { GoogleSheetsError } from '../core/errors';

export class AdaptiveRateLimiter {
	private successRate = 1.0;
	private baseDelay = 0;
	private requestTimes: number[] = [];
	private readonly windowMs = 100000; // 100 seconds (Google's quota window)
	private readonly maxRequestsPerWindow = 90; // Leave buffer below 100 limit

	async execute<T>(fn: () => Promise<T>): Promise<T> {
		// Clean old request times
		const now = Date.now();
		this.requestTimes = this.requestTimes.filter(
			(time) => time > now - this.windowMs
		);

		// Check if we're approaching limit
		if (this.requestTimes.length >= this.maxRequestsPerWindow) {
			// Wait until window slides
			const oldestRequest = this.requestTimes[0];
			if (oldestRequest) {
				const waitTime = oldestRequest + this.windowMs - now;
				if (waitTime > 0) {
					await new Promise((r) => setTimeout(r, waitTime + 100));
				}
			}
		}

		// Apply adaptive delay
		if (this.baseDelay > 0) {
			await new Promise((r) => setTimeout(r, this.baseDelay));
		}

		try {
			const result = await fn();

			// Success - gradually increase rate
			this.requestTimes.push(Date.now());
			this.successRate = Math.min(1.0, this.successRate * 1.05);
			this.baseDelay = Math.max(0, this.baseDelay - 10);

			return result;
		} catch (error: any) {
			// Check if it's a rate limit error
			const isRateLimit =
				error.code === 429 ||
				error.response?.status === 429 ||
				(error instanceof GoogleSheetsError && error.isRateLimitError());

			if (isRateLimit) {
				// Rate limited - immediately back off
				this.successRate *= 0.5;
				this.baseDelay = Math.min(1000, this.baseDelay + 200);
			}
			throw error;
		}
	}

	/**
	 * Get current rate limiter stats
	 */
	getStats(): {
		requestsInWindow: number;
		successRate: number;
		baseDelay: number;
	} {
		const now = Date.now();
		this.requestTimes = this.requestTimes.filter(
			(time) => time > now - this.windowMs
		);

		return {
			requestsInWindow: this.requestTimes.length,
			successRate: this.successRate,
			baseDelay: this.baseDelay,
		};
	}

	/**
	 * Reset rate limiter state
	 */
	reset(): void {
		this.successRate = 1.0;
		this.baseDelay = 0;
		this.requestTimes = [];
	}
}

/**
 * Wrap client with adaptive rate limiting
 */
export function withAdaptiveRateLimit(client: GoogleSheetsCore): GoogleSheetsCore {
	const limiter = new AdaptiveRateLimiter();
	const wrappedClient = Object.create(client) as GoogleSheetsCore;

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
			(wrappedClient as any)[method] = function (...args: any[]) {
				return limiter.execute(() => original.apply(client, args));
			};
		}
	}

	return wrappedClient;
}

/**
 * Simple token bucket rate limiter for predictable rate limiting
 */
export class TokenBucketRateLimiter {
	private tokens: number;
	private lastRefill: number;
	private readonly maxTokens: number;
	private readonly refillRate: number; // tokens per second

	constructor(maxTokens = 100, refillRate = 1) {
		this.maxTokens = maxTokens;
		this.tokens = maxTokens;
		this.refillRate = refillRate;
		this.lastRefill = Date.now();
	}

	async acquire(tokens = 1): Promise<void> {
		// Refill bucket
		const now = Date.now();
		const timePassed = (now - this.lastRefill) / 1000;
		const tokensToAdd = timePassed * this.refillRate;
		this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
		this.lastRefill = now;

		// Wait if not enough tokens
		if (this.tokens < tokens) {
			const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
			await new Promise((r) => setTimeout(r, waitTime));
			// Recursive call to re-check after waiting
			return this.acquire(tokens);
		}

		this.tokens -= tokens;
	}

	getAvailableTokens(): number {
		// Refill bucket
		const now = Date.now();
		const timePassed = (now - this.lastRefill) / 1000;
		const tokensToAdd = timePassed * this.refillRate;
		return Math.min(this.maxTokens, this.tokens + tokensToAdd);
	}
}

/**
 * Wrap client with token bucket rate limiting
 */
export function withTokenBucketRateLimit(
	client: GoogleSheetsCore,
	maxTokens = 100,
	refillRate = 1
): GoogleSheetsCore {
	const limiter = new TokenBucketRateLimiter(maxTokens, refillRate);
	const wrappedClient = Object.create(client) as GoogleSheetsCore;

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
				await limiter.acquire(1);
				return original.apply(client, args);
			};
		}
	}

	return wrappedClient;
}