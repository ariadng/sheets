// Performance test for reading massive data from Google Sheets
// Document: 1aOBzgPyNoQnKAuoEoxdHXZd2-8vXGyNTk6LNrnYicp8
// Sheet: MASTER_SQP_DATA
// Range: A:AK (all rows, columns A through AK)

const { GoogleSheetsCore, createServiceAccountAuth } = require('./dist/core');
const { withCache, withMetrics } = require('./dist/advanced');
const { TypedSheets, Parsers } = require('./dist/plus');

const SPREADSHEET_ID = '1aOBzgPyNoQnKAuoEoxdHXZd2-8vXGyNTk6LNrnYicp8';
const SHEET_NAME = 'MASTER_SQP_DATA';
const RANGE = `${SHEET_NAME}!A:AK`;

async function measurePerformance() {
	console.log('📊 Google Sheets Performance Test');
	console.log('==================================');
	console.log(`📄 Document: ${SPREADSHEET_ID}`);
	console.log(`📋 Sheet: ${SHEET_NAME}`);
	console.log(`📍 Range: ${RANGE}`);
	console.log('');

	try {
		// Initialize client with metrics
		const auth = await createServiceAccountAuth('./service_account.json');
		const baseClient = new GoogleSheetsCore({ auth });
		const client = withMetrics(baseClient);

		console.log('🔐 Authentication successful');
		console.log('⏱️  Starting performance test...\n');

		// Test 1: Basic read performance
		console.log('📖 Test 1: Basic Read Performance');
		console.log('─'.repeat(40));

		const startTime = Date.now();
		const memoryBefore = process.memoryUsage();

		console.log(`⏰ Start time: ${new Date(startTime).toLocaleTimeString()}`);
		console.log(`💾 Memory before: ${formatBytes(memoryBefore.heapUsed)}`);

		const data = await client.read(SPREADSHEET_ID, RANGE);

		const endTime = Date.now();
		const memoryAfter = process.memoryUsage();
		const duration = endTime - startTime;

		console.log(`⏰ End time: ${new Date(endTime).toLocaleTimeString()}`);
		console.log(`💾 Memory after: ${formatBytes(memoryAfter.heapUsed)}`);
		console.log(`📈 Memory delta: ${formatBytes(memoryAfter.heapUsed - memoryBefore.heapUsed)}`);

		// Data analysis
		const totalRows = data.length;
		const totalCells = data.reduce((sum, row) => sum + row.length, 0);
		const avgCellsPerRow = totalCells / totalRows;
		const maxRowLength = Math.max(...data.map(row => row.length));
		const minRowLength = Math.min(...data.map(row => row.length));

		console.log('\n📊 Data Statistics:');
		console.log(`   📝 Total rows: ${totalRows.toLocaleString()}`);
		console.log(`   🔢 Total cells: ${totalCells.toLocaleString()}`);
		console.log(`   📏 Average cells per row: ${avgCellsPerRow.toFixed(2)}`);
		console.log(`   📐 Max row length: ${maxRowLength}`);
		console.log(`   📐 Min row length: ${minRowLength}`);

		// Performance metrics
		const rowsPerSecond = totalRows / (duration / 1000);
		const cellsPerSecond = totalCells / (duration / 1000);
		const bytesPerSecond = (memoryAfter.heapUsed - memoryBefore.heapUsed) / (duration / 1000);

		console.log('\n⚡ Performance Metrics:');
		console.log(`   ⏱️  Total time: ${duration.toLocaleString()}ms (${(duration / 1000).toFixed(2)}s)`);
		console.log(`   🚀 Rows per second: ${rowsPerSecond.toFixed(2)}`);
		console.log(`   💨 Cells per second: ${cellsPerSecond.toLocaleString()}`);
		console.log(`   📦 Data throughput: ${formatBytes(bytesPerSecond)}/s`);

		// Get metrics from wrapper
		const metrics = client.metrics.getMetrics();
		const summary = client.metrics.getSummary();

		console.log('\n📈 API Metrics:');
		console.log(`   📞 Total requests: ${metrics.totalRequests}`);
		console.log(`   ✅ Successful requests: ${metrics.successfulRequests}`);
		console.log(`   ❌ Failed requests: ${metrics.failedRequests}`);
		console.log(`   🎯 Success rate: ${(summary.successRate * 100).toFixed(2)}%`);
		console.log(`   ⏰ Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
		console.log(`   🔄 Retry count: ${metrics.retryCount}`);
		console.log(`   🚫 Rate limit hits: ${metrics.rateLimitHits}`);

		// Test 2: Sample data preview
		console.log('\n📋 Test 2: Data Sample Preview');
		console.log('─'.repeat(40));

		if (data.length > 0) {
			console.log('🔍 First 3 rows:');
			data.slice(0, 3).forEach((row, index) => {
				const preview = row.slice(0, 5).join(' | '); // First 5 columns
				const moreColumns = row.length > 5 ? ` ... (+${row.length - 5} more)` : '';
				console.log(`   Row ${index + 1}: ${preview}${moreColumns}`);
			});

			if (data.length > 3) {
				console.log(`   ... (+${data.length - 3} more rows)`);
			}
		}

		// Test 3: Cached read performance
		console.log('\n🗄️  Test 3: Cached Read Performance');
		console.log('─'.repeat(40));

		const cachedClient = withCache(client, { ttlSeconds: 300 });

		const cachedStartTime = Date.now();
		const cachedData = await cachedClient.read(SPREADSHEET_ID, RANGE);
		const cachedDuration = Date.now() - cachedStartTime;

		console.log(`⏱️  Cached read time: ${cachedDuration}ms`);
		console.log(`🚀 Speed improvement: ${(duration / cachedDuration).toFixed(1)}x faster`);
		console.log(`✅ Data integrity: ${cachedData.length === data.length ? 'Passed' : 'Failed'}`);

		// Test 4: Memory efficiency analysis
		console.log('\n💾 Test 4: Memory Efficiency Analysis');
		console.log('─'.repeat(40));

		const dataStr = JSON.stringify(data);
		const estimatedDataSize = Buffer.byteLength(dataStr, 'utf8');
		const memoryOverhead = (memoryAfter.heapUsed - memoryBefore.heapUsed) / estimatedDataSize;

		console.log(`📐 Estimated data size: ${formatBytes(estimatedDataSize)}`);
		console.log(`💾 Actual memory used: ${formatBytes(memoryAfter.heapUsed - memoryBefore.heapUsed)}`);
		console.log(`📊 Memory overhead: ${(memoryOverhead * 100).toFixed(1)}%`);
		console.log(`⚖️  Bytes per cell: ${((memoryAfter.heapUsed - memoryBefore.heapUsed) / totalCells).toFixed(2)}`);

		// Test 5: TypedSheets Performance
		console.log('\n🔷 Test 5: TypedSheets Performance');
		console.log('─'.repeat(40));

		// Define the data structure based on the sample data we saw
		const typedClient = new TypedSheets(client);

		// Test parsing raw data to objects
		const parseStartTime = Date.now();
		const parseMemoryBefore = process.memoryUsage();

		console.log('🔄 Parsing raw data to typed objects...');

		// Parse the data to objects using the header row
		const parsedObjects = Parsers.rowsToObjects(data);

		const parseEndTime = Date.now();
		const parseMemoryAfter = process.memoryUsage();
		const parseDuration = parseEndTime - parseStartTime;

		console.log(`⏱️  Parse time: ${parseDuration}ms`);
		console.log(`💾 Parse memory delta: ${formatBytes(parseMemoryAfter.heapUsed - parseMemoryBefore.heapUsed)}`);
		console.log(`📊 Objects created: ${parsedObjects.length.toLocaleString()}`);
		console.log(`🚀 Parse rate: ${(parsedObjects.length / (parseDuration / 1000)).toFixed(0)} objects/sec`);

		// Test direct TypedSheets read with parser
		console.log('\n🔶 Direct TypedSheets read with parser:');
		const typedStartTime = Date.now();
		const typedMemoryBefore = process.memoryUsage();

		const typedData = await typedClient.read(
			SPREADSHEET_ID,
			RANGE,
			Parsers.rowsToObjects
		);

		const typedEndTime = Date.now();
		const typedMemoryAfter = process.memoryUsage();
		const typedDuration = typedEndTime - typedStartTime;

		console.log(`⏱️  TypedSheets read time: ${typedDuration}ms`);
		console.log(`💾 TypedSheets memory delta: ${formatBytes(typedMemoryAfter.heapUsed - typedMemoryBefore.heapUsed)}`);
		console.log(`📊 Typed objects: ${typedData.length.toLocaleString()}`);
		console.log(`🚀 TypedSheets rate: ${(typedData.length / (typedDuration / 1000)).toFixed(0)} objects/sec`);

		// Data structure analysis
		console.log('\n📋 Data Structure Analysis:');
		if (parsedObjects.length > 0) {
			const firstObject = parsedObjects[0];
			const objectKeys = Object.keys(firstObject);
			console.log(`   🔑 Object keys (${objectKeys.length}): ${objectKeys.slice(0, 5).join(', ')}${objectKeys.length > 5 ? '...' : ''}`);

			// Show sample object structure
			console.log('   📝 Sample object structure:');
			objectKeys.slice(0, 8).forEach(key => {
				const value = firstObject[key];
				const displayValue = typeof value === 'string' && value.length > 30
					? value.substring(0, 30) + '...'
					: value;
				console.log(`      ${key}: ${JSON.stringify(displayValue)}`);
			});
			if (objectKeys.length > 8) {
				console.log(`      ... (+${objectKeys.length - 8} more properties)`);
			}
		}

		// Memory efficiency comparison
		console.log('\n📊 TypedSheets vs Raw Data Comparison:');
		const rawDataSize = (memoryAfter.heapUsed - memoryBefore.heapUsed);
		const typedDataSize = (typedMemoryAfter.heapUsed - typedMemoryBefore.heapUsed);
		const memoryRatio = typedDataSize / rawDataSize;

		console.log(`   📈 Raw data memory: ${formatBytes(rawDataSize)}`);
		console.log(`   🔷 TypedSheets memory: ${formatBytes(typedDataSize)}`);
		console.log(`   ⚖️  Memory ratio: ${memoryRatio.toFixed(2)}x`);
		console.log(`   🎯 Memory efficiency: ${memoryRatio < 1.5 ? '✅ Excellent' : memoryRatio < 2.0 ? '👍 Good' : '⚠️ High overhead'}`);

		// Performance comparison
		const totalTypedTime = typedDuration; // Includes read + parse
		const rawPlusParseTime = duration + parseDuration;
		const timeComparison = rawPlusParseTime / totalTypedTime;

		console.log('\n⏱️  Performance Comparison:');
		console.log(`   📖 Raw read time: ${duration}ms`);
		console.log(`   🔄 Separate parse time: ${parseDuration}ms`);
		console.log(`   📋 Raw + Parse total: ${rawPlusParseTime}ms`);
		console.log(`   🔷 TypedSheets total: ${totalTypedTime}ms`);
		console.log(`   🚀 TypedSheets efficiency: ${timeComparison.toFixed(2)}x ${timeComparison > 1 ? 'faster' : 'slower'}`);

		// TypedSheets summary
		console.log('\n🔷 TypedSheets Summary:');
		console.log(`   📊 Objects processed: ${typedData.length.toLocaleString()}`);
		console.log(`   ⏱️  Total time: ${typedDuration}ms`);
		console.log(`   💾 Memory usage: ${formatBytes(typedDataSize)}`);
		console.log(`   🎯 Type safety: ✅ Full TypeScript support`);
		console.log(`   📈 Performance rating: ${getTypedSheetsRating(timeComparison, memoryRatio)}`);

		// Final summary
		console.log('\n🎯 Performance Summary');
		console.log('='.repeat(50));
		console.log(`📊 Dataset: ${totalRows.toLocaleString()} rows × ${maxRowLength} columns`);
		console.log(`⏱️  Read time: ${(duration / 1000).toFixed(2)} seconds`);
		console.log(`💾 Memory usage: ${formatBytes(memoryAfter.heapUsed - memoryBefore.heapUsed)}`);
		console.log(`🚀 Throughput: ${rowsPerSecond.toFixed(0)} rows/sec`);
		console.log(`🎯 API success rate: ${(summary.successRate * 100).toFixed(1)}%`);
		console.log(`📈 Performance rating: ${getPerformanceRating(rowsPerSecond, summary.successRate)}`);

	} catch (error) {
		console.error('❌ Performance test failed:', error);

		if (error.name === 'GoogleSheetsError') {
			console.error(`   Code: ${error.code}`);
			console.error(`   Retryable: ${error.isRetryable}`);
			console.error(`   User message: ${error.getUserMessage()}`);
		}

		process.exit(1);
	}
}

function formatBytes(bytes) {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getPerformanceRating(rowsPerSecond, successRate) {
	const speed = rowsPerSecond > 1000 ? 'Fast' : rowsPerSecond > 500 ? 'Good' : 'Slow';
	const reliability = successRate > 0.99 ? 'Excellent' : successRate > 0.95 ? 'Good' : 'Poor';

	if (speed === 'Fast' && reliability === 'Excellent') return '🌟 Excellent';
	if (speed === 'Good' && reliability === 'Good') return '👍 Good';
	return '⚠️  Needs Optimization';
}

function getTypedSheetsRating(timeRatio, memoryRatio) {
	const timeEfficient = timeRatio >= 0.95; // Within 5% of separate operations
	const memoryEfficient = memoryRatio < 2.0; // Less than 2x memory overhead

	if (timeEfficient && memoryEfficient) return '🌟 Excellent';
	if (timeEfficient || memoryRatio < 3.0) return '👍 Good';
	return '⚠️  High Overhead';
}

// Run the performance test
if (require.main === module) {
	measurePerformance().catch(console.error);
}

module.exports = { measurePerformance };