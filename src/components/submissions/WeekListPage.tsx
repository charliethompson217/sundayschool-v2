import { type ReactNode, useState } from 'react';

import { ActionIcon, Button, Collapse, Divider, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconChevronDown, IconChevronLeft, IconChevronUp } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import type { WeekMeta } from '@/types/schedules';

import { isWeekClosed, isWeekNotYetOpen } from './weekUtils';

// ── WeekListPage ─────────────────────────────────────────────────────────────

interface WeekListPageProps<T> {
  title: string;
  emptyMessage: string;
  localStorageKey: string;
  closedLabel?: string;
  queryKey: string;
  queryFn: () => Promise<WeekMeta[]>;
  submissions: Record<number, T>;
  submitPicks: (year: number, seasonType: number, week: number, submission: T) => Promise<void>;
  renderForm: (props: {
    weekMeta: WeekMeta;
    onSubmit: (submission: T) => Promise<void>;
    existingSubmission: T | undefined;
    readOnly: boolean;
  }) => ReactNode;
  renderWeekRow: (meta: WeekMeta, onClick: () => void) => ReactNode;
  onSelectionChange?: (hasSelection: boolean) => void;
  extraLoading?: boolean;
}

export default function WeekListPage<T>({
  title,
  emptyMessage,
  localStorageKey,
  closedLabel = 'previous weeks',
  queryKey,
  queryFn,
  submissions,
  submitPicks,
  renderForm,
  renderWeekRow,
  onSelectionChange,
  extraLoading,
}: WeekListPageProps<T>) {
  const [selectedWeek, setSelectedWeek] = useState<WeekMeta | null>(null);
  const [showClosed, setShowClosed] = useState(() => {
    return localStorage.getItem(localStorageKey) === 'true';
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
    queryKey: [queryKey],
    queryFn,
  });

  const openWeeks = weekMetas?.filter((m) => !isWeekClosed(m) && !isWeekNotYetOpen(m)) ?? [];
  const closedWeeks = weekMetas?.filter((m) => isWeekClosed(m)) ?? [];

  function handleSubmit(submission: T) {
    if (selectedWeek) {
      return submitPicks(
        parseInt(selectedWeek.year, 10),
        parseInt(selectedWeek.season_type, 10),
        parseInt(selectedWeek.week, 10),
        submission,
      );
    }
    return Promise.resolve();
  }

  if (isLoading || extraLoading) {
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
            Back to {closedLabel.includes('round') ? 'rounds' : 'weeks'}
          </Text>
        </Group>

        {renderForm({
          weekMeta: selectedWeek,
          onSubmit: handleSubmit,
          existingSubmission: submissions[weekNum],
          readOnly: closed,
        })}
      </Stack>
    );
  }

  return (
    <Stack>
      <Title order={3}>{title}</Title>
      <Text size="sm" c="dimmed">
        Select a {closedLabel.includes('round') ? 'round' : 'week'} to submit or review your picks.
      </Text>

      <Stack gap="sm">
        {openWeeks.length > 0 ? (
          openWeeks.map((meta) => <div key={meta.week}>{renderWeekRow(meta, () => selectWeek(meta))}</div>)
        ) : (
          <Text size="sm" c="dimmed">
            {emptyMessage}
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
                    localStorage.setItem(localStorageKey, String(next));
                    return next;
                  })
                }
              >
                {showClosed ? 'Hide' : 'Show'} {closedLabel} ({closedWeeks.length})
              </Button>
            }
          />
          <Collapse in={showClosed}>
            <Stack gap="sm">
              {closedWeeks.map((meta) => (
                <div key={meta.week}>{renderWeekRow(meta, () => selectWeek(meta))}</div>
              ))}
            </Stack>
          </Collapse>
        </Stack>
      )}
    </Stack>
  );
}
