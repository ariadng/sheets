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

// src/core/index.ts
var core_exports = {};
__export(core_exports, {
  GoogleSheetsCore: () => GoogleSheetsCore,
  GoogleSheetsError: () => GoogleSheetsError,
  createAuth: () => createAuth,
  createOAuth2Client: () => createOAuth2Client,
  createServiceAccountAuth: () => createServiceAccountAuth,
  generateAuthUrl: () => generateAuthUrl,
  getTokenFromCode: () => getTokenFromCode,
  saveToken: () => saveToken
});
module.exports = __toCommonJS(core_exports);

// src/core/client.ts
var import_googleapis = require("googleapis");

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

// src/core/client.ts
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
  GoogleSheetsCore,
  GoogleSheetsError,
  createAuth,
  createOAuth2Client,
  createServiceAccountAuth,
  generateAuthUrl,
  getTokenFromCode,
  saveToken
});
