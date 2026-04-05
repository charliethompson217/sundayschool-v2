import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { Resource } from 'sst';

import { createUser, getUserByEmail } from '../db/users/users';

/**
 * Cognito PostConfirmation trigger.
 *
 * Fires after a user successfully verifies their email address. Creates an
 * immutable user record in DynamoDB keyed by a UUID that is independent of
 * Cognito. Email is the stable lookup key — auth middleware resolves the full
 * user from DynamoDB on every authenticated request.
 *
 * Cognito expects the original event to be returned unchanged.
 */
export async function handler(event: PostConfirmationTriggerEvent): Promise<PostConfirmationTriggerEvent> {
  // Only act on email-confirmation sign-ups, not password-reset confirmations.
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  const attrs = event.request.userAttributes;
  const email = attrs.email;

  if (!email) {
    console.error('PostConfirmation: no email attribute in event', { sub: attrs.sub });
    return event;
  }

  const tableName = Resource.UsersTable.name;

  // Guard against duplicate triggers (e.g. retries) — if the user already
  // exists we log and continue without error so Cognito is not blocked.
  const existing = await getUserByEmail(tableName, email);
  if (existing) {
    console.info('PostConfirmation: user already exists, skipping create', { email });
    return event;
  }

  // Standard Cognito attributes passed from the frontend during signUp.
  // We fall back gracefully so a missing attribute never blocks Cognito.
  const firstName = attrs.given_name?.trim() || '';
  const lastName = attrs.family_name?.trim() || '';
  const username = attrs.preferred_username?.trim() || email.split('@')[0];

  try {
    const user = await createUser(tableName, { email, username, firstName, lastName });
    console.info('PostConfirmation: user created', { id: user.id, email });
  } catch (err) {
    // Log but do NOT re-throw — a DynamoDB failure must not block Cognito from
    // completing the sign-up flow. The /me endpoint has a safety-net upsert.
    console.error('PostConfirmation: failed to create user', { email, error: String(err) });
  }

  return event;
}
