import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockGetUserByEmail, mockCreateUser } = vi.hoisted(() => ({
  mockGetUserByEmail: vi.fn(),
  mockCreateUser: vi.fn(),
}));

vi.mock('sst', () => ({
  Resource: {
    UsersTable: { name: 'test-users' },
  },
}));

vi.mock('../db/users/users', () => ({
  getUserByEmail: mockGetUserByEmail,
  createUser: mockCreateUser,
}));

import { handler } from './cognito-post-confirmation';

function makeEvent(triggerSource: string, attrs: Record<string, string>): PostConfirmationTriggerEvent {
  return {
    triggerSource,
    request: { userAttributes: attrs },
    response: {},
  } as unknown as PostConfirmationTriggerEvent;
}

describe('cognito-post-confirmation handler', () => {
  beforeEach(() => {
    mockGetUserByEmail.mockReset();
    mockCreateUser.mockReset();
  });

  it('returns the event unchanged for non-signup trigger sources', async () => {
    const event = makeEvent('PostConfirmation_ConfirmForgotPassword', { email: 'a@b.com' });
    const result = await handler(event);
    expect(result).toBe(event);
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('returns the event unchanged when the email attribute is missing', async () => {
    const event = makeEvent('PostConfirmation_ConfirmSignUp', { sub: 'abc' });
    const result = await handler(event);
    expect(result).toBe(event);
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });

  it('skips createUser and returns event when the user already exists', async () => {
    mockGetUserByEmail.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' });
    const event = makeEvent('PostConfirmation_ConfirmSignUp', { email: 'a@b.com' });
    const result = await handler(event);
    expect(result).toBe(event);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('creates a new user for a fresh sign-up', async () => {
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({ id: 'u2', email: 'new@example.com' });
    const event = makeEvent('PostConfirmation_ConfirmSignUp', {
      email: 'new@example.com',
      given_name: 'New',
      family_name: 'User',
      preferred_username: 'newuser',
    });
    await handler(event);
    expect(mockCreateUser).toHaveBeenCalledWith('test-users', {
      email: 'new@example.com',
      username: 'newuser',
      firstName: 'New',
      lastName: 'User',
    });
  });

  it('falls back to email prefix as username when preferred_username is missing', async () => {
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({ id: 'u3', email: 'fallback@example.com' });
    const event = makeEvent('PostConfirmation_ConfirmSignUp', {
      email: 'fallback@example.com',
      given_name: 'Fall',
      family_name: 'Back',
    });
    await handler(event);
    expect(mockCreateUser).toHaveBeenCalledWith('test-users', expect.objectContaining({ username: 'fallback' }));
  });

  it('returns the event and does not throw when createUser fails', async () => {
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockRejectedValueOnce(new Error('DB boom'));
    const event = makeEvent('PostConfirmation_ConfirmSignUp', { email: 'fail@example.com' });
    await expect(handler(event)).resolves.toBe(event);
  });

  it('returns the event after a successful create', async () => {
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({ id: 'u4', email: 'ok@example.com' });
    const event = makeEvent('PostConfirmation_ConfirmSignUp', {
      email: 'ok@example.com',
      given_name: 'Ok',
      family_name: 'Guy',
      preferred_username: 'ok',
    });
    const result = await handler(event);
    expect(result).toBe(event);
  });
});
