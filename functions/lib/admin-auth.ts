/**
 * Admin auth helpers for Cognito JWT verification.
 *
 * Use this module for browser/admin endpoints only.
 * The ESPN ingest webhook uses HMAC auth (see auth.ts), not Cognito.
 *
 * To fully wire up:
 *  1. npm install aws-jwt-verify
 *  2. Link UserPool and WebClient to admin-facing functions in sst.config.ts
 *  3. Create the verifier using Resource.UserPool.id and Resource.WebClient.id
 *  4. Call verifyAdminToken from admin endpoint handlers
 */

export interface AdminClaims {
  sub: string;
  email: string;
  groups: string[];
}

const ADMIN_GROUP = 'admin';

export function isAdmin(groups: string[]): boolean {
  return groups.includes(ADMIN_GROUP);
}

/**
 * Extract a Bearer token from an Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}
