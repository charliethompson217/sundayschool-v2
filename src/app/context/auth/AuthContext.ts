import { createContext } from 'react';
import type { ConfirmSignUpOutput, SignInOutput, SignUpOutput } from 'aws-amplify/auth';

import type { User } from '@/types/users';

export type { User as CurrentUser };

export interface SignUpAttributes {
  firstName: string;
  lastName: string;
  username: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<SignInOutput>;
  signUp: (email: string, password: string, attributes: SignUpAttributes) => Promise<SignUpOutput>;
  signOut: () => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<ConfirmSignUpOutput>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
