import type {
  PastSubmissions,
  RegularSeasonGameResults,
  RegularSeasonLineups,
  RegularSeasonPicksSubmission,
} from '../../types/global';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// TODO: replace with real backend call
const HARDCODED_LINEUPS: RegularSeasonLineups = [
  {
    week: 1,
    kickoff: '2025-09-03T20:20:00Z',
    scheduledMatchups: [
      { matchup: ['KC', 'BAL'], gameType: 'rank' },
      { matchup: ['HOU', 'IND'], gameType: 'rank' },
      { matchup: ['GB', 'CHI'], gameType: 'rank' },
      { matchup: ['NYG', 'DAL'], gameType: 'rank' },
      { matchup: ['MIA', 'BUF'], gameType: 'rank' },
      { matchup: ['CIN', 'PIT'], gameType: 'rank' },
      { matchup: ['ATL', 'TB'], gameType: 'rank' },
      { matchup: ['MIN', 'DET'], gameType: 'rank' },
      { matchup: ['LAC', 'LV'], gameType: 'rank' },
      { matchup: ['DEN', 'SEA'], gameType: 'rank' },
      { matchup: ['TEN', 'NO'], gameType: 'file' },
      { matchup: ['CAR', 'WAS'], gameType: 'file' },
      { matchup: ['ARI', 'SF'], gameType: 'file' },
      { matchup: ['LA', 'PHI'], gameType: 'file' },
      { matchup: ['JAX', 'NE'], gameType: 'file' },
      { matchup: ['CLE', 'NYJ'], gameType: 'file' },
    ],
  },
  {
    week: 2,
    kickoff: '2025-09-10T17:00:00Z',
    scheduledMatchups: [
      { matchup: ['PHI', 'ATL'], gameType: 'rank' },
      { matchup: ['DAL', 'NYG'], gameType: 'rank' },
      { matchup: ['BUF', 'MIA'], gameType: 'rank' },
      { matchup: ['BAL', 'LV'], gameType: 'rank' },
      { matchup: ['SF', 'MIN'], gameType: 'rank' },
      { matchup: ['DET', 'TB'], gameType: 'rank' },
      { matchup: ['IND', 'CHI'], gameType: 'rank' },
      { matchup: ['PIT', 'CLE'], gameType: 'rank' },
      { matchup: ['KC', 'CIN'], gameType: 'rank' },
      { matchup: ['SEA', 'LAC'], gameType: 'rank' },
      { matchup: ['NE', 'JAX'], gameType: 'file' },
      { matchup: ['NO', 'CAR'], gameType: 'file' },
      { matchup: ['WAS', 'NYJ'], gameType: 'file' },
      { matchup: ['HOU', 'TEN'], gameType: 'file' },
      { matchup: ['DEN', 'LA'], gameType: 'file' },
      { matchup: ['ARI', 'GB'], gameType: 'file' },
    ],
  },
  {
    week: 3,
    kickoff: '2027-09-17T17:00:00Z',
    scheduledMatchups: [
      { matchup: ['LA', 'SF'], gameType: 'rank' },
      { matchup: ['KC', 'ATL'], gameType: 'rank' },
      { matchup: ['BUF', 'JAX'], gameType: 'rank' },
      { matchup: ['PHI', 'NO'], gameType: 'rank' },
      { matchup: ['DET', 'ARI'], gameType: 'rank' },
      { matchup: ['GB', 'MIN'], gameType: 'rank' },
      { matchup: ['BAL', 'DEN'], gameType: 'rank' },
      { matchup: ['CIN', 'WAS'], gameType: 'rank' },
      { matchup: ['MIA', 'SEA'], gameType: 'rank' },
      { matchup: ['DAL', 'HOU'], gameType: 'rank' },
      { matchup: ['TEN', 'NYJ'], gameType: 'file' },
      { matchup: ['CAR', 'LV'], gameType: 'file' },
      { matchup: ['NE', 'NYG'], gameType: 'file' },
      { matchup: ['IND', 'PIT'], gameType: 'file' },
      { matchup: ['CLE', 'TB'], gameType: 'file' },
      { matchup: ['CHI', 'LAC'], gameType: 'file' },
    ],
  },
];

export type SeasonPhase = 'regular' | 'playoffs';

// TODO: replace with real backend call
export async function getSeasonPhase(): Promise<SeasonPhase> {
  await delay(300);
  return 'regular'; // change to 'playoffs' to test that branch
}

