import { useState } from 'react';
import { Badge, Group, Paper, Stack, Text } from '@mantine/core';

import type { WeekMeta } from '@/types/schedules';

const SEASON_LABELS: Record<string, string> = {
  '1': 'Preseason',
  '2': 'Regular Season',
  '3': 'Playoffs',
};

function formatWindowDate(iso: string): string {
  return (
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }) + ' UTC'
  );
}

interface Props {
  meta: WeekMeta;
  onClick: () => void;
}

export default function ScheduleWeekCard({ meta, onClick }: Props) {
  const [hovered, setHovered] = useState(false);

  const weekLabel = meta.kind === 'playoff' && meta.round_name ? meta.round_name : `Week ${meta.week}`;
  const seasonLabel = SEASON_LABELS[meta.season_type] ?? `Season ${meta.season_type}`;

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        transition: 'background-color 100ms ease',
        backgroundColor: hovered ? 'var(--app-admin-table-hover-bg)' : undefined,
        borderColor: 'var(--app-admin-table-border)',
      }}
    >
      <Stack gap="xs">
        {/* Top row: season label + badges */}
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ flexShrink: 0 }}>
            {seasonLabel} · {meta.year}
          </Text>
          <Group gap={4} wrap="nowrap">
            <Badge size="xs" variant="light" color={meta.kind === 'playoff' ? 'grape' : 'blue'}>
              {meta.kind === 'playoff' ? 'Playoff' : 'Regular'}
            </Badge>
            <Badge size="xs" variant="light" color={meta.is_published ? 'green' : 'yellow'}>
              {meta.is_published ? 'Published' : 'Draft'}
            </Badge>
          </Group>
        </Group>

        {/* Week title */}
        <Text fw={700} size="xl" lh={1.2}>
          {weekLabel}
        </Text>

        {/* Submission window */}
        {meta.submission_opens_at || meta.submission_closes_at ? (
          <Stack gap={2} mt={2}>
            {meta.submission_opens_at && (
              <Text size="xs" c="dimmed">
                Opens · {formatWindowDate(meta.submission_opens_at)}
              </Text>
            )}
            {meta.submission_closes_at && (
              <Text size="xs" c="dimmed">
                Closes · {formatWindowDate(meta.submission_closes_at)}
              </Text>
            )}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed" mt={2}>
            No submission window set
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
