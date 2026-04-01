import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from './lib/cognito-auth';
import { getAllUsers, type UserRecord } from './lib/users-dynamo';

function jsonResponse(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler = withAuth(async (_event: APIGatewayProxyEventV2, user: UserRecord) => {
  if (!user.isAdmin) {
    return jsonResponse(403, { error: 'Forbidden' });
  }

  const users = await getAllUsers(Resource.UsersTable.name);
  return jsonResponse(200, { users });
});
