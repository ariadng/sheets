import { GoogleSheetsCore } from '../core';
export interface CacheConfig {
    ttlSeconds?: number;
    maxEntries?: number;
}
export declare class SimpleCache {
    private cache;
    private config;
    constructor(config?: CacheConfig);
    get(key: string): any | null;
    set(key: string, value: any, ttlOverride?: number): void;
    invalidate(pattern?: string): void;
    size(): number;
    clear(): void;
}
export declare function withCache(client: GoogleSheetsCore, config?: CacheConfig): GoogleSheetsCore & {
    cache: SimpleCache;
};
//# sourceMappingURL=cache.d.ts.map