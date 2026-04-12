import { createTheme, type CSSVariablesResolver } from '@mantine/core';

// ---------------------------------------------------------------------------
// Semantic design tokens
//
// Add new tokens here. Each key appears in both `light` and `dark` buckets so
// the correct value is applied automatically when the color scheme changes.
// Reference them anywhere in the app as `var(--app-<token>)` — no imports or
// useComputedColorScheme calls needed.
// ---------------------------------------------------------------------------

export const resolver: CSSVariablesResolver = (theme) => ({
  variables: {
    // color-scheme-independent tokens (static values)
  },

  light: {
    // --- Team pick states ---
    '--app-pick-win-bg': theme.colors.green[6],
    '--app-pick-win-border': theme.colors.green[8],
    '--app-pick-lose-bg': theme.colors.red[6],
    '--app-pick-lose-border': theme.colors.red[8],
    '--app-pick-tie-bg': theme.colors.yellow[5],
    '--app-pick-tie-border': theme.colors.yellow[7],
    '--app-pick-tie-text': theme.colors.dark[9],

    // --- Primary action button ---
    '--app-primary-button-bg': theme.colors.blue[6],
    '--app-primary-button-hover': theme.colors.blue[7],
    '--app-primary-button-text': '#ffffff',

    // --- Admin table ---
    '--app-admin-table-surface': theme.white,
    '--app-admin-table-gradient-start': 'rgba(99, 102, 241, 0.04)',
    '--app-admin-table-toolbar-bg': 'rgba(99, 102, 241, 0.04)',
    '--app-admin-table-header-bg': theme.white,
    '--app-admin-table-footer-bg': 'rgba(99, 102, 241, 0.02)',
    '--app-admin-table-hover-bg': 'rgba(99, 102, 241, 0.05)',
    '--app-admin-table-shadow': 'rgba(15, 23, 42, 0.08)',
    '--app-admin-table-border': theme.colors.gray[3],
    '--app-admin-table-header-text': theme.colors.gray[7],
    '--app-admin-table-muted-text': theme.colors.gray[6],
    '--app-admin-table-admin-avatar-bg': theme.colors.grape[6],
    '--app-admin-table-member-avatar-bg': theme.colors.blue[6],
    '--app-admin-table-admin-role-bg': theme.colors.grape[1],
    '--app-admin-table-admin-role-border': theme.colors.grape[3],
    '--app-admin-table-admin-role-text': theme.colors.grape[8],
    '--app-admin-table-member-role-border': theme.colors.gray[4],
    '--app-admin-table-member-role-text': theme.colors.gray[8],
    '--app-admin-table-active-bg': 'rgba(64, 192, 87, 0.08)',
    '--app-admin-table-active-border': theme.colors.green[3],
    '--app-admin-table-active-text': theme.colors.green[8],
    '--app-admin-table-inactive-bg': 'rgba(250, 82, 82, 0.08)',
    '--app-admin-table-inactive-border': theme.colors.red[3],
    '--app-admin-table-inactive-text': theme.colors.red[8],
    '--app-admin-table-verified-bg': 'rgba(51, 154, 240, 0.08)',
    '--app-admin-table-verified-border': theme.colors.blue[3],
    '--app-admin-table-verified-text': theme.colors.blue[8],
    '--app-admin-table-pending-bg': 'rgba(252, 196, 25, 0.12)',
    '--app-admin-table-pending-border': theme.colors.yellow[4],
    '--app-admin-table-pending-text': theme.colors.yellow[9],
    '--app-admin-table-summary-chip-bg': theme.colors.blue[0],
    '--app-admin-table-summary-chip-border': theme.colors.blue[2],
    '--app-admin-table-summary-chip-text': theme.colors.blue[8],
    '--app-admin-table-summary-selected-bg': theme.colors.grape[6],
    '--app-admin-table-summary-selected-border': theme.colors.grape[6],
    '--app-admin-table-summary-selected-text': theme.white,
  },

  dark: {
    // --- Team pick states ---
    '--app-pick-win-bg': theme.colors.green[9],
    '--app-pick-win-border': theme.colors.green[7],
    '--app-pick-lose-bg': theme.colors.red[9],
    '--app-pick-lose-border': theme.colors.red[7],
    '--app-pick-tie-bg': theme.colors.yellow[8],
    '--app-pick-tie-border': theme.colors.yellow[6],
    '--app-pick-tie-text': theme.black,

    // --- Primary action button ---
    '--app-primary-button-bg': theme.colors.blue[7],
    '--app-primary-button-hover': theme.colors.blue[6],
    '--app-primary-button-text': '#ffffff',

    // --- Admin table ---
    '--app-admin-table-surface': theme.colors.dark[7],
    '--app-admin-table-gradient-start': 'rgba(255, 255, 255, 0.03)',
    '--app-admin-table-toolbar-bg': 'rgba(255, 255, 255, 0.03)',
    '--app-admin-table-header-bg': theme.colors.dark[7],
    '--app-admin-table-footer-bg': 'rgba(255, 255, 255, 0.02)',
    '--app-admin-table-hover-bg': 'rgba(255, 255, 255, 0.04)',
    '--app-admin-table-shadow': 'rgba(0, 0, 0, 0.35)',
    '--app-admin-table-border': theme.colors.dark[4],
    '--app-admin-table-header-text': theme.colors.gray[4],
    '--app-admin-table-muted-text': theme.colors.dark[0],
    '--app-admin-table-admin-avatar-bg': theme.colors.grape[8],
    '--app-admin-table-member-avatar-bg': theme.colors.blue[8],
    '--app-admin-table-admin-role-bg': theme.colors.grape[8],
    '--app-admin-table-admin-role-border': theme.colors.grape[6],
    '--app-admin-table-admin-role-text': theme.colors.grape[1],
    '--app-admin-table-member-role-border': theme.colors.dark[4],
    '--app-admin-table-member-role-text': theme.colors.gray[1],
    '--app-admin-table-active-bg': 'rgba(64, 192, 87, 0.14)',
    '--app-admin-table-active-border': theme.colors.green[6],
    '--app-admin-table-active-text': theme.colors.green[2],
    '--app-admin-table-inactive-bg': 'rgba(250, 82, 82, 0.14)',
    '--app-admin-table-inactive-border': theme.colors.red[6],
    '--app-admin-table-inactive-text': theme.colors.red[2],
    '--app-admin-table-verified-bg': 'rgba(51, 154, 240, 0.14)',
    '--app-admin-table-verified-border': theme.colors.blue[6],
    '--app-admin-table-verified-text': theme.colors.blue[2],
    '--app-admin-table-pending-bg': 'rgba(252, 196, 25, 0.14)',
    '--app-admin-table-pending-border': theme.colors.yellow[6],
    '--app-admin-table-pending-text': theme.colors.yellow[2],
    '--app-admin-table-summary-chip-bg': theme.colors.blue[9],
    '--app-admin-table-summary-chip-border': theme.colors.blue[6],
    '--app-admin-table-summary-chip-text': theme.colors.blue[1],
    '--app-admin-table-summary-selected-bg': theme.colors.grape[8],
    '--app-admin-table-summary-selected-border': theme.colors.grape[6],
    '--app-admin-table-summary-selected-text': theme.colors.grape[1],
  },
});

export const theme = createTheme({
  colors: {
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5C5F66',
      '#373A40',
      '#2C2E33',
      '#25262B',
      '#000000', // dark[7] - pure black background in dark mode
      '#202020',
      '#151515',
    ],
  },
  components: {
    AppShell: {
      styles: () => ({
        header: {
          borderBottom: `0.5px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-9))`,
        },
        navbar: {
          borderRight: `0.5px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-8))`,
        },
      }),
    },
  },
});
