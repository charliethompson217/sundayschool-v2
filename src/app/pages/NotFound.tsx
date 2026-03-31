// src/app/routes/NotFound.tsx

import { Title, Text } from '@mantine/core';

export default function NotFoundRoute() {
  return (
    <>
      <Title order={1}>404 - Not Found</Title>
      <Text>Page does not exist.</Text>
    </>
  );
}
