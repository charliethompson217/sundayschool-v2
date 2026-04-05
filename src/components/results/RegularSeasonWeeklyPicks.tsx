import { useMemo, useState } from 'react';

import { Box, Group, Loader, Select, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';

import { getGameResults, getPastSubmissions } from '@/app/API/functions';
import getLogo from '@/assets/logo-map';
import type { GameResultWithScore } from '@/types/results';
import type { GamePick } from '@/types/submissions';
import type { TeamID } from '@/types/teams';

// ── Types ─────────────────────────────────────────────────────────────────────

type PickStatus = 'correct' | 'incorrect' | 'tie' | 'undecided';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPickStatus(pick: GamePick, result: GameResultWithScore | undefined): PickStatus {
  if (!result) return 'undecided';
  if (result.winner === 'TIE') return 'tie';
  return pick.winner === result.winner ? 'correct' : 'incorrect';
}

const STATUS_BG: Record<PickStatus, string> = {
  correct: 'rgba(34, 139, 34, 0.80)',
  incorrect: 'rgba(210, 50, 50, 0.80)',
  tie: 'rgba(200, 165, 25, 0.80)',
  undecided: 'rgba(120, 120, 120, 0.18)',
};

function formatUserName(userId: string): string {
  return userId
    .replace(/^user_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function calculateScore(
  rankedPicks: GamePick[],
  rankedResults: GameResultWithScore[] | undefined,
): { totalPoints: number; bonusGameIndices: number[] } {
  const n = rankedPicks.length;
  let totalPoints = 0;
  let bonusGameIndices: number[] = [];

  // Award rank points for correct / tie / undecided ranked picks.
  // Index 0 = most confident → rank n; index n-1 → rank 1.
  rankedPicks.forEach((pick, i) => {
    const rank = n - i;
    const status = getPickStatus(pick, rankedResults?.[i]);
    if (status === 'correct' || status === 'tie' || status === 'undecided') {
      totalPoints += rank;
    }
  });

  // Bonus +20: all 5 lowest-ranked picks (rank 1–5, i.e. last 5 indices) correct/undecided.
  if (n >= 5) {
    const lowRankIndices = Array.from({ length: 5 }, (_, k) => n - 5 + k);
    const potential: number[] = [];
    let count = 0;
    for (const i of lowRankIndices) {
      const status = getPickStatus(rankedPicks[i], rankedResults?.[i]);
      if (status === 'correct' || status === 'undecided') {
        count++;
        potential.push(i);
      }
    }
    if (count === 5) {
      totalPoints += 20;
      bonusGameIndices = potential;
    }
  }

  // Perfect Sunday +40: every ranked pick correct/undecided.
  if (n > 0) {
    const allGood = rankedPicks.every((pick, i) => {
      const status = getPickStatus(pick, rankedResults?.[i]);
      return status === 'correct' || status === 'undecided';
    });
    if (allGood) totalPoints += 40;
  }

  return { totalPoints, bonusGameIndices };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const CELL_PX = 76;

interface PickCellProps {
  teamId: TeamID;
  status: PickStatus;
  rank?: number;
  isBonus?: boolean;
}

function PickCell({ teamId, status, rank, isBonus }: PickCellProps) {
  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: CELL_PX,
        height: CELL_PX,
        backgroundColor: STATUS_BG[status],
        borderRadius: 8,
        flexShrink: 0,
      }}
    >
      <img
        src={getLogo(teamId)}
        alt={teamId}
        style={{ width: 38, height: 38, objectFit: 'contain', marginBottom: rank !== undefined ? 3 : 0 }}
      />
      {rank !== undefined && (
        <Box
          style={{
            backgroundColor: isBonus ? 'rgba(0,0,0,0.35)' : 'rgba(140,140,140,0.30)',
            borderRadius: 8,
            color: isBonus ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.60)',
            padding: '1px 7px',
            fontSize: 15,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          {rank}
        </Box>
      )}
    </Box>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegularSeasonWeeklyPicks() {
  const { data: pastSubmissions, isLoading: loadingSubs } = useQuery({
    queryKey: ['pastSubmissions'],
    queryFn: getPastSubmissions,
  });

  const { data: gameResults, isLoading: loadingResults } = useQuery({
    queryKey: ['gameResults'],
    queryFn: getGameResults,
  });

  const availableWeeks = useMemo(
    () =>
      Object.keys(pastSubmissions ?? {})
        .map(Number)
        .sort((a, b) => a - b),
    [pastSubmissions],
  );

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const week = selectedWeek ?? availableWeeks.at(-1) ?? null;

  const weekResults = week !== null ? gameResults?.[week] : undefined;
  const weekSubmissions = week !== null ? pastSubmissions?.[week] : undefined;

  const players = useMemo(() => {
    if (!weekSubmissions) return [];
    return Object.entries(weekSubmissions)
      .map(([userId, submission]) => {
        const { totalPoints, bonusGameIndices } = calculateScore(submission.rankedPicks, weekResults?.rankedResults);
        return { userId, submission, totalPoints, bonusGameIndices };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [weekSubmissions, weekResults]);

  if (loadingSubs || loadingResults) return <Loader />;

  const weekSelectData = availableWeeks.map((w) => ({
    value: String(w),
    label: `Week ${w}`,
  }));

  return (
    <Stack gap="lg">
      <Group justify="flex-end">
        <Select
          data={weekSelectData}
          value={week !== null ? String(week) : null}
          onChange={(v) => setSelectedWeek(v !== null ? Number(v) : null)}
          placeholder="Select week"
          w={140}
        />
      </Group>

      {week === null || players.length === 0 ? (
        <Text c="dimmed">No results available for this week.</Text>
      ) : (
        <Box style={{ overflowX: 'auto' }}>
          <table
            style={{
              borderCollapse: 'separate',
              borderSpacing: '0 6px',
              width: '100%',
            }}
          >
            <thead>
              <tr>
                {(['Player (pts)', 'Ranked Picks', 'Filed Picks'] as const).map((label, i) => (
                  <th
                    key={label}
                    style={{
                      padding: '8px 14px',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                      backgroundColor: 'var(--mantine-color-default-border)',
                      borderRadius: i === 0 ? '8px 0 0 8px' : i === 2 ? '0 8px 8px 0' : 0,
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map(({ userId, submission, totalPoints, bonusGameIndices }, rowIdx) => {
                const n = submission.rankedPicks.length;
                return (
                  <tr key={userId}>
                    <td
                      style={{
                        padding: '0 16px',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                        backgroundColor: 'var(--mantine-color-default-border)',
                        borderRadius: '8px 0 0 8px',
                        height: CELL_PX + 8,
                        minWidth: 160,
                      }}
                    >
                      <Group justify="space-between" gap="xl" wrap="nowrap">
                        <Stack gap={0}>
                          <Text size="xs" c="dimmed" fw={500}>
                            #{rowIdx + 1}
                          </Text>
                          <Text fw={700} size="md" style={{ lineHeight: 1.2 }}>
                            {formatUserName(userId)}
                          </Text>
                        </Stack>
                        <Text fw={800} style={{ fontSize: 36, lineHeight: 1 }}>
                          {totalPoints}
                        </Text>
                      </Group>
                    </td>

                    <td style={{ padding: '4px 10px', verticalAlign: 'middle' }}>
                      <Group gap={3} wrap="nowrap">
                        {submission.rankedPicks.length > 0 ? (
                          submission.rankedPicks.map((pick, i) => (
                            <PickCell
                              key={i}
                              teamId={pick.winner}
                              status={getPickStatus(pick, weekResults?.rankedResults?.[i])}
                              rank={n - i}
                              isBonus={bonusGameIndices.includes(i)}
                            />
                          ))
                        ) : (
                          <Text c="dimmed" size="sm">
                            No picks
                          </Text>
                        )}
                      </Group>
                    </td>

                    <td style={{ padding: '4px 10px', verticalAlign: 'middle' }}>
                      <Group gap={3} wrap="nowrap">
                        {submission.filedPicks.length > 0 ? (
                          submission.filedPicks.map((pick, i) => (
                            <PickCell
                              key={i}
                              teamId={pick.winner}
                              status={getPickStatus(pick, weekResults?.filedResults?.[i])}
                            />
                          ))
                        ) : (
                          <Text c="dimmed" size="sm">
                            No picks
                          </Text>
                        )}
                      </Group>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      )}
    </Stack>
  );
}
