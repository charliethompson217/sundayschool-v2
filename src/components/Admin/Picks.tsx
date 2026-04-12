import { useState } from 'react';

import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconClock, IconCoin, IconTrophy, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { getAdminWeekSubmissions, getScheduleWeekDetail, getScheduleWeeks, getUsers } from '@/app/API/adminFunctions';
import getLogo from '@/assets/logo-map';
import type { ScheduleGame, WeekMeta } from '@/types/schedules';
import type { TeamID } from '@/types/teams';
import { getTeamName } from '@/types/teams';

// ── Constants ─────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const y = (CURRENT_YEAR - i).toString();
  return { value: y, label: y };
});
const SEASON_TYPE_OPTIONS = [
  { value: '2', label: 'Regular Season' },
  { value: '3', label: 'Playoffs' },
];

const CELL_SIZE = 52;

// ── Team logo cell ────────────────────────────────────────────────────────────

function TeamCell({ teamId, rank }: { teamId: TeamID; rank?: number }) {
  return (
    <Tooltip label={getTeamName(teamId, 'full')} withArrow>
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: CELL_SIZE,
          height: CELL_SIZE,
          backgroundColor: 'var(--mantine-color-default-border)',
          borderRadius: 8,
          flexShrink: 0,
          gap: 2,
        }}
      >
        <img src={getLogo(teamId)} alt={teamId} style={{ width: 28, height: 28, objectFit: 'contain' }} />
        {rank !== undefined && (
          <Text size="xs" fw={800} c="dimmed" lh={1}>
            {rank}
          </Text>
        )}
      </Box>
    </Tooltip>
  );
}

