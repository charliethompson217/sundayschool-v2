import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

import { withAuth } from './lib/cognito-auth';
import type { UserRecord } from './lib/users-dynamo';

function jsonResponse(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler = withAuth(async (_event: APIGatewayProxyEventV2, user: UserRecord) => {
  return jsonResponse(200, { user });
});
