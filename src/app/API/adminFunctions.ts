import { UserSchema, type User } from '@/types/users';

import { authedFetch } from './authedFetch';

export async function getUsers(): Promise<User[]> {
  const res = await authedFetch('/admin/users');
  if (!res.ok) {
    throw new Error(`GET /admin/users failed: ${res.status}`);
  }
  const data = await res.json();
  return UserSchema.array().parse(data.users);
}
