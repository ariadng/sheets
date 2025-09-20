import { GoogleAuth, OAuth2Client, JWT } from 'google-auth-library';
import * as fs from 'fs/promises';

export interface ServiceAccountKey {
	type: string;
	project_id: string;
	private_key_id: string;
	private_key: string;
	client_email: string;
	client_id: string;
	auth_uri: string;
	token_uri: string;
	auth_provider_x509_cert_url: string;
	client_x509_cert_url: string;
    universe_domain?: string;
}

export interface OAuth2Credentials {
	client_id: string;
	client_secret: string;
	redirect_uris: string[];
}

export interface OAuth2Token {
	access_token?: string | null;
	refresh_token?: string | null;
	scope?: string;
	token_type?: string | null;
	expiry_date?: number | null;
}

/**
 * Create auth from service account key file or object
 */
export async function createServiceAccountAuth(
	keyFile: string | ServiceAccountKey
): Promise<JWT> {
	const key =
		typeof keyFile === 'string'
			? JSON.parse(await fs.readFile(keyFile, 'utf8'))
			: keyFile;

	const jwt = new JWT({
		email: key.client_email,
		key: key.private_key,
		scopes: ['https://www.googleapis.com/auth/spreadsheets'],
	});

	return jwt;
}

/**
 * Create OAuth2 client with optional token caching
 */
export async function createOAuth2Client(
	credentials: OAuth2Credentials,
	tokenPath?: string
): Promise<OAuth2Client> {
	const client = new OAuth2Client(
		credentials.client_id,
		credentials.client_secret,
		credentials.redirect_uris[0]
	);

	// Try to load existing token
	if (tokenPath) {
		try {
			const token = JSON.parse(await fs.readFile(tokenPath, 'utf8')) as OAuth2Token;
			client.setCredentials(token);
		} catch {
			// No token file, user needs to authorize
		}
	}

	return client;
}

/**
 * Generate authorization URL for OAuth2
 */
export function generateAuthUrl(
	client: OAuth2Client,
	scopes: string[] = ['https://www.googleapis.com/auth/spreadsheets']
): string {
	return client.generateAuthUrl({
		access_type: 'offline',
		scope: scopes,
	});
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokenFromCode(
	client: OAuth2Client,
	code: string
): Promise<OAuth2Token> {
	const { tokens } = await client.getToken(code);
	client.setCredentials(tokens);
	return tokens;
}

/**
 * Save tokens to file for persistence
 */
export async function saveToken(tokens: OAuth2Token, path: string): Promise<void> {
	await fs.writeFile(path, JSON.stringify(tokens, null, 2));
}

/**
 * Create GoogleAuth instance from various auth types
 */
export function createAuth(
	auth: GoogleAuth | OAuth2Client | JWT | ServiceAccountKey | string
): GoogleAuth | OAuth2Client | JWT | Promise<JWT> {
	if (auth instanceof GoogleAuth || auth instanceof OAuth2Client || auth instanceof JWT) {
		return auth;
	}
	return createServiceAccountAuth(auth);
}