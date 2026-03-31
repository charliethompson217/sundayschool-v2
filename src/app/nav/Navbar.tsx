// src/app/nav/Navbar.tsx

import { AppShell, Burger, Group, Title } from '@mantine/core';
import { NavLinks } from './NavLinks.tsx';
import { NavToggle } from './NavToggle.tsx';
import { useNavState } from './useNavState.ts';

type Props = {
  children: React.ReactNode;
};

export function Navbar({ children }: Props) {
  const { mobileOpened, toggleMobile, closeMobile, desktopExpanded, toggleDesktop, isDesktop } = useNavState();

  const showLabels = !isDesktop || desktopExpanded;

  return (
    <AppShell
      header={{ height: 50 }}
      navbar={{
        width: { base: isDesktop ? (desktopExpanded ? 260 : 45) : 260 },
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" align="center">
          <Group>
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            <Title order={2}>Sunday School</Title>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p={{ base: 'xs', xs: 0 }} py="xs">
        <NavLinks showLabels={showLabels} onMobileClose={isDesktop ? undefined : closeMobile} />

        {isDesktop && <NavToggle expanded={desktopExpanded} onClick={toggleDesktop} />}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
