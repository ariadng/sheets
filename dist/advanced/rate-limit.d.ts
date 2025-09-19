import { GoogleSheetsCore } from '../core';
export declare class AdaptiveRateLimiter {
    private successRate;
    private baseDelay;
    private requestTimes;
    private readonly windowMs;
    private readonly maxRequestsPerWindow;
    execute<T>(fn: () => Promise<T>): Promise<T>;
    getStats(): {
        requestsInWindow: number;
        successRate: number;
        baseDelay: number;
    };
    reset(): void;
}
export declare function withAdaptiveRateLimit(client: GoogleSheetsCore): GoogleSheetsCore;
export declare class TokenBucketRateLimiter {
    private tokens;
    private lastRefill;
    private readonly maxTokens;
    private readonly refillRate;
    constructor(maxTokens?: number, refillRate?: number);
    acquire(tokens?: number): Promise<void>;
    getAvailableTokens(): number;
}
export declare function withTokenBucketRateLimit(client: GoogleSheetsCore, maxTokens?: number, refillRate?: number): GoogleSheetsCore;
//# sourceMappingURL=rate-limit.d.ts.map