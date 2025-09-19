import { GoogleSheetsCore } from '../core';
import { sheets_v4 } from 'googleapis';

export interface BatchWriteOperation {
	range: string;
	values: any[][];
}

export class BatchOperations {
	// Google Sheets allows up to 100 operations per batch
	private readonly MAX_BATCH_SIZE = 100;

	constructor(private client: GoogleSheetsCore) {}

	/**
	 * Execute multiple write operations efficiently
	 * Automatically splits into optimal batch sizes
	 */
	async batchWrite(
		spreadsheetId: string,
		operations: BatchWriteOperation[]
	): Promise<sheets_v4.Schema$BatchUpdateValuesResponse[]> {
		const batches = this.chunk(operations, this.MAX_BATCH_SIZE);
		const results: sheets_v4.Schema$BatchUpdateValuesResponse[] = [];

		for (const batch of batches) {
			const result = await this.client.batchWrite(spreadsheetId, batch);
			results.push(result);
		}

		return results;
	}

	/**
	 * Execute multiple clear operations efficiently
	 */
	async batchClear(
		spreadsheetId: string,
		ranges: string[]
	): Promise<sheets_v4.Schema$BatchClearValuesResponse[]> {
		const batches = this.chunk(ranges, this.MAX_BATCH_SIZE);
		const results: sheets_v4.Schema$BatchClearValuesResponse[] = [];

		for (const batch of batches) {
			const result = await this.client.batchClear(spreadsheetId, batch);
			results.push(result);
		}

		return results;
	}

	/**
	 * Execute multiple read operations efficiently
	 */
	async batchRead(
		spreadsheetId: string,
		ranges: string[]
	): Promise<sheets_v4.Schema$ValueRange[]> {
		const batches = this.chunk(ranges, this.MAX_BATCH_SIZE);
		const results: sheets_v4.Schema$ValueRange[] = [];

		for (const batch of batches) {
			const batchResult = await this.client.batchRead(spreadsheetId, batch);
			results.push(...batchResult);
		}

		return results;
	}

	/**
	 * Execute a mixed batch of operations
	 */
	async executeBatch(
		spreadsheetId: string,
		operations: {
			writes?: BatchWriteOperation[];
			clears?: string[];
			reads?: string[];
		}
	): Promise<{
		writeResults?: sheets_v4.Schema$BatchUpdateValuesResponse[];
		clearResults?: sheets_v4.Schema$BatchClearValuesResponse[];
		readResults?: sheets_v4.Schema$ValueRange[];
	}> {
		const results: {
			writeResults?: sheets_v4.Schema$BatchUpdateValuesResponse[];
			clearResults?: sheets_v4.Schema$BatchClearValuesResponse[];
			readResults?: sheets_v4.Schema$ValueRange[];
		} = {};

		// Execute operations in parallel when possible
		const promises: Promise<void>[] = [];

		if (operations.writes) {
			promises.push(
				this.batchWrite(spreadsheetId, operations.writes).then((r) => {
					results.writeResults = r;
				})
			);
		}

		if (operations.clears) {
			promises.push(
				this.batchClear(spreadsheetId, operations.clears).then((r) => {
					results.clearResults = r;
				})
			);
		}

		if (operations.reads) {
			promises.push(
				this.batchRead(spreadsheetId, operations.reads).then((r) => {
					results.readResults = r;
				})
			);
		}

		await Promise.all(promises);
		return results;
	}

	/**
	 * Helper to chunk arrays into smaller batches
	 */
	private chunk<T>(array: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += size) {
			chunks.push(array.slice(i, i + size));
		}
		return chunks;
	}
}