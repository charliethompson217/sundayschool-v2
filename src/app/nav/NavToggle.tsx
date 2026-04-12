import { NavLink } from '@mantine/core';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

type Props = {
  expanded: boolean;
  onClick: () => void;
};

export function NavToggle({ expanded, onClick }: Props) {
  return (
    <NavLink
      mt="auto"
      leftSection={
        expanded ? <ChevronsLeft size="1.2rem" strokeWidth={1.5} /> : <ChevronsRight size="1.2rem" strokeWidth={1.5} />
      }
      onClick={onClick}
    />
  );
}
