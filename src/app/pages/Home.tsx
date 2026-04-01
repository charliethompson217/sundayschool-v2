// src/app/routes/Home.tsx

import { Title } from '@mantine/core';
import { useAuth } from '../context/auth/useAuth.ts';
import AuthPage from './AuthPage.tsx';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && !isAuthenticated) {
    return <AuthPage />;
  }

  return <Title order={1}>Home Page</Title>;
}
