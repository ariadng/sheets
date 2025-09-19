import { GoogleSheetsCore } from '../core';

/**
 * A1 Notation utilities
 */
export class A1 {
	/**
	 * Convert column letter to index (A=0, B=1, etc)
	 */
	static columnToIndex(column: string): number {
		let index = 0;
		for (let i = 0; i < column.length; i++) {
			index = index * 26 + (column.charCodeAt(i) - 64);
		}
		return index - 1;
	}

	/**
	 * Convert index to column letter (0=A, 1=B, etc)
	 */
	static indexToColumn(index: number): string {
		let column = '';
		index++;
		while (index > 0) {
			const remainder = (index - 1) % 26;
			column = String.fromCharCode(65 + remainder) + column;
			index = Math.floor((index - 1) / 26);
		}
		return column;
	}

	/**
	 * Parse A1 notation to components
	 */
	static parse(notation: string): {
		sheet?: string;
		startCol: string;
		startRow: number;
		endCol?: string;
		endRow?: number;
	} {
		// Match pattern: 'Sheet Name'!A1:B2 or Sheet1!A1:B2 or A1:B2
		const match = notation.match(
			/^(?:(?:'([^']+)'|([^!]+))!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/
		);

		if (!match) {
			throw new Error(`Invalid A1 notation: ${notation}`);
		}

		const [, quotedSheet, unquotedSheet, startCol, startRow, endCol, endRow] = match;

		return {
			sheet: quotedSheet || unquotedSheet || undefined,
			startCol: startCol!,
			startRow: parseInt(startRow!, 10),
			endCol: endCol || undefined,
			endRow: endRow ? parseInt(endRow, 10) : undefined,
		};
	}

	/**
	 * Build A1 notation from components
	 */
	static build(
		sheet: string | undefined,
		startCol: string,
		startRow: number,
		endCol?: string,
		endRow?: number
	): string {
		let sheetPrefix = '';
		if (sheet) {
			// Quote sheet name if it contains spaces or special characters
			sheetPrefix = /[^a-zA-Z0-9]/.test(sheet) ? `'${sheet}'!` : `${sheet}!`;
		}

		const start = `${startCol}${startRow}`;

		if (endCol && endRow) {
			return `${sheetPrefix}${start}:${endCol}${endRow}`;
		}

		return `${sheetPrefix}${start}`;
	}

	/**
	 * Get range dimensions
	 */
	static getDimensions(notation: string): {
		rows: number;
		columns: number;
	} {
		const parsed = A1.parse(notation);

		const rows = parsed.endRow
			? parsed.endRow - parsed.startRow + 1
			: 1;

		const columns = parsed.endCol
			? A1.columnToIndex(parsed.endCol) - A1.columnToIndex(parsed.startCol) + 1
			: 1;

		return { rows, columns };
	}

	/**
	 * Offset a range by rows and columns
	 */
	static offset(
		notation: string,
		rowOffset: number,
		colOffset: number
	): string {
		const parsed = A1.parse(notation);

		const newStartCol = A1.indexToColumn(
			A1.columnToIndex(parsed.startCol) + colOffset
		);
		const newStartRow = parsed.startRow + rowOffset;

		if (newStartRow < 1) {
			throw new Error('Row offset results in invalid range');
		}

		let newEndCol: string | undefined;
		let newEndRow: number | undefined;

		if (parsed.endCol && parsed.endRow) {
			newEndCol = A1.indexToColumn(
				A1.columnToIndex(parsed.endCol) + colOffset
			);
			newEndRow = parsed.endRow + rowOffset;

			if (newEndRow < 1) {
				throw new Error('Row offset results in invalid range');
			}
		}

		return A1.build(parsed.sheet, newStartCol, newStartRow, newEndCol, newEndRow);
	}
}

/**
 * Type-safe wrapper for known data structures
 */
export class TypedSheets<T = any> {
	constructor(private client: GoogleSheetsCore) {}

	async read(
		spreadsheetId: string,
		range: string,
		parser?: (data: any[][]) => T
	): Promise<T> {
		const data = await this.client.read(spreadsheetId, range);
		return parser ? parser(data) : (data as any as T);
	}

	async write(
		spreadsheetId: string,
		range: string,
		data: T,
		serializer?: (data: T) => any[][]
	): Promise<void> {
		const values = serializer ? serializer(data) : (data as any as any[][]);
		await this.client.write(spreadsheetId, range, values);
	}

	async append(
		spreadsheetId: string,
		range: string,
		data: T,
		serializer?: (data: T) => any[][]
	): Promise<void> {
		const values = serializer ? serializer(data) : (data as any as any[][]);
		await this.client.append(spreadsheetId, range, values);
	}
}

/**
 * Common parsers for spreadsheet data
 */
export const Parsers = {
	/**
	 * Parse rows as objects using first row as headers
	 */
	rowsToObjects<T = any>(data: any[][]): T[] {
		if (data.length < 2) return [];

		const [headers, ...rows] = data;
		return rows.map((row) => {
			const obj: any = {};
			headers?.forEach((header, i) => {
				obj[header] = row[i];
			});
			return obj as T;
		});
	},

	/**
	 * Parse as simple 2D array with type coercion to numbers
	 */
	asNumbers(data: any[][]): number[][] {
		return data.map((row) => row.map((cell) => parseFloat(cell) || 0));
	},

	/**
	 * Parse as strings, handling empty cells
	 */
	asStrings(data: any[][]): string[][] {
		return data.map((row) => row.map((cell) => String(cell || '')));
	},

	/**
	 * Parse as key-value pairs from two columns
	 */
	asMap<V = any>(data: any[][]): Map<string, V> {
		const map = new Map<string, V>();
		for (const row of data) {
			if (row.length >= 2) {
				map.set(String(row[0]), row[1] as V);
			}
		}
		return map;
	},

	/**
	 * Parse single column as array
	 */
	column<T = any>(data: any[][], columnIndex = 0): T[] {
		return data.map((row) => row[columnIndex] as T).filter((val) => val !== undefined);
	},
};

/**
 * Common serializers for converting data to spreadsheet format
 */
export const Serializers = {
	/**
	 * Convert objects to rows with headers
	 */
	objectsToRows<T extends Record<string, any>>(
		objects: T[],
		headers?: (keyof T)[]
	): any[][] {
		if (objects.length === 0) return [];

		const keys = headers || (Object.keys(objects[0]!) as (keyof T)[]);
		const headerRow = keys.map(String);
		const dataRows = objects.map((obj) => keys.map((key) => obj[key]));

		return [headerRow, ...dataRows];
	},

	/**
	 * Convert Map to two-column format
	 */
	mapToRows<K, V>(map: Map<K, V>): any[][] {
		const rows: any[][] = [];
		for (const [key, value] of map.entries()) {
			rows.push([key, value]);
		}
		return rows;
	},

	/**
	 * Convert array to single column
	 */
	arrayToColumn<T>(array: T[]): any[][] {
		return array.map((item) => [item]);
	},

	/**
	 * Transpose rows and columns
	 */
	transpose(data: any[][]): any[][] {
		if (data.length === 0) return [];

		const maxLength = Math.max(...data.map((row) => row.length));
		const result: any[][] = [];

		for (let col = 0; col < maxLength; col++) {
			const newRow: any[] = [];
			for (let row = 0; row < data.length; row++) {
				newRow.push(data[row]?.[col] ?? '');
			}
			result.push(newRow);
		}

		return result;
	},
};