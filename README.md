# Sheets

A pragmatic TypeScript client for Google Sheets API v4 with stellar performance, that provides essential features without over-engineering. Start simple and add complexity only when needed.

## Features

- **Progressive Enhancement** - Start with core features, add more as needed
- **Modular Packages** - Core (~3KB), Plus (~5KB), Advanced (~2KB)
- **Smart Retry Logic** - Exponential backoff with jitter
- **Optional Caching** - Reduce API calls with configurable TTL
- **Type Safety** - Full TypeScript support with type utilities
- **Rate Limiting** - Adaptive or token bucket strategies
- **Metrics Collection** - Track performance and errors
- **Batch Operations** - Efficient bulk reads/writes

## Installation

```bash
# Core package only
npm install @ariadng/sheets

# With specific packages
npm install @ariadng/sheets
```

## Quick Start

### Basic Usage

```typescript
import { GoogleSheetsCore, createServiceAccountAuth } from '@ariadng/sheets/core';

// Setup with service account
const auth = await createServiceAccountAuth('./service-account-key.json');
const sheets = new GoogleSheetsCore({ auth });

// Simple read
const data = await sheets.read('spreadsheetId', 'Sheet1!A1:B10');
console.log(data); // [[value1, value2], [value3, value4], ...]

// Simple write
await sheets.write('spreadsheetId', 'Sheet1!A1:B2', [
  ['Name', 'Score'],
  ['Alice', 100]
]);
```

### With Caching

```typescript
import { withCache } from '@ariadng/sheets/plus';

const cachedSheets = withCache(sheets, {
  ttlSeconds: 300 // 5-minute cache
});

// First read hits API
const data1 = await cachedSheets.read(id, 'A1:B10');

// Second read uses cache (within 5 minutes)
const data2 = await cachedSheets.read(id, 'A1:B10'); // Much faster!
```

### With Rate Limiting

```typescript
import { withAdaptiveRateLimit } from '@ariadng/sheets/advanced';

const rateLimitedSheets = withAdaptiveRateLimit(sheets);

// Automatically handles rate limits
for (let i = 0; i < 1000; i++) {
  await rateLimitedSheets.read(id, `A${i}`);
  // Automatically slows down if hitting limits
}
```

## Authentication

### Service Account

```typescript
import { createServiceAccountAuth } from '@ariadng/sheets/core';

// From file
const auth = await createServiceAccountAuth('./service-account.json');

// From object
const auth = await createServiceAccountAuth({
  client_email: 'your-service-account@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----...',
  // ... other fields
});
```

### OAuth2

```typescript
import { createOAuth2Client, generateAuthUrl, getTokenFromCode } from '@ariadng/sheets/core';

const client = await createOAuth2Client({
  client_id: 'your-client-id',
  client_secret: 'your-client-secret',
  redirect_uris: ['http://localhost:3000/callback']
});

// Generate auth URL
const authUrl = generateAuthUrl(client);
console.log('Visit:', authUrl);

// After user authorizes, exchange code for token
const tokens = await getTokenFromCode(client, authorizationCode);
```

## Core Features

### CRUD Operations

```typescript
// Read
const values = await sheets.read(spreadsheetId, 'Sheet1!A1:C10');

// Write (replaces existing data)
await sheets.write(spreadsheetId, 'Sheet1!A1:C3', [
  ['Header1', 'Header2', 'Header3'],
  ['Value1', 'Value2', 'Value3']
]);

// Append (adds to end)
await sheets.append(spreadsheetId, 'Sheet1!A:C', [
  ['New1', 'New2', 'New3']
]);

// Clear
await sheets.clear(spreadsheetId, 'Sheet1!A1:C10');
```

### Batch Operations

```typescript
// Batch read multiple ranges
const results = await sheets.batchRead(spreadsheetId, [
  'Sheet1!A1:B10',
  'Sheet2!C1:D5'
]);

// Batch write multiple ranges
await sheets.batchWrite(spreadsheetId, [
  { range: 'Sheet1!A1:B2', values: [['A', 'B'], ['C', 'D']] },
  { range: 'Sheet2!A1:B2', values: [['E', 'F'], ['G', 'H']] }
]);
```

