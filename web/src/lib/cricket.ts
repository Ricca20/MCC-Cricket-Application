// Mirrors server/lib/cricketRules.js — keep the two in sync.

export const EXTRA_TYPES = ['wide', 'noball', 'bye', 'legbye'] as const;
export type ExtraType = (typeof EXTRA_TYPES)[number];

export const EXTRA_LABELS: Record<ExtraType, string> = {
  wide: 'WD',
  noball: 'NB',
  bye: 'B',
  legbye: 'LB'
};

export const WICKET_TYPES = ['bowled', 'caught', 'lbw', 'run out', 'stumped', 'hit wicket', 'retired hurt'] as const;
export type WicketType = (typeof WICKET_TYPES)[number];

// Dismissals that need a fielder recorded
export const FIELDER_WICKETS: WicketType[] = ['caught', 'run out', 'stumped'];

export const isLegal = (extraType: ExtraType | null) => extraType !== 'wide' && extraType !== 'noball';

export const formatOvers = (legalBalls: number) => `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

export const ballLabel = (d: { runs: number; extraType: ExtraType | null; wicket: unknown }) => {
  if (d.wicket) return 'W';
  if (!d.extraType) return String(d.runs);
  const label = EXTRA_LABELS[d.extraType];
  return d.runs ? `${d.runs}${label}` : label;
};
