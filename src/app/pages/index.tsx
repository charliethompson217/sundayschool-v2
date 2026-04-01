// src/config/routes.tsx

import { IconHome, IconSettings, IconClipboardList, IconChartDots, IconUserShield } from '@tabler/icons-react';
import HomeRoute from './Home.tsx';
import SettingsRoute from './Settings.tsx';
import NotFoundRoute from './NotFound.tsx';
import type { ComponentType } from 'react';
import type { Icon } from '@tabler/icons-react';
import ResultsRoute from './Results.tsx';
import AdminRoute from './Admin.tsx';
import SubmitPicksRoute from './SubmitPicks.tsx';
import AuthPage from './AuthPage.tsx'; // Adjust path if needed

export type RouteConfig = {
  path: string;
  element: ComponentType;
  label?: string;
  icon?: Icon;
  showInNav?: boolean;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
};

export const routes: RouteConfig[] = [
  {
    path: '/',
    element: HomeRoute,
    label: 'Home',
    icon: IconHome,
    showInNav: true,
    requiresAuth: false,
  },
  {
    path: '/submitpicks',
    element: SubmitPicksRoute,
    label: 'Submit Picks',
    icon: IconClipboardList,
    showInNav: true,
    requiresAuth: true,
  },
  {
    path: '/results',
    element: ResultsRoute,
    label: 'Results',
    icon: IconChartDots,
    showInNav: true,
    requiresAuth: false,
  },
  {
    path: '/admin',
    element: AdminRoute,
    label: 'Admin',
    icon: IconUserShield,
    showInNav: true,
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    path: '/settings',
    element: SettingsRoute,
    label: 'Settings',
    icon: IconSettings,
    showInNav: true,
    requiresAuth: true,
  },
  {
    path: '/login',
    element: AuthPage,
    showInNav: false,
    requiresAuth: false,
  },
  {
    path: '*',
    element: NotFoundRoute,
    requiresAuth: false,
  },
];
