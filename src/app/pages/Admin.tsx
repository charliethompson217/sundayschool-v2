import { Stack, Tabs, Title } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';

import UserTable from '@/components/Admin/UserTable';
import Overview from '@/components/Admin/Overview';
import Schedule from '@/components/Admin/Schedule';
import Picks from '@/components/Admin/Picks';
import Results from '@/components/Admin/Results';
import Settings from '@/components/Admin/Settings';
import EspnGamesTable from '@/components/Admin/EspnGamesTable';

const VALID_TABS = ['overview', 'users', 'schedule', 'picks', 'results', 'espn', 'settings'] as const;
type AdminTab = (typeof VALID_TABS)[number];

function isValidTab(value: string | undefined): value is AdminTab {
  return VALID_TABS.includes(value as AdminTab);
}

export default function AdminRoute() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const activeTab: AdminTab = isValidTab(tab) ? tab : 'users';

  function handleTabChange(value: string | null) {
    if (value) navigate(`/admin/${value}`);
  }

  return (
    <Stack gap="lg">
      <Title order={1}>Admin Page</Title>

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="users">Users</Tabs.Tab>
          <Tabs.Tab value="schedule">Schedule</Tabs.Tab>
          <Tabs.Tab value="picks">Picks</Tabs.Tab>
          <Tabs.Tab value="results">Results</Tabs.Tab>
          <Tabs.Tab value="espn">ESPN Data</Tabs.Tab>
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
        <Tabs.Panel value="espn" pt="md">
          <EspnGamesTable />
        </Tabs.Panel>
        <Tabs.Panel value="settings" pt="md">
          <Settings />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
