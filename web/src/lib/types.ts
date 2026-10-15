import type { ExtraType, WicketType } from './cricket';

export type Side = 'A' | 'B';

export interface RosterPlayer {
  name: string;
  userId?: string | null;
}

export interface MatchTeam {
  teamId?: string;
  name: string;
  players: RosterPlayer[];
}

export interface Match {
  _id: string;
  matchType: 'practice' | 'friendly' | 'tournament';
  date: string;
  venue?: string;
  oversLimit: number;
  teamA: MatchTeam;
  teamB: MatchTeam;
  toss?: { winner?: Side; decision?: 'bat' | 'bowl' };
  status: 'upcoming' | 'live' | 'completed';
  scorerId?: string;
  isPublic: boolean;
  publicSlug: string;
  result?: string;
  winner?: Side | null;
  tournamentId?: string | null;
  fixtureId?: string | null;
}

export interface Delivery {
  _id: string;
  clientEntryId: string;
  over: number;
  ballInOver: number;
  batsman?: string | null;
  batsmanName: string;
  nonStriker?: string | null;
  nonStrikerName?: string;
  bowler?: string | null;
  bowlerName: string;
  runs: number;
  extraType: ExtraType | null;
  wicket: {
    type: WicketType;
    playerOut?: string | null;
    playerOutName?: string;
    fielder?: string | null;
    fielderName?: string;
  } | null;
}

export interface Innings {
  _id: string;
  inningsNumber: 1 | 2;
  status: 'in-progress' | 'completed';
  battingSide: Side;
  battingTeam: string;
  bowlingTeam: string;
  maxWickets: number;
  target: number | null;
  totalRuns: number;
  totalWickets: number;
  totalOvers: number;
  legalBalls: number;
  extras: number;
  deliveries?: Delivery[];
}

export interface Team {
  _id: string;
  name: string;
  isClubTeam: boolean;
  players: RosterPlayer[];
}

export interface Tournament {
  _id: string;
  name: string;
  format: 'round-robin' | 'knockout' | 'groups-knockout';
  status: 'draft' | 'draw-published' | 'in-progress' | 'completed';
  publicSlug: string;
  startDate: string;
  teams: (string | { _id: string; name: string })[];
}

export interface Fixture {
  _id: string;
  stage: 'league' | 'group' | 'knockout';
  round: string;
  roundNumber: number;
  group?: string | null;
  teamA: { _id: string; name: string } | null;
  teamB: { _id: string; name: string } | null;
  isBye: boolean;
  winner?: { _id: string; name: string } | null;
  matchId?: { _id: string; status: Match['status']; result?: string; publicSlug?: string } | string | null;
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  group: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  nrr: number;
}

export interface Player {
  _id: string;
  name: string;
  nickname?: string;
  jerseyNumber?: number;
  profilePhoto?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  roles: string[];
}

export interface PlayerStats {
  matchesPlayed: number;
  innings: number;
  notOuts: number;
  runs: number;
  ballsFaced: number;
  highScore: number;
  fifties: number;
  hundreds: number;
  battingAverage: number | null;
  strikeRate: number;
  wickets: number;
  oversBowled: number;
  runsConceded: number;
  bestBowling: string;
  economy: number;
  catches: number;
  runOuts: number;
  stumpings: number;
}

export interface MatchHistoryItem {
  matchId: string;
  matchDate: string;
  title: string;
  result?: string;
  publicSlug: string | null;
  batting: { runs: number; balls: number; out: boolean } | null;
  bowling: { wickets: number; runsConceded: number; balls: number } | null;
}
