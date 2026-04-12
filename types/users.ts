import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.email(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullish(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  isAdmin: z.boolean().default(false),
  isSystemAdmin: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isVerified: z.boolean().default(false),
  isPlayer: z.boolean().default(true),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserParamsSchema = UserSchema.pick({
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  phone: true,
});
export type CreateUserParams = z.infer<typeof CreateUserParamsSchema>;
