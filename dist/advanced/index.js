"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/advanced/index.ts
var advanced_exports = {};
__export(advanced_exports, {
  A1: () => A1,
  AdaptiveRateLimiter: () => AdaptiveRateLimiter,
  BatchOperations: () => BatchOperations,
  GoogleSheetsCore: () => GoogleSheetsCore,
  GoogleSheetsError: () => GoogleSheetsError,
  MetricsCollector: () => MetricsCollector,
  Parsers: () => Parsers,
  PerformanceMonitor: () => PerformanceMonitor,
  Serializers: () => Serializers,
  SimpleCache: () => SimpleCache,
  TokenBucketRateLimiter: () => TokenBucketRateLimiter,
  TypedSheets: () => TypedSheets,
  createAuth: () => createAuth,
  createOAuth2Client: () => createOAuth2Client,
  createServiceAccountAuth: () => createServiceAccountAuth,
  generateAuthUrl: () => generateAuthUrl,
  getTokenFromCode: () => getTokenFromCode,
  saveToken: () => saveToken,
  withAdaptiveRateLimit: () => withAdaptiveRateLimit,
  withCache: () => withCache,
  withMetrics: () => withMetrics,
  withTokenBucketRateLimit: () => withTokenBucketRateLimit
});
module.exports = __toCommonJS(advanced_exports);

// src/core/errors.ts
var GoogleSheetsError = class extends Error {
  constructor(originalError) {
    const message = originalError.response?.data?.error?.message || originalError.message || "Unknown error";
    super(message);
    this.name = "GoogleSheetsError";
    this.code = originalError.response?.status || originalError.code;
    this.originalError = originalError;
    const retryableCodes = [429, 500, 502, 503, 504, "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"];
    this.isRetryable = retryableCodes.includes(this.code);
    if (originalError.stack) {
      this.stack = originalError.stack;
    }
  }
  /**
   * Check if error is a rate limit error
   */
  isRateLimitError() {
    return this.code === 429;
  }
  /**
   * Check if error is a permission error
   */
  isPermissionError() {
    return this.code === 403;
  }
  /**
   * Check if error is a not found error
   */
  isNotFoundError() {
    return this.code === 404;
  }
  /**
   * Get a user-friendly error message
   */
  getUserMessage() {
    if (this.isPermissionError()) {
      return "Permission denied. Please ensure the spreadsheet is shared with the service account or you have proper OAuth permissions.";
    }
    if (this.isRateLimitError()) {
      return "Rate limit exceeded. Please wait before making more requests.";
    }
    if (this.isNotFoundError()) {
      return "Spreadsheet or range not found. Please check the ID and range are correct.";
    }
    return this.message;
  }
};

