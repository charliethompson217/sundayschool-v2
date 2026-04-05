import ARI from './ARI.svg';
import ATL from './ATL.svg';
import BAL from './BAL.svg';
import BUF from './BUF.svg';
import CAR from './CAR.svg';
import CHI from './CHI.svg';
import CIN from './CIN.svg';
import CLE from './CLE.svg';
import DAL from './DAL.svg';
import DEN from './DEN.svg';
import DET from './DET.svg';
import GB from './GB.svg';
import HOU from './HOU.svg';
import IND from './IND.svg';
import JAX from './JAX.svg';
import KC from './KC.svg';
import LAR from './LAR.svg';
import LAC from './LAC.svg';
import LV from './LV.svg';
import MIA from './MIA.svg';
import MIN from './MIN.svg';
import NE from './NE.svg';
import NO from './NO.svg';
import NYG from './NYG.svg';
import NYJ from './NYJ.svg';
import PHI from './PHI.svg';
import PIT from './PIT.svg';
import SEA from './SEA.svg';
import SF from './SF.svg';
import TB from './TB.svg';
import TEN from './TEN.svg';
import WSH from './WSH.svg';

import type { TeamID } from '@/types/teams';

const logoMap: Record<TeamID, string> = {
  ARI,
  ATL,
  BAL,
  BUF,
  CAR,
  CHI,
  CIN,
  CLE,
  DAL,
  DEN,
  DET,
  GB,
  HOU,
  IND,
  JAX,
  KC,
  LAR,
  LAC,
  LV,
  MIA,
  MIN,
  NE,
  NO,
  NYG,
  NYJ,
  PHI,
  PIT,
  SEA,
  SF,
  TB,
  TEN,
  WSH,
};

export function getLogo(teamID: TeamID): string {
  return logoMap[teamID];
}

export default getLogo;
