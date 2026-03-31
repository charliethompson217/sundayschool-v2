// src/app/theme.ts

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
