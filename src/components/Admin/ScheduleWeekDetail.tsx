import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  NumberInput,
  Paper,
  Radio,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  Textarea,
} from '@mantine/core';

import { getScheduleWeekDetail, updateScheduleWeek } from '@/app/API/adminFunctions';
import type { ScheduleGame, WeekDetail, WeekMeta, WeekUpdateBody } from '@/types/schedules';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Converts a stored ISO timestamp into a value suitable for
 * <input type="datetime-local"> in the viewer's local timezone.
 *
 * Example:
 *   "2025-09-04T20:25:00.000Z" -> "2025-09-04T16:25" (for America/New_York in EDT)
 */
function isoToDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Converts a local datetime-local input value into a real UTC ISO string.
 *
 * Example:
 *   "2025-09-04T16:25" -> "2025-09-04T20:25:00.000Z" (for America/New_York in EDT)
 */
function dateTimeLocalToIso(val: string): string | null {
  if (!val) return null;

  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

/**
 * Formats an ISO timestamp in the viewer's local timezone and includes
 * the timezone abbreviation to remove ambiguity.
 */
function formatLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatKickoff(startTime: string): string {
  return formatLocalDateTime(startTime);
}

function getLocalTimeZoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time';
  } catch {
    return 'Local Time';
  }
}

const SEASON_TYPE_LABELS: Record<string, string> = {
  '1': 'Preseason',
  '2': 'Regular Season',
  '3': 'Playoffs',
};

// ── Form state types ──────────────────────────────────────────────────────────

interface MetaFormState {
  is_published: boolean;
  submission_opens_at: string;
  submission_closes_at: string;
  notes: string;
  round_name: string;
  allow_straight_bets: boolean;
  allow_parlay: boolean;
  parlay_leg_count: number;
}

interface GameFormState {
  include_in_rank: boolean;
  include_in_file: boolean;
  description: string;
  special_tag: string;
  is_wagerable: boolean;
}

function metaToFormState(meta: WeekMeta): MetaFormState {
  return {
    is_published: meta.is_published,
    submission_opens_at: isoToDateTimeLocal(meta.submission_opens_at),
    submission_closes_at: isoToDateTimeLocal(meta.submission_closes_at),
    notes: meta.notes ?? '',
    round_name: meta.round_name ?? '',
    allow_straight_bets: meta.allow_straight_bets ?? true,
    allow_parlay: meta.allow_parlay ?? false,
    parlay_leg_count: meta.parlay_leg_count ?? 2,
  };
}

function gameToFormState(game: ScheduleGame): GameFormState {
  return {
    include_in_rank: game.include_in_rank ?? true,
    include_in_file: game.include_in_file ?? true,
    description: game.description ?? '',
    special_tag: game.special_tag ?? '',
    is_wagerable: game.is_wagerable ?? false,
  };
}

