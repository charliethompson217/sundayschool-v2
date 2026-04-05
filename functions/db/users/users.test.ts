import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { MockConditionalCheckFailedException, mockSend } = vi.hoisted(() => {
  class MockConditionalCheckFailedException extends Error {
    constructor() {
      super('ConditionalCheckFailed');
      this.name = 'ConditionalCheckFailedException';
    }
  }
  return {
    MockConditionalCheckFailedException,
    mockSend: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {},
  ConditionalCheckFailedException: MockConditionalCheckFailedException,
}));

vi.mock('@aws-sdk/lib-dynamodb', () => {
  const makeCmd = () =>
    class {
      readonly input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    };
  return {
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    PutCommand: makeCmd(),
    GetCommand: makeCmd(),
    QueryCommand: makeCmd(),
    ScanCommand: makeCmd(),
    DeleteCommand: makeCmd(),
    UpdateCommand: makeCmd(),
  };
});

import { createUser, getUserByEmail, getUserById, getAllUsers } from './users';

const TABLE = 'test-users';

const baseItem = {
  id: 'u1',
  email: 'user@test.com',
  username: 'tester',
  firstName: 'Test',
  lastName: 'User',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  isAdmin: false,
  isSystemAdmin: false,
  isActive: true,
  isVerified: true,
  isPlayer: true,
  phone: null,
};

// ── createUser ────────────────────────────────────────────────────────────────

describe('createUser', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('returns a UserRecord with correct defaults', async () => {
    const user = await createUser(TABLE, {
      email: 'Test@Example.com',
      username: 'tester',
      firstName: 'Test',
      lastName: 'User',
    });
    expect(user.email).toBe('test@example.com');
    expect(user.username).toBe('tester');
    expect(user.firstName).toBe('Test');
    expect(user.lastName).toBe('User');
    expect(user.isAdmin).toBe(false);
    expect(user.isSystemAdmin).toBe(false);
    expect(user.isActive).toBe(true);
    expect(user.isVerified).toBe(true);
    expect(user.isPlayer).toBe(true);
    expect(user.phone).toBeNull();
    expect(user.id).toBeDefined();
  });

  it('sends a PutCommand with attribute_not_exists condition', async () => {
    await createUser(TABLE, { email: 'a@b.com', username: 'a', firstName: 'A', lastName: 'B' });
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input.TableName).toBe(TABLE);
    expect(cmd.input.ConditionExpression).toBe('attribute_not_exists(pk)');
  });

  it('sets pk as USER#<uuid>, sk as #META, and gsi1pk as EMAIL#<email>', async () => {
    await createUser(TABLE, { email: 'a@b.com', username: 'a', firstName: 'A', lastName: 'B' });
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const item = cmd.input.Item as Record<string, string>;
    expect(item.pk).toMatch(/^USER#/);
    expect(item.sk).toBe('#META');
    expect(item.gsi1pk).toBe('EMAIL#a@b.com');
    expect(item.gsi1sk).toBe('EMAIL#a@b.com');
  });

  it('stores phone when provided', async () => {
    const user = await createUser(TABLE, {
      email: 'a@b.com',
      username: 'a',
      firstName: 'A',
      lastName: 'B',
      phone: '555-1234',
    });
    expect(user.phone).toBe('555-1234');
  });

  it('stores null for phone when not provided', async () => {
    const user = await createUser(TABLE, { email: 'a@b.com', username: 'a', firstName: 'A', lastName: 'B' });
    expect(user.phone).toBeNull();
  });

  it('throws a descriptive error when the PK already exists', async () => {
    mockSend.mockRejectedValueOnce(new MockConditionalCheckFailedException());
    await expect(createUser(TABLE, { email: 'a@b.com', username: 'a', firstName: 'A', lastName: 'B' })).rejects.toThrow(
      'already exists',
    );
  });

  it('rethrows non-conditional errors unchanged', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'));
    await expect(createUser(TABLE, { email: 'a@b.com', username: 'a', firstName: 'A', lastName: 'B' })).rejects.toThrow(
      'network error',
    );
  });
});

// ── getUserByEmail ────────────────────────────────────────────────────────────

describe('getUserByEmail', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('returns a UserRecord when the item is found', async () => {
    mockSend.mockResolvedValueOnce({ Items: [baseItem] });
    const result = await getUserByEmail(TABLE, 'user@test.com');
    expect(result?.id).toBe('u1');
    expect(result?.email).toBe('user@test.com');
  });

  it('returns null when no item is found', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const result = await getUserByEmail(TABLE, 'missing@test.com');
    expect(result).toBeNull();
  });

  it('queries GSI1 with a lowercased EMAIL# key', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await getUserByEmail(TABLE, 'Upper@Example.COM');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input.IndexName).toBe('gsi1');
    const values = cmd.input.ExpressionAttributeValues as Record<string, string>;
    expect(Object.values(values)).toContain('EMAIL#upper@example.com');
  });

  it('maps boolean fields correctly', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ ...baseItem, isAdmin: true, isPlayer: false }] });
    const result = await getUserByEmail(TABLE, 'user@test.com');
    expect(result?.isAdmin).toBe(true);
    expect(result?.isPlayer).toBe(false);
  });
});

// ── getUserById ───────────────────────────────────────────────────────────────

describe('getUserById', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('returns a UserRecord when found', async () => {
    mockSend.mockResolvedValueOnce({ Item: baseItem });
    const result = await getUserById(TABLE, 'u1');
    expect(result?.id).toBe('u1');
  });

  it('returns null when the item is not found', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const result = await getUserById(TABLE, 'missing');
    expect(result).toBeNull();
  });

  it('queries with pk = USER#<id> and sk = #META', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    await getUserById(TABLE, 'abc-123');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const key = cmd.input.Key as Record<string, string>;
    expect(key.pk).toBe('USER#abc-123');
    expect(key.sk).toBe('#META');
  });
});

// ── getAllUsers ───────────────────────────────────────────────────────────────

describe('getAllUsers', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('returns all users in a single page', async () => {
    mockSend.mockResolvedValueOnce({ Items: [baseItem, { ...baseItem, id: 'u2' }], LastEvaluatedKey: undefined });
    const result = await getAllUsers(TABLE);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('u1');
  });

  it('returns an empty array when the table is empty', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    const result = await getAllUsers(TABLE);
    expect(result).toEqual([]);
  });

  it('paginates through multiple scan pages', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [baseItem], LastEvaluatedKey: { pk: 'USER#u1', sk: '#META' } })
      .mockResolvedValueOnce({ Items: [{ ...baseItem, id: 'u2' }], LastEvaluatedKey: undefined });
    const result = await getAllUsers(TABLE);
    expect(result).toHaveLength(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('filters by sk = #META', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await getAllUsers(TABLE);
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input.FilterExpression).toContain('sk');
    const values = cmd.input.ExpressionAttributeValues as Record<string, string>;
    expect(Object.values(values)).toContain('#META');
  });

  it('passes ExclusiveStartKey on subsequent pages', async () => {
    const startKey = { pk: 'USER#u1', sk: '#META' };
    mockSend
      .mockResolvedValueOnce({ Items: [baseItem], LastEvaluatedKey: startKey })
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await getAllUsers(TABLE);
    const secondCall = mockSend.mock.calls[1][0] as { input: Record<string, unknown> };
    expect(secondCall.input.ExclusiveStartKey).toEqual(startKey);
  });
});
