// src/context/auth/auth-context.ts

import { createContext, useContext } from 'react';
import type { SignInOutput, SignUpOutput, ConfirmSignUpOutput } from 'aws-amplify/auth';

export interface CurrentUser {
  userId: string;
  username: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<SignInOutput>;
  signUp: (email: string, password: string, attributes?: Record<string, string>) => Promise<SignUpOutput>;
  signOut: () => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<ConfirmSignUpOutput>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (undefined === context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
