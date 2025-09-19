import { GoogleSheetsError } from '../errors';

describe('GoogleSheetsError', () => {
	it('should create error from API response', () => {
		const originalError = {
			response: {
				status: 403,
				data: {
					error: {
						message: 'Permission denied',
					},
				},
			},
		};

		const error = new GoogleSheetsError(originalError);

		expect(error.message).toBe('Permission denied');
		expect(error.code).toBe(403);
		expect(error.isRetryable).toBe(false);
		expect(error.isPermissionError()).toBe(true);
		expect(error.isRateLimitError()).toBe(false);
	});

	it('should identify retryable errors', () => {
		const testCases = [
			{ code: 429, expected: true },
			{ code: 500, expected: true },
			{ code: 503, expected: true },
			{ code: 'ECONNRESET', expected: true },
			{ code: 'ETIMEDOUT', expected: true },
			{ code: 403, expected: false },
			{ code: 404, expected: false },
		];

		testCases.forEach(({ code, expected }) => {
			const error = new GoogleSheetsError({ code });
			expect(error.isRetryable).toBe(expected);
		});
	});

	it('should provide user-friendly messages', () => {
		const permissionError = new GoogleSheetsError({
			response: { status: 403 },
		});
		expect(permissionError.getUserMessage()).toContain('Permission denied');

		const rateLimitError = new GoogleSheetsError({
			response: { status: 429 },
		});
		expect(rateLimitError.getUserMessage()).toContain('Rate limit exceeded');

		const notFoundError = new GoogleSheetsError({
			response: { status: 404 },
		});
		expect(notFoundError.getUserMessage()).toContain('not found');
	});

	it('should preserve original error stack trace', () => {
		const originalError = new Error('Original error');
		const wrappedError = new GoogleSheetsError(originalError);

		expect(wrappedError.stack).toBe(originalError.stack);
	});

	it('should handle errors without response data', () => {
		const error = new GoogleSheetsError({
			message: 'Network error',
			code: 'ECONNRESET',
		});

		expect(error.message).toBe('Network error');
		expect(error.code).toBe('ECONNRESET');
		expect(error.isRetryable).toBe(true);
	});

	it('should store original error', () => {
		const originalError = { foo: 'bar', message: 'test' };
		const error = new GoogleSheetsError(originalError);

		expect(error.originalError).toBe(originalError);
	});
});