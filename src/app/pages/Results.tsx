import { Stack, Tabs, Title } from '@mantine/core';

import RegularSeasonWeeklyPicks from '@/components/results/RegularSeasonWeeklyPicks';

export default function ResultsRoute() {
  return (
    <Stack gap="lg">
      <Title order={2}>Results</Title>

      <Tabs defaultValue="weekly-picks">
        <Tabs.List>
          <Tabs.Tab value="weekly-picks">Weekly Picks</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="weekly-picks" pt="md">
          <RegularSeasonWeeklyPicks />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
