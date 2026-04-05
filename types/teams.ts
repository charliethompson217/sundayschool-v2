import { z } from 'zod';

export const TEAM_IDS = {
  ARI: 'ARI',
  ATL: 'ATL',
  BAL: 'BAL',
  BUF: 'BUF',
  CAR: 'CAR',
  CHI: 'CHI',
  CIN: 'CIN',
  CLE: 'CLE',
  DAL: 'DAL',
  DEN: 'DEN',
  DET: 'DET',
  GB: 'GB',
  HOU: 'HOU',
  IND: 'IND',
  JAX: 'JAX',
  KC: 'KC',
  LAR: 'LAR',
  LAC: 'LAC',
  LV: 'LV',
  MIA: 'MIA',
  MIN: 'MIN',
  NE: 'NE',
  NO: 'NO',
  NYG: 'NYG',
  NYJ: 'NYJ',
  PHI: 'PHI',
  PIT: 'PIT',
  SEA: 'SEA',
  SF: 'SF',
  TB: 'TB',
  TEN: 'TEN',
  WSH: 'WSH',
} as const;

export type TeamID = keyof typeof TEAM_IDS;
export type TeamNameType = 'full' | 'location' | 'mascot';

type TeamNameParts = {
  full: string;
  location: string;
  mascot: string;
};

const teamNames: Record<TeamID, TeamNameParts> = {
  ARI: { full: 'Arizona Cardinals', location: 'Arizona', mascot: 'Cardinals' },
  ATL: { full: 'Atlanta Falcons', location: 'Atlanta', mascot: 'Falcons' },
  BAL: { full: 'Baltimore Ravens', location: 'Baltimore', mascot: 'Ravens' },
  BUF: { full: 'Buffalo Bills', location: 'Buffalo', mascot: 'Bills' },
  CAR: { full: 'Carolina Panthers', location: 'Carolina', mascot: 'Panthers' },
  CHI: { full: 'Chicago Bears', location: 'Chicago', mascot: 'Bears' },
  CIN: { full: 'Cincinnati Bengals', location: 'Cincinnati', mascot: 'Bengals' },
  CLE: { full: 'Cleveland Browns', location: 'Cleveland', mascot: 'Browns' },
  DAL: { full: 'Dallas Cowboys', location: 'Dallas', mascot: 'Cowboys' },
  DEN: { full: 'Denver Broncos', location: 'Denver', mascot: 'Broncos' },
  DET: { full: 'Detroit Lions', location: 'Detroit', mascot: 'Lions' },
  GB: { full: 'Green Bay Packers', location: 'Green Bay', mascot: 'Packers' },
  HOU: { full: 'Houston Texans', location: 'Houston', mascot: 'Texans' },
  IND: { full: 'Indianapolis Colts', location: 'Indianapolis', mascot: 'Colts' },
  JAX: { full: 'Jacksonville Jaguars', location: 'Jacksonville', mascot: 'Jaguars' },
  KC: { full: 'Kansas City Chiefs', location: 'Kansas City', mascot: 'Chiefs' },
  LAR: { full: 'Los Angeles Rams', location: 'Los Angeles', mascot: 'Rams' },
  LAC: { full: 'Los Angeles Chargers', location: 'Los Angeles', mascot: 'Chargers' },
  LV: { full: 'Las Vegas Raiders', location: 'Las Vegas', mascot: 'Raiders' },
  MIA: { full: 'Miami Dolphins', location: 'Miami', mascot: 'Dolphins' },
  MIN: { full: 'Minnesota Vikings', location: 'Minnesota', mascot: 'Vikings' },
  NE: { full: 'New England Patriots', location: 'New England', mascot: 'Patriots' },
  NO: { full: 'New Orleans Saints', location: 'New Orleans', mascot: 'Saints' },
  NYG: { full: 'New York Giants', location: 'New York', mascot: 'Giants' },
  NYJ: { full: 'New York Jets', location: 'New York', mascot: 'Jets' },
  PHI: { full: 'Philadelphia Eagles', location: 'Philadelphia', mascot: 'Eagles' },
  PIT: { full: 'Pittsburgh Steelers', location: 'Pittsburgh', mascot: 'Steelers' },
  SEA: { full: 'Seattle Seahawks', location: 'Seattle', mascot: 'Seahawks' },
  SF: { full: 'San Francisco 49ers', location: 'San Francisco', mascot: '49ers' },
  TB: { full: 'Tampa Bay Buccaneers', location: 'Tampa Bay', mascot: 'Buccaneers' },
  TEN: { full: 'Tennessee Titans', location: 'Tennessee', mascot: 'Titans' },
  WSH: { full: 'Washington Commanders', location: 'Washington', mascot: 'Commanders' },
};

const nameToIdMap: Record<string, TeamID> = Object.fromEntries(
  Object.entries(teamNames).flatMap(([id, names]) => {
    const teamID = id as TeamID;

    const aliases = [names.full, names.location, names.mascot, `${names.location} ${names.mascot}`];

    if (teamID === 'SF') aliases.push('Niners');
    if (teamID === 'TB') aliases.push('Bucs');

    return aliases.map((alias) => [alias.trim().toLowerCase(), teamID]);
  }),
) as Record<string, TeamID>;

export function getTeamID(teamName: string): TeamID | undefined {
  return nameToIdMap[teamName.trim().toLowerCase()];
}

export function getTeamName(teamID: TeamID, type: TeamNameType = 'full'): string {
  return teamNames[teamID][type];
}

export function getTeamNames(teamID: TeamID): TeamNameParts {
  return teamNames[teamID];
}

// Mirror of the TeamID union as a runtime-checkable Zod enum.
export const TeamIDSchema = z.enum(Object.keys(TEAM_IDS) as [keyof typeof TEAM_IDS, ...Array<keyof typeof TEAM_IDS>]);

// What ChooseTeam stores: a chosen team, a tie, or nothing yet (null).
// `allowTie` controls whether 'TIE' is ever reachable in the UI.
export const TeamSelectionSchema = z.union([TeamIDSchema, z.literal('TIE'), z.null()]);
export type TeamSelection = z.infer<typeof TeamSelectionSchema>;

// Matchup: [awayTeamID, homeTeamID]
export const MatchupSchema = z.tuple([TeamIDSchema, TeamIDSchema]);
export type Matchup = z.infer<typeof MatchupSchema>;
