// src/app/routes/Settings.tsx

import { Button, Stack, Title } from '@mantine/core';
import { useAuth } from '../context/auth/auth-context';

export default function SettingsRoute() {
  const { signOut, isAuthenticated } = useAuth();

  return (
    <Stack gap="lg">
      <Title order={1}>Settings</Title>
      {isAuthenticated && (
        <Button color="red" variant="outline" onClick={signOut} w="fit-content">
          Log out
        </Button>
      )}
    </Stack>
  );
}
