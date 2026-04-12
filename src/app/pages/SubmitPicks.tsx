import { useState } from 'react';

import { Loader, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';

import PlayOffs from '@/components/submissions/PlayOffs';
import RegularSeason from '@/components/submissions/RegularSeason';
import { getSeasonPhase, getYears } from '@/app/API/scheduleFunctions';
import type { PickKind } from '@/types/submissions';

export default function SubmitPicksRoute() {
  const [weekSelected, setWeekSelected] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const {
    data: phase,
    isLoading: isLoadingPhase,
    isError: isPhaseError,
  } = useQuery({
    queryKey: ['seasonPhase'],
    queryFn: getSeasonPhase,
  });

  const {
    data: years,
    isLoading: isLoadingYears,
    isError: isYearsError,
  } = useQuery({
    queryKey: ['years'],
    queryFn: getYears,
  });

  const [view, setView] = useState<PickKind | null>(null);
  const latestYear = years?.length ? Math.max(...years) : null;

  const resolvedView: PickKind = view ?? (phase === 'playoff' ? 'playoff' : 'regular');
  const resolvedYear = year ?? latestYear;

  function handleViewChange(v: string) {
    setView(v as PickKind);
    setWeekSelected(false);
  }

  function handleYearChange(v: string) {
    setYear(Number(v));
    setWeekSelected(false);
  }

  if (isLoadingPhase || isLoadingYears) {
    return <Loader />;
  }

  if (isPhaseError || isYearsError || !phase || !resolvedYear) {
    return <Text c="red">Failed to load season info. Please try again.</Text>;
  }

  return (
    <Stack gap="lg">
      {!weekSelected && (
        <>
          <Select
            label="Year"
            value={String(resolvedYear)}
            onChange={(value) => value && handleYearChange(value)}
            data={(years ?? []).map((availableYear) => ({
              label: String(availableYear),
              value: String(availableYear),
            }))}
            allowDeselect={false}
          />
          <SegmentedControl
            value={resolvedView}
            onChange={handleViewChange}
            data={[
              { label: 'Regular Season', value: 'regular' },
              { label: 'Playoffs', value: 'playoff' },
            ]}
            size="sm"
            fullWidth
          />
        </>
      )}
      {resolvedView === 'regular' ? (
        <RegularSeason year={resolvedYear} onSelectionChange={setWeekSelected} />
      ) : (
        <PlayOffs year={resolvedYear} onSelectionChange={setWeekSelected} />
      )}
    </Stack>
  );
}
