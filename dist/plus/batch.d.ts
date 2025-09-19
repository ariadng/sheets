import { GoogleSheetsCore } from '../core';
import { sheets_v4 } from 'googleapis';
export interface BatchWriteOperation {
    range: string;
    values: any[][];
}
export declare class BatchOperations {
    private client;
    private readonly MAX_BATCH_SIZE;
    constructor(client: GoogleSheetsCore);
    batchWrite(spreadsheetId: string, operations: BatchWriteOperation[]): Promise<sheets_v4.Schema$BatchUpdateValuesResponse[]>;
    batchClear(spreadsheetId: string, ranges: string[]): Promise<sheets_v4.Schema$BatchClearValuesResponse[]>;
    batchRead(spreadsheetId: string, ranges: string[]): Promise<sheets_v4.Schema$ValueRange[]>;
    executeBatch(spreadsheetId: string, operations: {
        writes?: BatchWriteOperation[];
        clears?: string[];
        reads?: string[];
    }): Promise<{
        writeResults?: sheets_v4.Schema$BatchUpdateValuesResponse[];
        clearResults?: sheets_v4.Schema$BatchClearValuesResponse[];
        readResults?: sheets_v4.Schema$ValueRange[];
    }>;
    private chunk;
}
//# sourceMappingURL=batch.d.ts.map