// src/advanced/rate-limit.ts
var AdaptiveRateLimiter = class {
  constructor() {
    this.successRate = 1;
    this.baseDelay = 0;
    this.requestTimes = [];
    this.windowMs = 1e5;
    // 100 seconds (Google's quota window)
    this.maxRequestsPerWindow = 90;
  }
  // Leave buffer below 100 limit
  async execute(fn) {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(
      (time) => time > now - this.windowMs
    );
    if (this.requestTimes.length >= this.maxRequestsPerWindow) {
      const oldestRequest = this.requestTimes[0];
      if (oldestRequest) {
        const waitTime = oldestRequest + this.windowMs - now;
        if (waitTime > 0) {
          await new Promise((r) => setTimeout(r, waitTime + 100));
        }
      }
    }
    if (this.baseDelay > 0) {
      await new Promise((r) => setTimeout(r, this.baseDelay));
    }
    try {
      const result = await fn();
      this.requestTimes.push(Date.now());
      this.successRate = Math.min(1, this.successRate * 1.05);
      this.baseDelay = Math.max(0, this.baseDelay - 10);
      return result;
    } catch (error) {
      const isRateLimit = error.code === 429 || error.response?.status === 429 || error instanceof GoogleSheetsError && error.isRateLimitError();
      if (isRateLimit) {
        this.successRate *= 0.5;
        this.baseDelay = Math.min(1e3, this.baseDelay + 200);
      }
      throw error;
    }
  }
  /**
   * Get current rate limiter stats
   */
  getStats() {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(
      (time) => time > now - this.windowMs
    );
    return {
      requestsInWindow: this.requestTimes.length,
      successRate: this.successRate,
      baseDelay: this.baseDelay
    };
  }
  /**
   * Reset rate limiter state
   */
  reset() {
    this.successRate = 1;
    this.baseDelay = 0;
    this.requestTimes = [];
  }
};
function withAdaptiveRateLimit(client) {
  const limiter = new AdaptiveRateLimiter();
  const wrappedClient = Object.create(client);
  const methodsToWrap = [
    "read",
    "write",
    "append",
    "clear",
    "batchRead",
    "batchWrite",
    "batchClear",
    "getSpreadsheet"
  ];
  for (const method of methodsToWrap) {
    const original = client[method];
    if (typeof original === "function") {
      wrappedClient[method] = function(...args) {
        return limiter.execute(() => original.apply(client, args));
      };
    }
  }
  return wrappedClient;
}
var TokenBucketRateLimiter = class {
  // tokens per second
  constructor(maxTokens = 100, refillRate = 1) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }
  async acquire(tokens = 1) {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1e3;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
    if (this.tokens < tokens) {
      const waitTime = (tokens - this.tokens) / this.refillRate * 1e3;
      await new Promise((r) => setTimeout(r, waitTime));
      return this.acquire(tokens);
    }
    this.tokens -= tokens;
  }
  getAvailableTokens() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1e3;
    const tokensToAdd = timePassed * this.refillRate;
    return Math.min(this.maxTokens, this.tokens + tokensToAdd);
  }
};
function withTokenBucketRateLimit(client, maxTokens = 100, refillRate = 1) {
  const limiter = new TokenBucketRateLimiter(maxTokens, refillRate);
  const wrappedClient = Object.create(client);
  const methodsToWrap = [
    "read",
    "write",
    "append",
    "clear",
    "batchRead",
    "batchWrite",
    "batchClear",
    "getSpreadsheet"
  ];
  for (const method of methodsToWrap) {
    const original = client[method];
    if (typeof original === "function") {
      wrappedClient[method] = async function(...args) {
        await limiter.acquire(1);
        return original.apply(client, args);
      };
    }
  }
  return wrappedClient;
}

// src/advanced/metrics.ts
var MetricsCollector = class {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retryCount: 0,
      averageLatency: 0,
      rateLimitHits: 0,
      errorsByCode: /* @__PURE__ */ new Map(),
      requestsByMethod: /* @__PURE__ */ new Map()
    };
    this.latencies = [];
    this.maxLatencySamples = 100;
    this.startTime = Date.now();
  }
  recordRequest(method, duration, success, retries = 0, error) {
    this.metrics.totalRequests++;
    const currentCount = this.metrics.requestsByMethod.get(method) || 0;
    this.metrics.requestsByMethod.set(method, currentCount + 1);
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      if (error) {
        const code = error.code || error.response?.status || (error instanceof GoogleSheetsError ? error.code : "unknown");
        const errorCount = this.metrics.errorsByCode.get(code) || 0;
        this.metrics.errorsByCode.set(code, errorCount + 1);
        if (code === 429) {
          this.metrics.rateLimitHits++;
        }
      }
    }
    this.metrics.retryCount += retries;
    this.latencies.push(duration);
    if (this.latencies.length > this.maxLatencySamples) {
      this.latencies.shift();
    }
    this.metrics.averageLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }
  recordRateLimitHit() {
    this.metrics.rateLimitHits++;
  }
  getMetrics() {
    return {
      ...this.metrics,
      errorsByCode: new Map(this.metrics.errorsByCode),
      requestsByMethod: new Map(this.metrics.requestsByMethod)
    };
  }
  getSummary() {
    const uptimeSeconds = (Date.now() - this.startTime) / 1e3;
    const successRate = this.metrics.totalRequests > 0 ? this.metrics.successfulRequests / this.metrics.totalRequests : 0;
    return {
      totalRequests: this.metrics.totalRequests,
      successRate,
      averageLatency: this.metrics.averageLatency,
      rateLimitHits: this.metrics.rateLimitHits,
      uptimeSeconds,
      requestsPerSecond: this.metrics.totalRequests / uptimeSeconds
    };
  }
  reset() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retryCount: 0,
      averageLatency: 0,
      rateLimitHits: 0,
      errorsByCode: /* @__PURE__ */ new Map(),
      requestsByMethod: /* @__PURE__ */ new Map()
    };
    this.latencies = [];
    this.startTime = Date.now();
  }
};
function withMetrics(client) {
  const metrics = new MetricsCollector();
  const wrappedClient = Object.create(client);
  const methodsToWrap = [
    "read",
    "write",
    "append",
    "clear",
    "batchRead",
    "batchWrite",
    "batchClear",
    "getSpreadsheet"
  ];
  for (const method of methodsToWrap) {
    const original = client[method];
    if (typeof original === "function") {
      wrappedClient[method] = async function(...args) {
        const startTime = Date.now();
        let retries = 0;
        let lastError;
        while (retries < 3) {
          try {
            const result = await original.apply(client, args);
            const duration = Date.now() - startTime;
            metrics.recordRequest(method, duration, true, retries);
            return result;
          } catch (error) {
            lastError = error;
            retries++;
            const isRetryable = error instanceof GoogleSheetsError && error.isRetryable;
            if (!isRetryable || retries >= 3) {
              const duration = Date.now() - startTime;
              metrics.recordRequest(method, duration, false, retries - 1, error);
              throw error;
            }
            await new Promise((r) => setTimeout(r, 1e3 * retries));
          }
        }
        throw lastError;
      };
    }
  }
  wrappedClient.metrics = metrics;
  return wrappedClient;
}
var PerformanceMonitor = class {
  constructor() {
    this.operations = /* @__PURE__ */ new Map();
  }
  record(operation, duration) {
    const current = this.operations.get(operation) || {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0
    };
    current.count++;
    current.totalDuration += duration;
    current.minDuration = Math.min(current.minDuration, duration);
    current.maxDuration = Math.max(current.maxDuration, duration);
    this.operations.set(operation, current);
  }
  getStats(operation) {
    const stats = this.operations.get(operation);
    if (!stats) return null;
    return {
      count: stats.count,
      average: stats.totalDuration / stats.count,
      min: stats.minDuration,
      max: stats.maxDuration
    };
  }
  getAllStats() {
    const result = /* @__PURE__ */ new Map();
    for (const [operation, stats] of this.operations) {
      result.set(operation, {
        count: stats.count,
        average: stats.totalDuration / stats.count,
        min: stats.minDuration,
        max: stats.maxDuration
      });
    }
    return result;
  }
  reset() {
    this.operations.clear();
  }
};