export async function getRegularSeasonLineups(): Promise<RegularSeasonLineups> {
  await delay(800);
  return HARDCODED_LINEUPS;
}

// TODO: replace with real backend call — in-memory store simulates the server
let submissionsStore: Record<number, RegularSeasonPicksSubmission> = {
  1: {
    rankedPicks: [
      { matchup: ['KC', 'BAL'], winner: 'KC' },
      { matchup: ['MIA', 'BUF'], winner: 'BUF' },
      { matchup: ['CIN', 'PIT'], winner: 'CIN' },
      { matchup: ['MIN', 'DET'], winner: 'DET' },
      { matchup: ['HOU', 'IND'], winner: 'HOU' },
      { matchup: ['GB', 'CHI'], winner: 'GB' },
      { matchup: ['NYG', 'DAL'], winner: 'DAL' },
      { matchup: ['ATL', 'TB'], winner: 'ATL' },
      { matchup: ['LAC', 'LV'], winner: 'LAC' },
      { matchup: ['DEN', 'SEA'], winner: 'SEA' },
    ],
    filedPicks: [
      { matchup: ['TEN', 'NO'], winner: 'NO' },
      { matchup: ['CAR', 'WAS'], winner: 'WAS' },
      { matchup: ['ARI', 'SF'], winner: 'SF' },
      { matchup: ['LA', 'PHI'], winner: 'PHI' },
      { matchup: ['JAX', 'NE'], winner: 'JAX' },
      { matchup: ['CLE', 'NYJ'], winner: 'CLE' },
    ],
  },
  2: {
    rankedPicks: [
      { matchup: ['KC', 'CIN'], winner: 'KC' },
      { matchup: ['BUF', 'MIA'], winner: 'BUF' },
      { matchup: ['SF', 'MIN'], winner: 'SF' },
      { matchup: ['DET', 'TB'], winner: 'DET' },
      { matchup: ['PHI', 'ATL'], winner: 'PHI' },
      { matchup: ['DAL', 'NYG'], winner: 'DAL' },
      { matchup: ['BAL', 'LV'], winner: 'BAL' },
      { matchup: ['IND', 'CHI'], winner: 'IND' },
      { matchup: ['PIT', 'CLE'], winner: 'PIT' },
      { matchup: ['SEA', 'LAC'], winner: 'SEA' },
    ],
    filedPicks: [
      { matchup: ['NE', 'JAX'], winner: 'JAX' },
      { matchup: ['NO', 'CAR'], winner: 'NO' },
      { matchup: ['WAS', 'NYJ'], winner: 'WAS' },
      { matchup: ['HOU', 'TEN'], winner: 'HOU' },
      { matchup: ['DEN', 'LA'], winner: 'LA' },
      { matchup: ['ARI', 'GB'], winner: 'GB' },
    ],
  },
  3: {
    rankedPicks: [
      { matchup: ['LA', 'SF'], winner: 'SF' },
      { matchup: ['KC', 'ATL'], winner: 'KC' },
      { matchup: ['BUF', 'JAX'], winner: 'BUF' },
      { matchup: ['PHI', 'NO'], winner: 'PHI' },
      { matchup: ['DET', 'ARI'], winner: 'DET' },
      { matchup: ['GB', 'MIN'], winner: 'GB' },
      { matchup: ['BAL', 'DEN'], winner: 'BAL' },
      { matchup: ['CIN', 'WAS'], winner: 'CIN' },
      { matchup: ['MIA', 'SEA'], winner: 'MIA' },
      { matchup: ['DAL', 'HOU'], winner: 'HOU' },
    ],
    filedPicks: [
      { matchup: ['TEN', 'NYJ'], winner: 'NYJ' },
      { matchup: ['CAR', 'LV'], winner: 'LV' },
      { matchup: ['NE', 'NYG'], winner: 'NYG' },
      { matchup: ['IND', 'PIT'], winner: 'PIT' },
      { matchup: ['CLE', 'TB'], winner: 'TB' },
      { matchup: ['CHI', 'LAC'], winner: 'LAC' },
    ],
  },
};

export async function getRegularSeasonPicksSubmissions(): Promise<Record<number, RegularSeasonPicksSubmission>> {
  await delay(600);
  return submissionsStore;
}

