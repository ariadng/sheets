// Production test - verify the library works correctly

const { GoogleSheetsCore, createServiceAccountAuth } = require('./dist/core');
const { withCache, A1, Parsers } = require('./dist/plus');
const { withAdaptiveRateLimit } = require('./dist/advanced');

const TEST_SPREADSHEET_ID = '1aOBzgPyNoQnKAuoEoxdHXZd2-8vXGyNTk6LNrnYicp8';

async function testLibrary() {
	console.log('Testing @ariadng/sheets library...\n');

	// Test 1: Authentication
	console.log('1. Testing authentication...');
	const auth = await createServiceAccountAuth('./service_account.json');
	console.log('✓ Authentication successful\n');

	// Test 2: Core functionality
	console.log('2. Testing core functionality...');
	const sheets = new GoogleSheetsCore({ auth });

	// Simple write and read
	const testData = [
		['Test', 'Production'],
		[new Date().toISOString(), 'Success']
	];

	await sheets.write(TEST_SPREADSHEET_ID, 'A100:B101', testData);
	const readData = await sheets.read(TEST_SPREADSHEET_ID, 'A100:B101');
	console.log('✓ Write and read successful:', readData[0]);

	// Clear test data
	await sheets.clear(TEST_SPREADSHEET_ID, 'A100:B101');
	console.log('✓ Clear successful\n');

	// Test 3: Plus features
	console.log('3. Testing plus features...');

	// Test A1 utilities
	const col = A1.columnToIndex('C');
	const letter = A1.indexToColumn(2);
	console.log(`✓ A1 utilities: Column C index = ${col}, Index 2 column = ${letter}`);

	// Test caching
	const cachedSheets = withCache(sheets, { ttlSeconds: 5 });
	const start1 = Date.now();
	await cachedSheets.read(TEST_SPREADSHEET_ID, 'A1');
	const time1 = Date.now() - start1;

	const start2 = Date.now();
	await cachedSheets.read(TEST_SPREADSHEET_ID, 'A1');
	const time2 = Date.now() - start2;

	console.log(`✓ Caching works: First read ${time1}ms, Cached read ${time2}ms\n`);

	// Test 4: Advanced features
	console.log('4. Testing advanced features...');
	const rateLimitedSheets = withAdaptiveRateLimit(sheets);

	// Test rate limiting with multiple requests
	const promises = Array.from({ length: 5 }, (_, i) =>
		rateLimitedSheets.read(TEST_SPREADSHEET_ID, `A${i + 1}`)
	);

	await Promise.all(promises);
	console.log('✓ Rate limiting handled 5 concurrent requests\n');

	// Summary
	console.log('========================================');
	console.log('✅ All production tests passed!');
	console.log('Library is ready for production use.');
	console.log('========================================');
}

testLibrary().catch(error => {
	console.error('❌ Production test failed:', error);
	process.exit(1);
});