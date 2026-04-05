import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Group, Paper, Select, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';

import { getScheduleWeeks } from '@/app/API/adminFunctions';
import type { WeekMeta } from '@/types/schedules';

import ScheduleWeekCard from './ScheduleWeekCard';

const CURRENT_YEAR = new Date().getFullYear();

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const y = (CURRENT_YEAR - i).toString();
  return { value: y, label: y };
});

const SEASON_TYPE_OPTIONS = [
  { value: '2', label: 'Regular Season' },
  { value: '3', label: 'Playoffs' },
];

const LS_YEAR_KEY = 'scheduleWeekList_year';
const LS_SEASON_TYPE_KEY = 'scheduleWeekList_seasonType';

function resolveParam(searchParams: URLSearchParams, key: string, lsKey: string, fallback: string): string {
  return searchParams.get(key) ?? localStorage.getItem(lsKey) ?? fallback;
}

export default function ScheduleWeekList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [yearInput, setYearInput] = useState(() =>
    resolveParam(searchParams, 'year', LS_YEAR_KEY, CURRENT_YEAR.toString()),
  );
  const [seasonTypeInput, setSeasonTypeInput] = useState(() =>
    resolveParam(searchParams, 'seasonType', LS_SEASON_TYPE_KEY, '2'),
  );
  const [committed, setCommitted] = useState(() => ({
    year: resolveParam(searchParams, 'year', LS_YEAR_KEY, CURRENT_YEAR.toString()),
    seasonType: resolveParam(searchParams, 'seasonType', LS_SEASON_TYPE_KEY, '2'),
  }));

  // Sync query params on mount if they were missing but localStorage had values
  useEffect(() => {
    const yearInUrl = searchParams.get('year');
    const seasonTypeInUrl = searchParams.get('seasonType');
    if (!yearInUrl || !seasonTypeInUrl) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!yearInUrl) next.set('year', committed.year);
          if (!seasonTypeInUrl) next.set('seasonType', committed.seasonType);
          return next;
        },
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    data: weeks = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['scheduleWeeks', committed],
    queryFn: () => getScheduleWeeks({ year: committed.year, seasonType: committed.seasonType }),
  });

  function handleLoad() {
    setCommitted({ year: yearInput, seasonType: seasonTypeInput });
    localStorage.setItem(LS_YEAR_KEY, yearInput);
    localStorage.setItem(LS_SEASON_TYPE_KEY, seasonTypeInput);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('year', yearInput);
        next.set('seasonType', seasonTypeInput);
        next.delete('week');
        return next;
      },
      { replace: true },
    );
  }

  function handleSelectWeek(meta: WeekMeta) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('year', meta.year);
      next.set('seasonType', meta.season_type);
      next.set('week', meta.week);
      return next;
    });
  }

  const seasonLabel = SEASON_TYPE_OPTIONS.find((o) => o.value === committed.seasonType)?.label ?? 'Season';

  const sortedWeeks = [...weeks].sort((a, b) => parseInt(a.week) - parseInt(b.week));

  return (
    <Stack gap="lg">
      {/* Filter bar */}
      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <Select
            label="Year"
            value={yearInput}
            onChange={(v) => setYearInput(v ?? CURRENT_YEAR.toString())}
            data={YEAR_OPTIONS}
            w={100}
            allowDeselect={false}
          />
          <Select
            label="Season Type"
            value={seasonTypeInput}
            onChange={(v) => setSeasonTypeInput(v ?? '2')}
            data={SEASON_TYPE_OPTIONS}
            w={170}
            allowDeselect={false}
          />
          <Button onClick={handleLoad}>Load</Button>
          {!isLoading && !isError && (
            <Badge
              variant="outline"
              size="lg"
              style={{
                background: 'var(--app-admin-table-summary-chip-bg)',
                color: 'var(--app-admin-table-summary-chip-text)',
                borderColor: 'var(--app-admin-table-summary-chip-border)',
                fontWeight: 600,
              }}
            >
              {weeks.length} {weeks.length === 1 ? 'week' : 'weeks'}
            </Badge>
          )}
        </Group>
      </Paper>

      {/* Section heading */}
      <div>
        <Title order={3}>
          {committed.year} {seasonLabel}
        </Title>
        <Text size="sm" c="dimmed" mt={2}>
          Weeks are created automatically when ESPN games are ingested. Click a week to view or edit its settings.
        </Text>
      </div>

      {/* Error */}
      {isError && (
        <Alert color="red" title="Failed to load weeks">
          Something went wrong fetching schedule weeks. Please try again.
        </Alert>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={130} radius="md" />
          ))}
        </SimpleGrid>
      )}

      {/* Empty state */}
      {!isLoading && !isError && weeks.length === 0 && (
        <Paper withBorder p="xl" radius="md" ta="center">
          <Text size="lg" fw={600} mb="xs">
            No weeks found
          </Text>
          <Text size="sm" c="dimmed">
            Schedule weeks appear here automatically once ESPN games are ingested for this season.
          </Text>
        </Paper>
      )}

      {/* Week cards */}
      {!isLoading && sortedWeeks.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {sortedWeeks.map((meta) => (
            <ScheduleWeekCard
              key={`${meta.year}-${meta.season_type}-${meta.week}`}
              meta={meta}
              onClick={() => handleSelectWeek(meta)}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
