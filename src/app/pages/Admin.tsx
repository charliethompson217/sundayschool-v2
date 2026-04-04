import { Stack, Tabs, Title } from '@mantine/core';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

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
  const [, setSearchParams] = useSearchParams();

  const activeTab: AdminTab = isValidTab(tab) ? tab : 'users';

  function handleTabChange(value: string | null) {
    if (value) {
      setSearchParams({});
      navigate(`/admin/${value}`);
    }
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
          {activeTab === 'overview' && <Overview />}
        </Tabs.Panel>
        <Tabs.Panel value="users" pt="md">
          {activeTab === 'users' && <UserTable />}
        </Tabs.Panel>
        <Tabs.Panel value="schedule" pt="md">
          {activeTab === 'schedule' && <Schedule />}
        </Tabs.Panel>
        <Tabs.Panel value="picks" pt="md">
          {activeTab === 'picks' && <Picks />}
        </Tabs.Panel>
        <Tabs.Panel value="results" pt="md">
          {activeTab === 'results' && <Results />}
        </Tabs.Panel>
        <Tabs.Panel value="espn" pt="md">
          {activeTab === 'espn' && <EspnGamesTable />}
        </Tabs.Panel>
        <Tabs.Panel value="settings" pt="md">
          {activeTab === 'settings' && <Settings />}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
