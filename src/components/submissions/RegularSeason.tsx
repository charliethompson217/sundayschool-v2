import { useState } from 'react';

import { ActionIcon, Badge, Button, Collapse, Divider, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp, IconLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import RegularSeasonPicksForm from '@/components/submissions/RegularSeasonPicksForm';
import { getRegularSeasonLineups } from '@/app/API/functions';
import { useRegularSeasonPicksSubmissions } from '@/app/hooks/useRegularSeasonPicksSubmissions';
import type { RegularSeasonPicksSubmission, WeekLineup } from '@/types/global';

function isWeekClosed(lineup: WeekLineup): boolean {
  return new Date(lineup.kickoff) <= new Date();
}

function formatKickoff(kickoff: string): string {
  return new Date(kickoff).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function WeekRow({ lineup, onClick }: { lineup: WeekLineup; onClick: () => void }) {
  const closed = isWeekClosed(lineup);
  return (
    <Paper p="md" radius="md" withBorder onClick={onClick} style={{ cursor: 'pointer' }}>
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Group gap="sm" align="center">
            <Text fw={600}>Week {lineup.week}</Text>
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
            {closed ? 'Started' : 'Kicks off'} {formatKickoff(lineup.kickoff)}
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
  onSelectionChange?: (hasSelection: boolean) => void;
}

export default function RegularSeason({ onSelectionChange }: RegularSeasonProps) {
  const [selectedWeek, setSelectedWeek] = useState<WeekLineup | null>(null);
  const [showClosed, setShowClosed] = useState(() => {
    return localStorage.getItem('regularSeason.showClosed') === 'true';
  });

  function selectWeek(lineup: WeekLineup | null) {
    setSelectedWeek(lineup);
    onSelectionChange?.(lineup !== null);
  }

  const {
    data: lineups,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['regularSeasonLineups'],
    queryFn: getRegularSeasonLineups,
  });

  const { submissions, submitPicks } = useRegularSeasonPicksSubmissions();

  const openWeeks = lineups?.filter((l) => !isWeekClosed(l)) ?? [];
  const closedWeeks = lineups?.filter((l) => isWeekClosed(l)) ?? [];

  function handleSubmit(submission: RegularSeasonPicksSubmission) {
    if (selectedWeek) {
      return submitPicks(selectedWeek.week, submission);
    }
    return Promise.resolve();
  }

  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return <Text c="red">Failed to load lineups. Please try again.</Text>;
  }

  if (selectedWeek) {
    const closed = isWeekClosed(selectedWeek);
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
          lineup={selectedWeek}
          onSubmit={handleSubmit}
          existingSubmission={submissions[selectedWeek.week]}
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
          openWeeks.map((lineup) => <WeekRow key={lineup.week} lineup={lineup} onClick={() => selectWeek(lineup)} />)
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
              {closedWeeks.map((lineup) => (
                <WeekRow key={lineup.week} lineup={lineup} onClick={() => selectWeek(lineup)} />
              ))}
            </Stack>
          </Collapse>
        </Stack>
      )}
    </Stack>
  );
}