## Plus Package Features

### Type Utilities

```typescript
import { A1, TypedSheets, Parsers, Serializers } from '@ariadng/sheets/plus';

// A1 notation utilities
const col = A1.columnToIndex('C'); // 2
const letter = A1.indexToColumn(2); // 'C'
const range = A1.build('Sheet1', 'A', 1, 'C', 10); // 'Sheet1!A1:C10'

// Type-safe operations
interface User {
  name: string;
  email: string;
  age: number;
}

const typed = new TypedSheets<User[]>(sheets);
const users = await typed.read(
  spreadsheetId,
  'Users!A1:C100',
  Parsers.rowsToObjects<User>
);

// Data transformation
const objects = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
];
const rows = Serializers.objectsToRows(objects);
// [['name', 'age'], ['Alice', 30], ['Bob', 25]]
```

### Batch Operations Manager

```typescript
import { BatchOperations } from '@ariadng/sheets/plus';

const batchOps = new BatchOperations(sheets);

// Automatically chunks large batches
const operations = Array.from({ length: 500 }, (_, i) => ({
  range: `Sheet1!A${i}:B${i}`,
  values: [[`Row${i}`, `Value${i}`]]
}));

await batchOps.batchWrite(spreadsheetId, operations); // Handles chunking
```

### Simple Cache

```typescript
import { SimpleCache } from '@ariadng/sheets/plus';

const cache = new SimpleCache({
  ttlSeconds: 60,
  maxEntries: 100
});

cache.set('key', data);
const cached = cache.get('key');
cache.invalidate('pattern*'); // Wildcard invalidation
cache.clear(); // Clear all
```

## Advanced Package Features

### Adaptive Rate Limiting

```typescript
import { AdaptiveRateLimiter } from '@ariadng/sheets/advanced';

const limiter = new AdaptiveRateLimiter();

// Automatically adjusts delay based on success/failure
await limiter.execute(async () => {
  return sheets.read(id, range);
});

// Get current stats
const stats = limiter.getStats();
console.log(stats); // { requestsInWindow: 45, successRate: 0.98, baseDelay: 0 }
```

### Metrics Collection

```typescript
import { withMetrics } from '@ariadng/sheets/advanced';

const metricsSheets = withMetrics(sheets);

// Use normally
await metricsSheets.read(id, range);
await metricsSheets.write(id, range, values);

// Get metrics
const metrics = metricsSheets.metrics.getMetrics();
console.log(metrics);
// {
//   totalRequests: 150,
//   successfulRequests: 148,
//   failedRequests: 2,
//   averageLatency: 123.5,
//   rateLimitHits: 1,
//   errorsByCode: Map { 429 => 1, 500 => 1 }
// }

const summary = metricsSheets.metrics.getSummary();
console.log(summary);
// {
//   successRate: 0.987,
//   requestsPerSecond: 2.5,
//   uptimeSeconds: 60
// }
```

## Error Handling

```typescript
import { GoogleSheetsError } from '@ariadng/sheets/core';

try {
  await sheets.read(spreadsheetId, range);
} catch (error) {
  if (error instanceof GoogleSheetsError) {
    console.error(`API Error ${error.code}: ${error.message}`);

    if (error.isRetryable) {
      console.log('This error is retryable');
    }

    if (error.isPermissionError()) {
      console.log('Share the sheet with service account');
    }

    if (error.isRateLimitError()) {
      console.log('Hit rate limit, slow down');
    }

    // User-friendly message
    console.log(error.getUserMessage());
  }
}
```

## Common Patterns

### Progressive Enhancement

```typescript
import { GoogleSheetsCore } from '@ariadng/sheets/core';
import { withCache } from '@ariadng/sheets/plus';
import { withAdaptiveRateLimit, withMetrics } from '@ariadng/sheets/advanced';

// Start simple
let sheets = new GoogleSheetsCore({ auth });

// Add features as needed
sheets = withCache(sheets, { ttlSeconds: 300 });
sheets = withAdaptiveRateLimit(sheets);
sheets = withMetrics(sheets);

// Now have all features!
```

