import { A1, Parsers, Serializers } from '../types';

describe('A1 utilities', () => {
	describe('columnToIndex', () => {
		it('should convert column letters to index', () => {
			expect(A1.columnToIndex('A')).toBe(0);
			expect(A1.columnToIndex('B')).toBe(1);
			expect(A1.columnToIndex('Z')).toBe(25);
			expect(A1.columnToIndex('AA')).toBe(26);
			expect(A1.columnToIndex('AB')).toBe(27);
			expect(A1.columnToIndex('AZ')).toBe(51);
			expect(A1.columnToIndex('BA')).toBe(52);
		});
	});

	describe('indexToColumn', () => {
		it('should convert index to column letters', () => {
			expect(A1.indexToColumn(0)).toBe('A');
			expect(A1.indexToColumn(1)).toBe('B');
			expect(A1.indexToColumn(25)).toBe('Z');
			expect(A1.indexToColumn(26)).toBe('AA');
			expect(A1.indexToColumn(27)).toBe('AB');
			expect(A1.indexToColumn(51)).toBe('AZ');
			expect(A1.indexToColumn(52)).toBe('BA');
		});
	});

	describe('parse', () => {
		it('should parse simple cell notation', () => {
			const result = A1.parse('A1');
			expect(result).toEqual({
				sheet: undefined,
				startCol: 'A',
				startRow: 1,
				endCol: undefined,
				endRow: undefined,
			});
		});

		it('should parse range notation', () => {
			const result = A1.parse('A1:B10');
			expect(result).toEqual({
				sheet: undefined,
				startCol: 'A',
				startRow: 1,
				endCol: 'B',
				endRow: 10,
			});
		});

		it('should parse sheet with range', () => {
			const result = A1.parse('Sheet1!A1:B10');
			expect(result).toEqual({
				sheet: 'Sheet1',
				startCol: 'A',
				startRow: 1,
				endCol: 'B',
				endRow: 10,
			});
		});

		it('should parse quoted sheet names', () => {
			const result = A1.parse("'My Sheet'!A1:B10");
			expect(result).toEqual({
				sheet: 'My Sheet',
				startCol: 'A',
				startRow: 1,
				endCol: 'B',
				endRow: 10,
			});
		});

		it('should throw on invalid notation', () => {
			expect(() => A1.parse('invalid')).toThrow('Invalid A1 notation');
		});
	});

	describe('build', () => {
		it('should build single cell notation', () => {
			expect(A1.build(undefined, 'A', 1)).toBe('A1');
			expect(A1.build('Sheet1', 'B', 5)).toBe('Sheet1!B5');
		});

		it('should build range notation', () => {
			expect(A1.build(undefined, 'A', 1, 'B', 10)).toBe('A1:B10');
			expect(A1.build('Sheet1', 'A', 1, 'B', 10)).toBe('Sheet1!A1:B10');
		});

		it('should quote sheet names with spaces', () => {
			expect(A1.build('My Sheet', 'A', 1)).toBe("'My Sheet'!A1");
		});
	});

	describe('getDimensions', () => {
		it('should calculate dimensions of ranges', () => {
			expect(A1.getDimensions('A1')).toEqual({ rows: 1, columns: 1 });
			expect(A1.getDimensions('A1:B10')).toEqual({ rows: 10, columns: 2 });
			expect(A1.getDimensions('A1:Z10')).toEqual({ rows: 10, columns: 26 });
		});
	});

	describe('offset', () => {
		it('should offset single cell', () => {
			expect(A1.offset('B2', 1, 1)).toBe('C3');
			expect(A1.offset('A1', 0, 1)).toBe('B1');
		});

		it('should offset range', () => {
			expect(A1.offset('A1:B2', 1, 1)).toBe('B2:C3');
		});

		it('should preserve sheet name', () => {
			expect(A1.offset('Sheet1!A1:B2', 1, 1)).toBe('Sheet1!B2:C3');
		});

		it('should throw on invalid offset', () => {
			expect(() => A1.offset('A1', -1, 0)).toThrow('Row offset results in invalid range');
		});
	});
});

