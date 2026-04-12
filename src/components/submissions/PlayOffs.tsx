import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconChevronRight, IconLock, IconTrophy } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import PlayOffsPicksForm from '@/components/submissions/PlayOffsPicksForm';
import { getPlayOffsWeekMetas } from '@/app/API/scheduleFunctions';
import { getPlayOffsBucks } from '@/app/API/scoreFunctions';
import { usePlayOffsPicksSubmissions } from '@/app/hooks/usePlayOffsPicksSubmissions';
import type { PlayOffsPicksSubmission } from '@/types/submissions';
import type { WeekMeta } from '@/types/schedules';

import WeekListPage from './WeekListPage';
import { isWeekClosed, formatKickoff } from './weekUtils';

function PlayoffWeekRow({ meta, onClick }: { meta: WeekMeta; onClick: () => void }) {
  const closed = isWeekClosed(meta);
  const roundLabel = meta.round_name ?? `Week ${meta.week}`;

  return (
    <Paper p="md" radius="md" withBorder onClick={onClick} style={{ cursor: 'pointer' }}>
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Group gap="sm" align="center">
            <IconTrophy size={14} color="var(--mantine-color-yellow-6)" />
            <Text fw={600}>{roundLabel}</Text>
            {closed ? (
              <Badge color="red" variant="light" size="sm" leftSection={<IconLock size={10} />}>
                Closed
              </Badge>
            ) : (
              <Badge color="green" variant="light" size="sm">
                Open
              </Badge>
            )}
            {meta.allow_parlay && (
              <Badge color="violet" variant="light" size="sm">
                Parlay available
              </Badge>
            )}
          </Group>
          {meta.submission_closes_at && (
            <Text size="xs" c="dimmed">
              {closed ? 'Started' : 'Closes'} {formatKickoff(meta.submission_closes_at)}
            </Text>
          )}
        </Stack>

        <Group gap="xs" align="center">
          {closed ? (
            <Button size="xs" variant="subtle" color="orange">
              View bets
            </Button>
          ) : (
            <Button size="xs" variant="subtle">
              Place bets
            </Button>
          )}
          <IconChevronRight size={16} color="gray" />
        </Group>
      </Group>
    </Paper>
  );
}

interface PlayOffsProps {
  year: number;
  onSelectionChange?: (hasSelection: boolean) => void;
}

export default function PlayOffs({ year, onSelectionChange }: PlayOffsProps) {
  const { submissions, submitPicks } = usePlayOffsPicksSubmissions(year);

  const { data: playoffsBucks, isLoading: isLoadingBucks } = useQuery({
    queryKey: ['playoffsBucks', year],
    queryFn: () => getPlayOffsBucks(year),
  });

  return (
    <WeekListPage<PlayOffsPicksSubmission>
      title="Playoff Bets"
      emptyMessage="No rounds are currently open for betting."
      localStorageKey="playOffs.showClosed"
      closedLabel="previous rounds"
      queryKey={`playOffsWeekMetas-${year}`}
      queryFn={() => getPlayOffsWeekMetas(year)}
      submissions={submissions}
      submitPicks={submitPicks}
      onSelectionChange={onSelectionChange}
      extraLoading={isLoadingBucks}
      renderWeekRow={(meta, onClick) => <PlayoffWeekRow meta={meta} onClick={onClick} />}
      renderForm={({ weekMeta, onSubmit, existingSubmission, readOnly }) => (
        <PlayOffsPicksForm
          weekMeta={weekMeta}
          onSubmit={onSubmit}
          existingSubmission={existingSubmission}
          readOnly={readOnly}
          playoffsBucks={playoffsBucks ?? 0}
        />
      )}
    />
  );
}