### Data Processing Pipeline

```typescript
import { Parsers, Serializers } from '@ariadng/sheets/plus';

// Read raw data
const raw = await sheets.read(id, 'Data!A1:Z1000');

// Parse to objects
const records = Parsers.rowsToObjects(raw);

// Process data
const processed = records
  .filter(r => r.status === 'active')
  .map(r => ({ ...r, processed: true }));

// Convert back to rows
const rows = Serializers.objectsToRows(processed);

// Write back
await sheets.write(id, 'Processed!A1', rows);
```

### Efficient Batch Processing

```typescript
import { BatchOperations } from '@ariadng/sheets/plus';

const batch = new BatchOperations(sheets);

// Mixed operations
const results = await batch.executeBatch(spreadsheetId, {
  reads: ['Summary!A1:Z1', 'Config!A1:B10'],
  writes: [
    { range: 'Output!A1:B100', values: outputData }
  ],
  clears: ['Temp!A:Z']
});

// All executed efficiently in parallel when possible
```

## API Reference

### Core Package

#### GoogleSheetsCore

- `constructor(config: GoogleSheetsConfig)`
- `read(spreadsheetId: string, range: string): Promise<any[][]>`
- `write(spreadsheetId: string, range: string, values: any[][]): Promise<UpdateValuesResponse>`
- `append(spreadsheetId: string, range: string, values: any[][]): Promise<AppendValuesResponse>`
- `clear(spreadsheetId: string, range: string): Promise<ClearValuesResponse>`
- `batchRead(spreadsheetId: string, ranges: string[]): Promise<ValueRange[]>`
- `batchWrite(spreadsheetId: string, data: BatchWriteData[]): Promise<BatchUpdateValuesResponse>`
- `getSpreadsheet(spreadsheetId: string): Promise<Spreadsheet>`
- `getApi(): sheets_v4.Sheets`

### Plus Package

#### A1 Utilities

- `A1.columnToIndex(column: string): number`
- `A1.indexToColumn(index: number): string`
- `A1.parse(notation: string): A1Components`
- `A1.build(sheet?, startCol, startRow, endCol?, endRow?): string`
- `A1.getDimensions(notation: string): { rows: number, columns: number }`
- `A1.offset(notation: string, rowOffset: number, colOffset: number): string`

#### Parsers

- `Parsers.rowsToObjects<T>(data: any[][]): T[]`
- `Parsers.asNumbers(data: any[][]): number[][]`
- `Parsers.asStrings(data: any[][]): string[][]`
- `Parsers.asMap<V>(data: any[][]): Map<string, V>`
- `Parsers.column<T>(data: any[][], columnIndex: number): T[]`

#### Serializers

- `Serializers.objectsToRows<T>(objects: T[], headers?: string[]): any[][]`
- `Serializers.mapToRows<K,V>(map: Map<K,V>): any[][]`
- `Serializers.arrayToColumn<T>(array: T[]): any[][]`
- `Serializers.transpose(data: any[][]): any[][]`

## Performance

| Operation | Base Latency | With Cache | With Rate Limit |
|-----------|-------------|------------|-----------------|
| Single Read | 100-200ms | 0-1ms (hit) | +0-50ms |
| Batch Read (10) | 150-250ms | 0-1ms (hit) | +0-50ms |
| Single Write | 150-300ms | N/A | +0-50ms |
| Batch Write (100) | 300-500ms | N/A | +0-100ms |

## Best Practices

1. **Use batch operations** when reading/writing multiple ranges
2. **Enable caching** for frequently read, rarely changed data
3. **Add rate limiting** for bulk operations or scripts
4. **Use type utilities** for better type safety and code clarity
5. **Handle errors gracefully** with proper retry logic
6. **Monitor with metrics** in production environments

## Requirements

- Node.js 14+
- Google Sheets API enabled in Google Cloud Console
- Service account or OAuth2 credentials

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and feature requests, please use the [GitHub issues page](https://github.com/ariadng/sheets/issues).