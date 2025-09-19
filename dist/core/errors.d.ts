export declare class GoogleSheetsError extends Error {
    code?: number | string;
    isRetryable: boolean;
    originalError?: any;
    constructor(originalError: any);
    isRateLimitError(): boolean;
    isPermissionError(): boolean;
    isNotFoundError(): boolean;
    getUserMessage(): string;
}
//# sourceMappingURL=errors.d.ts.map