function buildSaveBody(
  meta: WeekMeta,
  metaForm: MetaFormState,
  gamesForms: Record<string, GameFormState>,
  games: ScheduleGame[],
): WeekUpdateBody {
  const baseMeta = {
    is_published: metaForm.is_published,
    submission_opens_at: dateTimeLocalToIso(metaForm.submission_opens_at),
    submission_closes_at: dateTimeLocalToIso(metaForm.submission_closes_at),
    notes: metaForm.notes || null,
  };

  if (meta.kind === 'playoff') {
    return {
      meta: {
        ...baseMeta,
        round_name: metaForm.round_name,
        allow_straight_bets: metaForm.allow_straight_bets,
        allow_parlay: metaForm.allow_parlay,
        parlay_leg_count: metaForm.parlay_leg_count,
      },
      games: games.map((g) => ({
        game_id: g.game_id,
        is_wagerable: gamesForms[g.game_id]?.is_wagerable ?? false,
      })),
    };
  }

  return {
    meta: baseMeta,
    games: games.map((g) => ({
      game_id: g.game_id,
      include_in_rank: gamesForms[g.game_id]?.include_in_rank ?? true,
      include_in_file: gamesForms[g.game_id]?.include_in_file ?? true,
      description: gamesForms[g.game_id]?.description || null,
      special_tag: gamesForms[g.game_id]?.special_tag || null,
    })),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  year: string;
  seasonType: string;
  week: string;
}

export default function ScheduleWeekDetail({ year, seasonType, week }: Props) {
  const queryClient = useQueryClient();
  const [, setSearchParams] = useSearchParams();
  const localTimeZone = useMemo(() => getLocalTimeZoneLabel(), []);

  const {
    data: detail,
    isLoading,
    isError,
  } = useQuery<WeekDetail>({
    queryKey: ['scheduleWeekDetail', year, seasonType, week],
    queryFn: () => getScheduleWeekDetail(year, seasonType, week),
  });

  const [metaForm, setMetaForm] = useState<MetaFormState>({
    is_published: false,
    submission_opens_at: '',
    submission_closes_at: '',
    notes: '',
    round_name: '',
    allow_straight_bets: true,
    allow_parlay: false,
    parlay_leg_count: 2,
  });
  const [gamesForms, setGamesForms] = useState<Record<string, GameFormState>>({});
  const [initialized, setInitialized] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!detail || initialized) return;
    setMetaForm(metaToFormState(detail.meta));
    setGamesForms(Object.fromEntries(detail.games.map((g) => [g.game_id, gameToFormState(g)])));
    setInitialized(true);
  }, [detail, initialized]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateScheduleWeek(year, seasonType, week, buildSaveBody(detail!.meta, metaForm, gamesForms, detail!.games)),
    onSuccess: (data) => {
      queryClient.setQueryData(['scheduleWeekDetail', year, seasonType, week], data);
      queryClient.invalidateQueries({ queryKey: ['scheduleWeeks'] });
      setMetaForm(metaToFormState(data.meta));
      setGamesForms(Object.fromEntries(data.games.map((g) => [g.game_id, gameToFormState(g)])));
      setSaveError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
      setSaveSuccess(false);
    },
  });

  function handleBack() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('week');
      return next;
    });
  }

  function updateMeta<K extends keyof MetaFormState>(key: K, value: MetaFormState[K]) {
    setMetaForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateGame(gameId: string, updates: Partial<GameFormState>) {
    setGamesForms((prev) => ({
      ...prev,
      [gameId]: { ...prev[gameId], ...updates },
    }));
  }

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton height={44} width={180} radius="md" />
        <Skeleton height={36} radius="md" />
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Skeleton height={380} radius="md" />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={110} radius="md" />
              ))}
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    );
  }

  if (isError || !detail) {
    return (
      <Stack gap="md">
        <Button variant="subtle" w="fit-content" px={0} onClick={handleBack}>
          ← Back to Schedule
        </Button>
        <Alert color="red" title="Failed to load week">
          Could not load week details. Go back and try again.
        </Alert>
      </Stack>
    );
  }

  const isPlayoff = detail.meta.kind === 'playoff';
  const weekLabel = isPlayoff && detail.meta.round_name ? detail.meta.round_name : `Week ${detail.meta.week}`;
  const seasonLabel = SEASON_TYPE_LABELS[seasonType] ?? `Season ${seasonType}`;

  const sortedGames = [...detail.games].sort((a, b) => {
    const ta = a.espn?.start_time ?? '';
    const tb = b.espn?.start_time ?? '';
    return ta.localeCompare(tb);
  });

  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Button variant="subtle" w="fit-content" px={0} onClick={handleBack}>
          ← Back to Schedule
        </Button>
        <Group gap="sm" align="center" wrap="wrap">
          <Title order={2} lh={1}>
            {weekLabel}
          </Title>
          <Text size="lg" c="dimmed">
            {year} · {seasonLabel}
          </Text>
          <Badge color={isPlayoff ? 'grape' : 'blue'} variant="light">
            {isPlayoff ? 'Playoff' : 'Regular Season'}
          </Badge>
          <Badge color={metaForm.is_published ? 'green' : 'yellow'} variant="light">
            {metaForm.is_published ? 'Published' : 'Draft'}
          </Badge>
        </Group>
      </Stack>

      {saveError && (
        <Alert color="red" title="Save failed" withCloseButton onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}
      {saveSuccess && (
        <Alert color="green" title="Saved">
          Week saved successfully.
        </Alert>
      )}

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="lg" radius="md" h="100%">
            <Stack gap="md">
              <Text fw={700} size="sm" tt="uppercase" c="dimmed">
                Week Settings
              </Text>

              <Switch
                label="Published"
                description="Visible to all participants when enabled."
                size="md"
                color="green"
                checked={metaForm.is_published}
                onChange={(e) => updateMeta('is_published', e.currentTarget.checked)}
              />

              <Divider />

              <Stack gap="xs">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                  Submission Window ({localTimeZone})
                </Text>
                <TextInput
                  label="Opens at"
                  description={
                    metaForm.submission_opens_at
                      ? `${formatLocalDateTime(dateTimeLocalToIso(metaForm.submission_opens_at))}`
                      : `Enter local time (${localTimeZone})`
                  }
                  type="datetime-local"
                  value={metaForm.submission_opens_at}
                  onChange={(e) => updateMeta('submission_opens_at', e.currentTarget.value)}
                />
                <TextInput
                  label="Closes at"
                  description={
                    metaForm.submission_closes_at
                      ? `${formatLocalDateTime(dateTimeLocalToIso(metaForm.submission_closes_at))}`
                      : `Enter local time (${localTimeZone})`
                  }
                  type="datetime-local"
                  value={metaForm.submission_closes_at}
                  onChange={(e) => updateMeta('submission_closes_at', e.currentTarget.value)}
                />
              </Stack>

              <Textarea
                label="Notes"
                placeholder="Optional notes visible to admins only..."
                value={metaForm.notes}
                onChange={(e) => updateMeta('notes', e.currentTarget.value)}
                minRows={2}
                autosize
              />

              {isPlayoff && (
                <>
                  <Divider label="Playoff Settings" labelPosition="left" />
                  <TextInput
                    label="Round Name"
                    placeholder="e.g. Divisional Round"
                    value={metaForm.round_name}
                    onChange={(e) => updateMeta('round_name', e.currentTarget.value)}
                  />
                  <Switch
                    label="Allow Straight Bets"
                    checked={metaForm.allow_straight_bets}
                    onChange={(e) => updateMeta('allow_straight_bets', e.currentTarget.checked)}
                  />
                  <Switch
                    label="Allow Parlay"
                    checked={metaForm.allow_parlay}
                    onChange={(e) => updateMeta('allow_parlay', e.currentTarget.checked)}
                  />
                  {metaForm.allow_parlay && (
                    <NumberInput
                      label="Parlay Leg Count"
                      value={metaForm.parlay_leg_count}
                      onChange={(val) => updateMeta('parlay_leg_count', typeof val === 'number' ? val : 2)}
                      min={2}
                      max={16}
                    />
                  )}
                </>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="sm">
            <Text fw={700} size="sm" tt="uppercase" c="dimmed">
              {sortedGames.length} {sortedGames.length === 1 ? 'Game' : 'Games'}
            </Text>

            {sortedGames.length === 0 && (
              <Paper withBorder p="xl" radius="md" ta="center">
                <Text size="sm" c="dimmed">
                  No games configured for this week.
                </Text>
              </Paper>
            )}

            {sortedGames.map((game) => {
              const form = gamesForms[game.game_id];
              if (!form) return null;
              const espn = game.espn;

              return (
                <Paper key={game.game_id} withBorder p="md" radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Stack gap={2}>
                        {espn ? (
                          <>
                            <Text fw={700} size="lg" lh={1.2}>
                              {espn.away} @ {espn.home}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatKickoff(espn.start_time)}
                            </Text>
                            {espn.venue_full_name && (
                              <Text size="xs" c="dimmed">
                                {espn.venue_full_name}
                                {espn.venue_city ? `, ${espn.venue_city}` : ''}
                                {espn.venue_state ? `, ${espn.venue_state}` : ''}
                              </Text>
                            )}
                          </>
                        ) : (
                          <Text size="sm" c="dimmed">
                            Game {game.game_id} · ESPN data not yet available
                          </Text>
                        )}
                      </Stack>
                      <Group gap={4} wrap="nowrap">
                        {espn?.is_international && (
                          <Badge size="xs" color="orange" variant="light">
                            Intl
                          </Badge>
                        )}
                        {espn?.neutral_site && (
                          <Badge size="xs" color="gray" variant="light">
                            Neutral
                          </Badge>
                        )}
                      </Group>
                    </Group>

                    <Divider />

                    {isPlayoff ? (
                      <Switch
                        label="Wagerable"
                        description="Include this game in the betting pool."
                        checked={form.is_wagerable}
                        onChange={(e) => updateGame(game.game_id, { is_wagerable: e.currentTarget.checked })}
                      />
                    ) : (
                      <Stack gap="sm">
                        <Group gap="xl" wrap="wrap" align="flex-start">
                          <Radio.Group
                            label="Include in"
                            value={form.include_in_rank ? 'in_rank' : form.include_in_file ? 'in_file' : 'unused'}
                            onChange={(val) =>
                              updateGame(game.game_id, {
                                include_in_rank: val === 'in_rank',
                                include_in_file: val === 'in_file',
                              })
                            }
                          >
                            <Group gap="sm" mt={6}>
                              <Radio value="in_rank" label="Rank" />
                              <Radio value="in_file" label="File" />
                              <Radio value="unused" label="Unused" />
                            </Group>
                          </Radio.Group>

                          <Radio.Group
                            label="Special tag"
                            value={
                              form.special_tag === 'thanksgiving' || form.special_tag === 'christmas'
                                ? form.special_tag
                                : 'none'
                            }
                            onChange={(val) => updateGame(game.game_id, { special_tag: val === 'none' ? '' : val })}
                          >
                            <Group gap="sm" mt={6}>
                              <Radio value="none" label="None" />
                              <Radio value="thanksgiving" label="Thanksgiving" />
                              <Radio value="christmas" label="Christmas" />
                            </Group>
                          </Radio.Group>
                        </Group>

                        <TextInput
                          label="Description"
                          placeholder="Optional note..."
                          value={form.description}
                          onChange={(e) => updateGame(game.game_id, { description: e.currentTarget.value })}
                          size="xs"
                        />
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Grid.Col>
      </Grid>

      <Group justify="flex-end" pt="xs">
        <Button
          size="md"
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          style={{
            backgroundColor: 'var(--app-primary-button-bg)',
            color: 'var(--app-primary-button-text)',
          }}
        >
          Save Changes
        </Button>
      </Group>
    </Stack>
  );
}
