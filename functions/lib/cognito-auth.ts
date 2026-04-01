import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { getUserByEmail, createUser } from './users-dynamo';
import type { UserRecord } from './users-dynamo';

// ── Verifier singleton (reused across Lambda warm invocations) ────────────────

let _verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

function getVerifier() {
  if (!_verifier) {
    _verifier = CognitoJwtVerifier.create({
      userPoolId: Resource.UserPool.id,
      tokenUse: 'id',
      clientId: Resource.WebClient.id,
    });
  }
  return _verifier;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

function jsonResponse(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ── withAuth HOC ─────────────────────────────────────────────────────────────
//
// Wraps a Lambda handler with Cognito JWT verification + DynamoDB user lookup.
// The resolved UserRecord is injected as the second argument to the handler so
// every authenticated route has immediate access to the full user context.
//
// Auth flow per request:
//   1. Extract Bearer token from Authorization header
//   2. Verify the Cognito ID token signature + expiry
//   3. Decode the verified email claim (email is always present — users must
//      verify it before the PostConfirmation trigger creates their record)
//   4. Look up the user in DynamoDB by email
//   5. Inject user into handler; short-circuit with 401/403 on any failure
//
// Safety net: if the PostConfirmation trigger failed and no user record exists,
// we attempt to create one here so a transient DynamoDB error can't permanently
// lock a user out.

export type AuthedHandler = (event: APIGatewayProxyEventV2, user: UserRecord) => Promise<APIGatewayProxyResultV2>;

export function withAuth(handler: AuthedHandler) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const token = extractBearerToken(event.headers['authorization']);
    if (!token) {
      return jsonResponse(401, { error: 'Missing or invalid Authorization header' });
    }

    let email: string;
    let cognitoAttrs: Record<string, unknown>;

    try {
      const payload = await getVerifier().verify(token);
      email = (payload.email as string | undefined) ?? '';
      if (!email) throw new Error('No email claim in token');
      cognitoAttrs = payload as Record<string, unknown>;
    } catch {
      return jsonResponse(401, { error: 'Invalid or expired token' });
    }

    const tableName = Resource.UsersTable.name;
    let user = await getUserByEmail(tableName, email);

    // Safety-net: PostConfirmation trigger may have failed on initial sign-up.
    if (!user) {
      try {
        const givenName = (cognitoAttrs['given_name'] as string | undefined)?.trim() ?? '';
        const familyName = (cognitoAttrs['family_name'] as string | undefined)?.trim() ?? '';
        const preferredUsername =
          (cognitoAttrs['preferred_username'] as string | undefined)?.trim() || email.split('@')[0];

        user = await createUser(tableName, {
          email,
          username: preferredUsername,
          firstName: givenName,
          lastName: familyName,
        });

        console.warn('cognito-auth: created missing user record via safety-net', { email });
      } catch (err) {
        console.error('cognito-auth: safety-net user creation failed', { email, error: String(err) });
        return jsonResponse(403, { error: 'User account not found' });
      }
    }

    if (!user.isActive) {
      return jsonResponse(403, { error: 'Account is inactive' });
    }

    return handler(event, user);
  };
}
