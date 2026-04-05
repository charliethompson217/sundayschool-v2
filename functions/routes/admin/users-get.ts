import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from '../../utils/auth/cognito-auth';
import { getAllUsers, type UserRecord } from '../../db/users/users';
import { json } from '../../utils/http';

export const handler = withAuth(async (_event: APIGatewayProxyEventV2, user: UserRecord) => {
  if (!user.isAdmin) {
    return json(403, { error: 'Forbidden' });
  }

  const users = await getAllUsers(Resource.UsersTable.name);
  return json(200, { users });
});
