import { useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconCircleCheck, IconLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { getWeekLineup } from '@/app/API/functions';
import type { WeekMeta } from '@/types/schedules';
import type { GamePickDraft, RegularSeasonPicksSubmission, WeekLineup } from '@/types/submissions';
import { getTeamName, type Matchup, type TeamID, type TeamSelection } from '@/types/teams';

import ChooseTeam from './ChooseTeam';
import RankTeams from './RankTeams';

type FormStep = 1 | 2 | 3 | 'review';

const STEP_TITLES: Record<FormStep, string> = {
  1: 'Pick your winners',
  2: 'Rank your confidence',
  3: 'Bonus picks',
  review: 'Review your picks',
};

const STEP_DESCRIPTIONS: Record<FormStep, string> = {
  1: 'Choose the winner for each game. You will rank these by confidence next.',
  2: 'Drag to reorder — put the game you are most confident about at the top.',
  3: 'Pick the winner for each bonus game. These are not ranked.',
  review: 'Double-check everything before locking in your picks.',
};

const matchupKey = ([away, home]: Matchup) => `${away}-${home}`;

type Props = {
  weekMeta: WeekMeta;
  onSubmit: (submission: RegularSeasonPicksSubmission) => Promise<void>;
  existingSubmission?: RegularSeasonPicksSubmission;
  readOnly?: boolean;
};

export function RegularSeasonPicksForm({ weekMeta, onSubmit, existingSubmission, readOnly = false }: Props) {
  const {
    data: lineup,
    isLoading: isLoadingLineup,
    isError: isLineupError,
  } = useQuery({
    queryKey: ['weekLineup', weekMeta.year, weekMeta.season_type, weekMeta.week],
    queryFn: () => getWeekLineup(weekMeta),
  });

  if (isLoadingLineup) {
    return <Loader />;
  }

  if (isLineupError || !lineup) {
    return <Text c="red">Failed to load week details. Please try again.</Text>;
  }

  return (
    <RegularSeasonPicksFormInner
      lineup={lineup}
      onSubmit={onSubmit}
      existingSubmission={existingSubmission}
      readOnly={readOnly}
    />
  );
}

type InnerProps = {
  lineup: WeekLineup;
  onSubmit: (submission: RegularSeasonPicksSubmission) => Promise<void>;
  existingSubmission?: RegularSeasonPicksSubmission;
  readOnly?: boolean;
};

function RegularSeasonPicksFormInner({ lineup, onSubmit, existingSubmission, readOnly = false }: InnerProps) {
  const rankMatchups = lineup.scheduledMatchups.filter((sm) => sm.gameType === 'rank').map((sm) => sm.matchup);

  const fileMatchups = lineup.scheduledMatchups.filter((sm) => sm.gameType === 'file').map((sm) => sm.matchup);

  const isResubmission = existingSubmission !== undefined;

  const [step, setStep] = useState<FormStep>(readOnly ? 'review' : 1);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rankedDrafts, setRankedDrafts] = useState<GamePickDraft[]>(() => {
    if (existingSubmission) {
      return existingSubmission.rankedPicks.map(({ matchup, winner }) => ({ matchup, winner }));
    }
    return rankMatchups.map((matchup) => ({ matchup, winner: null }));
  });

  const [filedDrafts, setFiledDrafts] = useState<GamePickDraft[]>(() => {
    if (existingSubmission) {
      return existingSubmission.filedPicks.map(({ matchup, winner }) => ({ matchup, winner }));
    }
    return fileMatchups.map((matchup) => ({ matchup, winner: null }));
  });

  function updateWinner(
    setter: React.Dispatch<React.SetStateAction<GamePickDraft[]>>,
    matchup: Matchup,
    selection: TeamSelection,
  ) {
    const winner = selection === 'TIE' ? null : selection;
    setter((prev) => prev.map((d) => (matchupKey(d.matchup) === matchupKey(matchup) ? { ...d, winner } : d)));
  }

  function handleRankOrderChange(ranked: GamePickDraft[]) {
    setRankedDrafts((prev) => {
      // Re-map against prev to pick up any winner changes made after the initial render
      const byKey = Object.fromEntries(prev.map((d) => [matchupKey(d.matchup), d]));
      return ranked.map((d) => byKey[matchupKey(d.matchup)]);
    });
  }

  async function handleSubmit() {
    const rankedPicks = rankedDrafts
      .filter((d): d is GamePickDraft & { winner: TeamID } => d.winner !== null)
      .map(({ matchup, winner }) => ({ matchup, winner }));

    const filedPicks = filedDrafts
      .filter((d): d is GamePickDraft & { winner: TeamID } => d.winner !== null)
      .map(({ matchup, winner }) => ({ matchup, winner }));

    if (rankedPicks.length !== rankedDrafts.length || filedPicks.length !== filedDrafts.length) {
      // TODO: surface a validation error
      return;
    }

    setIsSubmitting(true);
    await onSubmit({ rankedPicks, filedPicks });
    setIsSubmitting(false);
    setSubmitted(true);
  }

  const rankPicksComplete = rankedDrafts.every((d) => d.winner !== null);
  const filePicksComplete = filedDrafts.every((d) => d.winner !== null);

  const totalSteps = fileMatchups.length > 0 ? 4 : 3;
  const stepNum: number = step === 'review' ? totalSteps : (step as number);

  if (submitted) {
    return (
      <Stack align="center" gap="md" py="xl">
        <ThemeIcon size={64} radius="xl" color="green" variant="light">
          <IconCircleCheck size={40} />
        </ThemeIcon>
        <Title order={2}>{isResubmission ? 'Picks updated!' : 'Picks submitted!'}</Title>
        <Text c="dimmed" ta="center" maw={320}>
          {isResubmission
            ? `Your Week ${lineup.week} picks have been updated. Only your most recent submission counts.`
            : `Your Week ${lineup.week} picks are locked in. Check back after the games to see how you did.`}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack>
      {readOnly && (
        <Alert icon={<IconLock size={16} />} color="orange" variant="light">
          Submissions are closed for Week {lineup.week}. You can view your picks below.
        </Alert>
      )}

      <Stack gap={2}>
        <Text c="dimmed" size="xs">
          Week {lineup.week}
          {readOnly ? '' : ` — Step ${stepNum} of ${totalSteps}`}
        </Text>
        <Title order={3}>{readOnly ? 'Your picks' : STEP_TITLES[step]}</Title>
        {!readOnly && (
          <Text size="sm" c="dimmed">
            {STEP_DESCRIPTIONS[step]}
          </Text>
        )}
      </Stack>

      {step === 1 && (
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="xl">
            {rankedDrafts.map(({ matchup, winner }) => (
              <Paper key={matchupKey(matchup)} p="sm" radius="md">
                <ChooseTeam
                  awayTeamID={matchup[0]}
                  homeTeamID={matchup[1]}
                  value={winner}
                  onChange={(v) => updateWinner(setRankedDrafts, matchup, v)}
                />
              </Paper>
            ))}
          </SimpleGrid>
          <Group justify="flex-end">
            <Button onClick={() => setStep(2)} disabled={!rankPicksComplete}>
              Next: Rank games
            </Button>
          </Group>
        </Stack>
      )}

      {step === 2 && (
        <Stack>
          <RankTeams matchups={rankedDrafts} value={rankedDrafts} onChange={handleRankOrderChange} />
          <Group justify="space-between">
            <Button variant="default" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => (fileMatchups.length > 0 ? setStep(3) : setStep('review'))}>
              {fileMatchups.length > 0 ? 'Next: Bonus picks' : 'Next: Review'}
            </Button>
          </Group>
        </Stack>
      )}

      {step === 3 && (
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="xl">
            {filedDrafts.map(({ matchup, winner }) => (
              <Paper key={matchupKey(matchup)} p="sm" radius="md">
                <ChooseTeam
                  awayTeamID={matchup[0]}
                  homeTeamID={matchup[1]}
                  value={winner}
                  onChange={(v) => updateWinner(setFiledDrafts, matchup, v)}
                />
              </Paper>
            ))}
          </SimpleGrid>
          <Group justify="space-between">
            <Button variant="default" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => setStep('review')} disabled={!filePicksComplete}>
              Next: Review
            </Button>
          </Group>
        </Stack>
      )}

      {step === 'review' && (
        <Stack>
          <Stack gap="xs">
            <Text fw={600} size="sm">
              Ranked picks — most confident first
            </Text>
            {rankedDrafts.every((d) => d.winner === null) ? (
              <Text size="sm" c="dimmed">
                No picks submitted.
              </Text>
            ) : (
              rankedDrafts.map(({ matchup, winner }, i) => {
                if (!winner) return null;
                const [teamA, teamB] = matchup;
                const loserID = winner === teamA ? teamB : teamA;
                const rank = rankedDrafts.length - i;
                return (
                  <Group key={matchupKey(matchup)} gap="sm" align="center">
                    <Badge size="lg" radius="sm" color="green" w={32} p={0} ta="center">
                      {rank}
                    </Badge>
                    <Text size="sm">
                      <Text span fw={600}>
                        {getTeamName(winner, 'full')}
                      </Text>{' '}
                      <Text span c="dimmed">
                        vs {getTeamName(loserID, 'mascot')}
                      </Text>
                    </Text>
                  </Group>
                );
              })
            )}
          </Stack>

          {filedDrafts.length > 0 && (
            <>
              <Divider />
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Bonus picks
                </Text>
                {filedDrafts.every((d) => d.winner === null) ? (
                  <Text size="sm" c="dimmed">
                    No picks submitted.
                  </Text>
                ) : (
                  filedDrafts.map(({ matchup, winner }) => {
                    if (!winner) return null;
                    const [teamA, teamB] = matchup;
                    const loserID = winner === teamA ? teamB : teamA;
                    return (
                      <Group key={matchupKey(matchup)} gap="sm" align="center">
                        <Badge size="lg" radius="sm" color="blue" w={32} p={0} ta="center">
                          W
                        </Badge>
                        <Text size="sm">
                          <Text span fw={600}>
                            {getTeamName(winner, 'full')}
                          </Text>{' '}
                          <Text span c="dimmed">
                            vs {getTeamName(loserID, 'mascot')}
                          </Text>
                        </Text>
                      </Group>
                    );
                  })
                )}
              </Stack>
            </>
          )}

          {!readOnly && (
            <Group justify="space-between">
              <Button variant="default" onClick={() => setStep(fileMatchups.length > 0 ? 3 : 2)}>
                Back
              </Button>
              <Button onClick={handleSubmit} loading={isSubmitting} disabled={isSubmitting}>
                {isResubmission ? 'Update picks' : 'Confirm & Submit'}
              </Button>
            </Group>
          )}
        </Stack>
      )}
    </Stack>
  );
}

export default RegularSeasonPicksForm;