export async function submitRegularSeasonPicks(week: number, submission: RegularSeasonPicksSubmission): Promise<void> {
  await delay(1000);
  submissionsStore = { ...submissionsStore, [week]: submission };
}

// TODO: replace with real backend call
const HARDCODED_GAME_RESULTS: Record<number, RegularSeasonGameResults> = {
  1: {
    rankedResults: [
      { matchup: ['KC', 'BAL'], winner: 'KC', score: [27, 20] },
      { matchup: ['MIA', 'BUF'], winner: 'BUF', score: [14, 31] },
      { matchup: ['CIN', 'PIT'], winner: 'CIN', score: [24, 17] },
      { matchup: ['MIN', 'DET'], winner: 'DET', score: [21, 28] },
      { matchup: ['HOU', 'IND'], winner: 'HOU', score: [30, 13] },
      { matchup: ['GB', 'CHI'], winner: 'GB', score: [35, 14] },
      { matchup: ['NYG', 'DAL'], winner: 'DAL', score: [10, 44] },
      { matchup: ['ATL', 'TB'], winner: 'ATL', score: [26, 24] },
      { matchup: ['LAC', 'LV'], winner: 'LAC', score: [22, 10] },
      { matchup: ['DEN', 'SEA'], winner: 'SEA', score: [17, 23] },
    ],
    filedResults: [
      { matchup: ['TEN', 'NO'], winner: 'NO', score: [14, 21] },
      { matchup: ['CAR', 'WAS'], winner: 'WAS', score: [7, 34] },
      { matchup: ['ARI', 'SF'], winner: 'SF', score: [13, 30] },
      { matchup: ['LA', 'PHI'], winner: 'PHI', score: [20, 26] },
      { matchup: ['JAX', 'NE'], winner: 'JAX', score: [17, 16] },
      { matchup: ['CLE', 'NYJ'], winner: 'CLE', score: [21, 14] },
    ],
  },
  2: {
    rankedResults: [
      { matchup: ['KC', 'CIN'], winner: 'KC', score: [26, 25] },
      { matchup: ['BUF', 'MIA'], winner: 'BUF', score: [38, 23] },
      { matchup: ['SF', 'MIN'], winner: 'SF', score: [27, 20] },
      { matchup: ['DET', 'TB'], winner: 'DET', score: [20, 16] },
      { matchup: ['PHI', 'ATL'], winner: 'PHI', score: [22, 21] },
      { matchup: ['DAL', 'NYG'], winner: 'DAL', score: [20, 15] },
      { matchup: ['BAL', 'LV'], winner: 'BAL', score: [37, 3] },
      { matchup: ['IND', 'CHI'], winner: 'IND', score: [21, 14] },
      { matchup: ['PIT', 'CLE'], winner: 'PIT', score: [26, 22] },
      { matchup: ['SEA', 'LAC'], winner: 'SEA', score: [23, 17] },
    ],
    filedResults: [
      { matchup: ['NE', 'JAX'], winner: 'JAX', score: [10, 27] },
      { matchup: ['NO', 'CAR'], winner: 'NO', score: [19, 10] },
      { matchup: ['WAS', 'NYJ'], winner: 'WAS', score: [23, 17] },
      { matchup: ['HOU', 'TEN'], winner: 'HOU', score: [31, 10] },
      { matchup: ['DEN', 'LA'], winner: 'LA', score: [14, 24] },
      { matchup: ['ARI', 'GB'], winner: 'GB', score: [13, 16] },
    ],
  },
  3: {
    rankedResults: [
      { matchup: ['LA', 'SF'], winner: 'SF', score: [17, 30] },
      { matchup: ['KC', 'ATL'], winner: 'KC', score: [22, 17] },
      { matchup: ['BUF', 'JAX'], winner: 'BUF', score: [34, 10] },
      { matchup: ['PHI', 'NO'], winner: 'PHI', score: [28, 21] },
      { matchup: ['DET', 'ARI'], winner: 'DET', score: [38, 20] },
      { matchup: ['GB', 'MIN'], winner: 'GB', score: [24, 19] },
      { matchup: ['BAL', 'DEN'], winner: 'BAL', score: [41, 10] },
      { matchup: ['CIN', 'WAS'], winner: 'CIN', score: [27, 24] },
      { matchup: ['MIA', 'SEA'], winner: 'MIA', score: [20, 17] },
      { matchup: ['DAL', 'HOU'], winner: 'HOU', score: [21, 28] },
    ],
    filedResults: [
      { matchup: ['TEN', 'NYJ'], winner: 'NYJ', score: [13, 23] },
      { matchup: ['CAR', 'LV'], winner: 'LV', score: [10, 17] },
      { matchup: ['NE', 'NYG'], winner: 'NYG', score: [14, 21] },
      { matchup: ['IND', 'PIT'], winner: 'PIT', score: [20, 23] },
      { matchup: ['CLE', 'TB'], winner: 'TB', score: [17, 26] },
      { matchup: ['CHI', 'LAC'], winner: 'LAC', score: [10, 30] },
    ],
  },
};

