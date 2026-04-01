import { UserSchema, type User } from '@/types/users';

import { authedFetch } from './authedFetch';

/**
 * Fetch the current user's full profile from DynamoDB via the backend.
 * Admin/role status always comes from here — never from Cognito claims.
 */
export async function getMe(): Promise<User> {
  const res = await authedFetch('/me');
  if (!res.ok) {
    throw new Error(`GET /me failed: ${res.status}`);
  }
  const data = await res.json();
  return UserSchema.parse(data.user);
}
