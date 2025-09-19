import { GoogleSheetsCore } from '../core';
export declare class A1 {
    static columnToIndex(column: string): number;
    static indexToColumn(index: number): string;
    static parse(notation: string): {
        sheet?: string;
        startCol: string;
        startRow: number;
        endCol?: string;
        endRow?: number;
    };
    static build(sheet: string | undefined, startCol: string, startRow: number, endCol?: string, endRow?: number): string;
    static getDimensions(notation: string): {
        rows: number;
        columns: number;
    };
    static offset(notation: string, rowOffset: number, colOffset: number): string;
}
export declare class TypedSheets<T = any> {
    private client;
    constructor(client: GoogleSheetsCore);
    read(spreadsheetId: string, range: string, parser?: (data: any[][]) => T): Promise<T>;
    write(spreadsheetId: string, range: string, data: T, serializer?: (data: T) => any[][]): Promise<void>;
    append(spreadsheetId: string, range: string, data: T, serializer?: (data: T) => any[][]): Promise<void>;
}
export declare const Parsers: {
    rowsToObjects<T = any>(data: any[][]): T[];
    asNumbers(data: any[][]): number[][];
    asStrings(data: any[][]): string[][];
    asMap<V = any>(data: any[][]): Map<string, V>;
    column<T = any>(data: any[][], columnIndex?: number): T[];
};
export declare const Serializers: {
    objectsToRows<T extends Record<string, any>>(objects: T[], headers?: (keyof T)[]): any[][];
    mapToRows<K, V>(map: Map<K, V>): any[][];
    arrayToColumn<T>(array: T[]): any[][];
    transpose(data: any[][]): any[][];
};
//# sourceMappingURL=types.d.ts.map