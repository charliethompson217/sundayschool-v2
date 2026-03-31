// src/context/auth/AuthProvider.tsx (unchanged from previous update)

import React, { useState, useEffect } from 'react';
import { signIn, signUp, signOut, confirmSignUp, getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { AuthContext } from './auth-context';
import type { CurrentUser } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      const isAdmin = attributes['custom:isAdmin'] === '1';
      setUser({ ...currentUser, isAdmin });
      setIsAuthenticated(true);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signInFunc = async (email: string, password: string) => {
    try {
      const signInResult = await signIn({ username: email, password });
      await checkUser();
      return signInResult;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUpFunc = async (email: string, password: string, attributes?: Record<string, string>) => {
    try {
      return await signUp({
        username: email,
        password,
        options: {
          userAttributes: { ...attributes, email },
        },
      });
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signOutFunc = async () => {
    try {
      await signOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const confirmSignUpFunc = async (email: string, code: string) => {
    try {
      return await confirmSignUp({ username: email, confirmationCode: code });
    } catch (error) {
      console.error('Confirm sign up error:', error);
      throw error;
    }
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
