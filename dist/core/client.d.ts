import { sheets_v4 } from 'googleapis';
import { GoogleAuth, OAuth2Client, JWT } from 'google-auth-library';
export interface GoogleSheetsConfig {
    auth: GoogleAuth | OAuth2Client | JWT;
    retryConfig?: {
        maxAttempts?: number;
        maxDelay?: number;
        initialDelay?: number;
    };
}
export interface RetryConfig {
    maxAttempts: number;
    maxDelay: number;
    initialDelay: number;
}
export declare class GoogleSheetsCore {
    private sheets;
    private retryConfig;
    constructor(config: GoogleSheetsConfig);
    read(spreadsheetId: string, range: string): Promise<any[][]>;
    write(spreadsheetId: string, range: string, values: any[][]): Promise<sheets_v4.Schema$UpdateValuesResponse>;
    append(spreadsheetId: string, range: string, values: any[][]): Promise<sheets_v4.Schema$AppendValuesResponse>;
    clear(spreadsheetId: string, range: string): Promise<sheets_v4.Schema$ClearValuesResponse>;
    batchRead(spreadsheetId: string, ranges: string[]): Promise<sheets_v4.Schema$ValueRange[]>;
    batchWrite(spreadsheetId: string, data: Array<{
        range: string;
        values: any[][];
    }>): Promise<sheets_v4.Schema$BatchUpdateValuesResponse>;
    batchClear(spreadsheetId: string, ranges: string[]): Promise<sheets_v4.Schema$BatchClearValuesResponse>;
    getSpreadsheet(spreadsheetId: string): Promise<sheets_v4.Schema$Spreadsheet>;
    getApi(): sheets_v4.Sheets;
    private withRetry;
    private isRetryable;
}
//# sourceMappingURL=client.d.ts.map