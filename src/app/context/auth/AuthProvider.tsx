import React, { useState, useEffect } from 'react';
import { signIn, signUp, signOut, confirmSignUp, getCurrentUser } from 'aws-amplify/auth';

import { AuthContext } from './AuthContext';
import type { SignUpAttributes } from './AuthContext';
import type { User } from '@/types/users';
import { getMe } from '@/app/API/userFunctions';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  /**
   * Verify there is an active Cognito session, then fetch the full user
   * profile from DynamoDB. Admin/role fields always come from the backend —
   * never from Cognito attributes or JWT claims.
   */
  const checkUser = async () => {
    try {
      await getCurrentUser();
      const fullUser = await getMe();
      setUser(fullUser);
      setIsAuthenticated(true);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signInFunc = async (email: string, password: string) => {
    const result = await signIn({ username: email, password });
    await checkUser();
    return result;
  };

  /**
   * Register a new Cognito user.
   *
   * given_name, family_name, and preferred_username are standard Cognito
   * attributes that the PostConfirmation trigger reads to populate DynamoDB.
   * The user record is NOT created here — it is created on the backend after
   * the user confirms their email, ensuring isVerified is always accurate.
   */
  const signUpFunc = async (email: string, password: string, attributes: SignUpAttributes) => {
    return signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          given_name: attributes.firstName,
          family_name: attributes.lastName,
          preferred_username: attributes.username,
        },
      },
    });
  };

  const signOutFunc = async () => {
    await signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  const confirmSignUpFunc = async (email: string, code: string) => {
    return confirmSignUp({ username: email, confirmationCode: code });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        signIn: signInFunc,
        signUp: signUpFunc,
        signOut: signOutFunc,
        confirmSignUp: confirmSignUpFunc,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