export async function getGameResults(): Promise<Record<number, RegularSeasonGameResults>> {
  await delay(600);
  return HARDCODED_GAME_RESULTS;
}

// TODO: replace with real backend call — only includes weeks whose deadline has passed
const HARDCODED_PAST_SUBMISSIONS: PastSubmissions = {
  1: {
    user_alice: {
      rankedPicks: [
        { matchup: ['KC', 'BAL'], winner: 'KC' },
        { matchup: ['MIA', 'BUF'], winner: 'BUF' },
        { matchup: ['CIN', 'PIT'], winner: 'CIN' },
        { matchup: ['MIN', 'DET'], winner: 'DET' },
        { matchup: ['HOU', 'IND'], winner: 'HOU' },
        { matchup: ['GB', 'CHI'], winner: 'GB' },
        { matchup: ['NYG', 'DAL'], winner: 'DAL' },
        { matchup: ['ATL', 'TB'], winner: 'TB' },
        { matchup: ['LAC', 'LV'], winner: 'LV' },
        { matchup: ['DEN', 'SEA'], winner: 'DEN' },
      ],
      filedPicks: [
        { matchup: ['TEN', 'NO'], winner: 'TEN' },
        { matchup: ['CAR', 'WAS'], winner: 'WAS' },
        { matchup: ['ARI', 'SF'], winner: 'SF' },
        { matchup: ['LA', 'PHI'], winner: 'PHI' },
        { matchup: ['JAX', 'NE'], winner: 'JAX' },
        { matchup: ['CLE', 'NYJ'], winner: 'NYJ' },
      ],
    },
    user_bob: {
      rankedPicks: [
        { matchup: ['KC', 'BAL'], winner: 'BAL' },
        { matchup: ['MIA', 'BUF'], winner: 'MIA' },
        { matchup: ['CIN', 'PIT'], winner: 'PIT' },
        { matchup: ['MIN', 'DET'], winner: 'MIN' },
        { matchup: ['HOU', 'IND'], winner: 'HOU' },
        { matchup: ['GB', 'CHI'], winner: 'GB' },
        { matchup: ['NYG', 'DAL'], winner: 'DAL' },
        { matchup: ['ATL', 'TB'], winner: 'ATL' },
        { matchup: ['LAC', 'LV'], winner: 'LAC' },
        { matchup: ['DEN', 'SEA'], winner: 'SEA' },
      ],
      filedPicks: [
        { matchup: ['TEN', 'NO'], winner: 'NO' },
        { matchup: ['CAR', 'WAS'], winner: 'CAR' },
        { matchup: ['ARI', 'SF'], winner: 'ARI' },
        { matchup: ['LA', 'PHI'], winner: 'LA' },
        { matchup: ['JAX', 'NE'], winner: 'NE' },
        { matchup: ['CLE', 'NYJ'], winner: 'CLE' },
      ],
    },
    user_carol: {
      rankedPicks: [
        { matchup: ['KC', 'BAL'], winner: 'KC' },
        { matchup: ['MIA', 'BUF'], winner: 'BUF' },
        { matchup: ['CIN', 'PIT'], winner: 'PIT' },
        { matchup: ['MIN', 'DET'], winner: 'DET' },
        { matchup: ['HOU', 'IND'], winner: 'IND' },
        { matchup: ['GB', 'CHI'], winner: 'CHI' },
        { matchup: ['NYG', 'DAL'], winner: 'NYG' },
        { matchup: ['ATL', 'TB'], winner: 'ATL' },
        { matchup: ['LAC', 'LV'], winner: 'LAC' },
        { matchup: ['DEN', 'SEA'], winner: 'SEA' },
      ],
      filedPicks: [
        { matchup: ['TEN', 'NO'], winner: 'NO' },
        { matchup: ['CAR', 'WAS'], winner: 'WAS' },
        { matchup: ['ARI', 'SF'], winner: 'SF' },
        { matchup: ['LA', 'PHI'], winner: 'PHI' },
        { matchup: ['JAX', 'NE'], winner: 'JAX' },
        { matchup: ['CLE', 'NYJ'], winner: 'CLE' },
      ],
    },
  },
  2: {
    user_alice: {
      rankedPicks: [
        { matchup: ['KC', 'CIN'], winner: 'CIN' },
        { matchup: ['BUF', 'MIA'], winner: 'BUF' },
        { matchup: ['SF', 'MIN'], winner: 'SF' },
        { matchup: ['DET', 'TB'], winner: 'DET' },
        { matchup: ['PHI', 'ATL'], winner: 'ATL' },
        { matchup: ['DAL', 'NYG'], winner: 'DAL' },
        { matchup: ['BAL', 'LV'], winner: 'BAL' },
        { matchup: ['IND', 'CHI'], winner: 'CHI' },
        { matchup: ['PIT', 'CLE'], winner: 'PIT' },
        { matchup: ['SEA', 'LAC'], winner: 'LAC' },
      ],
      filedPicks: [
        { matchup: ['NE', 'JAX'], winner: 'NE' },
        { matchup: ['NO', 'CAR'], winner: 'NO' },
        { matchup: ['WAS', 'NYJ'], winner: 'NYJ' },
        { matchup: ['HOU', 'TEN'], winner: 'HOU' },
        { matchup: ['DEN', 'LA'], winner: 'DEN' },
        { matchup: ['ARI', 'GB'], winner: 'ARI' },
      ],
    },
    user_bob: {
      rankedPicks: [
        { matchup: ['KC', 'CIN'], winner: 'KC' },
        { matchup: ['BUF', 'MIA'], winner: 'BUF' },
        { matchup: ['SF', 'MIN'], winner: 'MIN' },
        { matchup: ['DET', 'TB'], winner: 'TB' },
        { matchup: ['PHI', 'ATL'], winner: 'PHI' },
        { matchup: ['DAL', 'NYG'], winner: 'NYG' },
        { matchup: ['BAL', 'LV'], winner: 'BAL' },
        { matchup: ['IND', 'CHI'], winner: 'IND' },
        { matchup: ['PIT', 'CLE'], winner: 'CLE' },
        { matchup: ['SEA', 'LAC'], winner: 'SEA' },
      ],
      filedPicks: [
        { matchup: ['NE', 'JAX'], winner: 'JAX' },
        { matchup: ['NO', 'CAR'], winner: 'CAR' },
        { matchup: ['WAS', 'NYJ'], winner: 'WAS' },
        { matchup: ['HOU', 'TEN'], winner: 'TEN' },
        { matchup: ['DEN', 'LA'], winner: 'LA' },
        { matchup: ['ARI', 'GB'], winner: 'GB' },
      ],
    },
    user_carol: {
      rankedPicks: [
        { matchup: ['KC', 'CIN'], winner: 'KC' },
        { matchup: ['BUF', 'MIA'], winner: 'BUF' },
        { matchup: ['SF', 'MIN'], winner: 'SF' },
        { matchup: ['DET', 'TB'], winner: 'DET' },
        { matchup: ['PHI', 'ATL'], winner: 'PHI' },
        { matchup: ['DAL', 'NYG'], winner: 'DAL' },
        { matchup: ['BAL', 'LV'], winner: 'LV' },
        { matchup: ['IND', 'CHI'], winner: 'IND' },
        { matchup: ['PIT', 'CLE'], winner: 'PIT' },
        { matchup: ['SEA', 'LAC'], winner: 'SEA' },
      ],
      filedPicks: [
        { matchup: ['NE', 'JAX'], winner: 'JAX' },
        { matchup: ['NO', 'CAR'], winner: 'NO' },
        { matchup: ['WAS', 'NYJ'], winner: 'WAS' },
        { matchup: ['HOU', 'TEN'], winner: 'HOU' },
        { matchup: ['DEN', 'LA'], winner: 'LA' },
        { matchup: ['ARI', 'GB'], winner: 'GB' },
      ],
    },
  },
};

export async function getPastSubmissions(): Promise<PastSubmissions> {
  await delay(700);
  return HARDCODED_PAST_SUBMISSIONS;
}
