// src/app/nav/NavLinks.tsx

import { NavLink, Tooltip } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { routes } from '../pages/index.tsx'; // adjust path

type Props = {
  showLabels: boolean;
  onMobileClose?: () => void;
};

export function NavLinks({ showLabels, onMobileClose }: Props) {
  const location = useLocation();

  const handleClick = () => onMobileClose?.();

  const navRoutes = routes.filter((r) => r.showInNav === true);

  return (
    <>
      {navRoutes.map(({ path, label, icon: Icon }) => (
        <Tooltip
          key={path}
          label={label}
          position="right"
          withArrow
          transitionProps={{ duration: 200 }}
          disabled={label === undefined || showLabels}
        >
          <NavLink
            component={Link}
            to={path}
            label={showLabels ? label : undefined}
            leftSection={Icon ? <Icon size="1.2rem" stroke={1.5} /> : undefined}
            active={location.pathname === path}
            onClick={handleClick}
          />
        </Tooltip>
      ))}
    </>
  );
}
