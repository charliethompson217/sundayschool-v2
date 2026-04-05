import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { withAuth } from '../../utils/auth/cognito-auth';
import type { UserRecord } from '../../db/users/users';
import { json } from '../../utils/http';

export const handler = withAuth(async (_event: APIGatewayProxyEventV2, user: UserRecord) => {
  return json(200, { user });
});