function SubmittedAt({ iso }: { iso: string }) {
  return (
    <Group gap={4}>
      <IconClock size={11} color="var(--mantine-color-dimmed)" />
      <Text size="xs" c="dimmed">
        {new Date(iso).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </Text>
    </Group>
  );
}

// ── "Did not submit" placeholder ──────────────────────────────────────────────

function NotSubmittedRow({ name }: { name: string }) {
  return (
    <Paper p="sm" radius="md" withBorder style={{ opacity: 0.55 }}>
      <Group gap="sm">
        <ThemeIcon size={32} radius="xl" color="gray" variant="light">
          <IconX size={16} />
        </ThemeIcon>
        <Stack gap={0}>
          <Text fw={600} size="sm">
            {name}
          </Text>
          <Text size="xs" c="dimmed">
            No submission
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}

// ── Regular season picks card ─────────────────────────────────────────────────

function RegularPicksCard({
  name,
  rankedPicks,
  filedPicks,
  submittedAt,
}: {
  name: string;
  rankedPicks: { matchup: [TeamID, TeamID]; winner: TeamID }[];
  filedPicks: { matchup: [TeamID, TeamID]; winner: TeamID }[];
  submittedAt: string;
}) {
  const n = rankedPicks.length;
  return (
    <Paper p="sm" radius="md" withBorder>
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Group gap="sm" align="center">
            <ThemeIcon size={32} radius="xl" color="green" variant="light">
              <IconCheck size={16} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text fw={600} size="sm">
                {name}
              </Text>
              <SubmittedAt iso={submittedAt} />
            </Stack>
          </Group>
          <Group gap="xs">
            <Badge size="sm" variant="light" color="blue">
              {n} ranked
            </Badge>
            {filedPicks.length > 0 && (
              <Badge size="sm" variant="light" color="gray">
                {filedPicks.length} bonus
              </Badge>
            )}
          </Group>
        </Group>

        {rankedPicks.length > 0 && (
          <>
            <Text size="xs" c="dimmed" fw={500}>
              Ranked picks — most confident first
            </Text>
            <Box style={{ overflowX: 'auto' }}>
              <Group gap={4} wrap="nowrap">
                {rankedPicks.map((pick, i) => (
                  <TeamCell key={i} teamId={pick.winner} rank={n - i} />
                ))}
              </Group>
            </Box>
          </>
        )}

        {filedPicks.length > 0 && (
          <>
            <Divider />
            <Text size="xs" c="dimmed" fw={500}>
              Bonus picks
            </Text>
            <Box style={{ overflowX: 'auto' }}>
              <Group gap={4} wrap="nowrap">
                {filedPicks.map((pick, i) => (
                  <TeamCell key={i} teamId={pick.winner} />
                ))}
              </Group>
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}

// ── Playoff picks card ────────────────────────────────────────────────────────

// Maps ESPN game_id → { home, away } using the week's schedule detail
type GameMap = Record<string, { home: TeamID; away: TeamID }>;

function PlayoffPicksCard({
  name,
  straightBets,
  parlayBet,
  submittedAt,
  gameMap,
}: {
  name: string;
  straightBets: { gameId: string; side: 'home' | 'away'; amount: number }[];
  parlayBet: { legs: { gameId: string; side: 'home' | 'away' }[]; amount: number } | null;
  submittedAt: string;
  gameMap: GameMap;
}) {
  const totalWagered = straightBets.reduce((s, b) => s + b.amount, 0) + (parlayBet?.amount ?? 0);

  function teamForSide(gameId: string, side: 'home' | 'away'): TeamID | null {
    const g = gameMap[gameId];
    if (!g) return null;
    return side === 'home' ? g.home : g.away;
  }

  function opponentForSide(gameId: string, side: 'home' | 'away'): TeamID | null {
    const g = gameMap[gameId];
    if (!g) return null;
    return side === 'home' ? g.away : g.home;
  }

  const hasAnyBet = straightBets.length > 0 || !!parlayBet;

  return (
    <Paper p="sm" radius="md" withBorder>
      <Stack gap="xs">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="sm" align="center">
            <ThemeIcon size={32} radius="xl" color="yellow" variant="light">
              <IconTrophy size={16} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text fw={600} size="sm">
                {name}
              </Text>
              <SubmittedAt iso={submittedAt} />
            </Stack>
          </Group>
          {totalWagered > 0 && (
            <Badge size="sm" variant="light" color="yellow" leftSection={<IconCoin size={10} />}>
              {totalWagered.toLocaleString()} wagered
            </Badge>
          )}
        </Group>

        {!hasAnyBet && (
          <Text size="xs" c="dimmed">
            No bets placed this round.
          </Text>
        )}

        {/* Straight bets */}
        {straightBets.length > 0 && (
          <Stack gap={6}>
            <Text size="xs" c="dimmed" fw={500}>
              Straight bets
            </Text>
            {straightBets.map((bet) => {
              const picked = teamForSide(bet.gameId, bet.side);
              const opp = opponentForSide(bet.gameId, bet.side);
              return (
                <Group key={bet.gameId} justify="space-between" align="center" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    {picked && <TeamCell teamId={picked} />}
                    <Stack gap={0}>
                      <Text size="sm" fw={600}>
                        {picked ? getTeamName(picked, 'mascot') : bet.gameId}
                      </Text>
                      {opp && (
                        <Text size="xs" c="dimmed">
                          vs {getTeamName(opp, 'mascot')}
                        </Text>
                      )}
                    </Stack>
                  </Group>
                  <Badge variant="light" color="blue" size="md" leftSection={<IconCoin size={11} />}>
                    {bet.amount.toLocaleString()}
                  </Badge>
                </Group>
              );
            })}
          </Stack>
        )}

        {/* Parlay bet */}
        {parlayBet && (
          <>
            {straightBets.length > 0 && <Divider />}
            <Stack gap={6}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={500}>
                  Parlay — {parlayBet.legs.length} legs
                </Text>
                <Badge variant="light" color="violet" size="md" leftSection={<IconCoin size={11} />}>
                  {parlayBet.amount.toLocaleString()}
                </Badge>
              </Group>
              {parlayBet.legs.map((leg) => {
                const picked = teamForSide(leg.gameId, leg.side);
                const opp = opponentForSide(leg.gameId, leg.side);
                return (
                  <Group key={leg.gameId} gap="xs" wrap="nowrap">
                    <Badge size="xs" radius="sm" color="violet" variant="light" w={18} p={0} ta="center">
                      +
                    </Badge>
                    {picked && <TeamCell teamId={picked} />}
                    <Stack gap={0}>
                      <Text size="sm" fw={600}>
                        {picked ? getTeamName(picked, 'mascot') : leg.gameId}
                      </Text>
                      {opp && (
                        <Text size="xs" c="dimmed">
                          vs {getTeamName(opp, 'mascot')}
                        </Text>
                      )}
                    </Stack>
                  </Group>
                );
              })}
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Picks() {
  // Inputs (not yet committed)
  const [yearInput, setYearInput] = useState(localStorage.getItem('adminPicks_year') ?? CURRENT_YEAR.toString());
  const [seasonTypeInput, setSeasonTypeInput] = useState(localStorage.getItem('adminPicks_seasonType') ?? '2');

  // Whether a Load has been executed for the current inputs.
  // Changing year or seasonType resets this so the week selector disappears.
  const [loadedFilter, setLoadedFilter] = useState<{ year: string; seasonType: string } | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const isPlayoff = (loadedFilter?.seasonType ?? seasonTypeInput) === '3';

  // ── Data fetching ────────────────────────────────────────────────────────

  const { data: users = [] } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: getUsers,
  });

  const { data: weeks = [], isLoading: isLoadingWeeks } = useQuery({
    queryKey: ['scheduleWeeks', loadedFilter],
    queryFn: () => getScheduleWeeks({ year: loadedFilter!.year, seasonType: loadedFilter!.seasonType }),
    enabled: !!loadedFilter,
  });

  const weekOptions = [...weeks]
    .sort((a: WeekMeta, b: WeekMeta) => parseInt(a.week) - parseInt(b.week))
    .map((w: WeekMeta) => ({ value: w.week, label: w.round_name ?? `Week ${w.week}` }));

  // Fetch week detail (needed to map gameId → teams for playoff bets)
  const { data: weekDetail } = useQuery({
    queryKey: ['scheduleWeekDetail', loadedFilter?.year, loadedFilter?.seasonType, selectedWeek],
    queryFn: () => getScheduleWeekDetail(loadedFilter!.year, loadedFilter!.seasonType, selectedWeek!),
    enabled: !!loadedFilter && !!selectedWeek && isPlayoff,
  });

  // Build gameId → { home, away } map from the week detail's ESPN data
  const gameMap: GameMap = {};
  if (weekDetail) {
    for (const game of weekDetail.games as ScheduleGame[]) {
      if (game.espn?.home && game.espn?.away) {
        gameMap[game.game_id] = {
          home: game.espn.home as TeamID,
          away: game.espn.away as TeamID,
        };
      }
    }
  }

  const {
    data: submissions = {},
    isLoading: isLoadingSubmissions,
    isError: isSubmissionsError,
  } = useQuery({
    queryKey: ['adminSubmissions', loadedFilter?.year, loadedFilter?.seasonType, selectedWeek],
    queryFn: () => getAdminWeekSubmissions(loadedFilter!.year, loadedFilter!.seasonType, selectedWeek!),
    enabled: !!loadedFilter && !!selectedWeek,
  });

  // ── Derived ──────────────────────────────────────────────────────────────

  const userById = Object.fromEntries(users.map((u) => [u.id, u]));
  const players = users.filter((u) => u.isPlayer);
  const submittedIds = new Set(Object.keys(submissions));
  const notSubmitted = players.filter((u) => !submittedIds.has(u.id));

  const selectedWeekMeta = weeks.find((w: WeekMeta) => w.week === selectedWeek);
  const weekLabel = selectedWeekMeta?.round_name ?? (selectedWeek ? `Week ${selectedWeek}` : null);
  const seasonLabel = SEASON_TYPE_OPTIONS.find((o) => o.value === (loadedFilter?.seasonType ?? seasonTypeInput))?.label;

  function getUserName(userId: string): string {
    const u = userById[userId];
    if (!u) return userId;
    return `${u.firstName} ${u.lastName}`.trim() || u.username;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleSeasonTypeChange(v: string | null) {
    setSeasonTypeInput(v ?? '2');
    // Changing season type invalidates the current loaded state
    setLoadedFilter(null);
    setSelectedWeek(null);
  }

  function handleYearChange(v: string | null) {
    setYearInput(v ?? CURRENT_YEAR.toString());
    setLoadedFilter(null);
    setSelectedWeek(null);
  }

  function handleLoad() {
    localStorage.setItem('adminPicks_year', yearInput);
    localStorage.setItem('adminPicks_seasonType', seasonTypeInput);
    setSelectedWeek(null);
    setLoadedFilter({ year: yearInput, seasonType: seasonTypeInput });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const weeksLoaded = !!loadedFilter && !isLoadingWeeks;

  return (
    <Stack gap="lg">
      {/* Step 1: Season filter */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text size="sm" fw={600} c="dimmed">
            Step 1 — Choose season
          </Text>
          <Group align="flex-end" gap="sm" wrap="wrap">
            <Select
              label="Year"
              value={yearInput}
              onChange={handleYearChange}
              data={YEAR_OPTIONS}
              w={100}
              allowDeselect={false}
            />
            <Select
              label="Season Type"
              value={seasonTypeInput}
              onChange={handleSeasonTypeChange}
              data={SEASON_TYPE_OPTIONS}
              w={170}
              allowDeselect={false}
            />
            <Button onClick={handleLoad} loading={!!loadedFilter && isLoadingWeeks}>
              Load weeks
            </Button>
          </Group>

          {/* Step 2: Week selector — only shown after Load */}
          {weeksLoaded && weekOptions.length > 0 && (
            <>
              <Divider />
              <Text size="sm" fw={600} c="dimmed">
                Step 2 — Choose week
              </Text>
              <Group align="flex-end" gap="sm" wrap="wrap">
                <Select
                  label="Week"
                  placeholder="Select a week…"
                  value={selectedWeek}
                  onChange={setSelectedWeek}
                  data={weekOptions}
                  w={200}
                  allowDeselect={false}
                />
                {selectedWeek && !isLoadingSubmissions && (
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
                    {submittedIds.size} / {players.length} submitted
                  </Badge>
                )}
              </Group>
            </>
          )}

          {weeksLoaded && weekOptions.length === 0 && (
            <Text size="sm" c="dimmed">
              No weeks found for this season.
            </Text>
          )}
        </Stack>
      </Paper>

      {/* Heading */}
      {loadedFilter && (
        <div>
          <Title order={3}>
            {loadedFilter.year} {seasonLabel}
            {weekLabel && ` — ${weekLabel}`}
          </Title>
          <Text size="sm" c="dimmed" mt={2}>
            {selectedWeek
              ? "Everyone's picks for this week. Players who haven't submitted appear at the bottom."
              : 'Select a week above to view submissions.'}
          </Text>
        </div>
      )}

      {/* Error */}
      {isSubmissionsError && (
        <Alert color="red" title="Failed to load submissions">
          Something went wrong fetching picks. Please try again.
        </Alert>
      )}

      {/* Loading skeletons */}
      {selectedWeek && isLoadingSubmissions && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={130} radius="md" />
          ))}
        </SimpleGrid>
      )}

      {/* Submissions grid */}
      {selectedWeek && !isLoadingSubmissions && !isSubmissionsError && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {Object.entries(submissions).map(([userId, record]) => {
            const name = getUserName(userId);
            if (record.kind === 'regular') {
              return (
                <RegularPicksCard
                  key={userId}
                  name={name}
                  rankedPicks={record.picks.rankedPicks}
                  filedPicks={record.picks.filedPicks}
                  submittedAt={record.submitted_at}
                />
              );
            }
            return (
              <PlayoffPicksCard
                key={userId}
                name={name}
                straightBets={record.picks.straightBets}
                parlayBet={record.picks.parlayBet}
                submittedAt={record.submitted_at}
                gameMap={gameMap}
              />
            );
          })}

          {notSubmitted.map((u) => (
            <NotSubmittedRow key={u.id} name={`${u.firstName} ${u.lastName}`.trim() || u.username} />
          ))}
        </SimpleGrid>
      )}

      {/* Empty state */}
      {selectedWeek &&
        !isLoadingSubmissions &&
        !isSubmissionsError &&
        submittedIds.size === 0 &&
        players.length === 0 && (
          <Paper withBorder p="xl" radius="md" ta="center">
            <Text size="lg" fw={600} mb="xs">
              No submissions yet
            </Text>
            <Text size="sm" c="dimmed">
              {isPlayoff
                ? 'No playoff bets have been placed for this round.'
                : 'No picks have been submitted for this week.'}
            </Text>
          </Paper>
        )}
    </Stack>
  );
}
