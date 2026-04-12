import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconChevronRight, IconLock } from '@tabler/icons-react';

import RegularSeasonPicksForm from '@/components/submissions/RegularSeasonPicksForm';
import { getRegularSeasonWeekMetas } from '@/app/API/scheduleFunctions';
import { useRegularSeasonPicksSubmissions } from '@/app/hooks/useRegularSeasonPicksSubmissions';
import type { RegularSeasonPicksSubmission } from '@/types/submissions';
import type { WeekMeta } from '@/types/schedules';

import WeekListPage from './WeekListPage';
import { isWeekClosed, formatKickoff } from './weekUtils';

function RegularWeekRow({ meta, onClick }: { meta: WeekMeta; onClick: () => void }) {
  const closed = isWeekClosed(meta);
  return (
    <Paper p="md" radius="md" withBorder onClick={onClick} style={{ cursor: 'pointer' }}>
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Group gap="sm" align="center">
            <Text fw={600}>Week {meta.week}</Text>
            {closed ? (
              <Badge color="red" variant="light" size="sm" leftSection={<IconLock size={10} />}>
                Closed
              </Badge>
            ) : (
              <Badge color="green" variant="light" size="sm">
                Open
              </Badge>
            )}
          </Group>
          {meta.submission_closes_at && (
            <Text size="xs" c="dimmed">
              {closed ? 'Started' : 'Kicks off'} {formatKickoff(meta.submission_closes_at)}
            </Text>
          )}
        </Stack>

        <Group gap="xs" align="center">
          {closed ? (
            <Button size="xs" variant="subtle" color="orange">
              View picks
            </Button>
          ) : (
            <Button size="xs" variant="subtle">
              Submit picks
            </Button>
          )}
          <IconChevronRight size={16} color="gray" />
        </Group>
      </Group>
    </Paper>
  );
}

interface RegularSeasonProps {
  year: number;
  onSelectionChange?: (hasSelection: boolean) => void;
}

export default function RegularSeason({ year, onSelectionChange }: RegularSeasonProps) {
  const { submissions, submitPicks } = useRegularSeasonPicksSubmissions(year);

  return (
    <WeekListPage<RegularSeasonPicksSubmission>
      title="Submit Picks"
      emptyMessage="No weeks are currently open for submission."
      localStorageKey="regularSeason.showClosed"
      closedLabel="previous weeks"
      queryKey={`regularSeasonWeekMetas-${year}`}
      queryFn={() => getRegularSeasonWeekMetas(year)}
      submissions={submissions}
      submitPicks={submitPicks}
      onSelectionChange={onSelectionChange}
      renderWeekRow={(meta, onClick) => <RegularWeekRow meta={meta} onClick={onClick} />}
      renderForm={({ weekMeta, onSubmit, existingSubmission, readOnly }) => (
        <RegularSeasonPicksForm
          weekMeta={weekMeta}
          onSubmit={onSubmit}
          existingSubmission={existingSubmission}
          readOnly={readOnly}
        />
      )}
    />
  );
}
