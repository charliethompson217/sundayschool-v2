import { Resource } from 'sst';

import { withAdmin } from '../../utils/auth/cognito-auth';
import { getAllUsers } from '../../db/users/users';
import { json } from '../../utils/http';

export const handler = withAdmin(async () => {
  const users = await getAllUsers(Resource.UsersTable.name);
  return json(200, { users });
});
