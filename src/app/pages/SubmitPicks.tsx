import { useState } from 'react';

import { Loader, SegmentedControl, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';

import PlayOffs from '@/components/submissions/PlayOffs';
import RegularSeason from '@/components/submissions/RegularSeason';
import { getSeasonPhase } from '@/app/API/functions';

type View = 'playoffs' | 'regular';

export default function SubmitPicksRoute() {
  const [weekSelected, setWeekSelected] = useState(false);

  const {
    data: phase,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['seasonPhase'],
    queryFn: getSeasonPhase,
  });

  const [view, setView] = useState<View | null>(null);

  // Default view tracks the resolved phase; view can be overridden by the user.
  const resolvedView: View = view ?? (phase === 'playoffs' ? 'playoffs' : 'regular');

  function handleViewChange(v: string) {
    setView(v as View);
    setWeekSelected(false);
  }

  if (isLoading) {
    return <Loader />;
  }

  if (isError || !phase) {
    return <Text c="red">Failed to load season info. Please try again.</Text>;
  }

  return (
    <Stack gap="lg">
      {!weekSelected && (
        <SegmentedControl
          value={resolvedView}
          onChange={handleViewChange}
          data={[
            { label: 'Regular Season', value: 'regular' },
            { label: 'Playoffs', value: 'playoffs' },
          ]}
          size="sm"
          fullWidth
        />
      )}
      {resolvedView === 'regular' ? <RegularSeason onSelectionChange={setWeekSelected} /> : <PlayOffs />}
    </Stack>
  );
}
