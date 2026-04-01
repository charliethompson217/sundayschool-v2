import { PutCommand, QueryCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

import { getDocClient } from './dynamo';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  createdAt: string;
  updatedAt: string;
  isAdmin: boolean;
  isSystemAdmin: boolean;
  isActive: boolean;
  isVerified: boolean;
  isPlayer: boolean;
}

export interface CreateUserParams {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

// ── Key builders ──────────────────────────────────────────────────────────────

function userPk(id: string): string {
  return `USER#${id}`;
}

function emailGsiPk(email: string): string {
  return `EMAIL#${email.toLowerCase()}`;
}

// ── Operations ────────────────────────────────────────────────────────────────

/**
 * Insert a new user record with an immutable UUID.
 * Throws if a record with this PK already exists (should never happen with UUIDs).
 */
export async function createUser(tableName: string, params: CreateUserParams): Promise<UserRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();

  const user: UserRecord = {
    id,
    email: params.email.toLowerCase(),
    username: params.username,
    firstName: params.firstName,
    lastName: params.lastName,
    phone: params.phone ?? null,
    createdAt: now,
    updatedAt: now,
    isAdmin: false,
    isSystemAdmin: false,
    isActive: true,
    isVerified: true, // PostConfirmation only fires after email verification
    isPlayer: true,
  };

  const pk = userPk(id);
  const gsi1pk = emailGsiPk(params.email);

  try {
    await getDocClient().send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk,
          sk: '#META',
          gsi1pk,
          gsi1sk: gsi1pk,
          ...user,
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new Error(`User with id ${id} already exists`);
    }
    throw err;
  }

  return user;
}

/**
 * Look up a user by email via the GSI. Used by the auth middleware on every
 * authenticated request — email is the only claim verified by the Cognito JWT.
 */
export async function getUserByEmail(tableName: string, email: string): Promise<UserRecord | null> {
  const gsi1pk = emailGsiPk(email);

  const result = await getDocClient().send(
    new QueryCommand({
      TableName: tableName,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :gsi1pk',
      ExpressionAttributeValues: { ':gsi1pk': gsi1pk },
      Limit: 1,
    }),
  );

  const item = result.Items?.[0];
  return item ? itemToUserRecord(item) : null;
}

/**
 * Look up a user by their immutable UUID.
 */
export async function getUserById(tableName: string, id: string): Promise<UserRecord | null> {
  const pk = userPk(id);

  const result = await getDocClient().send(
    new GetCommand({
      TableName: tableName,
      Key: { pk, sk: '#META' },
    }),
  );

  return result.Item ? itemToUserRecord(result.Item) : null;
}

/**
 * Scan all user records from the table.
 * Uses a FilterExpression to target only the #META items (one per user).
 */
export async function getAllUsers(tableName: string): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await getDocClient().send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'sk = :meta',
        ExpressionAttributeValues: { ':meta': '#META' },
        ExclusiveStartKey: lastKey,
      }),
    );

    for (const item of result.Items ?? []) {
      users.push(itemToUserRecord(item as Record<string, unknown>));
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return users;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemToUserRecord(item: Record<string, unknown>): UserRecord {
  return {
    id: item.id as string,
    email: item.email as string,
    username: item.username as string,
    firstName: item.firstName as string,
    lastName: item.lastName as string,
    phone: (item.phone as string | null | undefined) ?? null,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
    isAdmin: Boolean(item.isAdmin),
    isSystemAdmin: Boolean(item.isSystemAdmin),
    isActive: Boolean(item.isActive),
    isVerified: Boolean(item.isVerified),
    isPlayer: Boolean(item.isPlayer),
  };
}
