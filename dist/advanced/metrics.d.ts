import { GoogleSheetsCore } from '../core';
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
export declare class MetricsCollector {
    private metrics;
    private latencies;
    private readonly maxLatencySamples;
    private startTime;
    recordRequest(method: string, duration: number, success: boolean, retries?: number, error?: any): void;
    recordRateLimitHit(): void;
    getMetrics(): Readonly<Metrics>;
    getSummary(): {
        totalRequests: number;
        successRate: number;
        averageLatency: number;
        rateLimitHits: number;
        uptimeSeconds: number;
        requestsPerSecond: number;
    };
    reset(): void;
}
export declare function withMetrics(client: GoogleSheetsCore): GoogleSheetsCore & {
    metrics: MetricsCollector;
};
export declare class PerformanceMonitor {
    private operations;
    record(operation: string, duration: number): void;
    getStats(operation: string): {
        count: number;
        average: number;
        min: number;
        max: number;
    } | null;
    getAllStats(): Map<string, {
        count: number;
        average: number;
        min: number;
        max: number;
    }>;
    reset(): void;
}
//# sourceMappingURL=metrics.d.ts.map