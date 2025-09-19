/**
 * Error wrapper for better error handling with Google Sheets API
 */
export class GoogleSheetsError extends Error {
	public code?: number | string;
	public isRetryable: boolean;
	public originalError?: any;

	constructor(originalError: any) {
		const message =
			originalError.response?.data?.error?.message ||
			originalError.message ||
			'Unknown error';

		super(message);
		this.name = 'GoogleSheetsError';
		this.code = originalError.response?.status || originalError.code;
		this.originalError = originalError;

		// Determine if error is retryable
		const retryableCodes = [429, 500, 502, 503, 504, 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
		this.isRetryable = retryableCodes.includes(this.code as any);

		// Preserve stack trace
		if (originalError.stack) {
			this.stack = originalError.stack;
		}
	}

	/**
	 * Check if error is a rate limit error
	 */
	isRateLimitError(): boolean {
		return this.code === 429;
	}

	/**
	 * Check if error is a permission error
	 */
	isPermissionError(): boolean {
		return this.code === 403;
	}

	/**
	 * Check if error is a not found error
	 */
	isNotFoundError(): boolean {
		return this.code === 404;
	}

	/**
	 * Get a user-friendly error message
	 */
	getUserMessage(): string {
		if (this.isPermissionError()) {
			return 'Permission denied. Please ensure the spreadsheet is shared with the service account or you have proper OAuth permissions.';
		}
		if (this.isRateLimitError()) {
			return 'Rate limit exceeded. Please wait before making more requests.';
		}
		if (this.isNotFoundError()) {
			return 'Spreadsheet or range not found. Please check the ID and range are correct.';
		}
		return this.message;
	}
}