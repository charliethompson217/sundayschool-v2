import { useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  NumberInput,
  Paper,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconCircleCheck, IconCoin, IconLock, IconTrophy } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { getPlayOffsWeekGames, type PlayoffWageableGame } from '@/app/API/scheduleFunctions';
import type { WeekMeta } from '@/types/schedules';
import type { PlayOffsPicksSubmission, PlayoffParlayLeg, PlayoffStraightBet } from '@/types/submissions';
import { getTeamName } from '@/types/teams';

import ChooseTeam from './ChooseTeam';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSpread(points: number): string {
  const sign = points > 0 ? '+' : '';
  return `${sign}${points}`;
}

// ── Straight bet card ─────────────────────────────────────────────────────────

type StraightBetDraft = {
  enabled: boolean;
  side: 'home' | 'away' | null;
  amount: number | '';
};

function StraightBetCard({
  game,
  draft,
  readOnly,
  onChange,
}: {
  game: PlayoffWageableGame;
  draft: StraightBetDraft;
  readOnly: boolean;
  onChange: (next: StraightBetDraft) => void;
}) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600} size="sm">
            {getTeamName(game.away, 'mascot')} @ {getTeamName(game.home, 'mascot')}
          </Text>
          {!readOnly && (
            <Switch
              checked={draft.enabled}
              onChange={(e) => onChange({ ...draft, enabled: e.currentTarget.checked })}
              label="Bet this game"
              size="sm"
            />
          )}
          {readOnly && draft.enabled && (
            <Badge variant="light" color="blue" size="sm">
              Bet placed
            </Badge>
          )}
        </Group>

        {(draft.enabled || readOnly) && (
          <Stack gap="xs">
            <Text size="xs" c="dimmed">
              Pick a side to cover the spread
            </Text>
            <ChooseTeam
              homeTeamID={game.home}
              awayTeamID={game.away}
              value={draft.side === 'home' ? game.home : draft.side === 'away' ? game.away : null}
              onChange={(v) => {
                if (v === game.home) onChange({ ...draft, side: 'home' });
                else if (v === game.away) onChange({ ...draft, side: 'away' });
              }}
              spreadLabels={{
                home: formatSpread(game.spread),
                away: formatSpread(-game.spread),
              }}
            />
            <NumberInput
              label="Amount (playoff bucks)"
              placeholder="0"
              min={1}
              value={draft.amount}
              onChange={(v) => onChange({ ...draft, amount: typeof v === 'string' ? '' : v })}
              disabled={readOnly}
              size="sm"
              leftSection={<IconCoin size={14} />}
            />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

// ── Parlay leg row ────────────────────────────────────────────────────────────

type ParlayLegDraft = {
  selected: boolean;
  side: 'home' | 'away' | null;
};

function ParlayLegRow({
  game,
  draft,
  readOnly,
  onChange,
}: {
  game: PlayoffWageableGame;
  draft: ParlayLegDraft;
  readOnly: boolean;
  onChange: (next: ParlayLegDraft) => void;
}) {
  return (
    <Paper p="sm" radius="md" withBorder>
      <Stack gap="xs">
        <Group align="center" gap="sm">
          {!readOnly && (
            <Checkbox
              checked={draft.selected}
              onChange={(e) =>
                onChange({
                  ...draft,
                  selected: e.currentTarget.checked,
                  side: e.currentTarget.checked ? draft.side : null,
                })
              }
            />
          )}
          <Text size="sm" fw={draft.selected ? 600 : 400}>
            {getTeamName(game.away, 'mascot')} @ {getTeamName(game.home, 'mascot')}
          </Text>
          {readOnly && draft.selected && (
            <Badge variant="dot" color="green" size="sm">
              In parlay
            </Badge>
          )}
        </Group>
        {draft.selected && (
          <ChooseTeam
            homeTeamID={game.home}
            awayTeamID={game.away}
            value={draft.side === 'home' ? game.home : draft.side === 'away' ? game.away : null}
            onChange={(v) => {
              if (v === game.home) onChange({ ...draft, side: 'home' });
              else if (v === game.away) onChange({ ...draft, side: 'away' });
            }}
            spreadLabels={{
              home: formatSpread(game.spread),
              away: formatSpread(-game.spread),
            }}
          />
        )}
      </Stack>
    </Paper>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

type Props = {
  weekMeta: WeekMeta;
  onSubmit: (submission: PlayOffsPicksSubmission) => Promise<void>;
  existingSubmission?: PlayOffsPicksSubmission;
  readOnly?: boolean;
  playoffsBucks: number;
};

export function PlayOffsPicksForm({ weekMeta, onSubmit, existingSubmission, readOnly = false, playoffsBucks }: Props) {
  const {
    data: games,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['playoffsWeekGames', weekMeta.year, weekMeta.season_type, weekMeta.week],
    queryFn: () => getPlayOffsWeekGames(weekMeta),
  });

  if (isLoading) return <Loader />;
  if (isError || !games) return <Text c="red">Failed to load games. Please try again.</Text>;

  return (
    <PlayOffsPicksFormInner
      weekMeta={weekMeta}
      games={games}
      onSubmit={onSubmit}
      existingSubmission={existingSubmission}
      readOnly={readOnly}
      playoffsBucks={playoffsBucks}
    />
  );
}

// ── Inner (has games) ─────────────────────────────────────────────────────────

type InnerProps = {
  weekMeta: WeekMeta;
  games: PlayoffWageableGame[];
  onSubmit: (submission: PlayOffsPicksSubmission) => Promise<void>;
  existingSubmission?: PlayOffsPicksSubmission;
  readOnly?: boolean;
  playoffsBucks: number;
};

function initStraightBetDrafts(
  games: PlayoffWageableGame[],
  existingSubmission?: PlayOffsPicksSubmission,
): Record<string, StraightBetDraft> {
  return Object.fromEntries(
    games.map((g) => {
      const existing = existingSubmission?.straightBets.find((b) => b.gameId === g.gameId);
      return [
        g.gameId,
        existing
          ? { enabled: true, side: existing.side, amount: existing.amount }
          : { enabled: false, side: null, amount: '' },
      ];
    }),
  );
}

function initParlayLegDrafts(
  games: PlayoffWageableGame[],
  existingSubmission?: PlayOffsPicksSubmission,
): Record<string, ParlayLegDraft> {
  return Object.fromEntries(
    games.map((g) => {
      const leg = existingSubmission?.parlayBet?.legs.find((l) => l.gameId === g.gameId);
      return [g.gameId, { selected: !!leg, side: leg?.side ?? null }];
    }),
  );
}

function betSideLabel(game: PlayoffWageableGame, side: 'home' | 'away'): string {
  const teamId = side === 'home' ? game.home : game.away;
  const spread = side === 'home' ? game.spread : -game.spread;
  return `${getTeamName(teamId, 'mascot')} ${formatSpread(spread)}`;
}

function PlayOffsPicksFormInner({
  weekMeta,
  games,
  onSubmit,
  existingSubmission,
  readOnly = false,
  playoffsBucks,
}: InnerProps) {
  const allowStraight = weekMeta.allow_straight_bets !== false;
  const allowParlay = weekMeta.allow_parlay === true;
  const parlayLegCount = weekMeta.parlay_leg_count ?? 2;

  const [step, setStep] = useState<'edit' | 'review'>(readOnly ? 'review' : 'edit');
  const [straightDrafts, setStraightDrafts] = useState<Record<string, StraightBetDraft>>(() =>
    initStraightBetDrafts(games, existingSubmission),
  );
  const [parlayDrafts, setParlayDrafts] = useState<Record<string, ParlayLegDraft>>(() =>
    initParlayLegDrafts(games, existingSubmission),
  );
  const [parlayAmount, setParlayAmount] = useState<number | ''>(existingSubmission?.parlayBet?.amount ?? '');
  const [pendingSubmission, setPendingSubmission] = useState<PlayOffsPicksSubmission | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isResubmission = existingSubmission !== undefined;

  // Compute totals (used in edit step)
  const straightTotal = Object.values(straightDrafts).reduce((sum, d) => {
    if (d.enabled && typeof d.amount === 'number') return sum + d.amount;
    return sum;
  }, 0);
  const parlayTotal = typeof parlayAmount === 'number' ? parlayAmount : 0;
  const totalBet = straightTotal + parlayTotal;
  const overBudget = totalBet > playoffsBucks;

  // Parlay validation
  const selectedParlayLegs = Object.entries(parlayDrafts).filter(([, d]) => d.selected);
  const parlayLegCountMet = selectedParlayLegs.length === parlayLegCount;
  const parlayAllSidesPicked = selectedParlayLegs.every(([, d]) => d.side !== null);

  function buildSubmission(): PlayOffsPicksSubmission | null {
    const straightBets: PlayoffStraightBet[] = [];

    for (const [gameId, d] of Object.entries(straightDrafts)) {
      if (!d.enabled) continue;
      if (d.side === null || typeof d.amount !== 'number' || d.amount <= 0) {
        setError('Please fill in all active straight bets (pick a side and enter an amount).');
        return null;
      }
      straightBets.push({ gameId, side: d.side, amount: d.amount });
    }

    let parlayBet = null;
    if (allowParlay && selectedParlayLegs.length > 0) {
      if (!parlayLegCountMet) {
        setError(`Your parlay must include exactly ${parlayLegCount} game${parlayLegCount !== 1 ? 's' : ''}.`);
        return null;
      }
      if (!parlayAllSidesPicked) {
        setError('Please pick a side for every parlay leg.');
        return null;
      }
      if (typeof parlayAmount !== 'number' || parlayAmount <= 0) {
        setError('Please enter a parlay bet amount.');
        return null;
      }
      const legs: PlayoffParlayLeg[] = selectedParlayLegs.map(([gameId, d]) => ({
        gameId,
        side: d.side!,
      }));
      parlayBet = { legs, amount: parlayAmount };
    }

    return { straightBets, parlayBet };
  }

  function handleReview() {
    setError(null);
    if (overBudget) {
      setError(`You only have ${playoffsBucks.toLocaleString()} playoff bucks. Reduce your bets.`);
      return;
    }
    const submission = buildSubmission();
    if (!submission) return;
    setPendingSubmission(submission);
    setStep('review');
  }

  async function handleConfirm() {
    if (!pendingSubmission) return;
    setIsSubmitting(true);
    await onSubmit(pendingSubmission);
    setIsSubmitting(false);
    setSubmitted(true);
  }

  // ── Shared header / bucks bar ──────────────────────────────────────────────

  const roundLabel = weekMeta.round_name ?? `Playoff Week ${weekMeta.week}`;

  const reviewTotal = pendingSubmission
    ? pendingSubmission.straightBets.reduce((s, b) => s + b.amount, 0) + (pendingSubmission.parlayBet?.amount ?? 0)
    : totalBet;

  // ── Success ────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <Stack align="center" gap="md" py="xl">
        <ThemeIcon size={64} radius="xl" color="green" variant="light">
          <IconCircleCheck size={40} />
        </ThemeIcon>
        <Title order={2}>{isResubmission ? 'Bets updated!' : 'Bets placed!'}</Title>
        <Text c="dimmed" ta="center" maw={320}>
          {isResubmission
            ? 'Your playoff bets have been updated. Only your most recent submission counts.'
            : 'Your playoff bets are locked in. Good luck!'}
        </Text>
      </Stack>
    );
  }

  // ── Review step ────────────────────────────────────────────────────────────

  const reviewSubmission = pendingSubmission ?? existingSubmission ?? { straightBets: [], parlayBet: null };

  if (step === 'review') {
    const hasStraight = reviewSubmission.straightBets.length > 0;
    const hasParlay = reviewSubmission.parlayBet !== null;
    const hasAnyBet = hasStraight || hasParlay;

    return (
      <Stack>
        {readOnly && (
          <Alert icon={<IconLock size={16} />} color="orange" variant="light">
            Submissions are closed for {roundLabel}. You can view your bets below.
          </Alert>
        )}

        <Stack gap={2}>
          <Group gap="xs" align="center">
            <IconTrophy size={18} color="var(--mantine-color-yellow-6)" />
            <Text c="dimmed" size="xs">
              {roundLabel}
            </Text>
          </Group>
          <Title order={3}>{readOnly ? 'Your bets' : 'Review your bets'}</Title>
          {!readOnly && (
            <Text size="sm" c="dimmed">
              Double-check everything before locking in.
            </Text>
          )}
        </Stack>

        {/* Bucks summary */}
        <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-yellow-light)">
          <Group gap="xs" align="center">
            <IconCoin size={18} color="var(--mantine-color-yellow-8)" />
            <Text size="sm" fw={600} c="yellow.8">
              Playoff Bucks: {playoffsBucks.toLocaleString()}
            </Text>
            {reviewTotal > 0 && (
              <Badge variant="filled" color="yellow" size="sm" style={{ marginLeft: 'auto' }}>
                {reviewTotal.toLocaleString()} / {playoffsBucks.toLocaleString()} wagered
              </Badge>
            )}
          </Group>
        </Paper>

        {!hasAnyBet && (
          <Text size="sm" c="dimmed">
            No bets placed this round.
          </Text>
        )}

        {/* Straight bets summary */}
        {hasStraight && (
          <Stack gap="xs">
            <Text fw={600} size="sm">
              Straight Bets
            </Text>
            {reviewSubmission.straightBets.map((bet) => {
              const game = games.find((g) => g.gameId === bet.gameId);
              if (!game) return null;
              return (
                <Paper key={bet.gameId} p="sm" radius="md" withBorder>
                  <Group justify="space-between" align="center">
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">
                        {getTeamName(game.away, 'mascot')} @ {getTeamName(game.home, 'mascot')}
                      </Text>
                      <Text size="sm" fw={600}>
                        {betSideLabel(game, bet.side)}
                      </Text>
                    </Stack>
                    <Badge variant="light" color="blue" size="lg">
                      <Group gap={4} align="center">
                        <IconCoin size={12} />
                        {bet.amount.toLocaleString()}
                      </Group>
                    </Badge>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}

        {/* Parlay summary */}
        {hasParlay && reviewSubmission.parlayBet && (
          <>
            {hasStraight && <Divider />}
            <Stack gap="xs">
              <Text fw={600} size="sm">
                Parlay Bet — {reviewSubmission.parlayBet.legs.length} legs
              </Text>
              <Paper p="sm" radius="md" withBorder>
                <Stack gap="sm">
                  {reviewSubmission.parlayBet.legs.map((leg) => {
                    const game = games.find((g) => g.gameId === leg.gameId);
                    if (!game) return null;
                    return (
                      <Group key={leg.gameId} gap="sm" align="center">
                        <Badge size="sm" radius="sm" color="violet" variant="light" w={20} p={0} ta="center">
                          +
                        </Badge>
                        <Text size="sm">{betSideLabel(game, leg.side)}</Text>
                        <Text size="xs" c="dimmed">
                          vs {getTeamName(leg.side === 'home' ? game.away : game.home, 'mascot')}
                        </Text>
                      </Group>
                    );
                  })}
                  <Divider />
                  <Group justify="space-between" align="center">
                    <Text size="sm" c="dimmed">
                      Combined wager
                    </Text>
                    <Badge variant="light" color="violet" size="lg">
                      <Group gap={4} align="center">
                        <IconCoin size={12} />
                        {reviewSubmission.parlayBet.amount.toLocaleString()}
                      </Group>
                    </Badge>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </>
        )}

        {!readOnly && (
          <Group justify="space-between" mt="xs">
            <Button variant="default" onClick={() => setStep('edit')}>
              Back
            </Button>
            <Button onClick={handleConfirm} loading={isSubmitting} disabled={isSubmitting}>
              {isResubmission ? 'Update bets' : 'Confirm & place bets'}
            </Button>
          </Group>
        )}
      </Stack>
    );
  }

  // ── Edit step ──────────────────────────────────────────────────────────────

  return (
    <Stack>
      <Stack gap={2}>
        <Group gap="xs" align="center">
          <IconTrophy size={18} color="var(--mantine-color-yellow-6)" />
          <Text c="dimmed" size="xs">
            {roundLabel}
          </Text>
        </Group>
        <Title order={3}>Place your bets</Title>
        <Text size="sm" c="dimmed">
          You can make straight bets, {allowParlay ? 'parlay bets, ' : ''}or skip entirely — no bets required.
        </Text>
      </Stack>

      {/* Playoff bucks balance */}
      <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-yellow-light)">
        <Group gap="xs" align="center">
          <IconCoin size={18} color="var(--mantine-color-yellow-8)" />
          <Text size="sm" fw={600} c="yellow.8">
            Playoff Bucks: {playoffsBucks.toLocaleString()}
          </Text>
          {totalBet > 0 && (
            <Badge variant="filled" color={overBudget ? 'red' : 'yellow'} size="sm" style={{ marginLeft: 'auto' }}>
              {totalBet.toLocaleString()} / {playoffsBucks.toLocaleString()} wagered
            </Badge>
          )}
        </Group>
      </Paper>

      {/* Straight bets */}
      {allowStraight && games.length > 0 && (
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Straight Bets
          </Text>
          {games.map((game) => (
            <StraightBetCard
              key={game.gameId}
              game={game}
              draft={straightDrafts[game.gameId]}
              readOnly={false}
              onChange={(next) => setStraightDrafts((prev) => ({ ...prev, [game.gameId]: next }))}
            />
          ))}
        </Stack>
      )}

      {/* Parlay bets */}
      {allowParlay && games.length > 0 && (
        <>
          <Divider />
          <Stack gap="sm">
            <Stack gap={2}>
              <Text fw={600} size="sm">
                Parlay Bet
              </Text>
              <Text size="xs" c="dimmed">
                Select exactly {parlayLegCount} game{parlayLegCount !== 1 ? 's' : ''} and pick a side for each leg.
              </Text>
            </Stack>

            {selectedParlayLegs.length > 0 && !parlayLegCountMet && (
              <Alert variant="light" color="orange" p="xs">
                {selectedParlayLegs.length} of {parlayLegCount} game{parlayLegCount !== 1 ? 's' : ''} selected
              </Alert>
            )}

            {games.map((game) => (
              <ParlayLegRow
                key={game.gameId}
                game={game}
                draft={parlayDrafts[game.gameId]}
                readOnly={false}
                onChange={(next) => setParlayDrafts((prev) => ({ ...prev, [game.gameId]: next }))}
              />
            ))}

            {selectedParlayLegs.length > 0 && (
              <NumberInput
                label="Parlay amount (playoff bucks)"
                placeholder="0"
                min={1}
                value={parlayAmount}
                onChange={(v) => setParlayAmount(typeof v === 'string' ? '' : v)}
                size="sm"
                leftSection={<IconCoin size={14} />}
              />
            )}
          </Stack>
        </>
      )}

      {error && (
        <Alert variant="light" color="red">
          {error}
        </Alert>
      )}

      <Group justify="flex-end">
        <Button onClick={handleReview} disabled={overBudget}>
          Review bets
        </Button>
      </Group>
    </Stack>
  );
}

export default PlayOffsPicksForm;
