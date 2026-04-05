import { useEffect, useRef, useState } from 'react';

import { Box, Button, Group, Stack } from '@mantine/core';

import { getLogo } from '@/assets/logo-map.ts';
import { getTeamName, type TeamID, type TeamSelection } from '@/types/teams';

type ChooseTeamProps = {
  homeTeamID: TeamID;
  awayTeamID: TeamID;
  allowTie?: boolean;
  showReset?: boolean;
  value: TeamSelection;
  onChange: (value: TeamSelection) => void;
};

type TeamButtonProps = {
  teamID: TeamID;
  selectedState: TeamSelection;
  opposingTeamID: TeamID;
  onClick: () => void;
};

const WIDE_CUTOFF = 160;

function TeamButton({ teamID, selectedState, opposingTeamID, onClick }: TeamButtonProps) {
  console.log('==== TeamButton =======');
  console.log('teamID', teamID);
  console.log('selectedState', selectedState);
  console.log('opposingTeamID', opposingTeamID);
  console.log('=========================');
  const logoSrc = getLogo(teamID);
  const teamName = getTeamName(teamID, 'mascot');

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setIsWide(entry.contentRect.width >= WIDE_CUTOFF);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isSelected = selectedState === teamID;
  const isOtherSelected = selectedState === opposingTeamID;
  const isTie = selectedState === 'TIE';

  let backgroundColor = 'var(--mantine-color-default)';
  let borderColor = 'var(--mantine-color-default-border)';
  let textColor = 'inherit';

  if (isSelected) {
    backgroundColor = 'var(--app-pick-win-bg)';
    borderColor = 'var(--app-pick-win-border)';
    textColor = 'white';
  } else if (isOtherSelected) {
    backgroundColor = 'var(--app-pick-lose-bg)';
    borderColor = 'var(--app-pick-lose-border)';
    textColor = 'white';
  } else if (isTie) {
    backgroundColor = 'var(--app-pick-tie-bg)';
    borderColor = 'var(--app-pick-tie-border)';
    textColor = 'var(--app-pick-tie-text)';
  }

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        color: textColor,
        minHeight: 88,
        maxHeight: 100,
        flex: 1,
        alignSelf: 'stretch',
        padding: 6,
        borderRadius: 'var(--mantine-radius-lg)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: isWide ? 'row' : 'column',
        alignItems: 'center',
        gap: 6,
        overflow: 'hidden',
        width: 0,
      }}
    >
      <img
        src={logoSrc}
        alt={teamName}
        style={
          isWide
            ? {
                height: '100%',
                width: 'auto',
                objectFit: 'contain',
                flexShrink: 0,
                display: 'block',
              }
            : {
                flex: 1,
                minHeight: 0,
                width: '100%',
                objectFit: 'contain',
                display: 'block',
              }
        }
      />
      <span
        style={{
          flexShrink: 0,
          fontWeight: 700,
          fontSize: 'var(--mantine-font-size-sm)',
          textAlign: 'center',
        }}
      >
        {teamName}
      </span>
    </button>
  );
}

export function ChooseTeam({
  homeTeamID,
  awayTeamID,
  allowTie = false,
  showReset = false,
  value,
  onChange,
}: ChooseTeamProps) {
  const allGold = value === 'TIE';

  const middleCount = (allowTie ? 1 : 0) + (showReset ? 1 : 0);

  const halfHeightButton = {
    flex: 1,
    minHeight: 0,
    height: '100%',
  } as const;

  const tieButtonStyles = {
    root: {
      ...halfHeightButton,
      flexShrink: 1,
      minWidth: 'min-content',
      paddingInline: 10,
      backgroundColor: allGold ? 'var(--app-pick-tie-bg)' : undefined,
      border: allGold ? `1px solid var(--app-pick-tie-border)` : undefined,
      color: allGold ? 'var(--app-pick-tie-text)' : undefined,
    },
  } as const;

  const resetButtonStyles = {
    root: {
      ...halfHeightButton,
      flexShrink: 1,
      minWidth: 'min-content',
      paddingInline: 10,
    },
  } as const;

  const singleAuxButtonStyles = {
    root: {
      flex: '0 0 auto',
      height: '50%',
      maxHeight: '50%',
      minWidth: 'min-content',
      paddingInline: 14,
    },
  } as const;

  const singleTieStyles = {
    root: {
      ...singleAuxButtonStyles.root,
      backgroundColor: allGold ? 'var(--app-pick-tie-bg)' : undefined,
      border: allGold ? `1px solid var(--app-pick-tie-border)` : undefined,
      color: allGold ? 'var(--app-pick-tie-text)' : undefined,
    },
  } as const;

  return (
    <Stack gap="sm">
      <Group align="stretch" wrap="nowrap" gap="sm">
        <TeamButton
          teamID={homeTeamID}
          selectedState={value}
          opposingTeamID={awayTeamID}
          onClick={() => onChange(homeTeamID)}
        />

        {middleCount > 0 && (
          <Box
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'stretch',
              flex: '0 0 auto',
              minWidth: middleCount === 2 ? 188 : 110,
              alignSelf: 'stretch',
              minHeight: 88,
            }}
          >
            {middleCount === 2 ? (
              <Group
                gap="xs"
                wrap="nowrap"
                grow
                align="stretch"
                style={{ flex: '0 0 50%', height: '50%', minHeight: 0 }}
              >
                {allowTie && (
                  <Button
                    variant={allGold ? 'filled' : 'default'}
                    onClick={() => onChange('TIE')}
                    styles={tieButtonStyles}
                  >
                    Tie
                  </Button>
                )}
                {showReset && (
                  <Button variant="default" onClick={() => onChange(null)} styles={resetButtonStyles}>
                    Reset
                  </Button>
                )}
              </Group>
            ) : (
              <>
                {allowTie && (
                  <Button
                    variant={allGold ? 'filled' : 'default'}
                    onClick={() => onChange('TIE')}
                    styles={singleTieStyles}
                  >
                    Tie
                  </Button>
                )}
                {showReset && (
                  <Button variant="default" onClick={() => onChange(null)} styles={singleAuxButtonStyles}>
                    Reset
                  </Button>
                )}
              </>
            )}
          </Box>
        )}

        <TeamButton
          teamID={awayTeamID}
          selectedState={value}
          opposingTeamID={homeTeamID}
          onClick={() => onChange(awayTeamID)}
        />
      </Group>
    </Stack>
  );
}

export default ChooseTeam;
