// src/components/AuthWrapper.tsx

import React from 'react';
import { useAuth } from '../app/context/auth/auth-context.ts';
import { Navigate } from 'react-router-dom';
import { Loader } from '@mantine/core';
import AuthPage from '../app/pages/AuthPage.tsx';

interface AuthWrapperProps {
  children: React.ReactNode;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
}

export default function AuthWrapper({ children, requiresAuth = false, requiresAdmin = false }: AuthWrapperProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <Loader />;
  }

  if (requiresAuth && !isAuthenticated) {
    return <AuthPage />;
  }

  if (requiresAdmin && !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
