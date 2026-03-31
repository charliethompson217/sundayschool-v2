// src/main.tsx

import '@mantine/core/styles.css';
import { theme, resolver } from './theme.ts';
import { MantineProvider } from '@mantine/core';
import { Amplify } from 'aws-amplify';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/auth/AuthProvider.tsx';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID,
    },
  },
});

const queryClient = new QueryClient();

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} cssVariablesResolver={resolver} defaultColorScheme="auto">
        <AuthProvider>{children}</AuthProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
};
