import { PutCommand, QueryCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

import { getDocClient } from '../client';
import { UserSchema, type User, type CreateUserParams } from '@/types/users';

// ── Key builders ──────────────────────────────────────────────────────────────

function userPk(id: string): string {
  return `USER#${id}`;
}

function emailGsiPk(email: string): string {
  return `EMAIL#${email.toLowerCase()}`;
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function createUser(tableName: string, params: CreateUserParams): Promise<User> {
  const now = new Date().toISOString();
  const id = randomUUID();

  const user: User = {
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
    isVerified: true,
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

export async function getUserByEmail(tableName: string, email: string): Promise<User | null> {
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
  return item ? UserSchema.parse(item) : null;
}

export async function getUserById(tableName: string, id: string): Promise<User | null> {
  const pk = userPk(id);

  const result = await getDocClient().send(
    new GetCommand({
      TableName: tableName,
      Key: { pk, sk: '#META' },
    }),
  );

  return result.Item ? UserSchema.parse(result.Item) : null;
}

export async function getAllUsers(tableName: string): Promise<User[]> {
  const users: User[] = [];
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
      users.push(UserSchema.parse(item));
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return users;
}
