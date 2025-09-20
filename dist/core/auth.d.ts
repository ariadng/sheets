import { GoogleAuth, OAuth2Client, JWT } from 'google-auth-library';
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
export declare function createServiceAccountAuth(keyFile: string | ServiceAccountKey): Promise<JWT>;
export declare function createOAuth2Client(credentials: OAuth2Credentials, tokenPath?: string): Promise<OAuth2Client>;
export declare function generateAuthUrl(client: OAuth2Client, scopes?: string[]): string;
export declare function getTokenFromCode(client: OAuth2Client, code: string): Promise<OAuth2Token>;
export declare function saveToken(tokens: OAuth2Token, path: string): Promise<void>;
export declare function createAuth(auth: GoogleAuth | OAuth2Client | JWT | ServiceAccountKey | string): GoogleAuth | OAuth2Client | JWT | Promise<JWT>;
//# sourceMappingURL=auth.d.ts.map