// src/plus/batch.ts
var BatchOperations = class {
  constructor(client) {
    this.client = client;
    // Google Sheets allows up to 100 operations per batch
    this.MAX_BATCH_SIZE = 100;
  }
  /**
   * Execute multiple write operations efficiently
   * Automatically splits into optimal batch sizes
   */
  async batchWrite(spreadsheetId, operations) {
    const batches = this.chunk(operations, this.MAX_BATCH_SIZE);
    const results = [];
    for (const batch of batches) {
      const result = await this.client.batchWrite(spreadsheetId, batch);
      results.push(result);
    }
    return results;
  }
  /**
   * Execute multiple clear operations efficiently
   */
  async batchClear(spreadsheetId, ranges) {
    const batches = this.chunk(ranges, this.MAX_BATCH_SIZE);
    const results = [];
    for (const batch of batches) {
      const result = await this.client.batchClear(spreadsheetId, batch);
      results.push(result);
    }
    return results;
  }
  /**
   * Execute multiple read operations efficiently
   */
  async batchRead(spreadsheetId, ranges) {
    const batches = this.chunk(ranges, this.MAX_BATCH_SIZE);
    const results = [];
    for (const batch of batches) {
      const batchResult = await this.client.batchRead(spreadsheetId, batch);
      results.push(...batchResult);
    }
    return results;
  }
  /**
   * Execute a mixed batch of operations
   */
  async executeBatch(spreadsheetId, operations) {
    const results = {};
    const promises = [];
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
  chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
};

// src/plus/cache.ts
var SimpleCache = class {
  constructor(config) {
    this.cache = /* @__PURE__ */ new Map();
    this.config = {
      ttlSeconds: config?.ttlSeconds ?? 60,
      maxEntries: config?.maxEntries ?? 100
    };
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }
  set(key, value, ttlOverride) {
    if (this.cache.size >= this.config.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    const ttl = ttlOverride ?? this.config.ttlSeconds;
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl * 1e3
    });
  }
  invalidate(pattern) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    const regex = new RegExp(pattern.replace("*", ".*"));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
  size() {
    return this.cache.size;
  }
  clear() {
    this.cache.clear();
  }
};
function withCache(client, config) {
  const cache = new SimpleCache(config);
  const wrappedClient = Object.create(client);
  const originalRead = client.read.bind(client);
  wrappedClient.read = async function(spreadsheetId, range) {
    const cacheKey = `${spreadsheetId}:${range}`;
    const cached = cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
    const result = await originalRead(spreadsheetId, range);
    cache.set(cacheKey, result);
    return result;
  };
  const originalBatchRead = client.batchRead.bind(client);
  wrappedClient.batchRead = async function(spreadsheetId, ranges) {
    const uncachedRanges = [];
    const cachedResults = /* @__PURE__ */ new Map();
    for (const range of ranges) {
      const cacheKey = `${spreadsheetId}:${range}`;
      const cached = cache.get(cacheKey);
      if (cached !== null) {
        cachedResults.set(range, {
          range,
          values: cached
        });
      } else {
        uncachedRanges.push(range);
      }
    }
    let freshResults = [];
    if (uncachedRanges.length > 0) {
      freshResults = await originalBatchRead(spreadsheetId, uncachedRanges);
      for (const result of freshResults) {
        if (result.range) {
          const cacheKey = `${spreadsheetId}:${result.range}`;
          cache.set(cacheKey, result.values || []);
        }
      }
    }
    const results = [];
    for (const range of ranges) {
      const cached = cachedResults.get(range);
      if (cached) {
        results.push(cached);
      } else {
        const fresh = freshResults.find((r) => r.range === range);
        if (fresh) {
          results.push(fresh);
        }
      }
    }
    return results;
  };
  const originalWrite = client.write.bind(client);
  wrappedClient.write = async function(spreadsheetId, range, values) {
    const result = await originalWrite(spreadsheetId, range, values);
    cache.invalidate(`${spreadsheetId}:${range}*`);
    return result;
  };
  const originalAppend = client.append.bind(client);
  wrappedClient.append = async function(spreadsheetId, range, values) {
    const result = await originalAppend(spreadsheetId, range, values);
    cache.invalidate(`${spreadsheetId}:*`);
    return result;
  };
  const originalClear = client.clear.bind(client);
  wrappedClient.clear = async function(spreadsheetId, range) {
    const result = await originalClear(spreadsheetId, range);
    cache.invalidate(`${spreadsheetId}:${range}*`);
    return result;
  };
  wrappedClient.cache = cache;
  return wrappedClient;
}

