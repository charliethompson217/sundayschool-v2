import { Stack, Text, Title } from '@mantine/core';
import { IconTrophy } from '@tabler/icons-react';

export default function PlayOffs() {
  return (
    <Stack align="center" gap="sm" py="xl">
      <IconTrophy size={40} color="var(--mantine-color-yellow-6)" />
      <Title order={3}>Playoffs</Title>
      <Text size="sm" c="dimmed" ta="center">
        Playoff picks are coming soon. Check back when the bracket is set.
      </Text>
    </Stack>
  );
}
