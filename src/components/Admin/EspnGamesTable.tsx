import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Box, Chip, Typography } from '@mui/material';
import type { GridColDef, GridColumnVisibilityModel, GridRowSelectionModel } from '@mui/x-data-grid';
import { Alert, Badge, Button, Group, Select, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';

import { getEspnGames, type EspnGamesFilter } from '@/app/API/espnFunctions';
import type { EspnGameRecord } from '@/types/espn';
import GenericTable from '@/components/shared/GenericTable';

const SEASON_TYPE_OPTIONS = [
  { value: '', label: 'All season types' },
  { value: '1', label: 'Preseason (1)' },
  { value: '2', label: 'Regular Season (2)' },
  { value: '3', label: 'Playoffs (3)' },
];

const SEASON_TYPE_LABELS: Record<string, string> = {
  '1': 'Preseason',
  '2': 'Regular Season',
  '3': 'Playoffs',
};

const CURRENT_YEAR = String(new Date().getFullYear());

// ── Filter localStorage persistence ──────────────────────────────────────────

const FILTER_STORAGE_KEY = 'espn-games-filter';

interface SavedFilter {
  year: string;
  seasonType: string;
  week: string;
}

function loadSavedFilter(): SavedFilter | null {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedFilter) : null;
  } catch {
    return null;
  }
}

function persistFilter(year: string, seasonType: string, week: string): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ year, seasonType, week }));
  } catch {
    // silently ignore
  }
}

const DEFAULT_COLUMN_VISIBILITY: GridColumnVisibilityModel = {
  matchup: true,
  start_time: true,
  week_text: true,
  score: true,
  status: true,
  source_event_type: true,
  venue_full_name: true,
  game_id: false,
  competition_id: false,
  year: false,
  season_type: false,
  week: false,
  home: false,
  away: false,
  home_team_id: false,
  away_team_id: false,
  competition_type: false,
  competition_type_slug: false,
  neutral_site: false,
  venue_id: false,
  venue_city: false,
  venue_state: false,
  venue_country: false,
  is_international: false,
  completed: false,
  winner: false,
  espn_updated_at: false,
  ingested_at: false,
  schedule_hash: false,
  final_hash: false,
  entity_type: false,
  pk: false,
  sk: false,
  gsi1pk: false,
  gsi1sk: false,
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function boolCell(value: boolean | undefined) {
  if (value === undefined)
    return (
      <Typography variant="body2" sx={{ opacity: 0.4 }}>
        —
      </Typography>
    );
  return <Chip label={value ? 'Yes' : 'No'} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: 11 }} />;
}