// src/plus/types.ts
var A1 = class _A1 {
  /**
   * Convert column letter to index (A=0, B=1, etc)
   */
  static columnToIndex(column) {
    let index = 0;
    for (let i = 0; i < column.length; i++) {
      index = index * 26 + (column.charCodeAt(i) - 64);
    }
    return index - 1;
  }
  /**
   * Convert index to column letter (0=A, 1=B, etc)
   */
  static indexToColumn(index) {
    let column = "";
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
  static parse(notation) {
    const match = notation.match(
      /^(?:(?:'([^']+)'|([^!]+))!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/
    );
    if (!match) {
      throw new Error(`Invalid A1 notation: ${notation}`);
    }
    const [, quotedSheet, unquotedSheet, startCol, startRow, endCol, endRow] = match;
    return {
      sheet: quotedSheet || unquotedSheet || void 0,
      startCol,
      startRow: parseInt(startRow, 10),
      endCol: endCol || void 0,
      endRow: endRow ? parseInt(endRow, 10) : void 0
    };
  }
  /**
   * Build A1 notation from components
   */
  static build(sheet, startCol, startRow, endCol, endRow) {
    let sheetPrefix = "";
    if (sheet) {
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
  static getDimensions(notation) {
    const parsed = _A1.parse(notation);
    const rows = parsed.endRow ? parsed.endRow - parsed.startRow + 1 : 1;
    const columns = parsed.endCol ? _A1.columnToIndex(parsed.endCol) - _A1.columnToIndex(parsed.startCol) + 1 : 1;
    return { rows, columns };
  }
  /**
   * Offset a range by rows and columns
   */
  static offset(notation, rowOffset, colOffset) {
    const parsed = _A1.parse(notation);
    const newStartCol = _A1.indexToColumn(
      _A1.columnToIndex(parsed.startCol) + colOffset
    );
    const newStartRow = parsed.startRow + rowOffset;
    if (newStartRow < 1) {
      throw new Error("Row offset results in invalid range");
    }
    let newEndCol;
    let newEndRow;
    if (parsed.endCol && parsed.endRow) {
      newEndCol = _A1.indexToColumn(
        _A1.columnToIndex(parsed.endCol) + colOffset
      );
      newEndRow = parsed.endRow + rowOffset;
      if (newEndRow < 1) {
        throw new Error("Row offset results in invalid range");
      }
    }
    return _A1.build(parsed.sheet, newStartCol, newStartRow, newEndCol, newEndRow);
  }
};
var TypedSheets = class {
  constructor(client) {
    this.client = client;
  }
  async read(spreadsheetId, range, parser) {
    const data = await this.client.read(spreadsheetId, range);
    return parser ? parser(data) : data;
  }
  async write(spreadsheetId, range, data, serializer) {
    const values = serializer ? serializer(data) : data;
    await this.client.write(spreadsheetId, range, values);
  }
  async append(spreadsheetId, range, data, serializer) {
    const values = serializer ? serializer(data) : data;
    await this.client.append(spreadsheetId, range, values);
  }
};
var Parsers = {
  /**
   * Parse rows as objects using first row as headers
   */
  rowsToObjects(data) {
    if (data.length < 2) return [];
    const [headers, ...rows] = data;
    return rows.map((row) => {
      const obj = {};
      headers?.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
  },
  /**
   * Parse as simple 2D array with type coercion to numbers
   */
  asNumbers(data) {
    return data.map((row) => row.map((cell) => parseFloat(cell) || 0));
  },
  /**
   * Parse as strings, handling empty cells
   */
  asStrings(data) {
    return data.map((row) => row.map((cell) => String(cell || "")));
  },
  /**
   * Parse as key-value pairs from two columns
   */
  asMap(data) {
    const map = /* @__PURE__ */ new Map();
    for (const row of data) {
      if (row.length >= 2) {
        map.set(String(row[0]), row[1]);
      }
    }
    return map;
  },
  /**
   * Parse single column as array
   */
  column(data, columnIndex = 0) {
    return data.map((row) => row[columnIndex]).filter((val) => val !== void 0);
  }
};
var Serializers = {
  /**
   * Convert objects to rows with headers
   */
  objectsToRows(objects, headers) {
    if (objects.length === 0) return [];
    const keys = headers || Object.keys(objects[0]);
    const headerRow = keys.map(String);
    const dataRows = objects.map((obj) => keys.map((key) => obj[key]));
    return [headerRow, ...dataRows];
  },
  /**
   * Convert Map to two-column format
   */
  mapToRows(map) {
    const rows = [];
    for (const [key, value] of map.entries()) {
      rows.push([key, value]);
    }
    return rows;
  },
  /**
   * Convert array to single column
   */
  arrayToColumn(array) {
    return array.map((item) => [item]);
  },
  /**
   * Transpose rows and columns
   */
  transpose(data) {
    if (data.length === 0) return [];
    const maxLength = Math.max(...data.map((row) => row.length));
    const result = [];
    for (let col = 0; col < maxLength; col++) {
      const newRow = [];
      for (let row = 0; row < data.length; row++) {
        newRow.push(data[row]?.[col] ?? "");
      }
      result.push(newRow);
    }
    return result;
  }
};

// src/core/client.ts
var import_googleapis = require("googleapis");
var GoogleSheetsCore = class {
  constructor(config) {
    this.sheets = import_googleapis.google.sheets({
      version: "v4",
      auth: config.auth
    });
    this.retryConfig = {
      maxAttempts: config.retryConfig?.maxAttempts ?? 3,
      maxDelay: config.retryConfig?.maxDelay ?? 1e4,
      initialDelay: config.retryConfig?.initialDelay ?? 1e3
    };
  }
  /**
   * Read values from a spreadsheet
   * @param spreadsheetId The spreadsheet ID
   * @param range A1 notation range (e.g., 'Sheet1!A1:B10')
   * @returns 2D array of values
   */
  async read(spreadsheetId, range) {
    return this.withRetry(async () => {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });
      return response.data.values || [];
    });
  }
  /**
   * Write values to a spreadsheet
   * @param spreadsheetId The spreadsheet ID
   * @param range A1 notation range
   * @param values 2D array of values to write
   */
  async write(spreadsheetId, range, values) {
    return this.withRetry(async () => {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values }
      });
      return response.data;
    });
  }
  /**
   * Append values to a spreadsheet
   */
  async append(spreadsheetId, range, values) {
    return this.withRetry(async () => {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values }
      });
      return response.data;
    });
  }
  /**
   * Clear values in a range
   */
  async clear(spreadsheetId, range) {
    return this.withRetry(async () => {
      const response = await this.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range
      });
      return response.data;
    });
  }
  /**
   * Batch read multiple ranges
   */
  async batchRead(spreadsheetId, ranges) {
    return this.withRetry(async () => {
      const response = await this.sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges
      });
      return response.data.valueRanges || [];
    });
  }
  /**
   * Batch update multiple ranges
   */
  async batchWrite(spreadsheetId, data) {
    return this.withRetry(async () => {
      const response = await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          data: data.map((item) => ({
            range: item.range,
            values: item.values
          })),
          valueInputOption: "USER_ENTERED"
        }
      });
      return response.data;
    });
  }
  /**
   * Batch clear multiple ranges
   */
  async batchClear(spreadsheetId, ranges) {
    return this.withRetry(async () => {
      const response = await this.sheets.spreadsheets.values.batchClear({
        spreadsheetId,
        requestBody: { ranges }
      });
      return response.data;
    });
  }
  /**
   * Get spreadsheet metadata
   */
  async getSpreadsheet(spreadsheetId) {
    return this.withRetry(async () => {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId
      });
      return response.data;
    });
  }
  /**
   * Get the underlying Sheets API instance for advanced usage
   */
  getApi() {
    return this.sheets;
  }
  /**
   * Simple exponential backoff retry logic
   */
  async withRetry(fn) {
    let lastError;
    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (!this.isRetryable(error) || attempt === this.retryConfig.maxAttempts - 1) {
          throw new GoogleSheetsError(error);
        }
        const baseDelay = Math.min(
          this.retryConfig.initialDelay * Math.pow(2, attempt),
          this.retryConfig.maxDelay
        );
        const jitter = Math.random() * 1e3;
        const delay = baseDelay + jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new GoogleSheetsError(lastError);
  }
  isRetryable(error) {
    const retryableCodes = [429, 500, 502, 503, 504];
    const retryableErrors = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"];
    return retryableCodes.includes(error.code) || retryableCodes.includes(error.response?.status) || retryableErrors.includes(error.code);
  }
};

