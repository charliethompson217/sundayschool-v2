import { createContext } from 'react';
import type { ConfirmSignUpOutput, SignInOutput, SignUpOutput } from 'aws-amplify/auth';

export interface CurrentUser {
  userId: string;
  username: string;
  isAdmin: boolean;
}

export interface AuthContextType {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<SignInOutput>;
  signUp: (email: string, password: string, attributes?: Record<string, string>) => Promise<SignUpOutput>;
  signOut: () => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<ConfirmSignUpOutput>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
