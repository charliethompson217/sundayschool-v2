import { useDisclosure } from '@mantine/hooks';
import { useMediaQuery } from '@mantine/hooks';
import { useState } from 'react';

export function useNavState() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const isDesktop = useMediaQuery('(min-width: 48em)');

  const [desktopExpanded, setDesktopExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    return saved ? JSON.parse(saved) : true;
  });

  const toggleDesktop = () => {
    setDesktopExpanded((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('sidebarExpanded', JSON.stringify(next));
      return next;
    });
  };

  return {
    mobileOpened,
    toggleMobile,
    closeMobile,
    desktopExpanded,
    toggleDesktop,
    isDesktop,
  };
}
