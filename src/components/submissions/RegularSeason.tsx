import { useState } from 'react';

import { ActionIcon, Badge, Button, Collapse, Divider, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp, IconLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import RegularSeasonPicksForm from '@/components/submissions/RegularSeasonPicksForm';
import { getRegularSeasonWeekMetas } from '@/app/API/scheduleFunctions';
import { useRegularSeasonPicksSubmissions } from '@/app/hooks/useRegularSeasonPicksSubmissions';
import type { RegularSeasonPicksSubmission } from '@/types/submissions';
import type { WeekMeta } from '@/types/schedules';

function isWeekClosed(meta: WeekMeta): boolean {
  return meta.submission_closes_at !== null && new Date(meta.submission_closes_at) <= new Date();
}

function formatKickoff(closesAt: string): string {
  return new Date(closesAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function WeekRow({ meta, onClick }: { meta: WeekMeta; onClick: () => void }) {
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
          <Text size="xs" c="dimmed">
            {closed ? 'Started' : 'Kicks off'} {formatKickoff(meta.submission_closes_at!)}
          </Text>
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
  const [selectedWeek, setSelectedWeek] = useState<WeekMeta | null>(null);
  const [showClosed, setShowClosed] = useState(() => {
    return localStorage.getItem('regularSeason.showClosed') === 'true';
  });

  function selectWeek(meta: WeekMeta | null) {
    setSelectedWeek(meta);
    onSelectionChange?.(meta !== null);
  }

  const {
    data: weekMetas,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['regularSeasonWeekMetas', year],
    queryFn: () => getRegularSeasonWeekMetas(year),
  });

  const { submissions, submitPicks } = useRegularSeasonPicksSubmissions(year);

  const openWeeks = weekMetas?.filter((m) => !isWeekClosed(m)) ?? [];
  const closedWeeks = weekMetas?.filter((m) => isWeekClosed(m)) ?? [];

  function handleSubmit(submission: RegularSeasonPicksSubmission) {
    if (selectedWeek) {
      return submitPicks(year, parseInt(selectedWeek.season_type, 10), parseInt(selectedWeek.week, 10), submission);
    }
    return Promise.resolve();
  }

  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return <Text c="red">Failed to load schedule. Please try again.</Text>;
  }

  if (selectedWeek) {
    const closed = isWeekClosed(selectedWeek);
    const weekNum = parseInt(selectedWeek.week, 10);
    return (
      <Stack>
        <Group>
          <ActionIcon variant="subtle" onClick={() => selectWeek(null)}>
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Text size="sm" c="dimmed">
            Back to weeks
          </Text>
        </Group>

        <RegularSeasonPicksForm
          weekMeta={selectedWeek}
          onSubmit={handleSubmit}
          existingSubmission={submissions[weekNum]}
          readOnly={closed}
        />
      </Stack>
    );
  }

  return (
    <Stack>
      <Title order={3}>Submit Picks</Title>
      <Text size="sm" c="dimmed">
        Select a week to submit or review your picks.
      </Text>

      <Stack gap="sm">
        {openWeeks.length > 0 ? (
          openWeeks.map((meta) => <WeekRow key={meta.week} meta={meta} onClick={() => selectWeek(meta)} />)
        ) : (
          <Text size="sm" c="dimmed">
            No weeks are currently open for submission.
          </Text>
        )}
      </Stack>

      {closedWeeks.length > 0 && (
        <Stack gap="sm">
          <Divider
            labelPosition="left"
            label={
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={showClosed ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                onClick={() =>
                  setShowClosed((v) => {
                    const next = !v;
                    localStorage.setItem('regularSeason.showClosed', String(next));
                    return next;
                  })
                }
              >
                {showClosed ? 'Hide' : 'Show'} previous weeks ({closedWeeks.length})
              </Button>
            }
          />
          <Collapse in={showClosed}>
            <Stack gap="sm">
              {closedWeeks.map((meta) => (
                <WeekRow key={meta.week} meta={meta} onClick={() => selectWeek(meta)} />
              ))}
            </Stack>
          </Collapse>
        </Stack>
      )}
    </Stack>
  );
}