// src/core/auth.ts
var import_google_auth_library = require("google-auth-library");
var fs = __toESM(require("fs/promises"));
async function createServiceAccountAuth(keyFile) {
  const key = typeof keyFile === "string" ? JSON.parse(await fs.readFile(keyFile, "utf8")) : keyFile;
  const jwt = new import_google_auth_library.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return jwt;
}
async function createOAuth2Client(credentials, tokenPath) {
  const client = new import_google_auth_library.OAuth2Client(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris[0]
  );
  if (tokenPath) {
    try {
      const token = JSON.parse(await fs.readFile(tokenPath, "utf8"));
      client.setCredentials(token);
    } catch {
    }
  }
  return client;
}
function generateAuthUrl(client, scopes = ["https://www.googleapis.com/auth/spreadsheets"]) {
  return client.generateAuthUrl({
    access_type: "offline",
    scope: scopes
  });
}
async function getTokenFromCode(client, code) {
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  return tokens;
}
async function saveToken(tokens, path) {
  await fs.writeFile(path, JSON.stringify(tokens, null, 2));
}
function createAuth(auth) {
  if (auth instanceof import_google_auth_library.GoogleAuth || auth instanceof import_google_auth_library.OAuth2Client || auth instanceof import_google_auth_library.JWT) {
    return auth;
  }
  return createServiceAccountAuth(auth);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  A1,
  AdaptiveRateLimiter,
  BatchOperations,
  GoogleSheetsCore,
  GoogleSheetsError,
  MetricsCollector,
  Parsers,
  PerformanceMonitor,
  Serializers,
  SimpleCache,
  TokenBucketRateLimiter,
  TypedSheets,
  createAuth,
  createOAuth2Client,
  createServiceAccountAuth,
  generateAuthUrl,
  getTokenFromCode,
  saveToken,
  withAdaptiveRateLimit,
  withCache,
  withMetrics,
  withTokenBucketRateLimit
});