export default function EspnGamesTable() {
  const [, setSearchParams] = useSearchParams();

  // ── Bootstrap: resolve all four in lock-step ─────────────────────────────
  //
  // On every mount (including refresh) we pick ONE source of truth and
  // immediately write all other stores to match, so all four are always
  // identical:
  //
  //   1. URL query params  (highest priority — user shared/bookmarked the URL)
  //      → writes localStorage
  //
  //   2. localStorage      (user navigated away and came back, or no URL)
  //      → writes URL      (done by the useEffect below that syncs on committed)
  //
  //   3. Hard-coded defaults (first ever visit)
  //      → writes URL + localStorage (URL via effect, localStorage on first Load)
  const [committed, setCommitted] = useState<EspnGamesFilter>(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.has('year')) {
      const year = params.get('year')!;
      const seasonType = params.get('seasonType') ?? '';
      const week = params.get('week') ?? '';
      // URL is the authority → immediately sync localStorage to match.
      persistFilter(year, seasonType, week);
      return {
        year,
        seasonType: seasonType || undefined,
        week: week || undefined,
      };
    }

    const saved = loadSavedFilter();
    if (saved) {
      // localStorage is the authority → URL will be synced by the useEffect.
      return {
        year: saved.year,
        seasonType: saved.seasonType || undefined,
        week: saved.week || undefined,
      };
    }

    // Hard-coded defaults — URL will be synced by the useEffect.
    return { year: CURRENT_YEAR, seasonType: '2', week: undefined };
  });

  // Input controls always mirror committed on mount.
  const [yearInput, setYearInput] = useState(committed.year);
  const [seasonTypeInput, setSeasonTypeInput] = useState(committed.seasonType ?? '');
  const [weekInput, setWeekInput] = useState(committed.week ?? '');
  const [resetPageKey, setResetPageKey] = useState(0);
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>(() => ({
    type: 'include',
    ids: new Set(),
  }));

  // Keep URL in sync with the committed filter so the tab is bookmarkable.
  // This also runs on first mount to populate the URL from localStorage/defaults.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('year', committed.year);
        if (committed.seasonType) next.set('seasonType', committed.seasonType);
        else next.delete('seasonType');
        if (committed.week) next.set('week', committed.week);
        else next.delete('week');
        return next;
      },
      { replace: true },
    );
  }, [committed, setSearchParams]);

  function handleLoad() {
    const year = yearInput.trim() || CURRENT_YEAR;
    const seasonType = seasonTypeInput; // keep as raw string for localStorage
    const week = weekInput.trim();

    // Write to all four stores in one shot:
    //   committed  → triggers new React Query fetch
    //   URL        → synced by the useEffect that watches committed
    //   localStorage → written here so all four match immediately
    persistFilter(year, seasonType, week);
    setCommitted({ year, seasonType: seasonType || undefined, week: week || undefined });
    setResetPageKey((k) => k + 1);
  }

  const {
    data: games = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['espnGames', committed],
    queryFn: () => getEspnGames(committed),
    enabled: Boolean(committed.year),
  });

  const columns = useMemo<GridColDef<EspnGameRecord>[]>(
    () => [
      // ── Always-visible summary columns ───────────────────────────────────
      {
        field: 'matchup',
        headerName: 'Matchup',
        minWidth: 160,
        flex: 1,
        sortable: false,
        filterable: false,
        valueGetter: (_v, row) => `${row.away} @ ${row.home}`,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" fontWeight={700}>
              {row.away} <span style={{ fontWeight: 400, opacity: 0.6 }}>@</span> {row.home}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'start_time',
        headerName: 'Kickoff',
        minWidth: 210,
        flex: 1.1,
        type: 'dateTime',
        valueGetter: (_v, row) => new Date(row.start_time),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">{formatDate(row.start_time)}</Typography>
          </Box>
        ),
      },
      {
        field: 'week_text',
        headerName: 'Week',
        minWidth: 110,
        flex: 0.6,
      },
      {
        field: 'score',
        headerName: 'Score',
        minWidth: 110,
        flex: 0.6,
        sortable: false,
        filterable: false,
        valueGetter: (_v, row) => (row.completed ? `${row.away_score ?? '–'} – ${row.home_score ?? '–'}` : '–'),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            {row.completed ? (
              <Typography variant="body2" fontWeight={700}>
                {row.away_score} – {row.home_score}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ opacity: 0.4 }}>
                —
              </Typography>
            )}
          </Box>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 130,
        flex: 0.7,
        renderCell: ({ row }) => {
          const isFinal = row.completed;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Chip
                label={isFinal ? (row.status ?? 'Final') : (row.status ?? 'Scheduled')}
                size="small"
                variant={isFinal ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 600,
                  bgcolor: isFinal ? 'var(--app-admin-table-active-bg)' : 'transparent',
                  color: isFinal ? 'var(--app-admin-table-active-text)' : 'var(--app-admin-table-member-role-text)',
                  borderColor: isFinal
                    ? 'var(--app-admin-table-active-border)'
                    : 'var(--app-admin-table-member-role-border)',
                }}
              />
            </Box>
          );
        },
      },
      {
        field: 'source_event_type',
        headerName: 'Source',
        minWidth: 160,
        flex: 0.8,
        renderCell: ({ row }) => {
          const isGame = row.source_event_type === 'game_final';
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Chip
                label={row.source_event_type}
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  fontSize: 11,
                  color: isGame ? 'var(--app-admin-table-admin-role-text)' : 'var(--app-admin-table-muted-text)',
                  borderColor: isGame ? 'var(--app-admin-table-admin-role-border)' : 'var(--app-admin-table-border)',
                }}
              />
            </Box>
          );
        },
      },
      {
        field: 'venue_full_name',
        headerName: 'Venue',
        minWidth: 180,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ opacity: row.venue_full_name ? 1 : 0.4 }}>
              {row.venue_full_name ?? '—'}
            </Typography>
          </Box>
        ),
      },
      // ── Hidden by default — all raw DynamoDB fields ───────────────────────
      { field: 'game_id', headerName: 'Game ID', minWidth: 140, flex: 0.8 },
      { field: 'competition_id', headerName: 'Competition ID', minWidth: 150, flex: 0.8 },
      { field: 'year', headerName: 'Year', minWidth: 80, flex: 0.5 },
      {
        field: 'season_type',
        headerName: 'Season Type',
        minWidth: 130,
        flex: 0.7,
        valueGetter: (_v, row) => SEASON_TYPE_LABELS[row.season_type] ?? String(row.season_type),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">{SEASON_TYPE_LABELS[row.season_type] ?? row.season_type}</Typography>
          </Box>
        ),
      },
      { field: 'week', headerName: 'Week #', minWidth: 80, flex: 0.5 },
      { field: 'home', headerName: 'Home', minWidth: 100, flex: 0.6 },
      { field: 'away', headerName: 'Away', minWidth: 100, flex: 0.6 },
      { field: 'home_team_id', headerName: 'Home Team ID', minWidth: 130, flex: 0.7 },
      { field: 'away_team_id', headerName: 'Away Team ID', minWidth: 130, flex: 0.7 },
      { field: 'competition_type', headerName: 'Competition Type', minWidth: 150, flex: 0.8 },
      { field: 'competition_type_slug', headerName: 'Competition Slug', minWidth: 150, flex: 0.8 },
      {
        field: 'neutral_site',
        headerName: 'Neutral Site',
        minWidth: 110,
        flex: 0.6,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>{boolCell(row.neutral_site)}</Box>
        ),
      },
      { field: 'venue_id', headerName: 'Venue ID', minWidth: 130, flex: 0.7 },
      { field: 'venue_city', headerName: 'Venue City', minWidth: 130, flex: 0.7 },
      { field: 'venue_state', headerName: 'Venue State', minWidth: 110, flex: 0.6 },
      { field: 'venue_country', headerName: 'Venue Country', minWidth: 120, flex: 0.6 },
      {
        field: 'is_international',
        headerName: 'International',
        minWidth: 120,
        flex: 0.6,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>{boolCell(row.is_international)}</Box>
        ),
      },
      {
        field: 'completed',
        headerName: 'Completed',
        minWidth: 110,
        flex: 0.6,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>{boolCell(row.completed)}</Box>
        ),
      },
      { field: 'winner', headerName: 'Winner', minWidth: 100, flex: 0.6 },
      {
        field: 'espn_updated_at',
        headerName: 'ESPN Updated',
        minWidth: 200,
        flex: 0.9,
        type: 'dateTime',
        valueGetter: (_v, row) => new Date(row.espn_updated_at),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">{formatDate(row.espn_updated_at)}</Typography>
          </Box>
        ),
      },
      {
        field: 'ingested_at',
        headerName: 'Ingested At',
        minWidth: 200,
        flex: 0.9,
        type: 'dateTime',
        valueGetter: (_v, row) => new Date(row.ingested_at),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">{formatDate(row.ingested_at)}</Typography>
          </Box>
        ),
      },
      { field: 'schedule_hash', headerName: 'Schedule Hash', minWidth: 200, flex: 1 },
      { field: 'final_hash', headerName: 'Final Hash', minWidth: 200, flex: 1 },
      { field: 'entity_type', headerName: 'Entity Type', minWidth: 120, flex: 0.6 },
      { field: 'pk', headerName: 'PK', minWidth: 250, flex: 1.2 },
      { field: 'sk', headerName: 'SK', minWidth: 220, flex: 1.1 },
      { field: 'gsi1pk', headerName: 'GSI1 PK', minWidth: 180, flex: 0.9 },
      { field: 'gsi1sk', headerName: 'GSI1 SK', minWidth: 180, flex: 0.9 },
    ],
    [],
  );

  if (isError) {
    return (
      <Alert color="red" title="Error loading ESPN games">
        {error instanceof Error ? error.message : 'An unexpected error occurred.'}
      </Alert>
    );
  }

  const badgeSharedStyle = {
    alignSelf: 'flex-end' as const,
    marginBottom: 2,
    fontWeight: 600,
  };

  const headerRight = (
    <Group gap="xs" align="flex-end" wrap="wrap">
      <TextInput
        label="Year"
        size="xs"
        value={yearInput}
        onChange={(e) => setYearInput(e.currentTarget.value)}
        style={{ width: 80 }}
      />
      <Select
        label="Season type"
        size="xs"
        data={SEASON_TYPE_OPTIONS}
        value={seasonTypeInput}
        onChange={(v) => setSeasonTypeInput(v ?? '')}
        style={{ width: 160 }}
        clearable={false}
      />
      <TextInput
        label="Week"
        placeholder="e.g. 1"
        size="xs"
        value={weekInput}
        onChange={(e) => setWeekInput(e.currentTarget.value)}
        style={{ width: 80 }}
      />
      <Button size="xs" onClick={handleLoad} loading={isLoading} style={{ marginBottom: 1 }}>
        Load
      </Button>
      <Badge
        variant="outline"
        style={{
          ...badgeSharedStyle,
          background: 'var(--app-admin-table-summary-chip-bg)',
          color: 'var(--app-admin-table-summary-chip-text)',
          borderColor: 'var(--app-admin-table-summary-chip-border)',
        }}
      >
        {games.length} games
      </Badge>
      <Badge
        variant={rowSelectionModel.ids.size ? 'filled' : 'outline'}
        style={{
          ...badgeSharedStyle,
          background: rowSelectionModel.ids.size ? 'var(--app-admin-table-summary-selected-bg)' : 'transparent',
          color: rowSelectionModel.ids.size
            ? 'var(--app-admin-table-summary-selected-text)'
            : 'var(--app-admin-table-member-role-text)',
          borderColor: rowSelectionModel.ids.size
            ? 'var(--app-admin-table-summary-selected-border)'
            : 'var(--app-admin-table-member-role-border)',
        }}
      >
        {rowSelectionModel.ids.size ? `${rowSelectionModel.ids.size} selected` : 'No rows selected'}
      </Badge>
    </Group>
  );

  return (
    <GenericTable
      tableId="espn-games"
      title="ESPN Games"
      description="Raw read-only game data ingested from ESPN. Use the Columns menu to reveal all fields."
      rows={games}
      columns={columns}
      getRowId={(row) => row.game_id}
      loading={isLoading}
      defaultColumnVisibility={DEFAULT_COLUMN_VISIBILITY}
      initialSort={{ field: 'start_time', sort: 'asc' }}
      pageSizeOptions={[10, 25, 50]}
      defaultPageSize={25}
      resetPageKey={resetPageKey}
      csvFileName="espn-games"
      checkboxSelection
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={setRowSelectionModel}
      headerRight={headerRight}
    />
  );
}
