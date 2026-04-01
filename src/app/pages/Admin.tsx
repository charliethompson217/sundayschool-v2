import { Stack, Tabs, Title } from '@mantine/core';

import UserTable from '@/components/Admin/UserTable';
import Overview from '@/components/Admin/Overview';
import Schedule from '@/components/Admin/Schedule';
import Picks from '@/components/Admin/Picks';
import Results from '@/components/Admin/Results';
import Settings from '@/components/Admin/Settings';

export default function AdminRoute() {
  return (
    <Stack gap="lg">
      <Title order={1}>Admin Page</Title>

      <Tabs defaultValue="users">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="users">Users</Tabs.Tab>
          <Tabs.Tab value="schedule">Schedule</Tabs.Tab>
          <Tabs.Tab value="picks">Picks</Tabs.Tab>
          <Tabs.Tab value="results">Results</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Overview />
        </Tabs.Panel>
        <Tabs.Panel value="users" pt="md">
          <UserTable />
        </Tabs.Panel>
        <Tabs.Panel value="schedule" pt="md">
          <Schedule />
        </Tabs.Panel>
        <Tabs.Panel value="picks" pt="md">
          <Picks />
        </Tabs.Panel>
        <Tabs.Panel value="results" pt="md">
          <Results />
        </Tabs.Panel>
        <Tabs.Panel value="settings" pt="md">
          <Settings />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