describe('Parsers', () => {
	describe('rowsToObjects', () => {
		it('should parse rows as objects using headers', () => {
			const data = [
				['name', 'age', 'city'],
				['Alice', 30, 'NYC'],
				['Bob', 25, 'LA'],
			];

			const result = Parsers.rowsToObjects(data);

			expect(result).toEqual([
				{ name: 'Alice', age: 30, city: 'NYC' },
				{ name: 'Bob', age: 25, city: 'LA' },
			]);
		});

		it('should handle empty data', () => {
			expect(Parsers.rowsToObjects([])).toEqual([]);
			expect(Parsers.rowsToObjects([['header']])).toEqual([]);
		});
	});

	describe('asNumbers', () => {
		it('should convert to numbers', () => {
			const data = [['1', '2.5'], ['3', '4.2'], ['invalid', '']];

			const result = Parsers.asNumbers(data);

			expect(result).toEqual([[1, 2.5], [3, 4.2], [0, 0]]);
		});
	});

	describe('asStrings', () => {
		it('should convert to strings', () => {
			const data = [[1, null], [true, undefined], ['text', '']];

			const result = Parsers.asStrings(data);

			expect(result).toEqual([
				['1', ''],
				['true', ''],
				['text', ''],
			]);
		});
	});

	describe('asMap', () => {
		it('should parse as key-value map', () => {
			const data = [['key1', 'value1'], ['key2', 'value2'], ['key3']];

			const result = Parsers.asMap(data);

			expect(result.get('key1')).toBe('value1');
			expect(result.get('key2')).toBe('value2');
			expect(result.has('key3')).toBe(false); // Skipped, no value
		});
	});

	describe('column', () => {
		it('should extract single column', () => {
			const data = [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']];

			expect(Parsers.column(data, 0)).toEqual(['A', 'D', 'G']);
			expect(Parsers.column(data, 1)).toEqual(['B', 'E', 'H']);
			expect(Parsers.column(data, 2)).toEqual(['C', 'F', 'I']);
		});

		it('should filter undefined values', () => {
			const data = [['A'], ['B', 'extra'], []];

			expect(Parsers.column(data, 0)).toEqual(['A', 'B']);
			expect(Parsers.column(data, 1)).toEqual(['extra']);
		});
	});
});

describe('Serializers', () => {
	describe('objectsToRows', () => {
		it('should convert objects to rows with headers', () => {
			const objects = [
				{ name: 'Alice', age: 30, city: 'NYC' },
				{ name: 'Bob', age: 25, city: 'LA' },
			];

			const result = Serializers.objectsToRows(objects);

			expect(result).toEqual([
				['name', 'age', 'city'],
				['Alice', 30, 'NYC'],
				['Bob', 25, 'LA'],
			]);
		});

		it('should use custom headers', () => {
			const objects = [
				{ name: 'Alice', age: 30, city: 'NYC' },
			];

			const result = Serializers.objectsToRows(objects, ['name', 'city']);

			expect(result).toEqual([
				['name', 'city'],
				['Alice', 'NYC'],
			]);
		});

		it('should handle empty array', () => {
			expect(Serializers.objectsToRows([])).toEqual([]);
		});
	});

	describe('mapToRows', () => {
		it('should convert Map to rows', () => {
			const map = new Map([
				['key1', 'value1'],
				['key2', 'value2'],
			]);

			const result = Serializers.mapToRows(map);

			expect(result).toEqual([
				['key1', 'value1'],
				['key2', 'value2'],
			]);
		});
	});

	describe('arrayToColumn', () => {
		it('should convert array to single column', () => {
			const array = ['A', 'B', 'C'];

			const result = Serializers.arrayToColumn(array);

			expect(result).toEqual([['A'], ['B'], ['C']]);
		});
	});

	describe('transpose', () => {
		it('should transpose rows and columns', () => {
			const data = [
				['A', 'B', 'C'],
				['D', 'E', 'F'],
			];

			const result = Serializers.transpose(data);

			expect(result).toEqual([
				['A', 'D'],
				['B', 'E'],
				['C', 'F'],
			]);
		});

		it('should handle uneven rows', () => {
			const data = [
				['A', 'B'],
				['C', 'D', 'E'],
				['F'],
			];

			const result = Serializers.transpose(data);

			expect(result).toEqual([
				['A', 'C', 'F'],
				['B', 'D', ''],
				['', 'E', ''],
			]);
		});

		it('should handle empty data', () => {
			expect(Serializers.transpose([])).toEqual([]);
		});
	});
});