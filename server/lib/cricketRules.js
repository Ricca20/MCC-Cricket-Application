// Single source of truth for scoring rules. The web app mirrors these
// constants in web/src/lib/cricket.ts — keep the two in sync.

const EXTRA_TYPES = ['wide', 'noball', 'bye', 'legbye'];

const WICKET_TYPES = ['bowled', 'caught', 'lbw', 'run out', 'stumped', 'hit wicket', 'retired hurt'];

// Dismissals credited to the bowler
const BOWLER_WICKETS = ['bowled', 'caught', 'lbw', 'stumped', 'hit wicket'];

// Dismissals that do not count towards the team's wickets
const NON_DISMISSALS = ['retired hurt'];

const isLegal = (d) => d.extraType !== 'wide' && d.extraType !== 'noball';

// Runs added to the team total by one delivery
const teamRuns = (d) => (d.extraType === 'wide' || d.extraType === 'noball' ? 1 + d.runs : d.runs);

// Runs that count as extras
const extraRuns = (d) => {
  if (d.extraType === 'wide') return 1 + d.runs;
  if (d.extraType === 'noball') return 1;
  if (d.extraType === 'bye' || d.extraType === 'legbye') return d.runs;
  return 0;
};

// Runs credited to the batter (off the bat only)
const batterRuns = (d) => (!d.extraType || d.extraType === 'noball' ? d.runs : 0);

// A wide is not a ball faced; everything else is
const isBallFaced = (d) => d.extraType !== 'wide';

// Runs charged to the bowler (byes and leg byes are not)
const bowlerRuns = (d) => (d.extraType === 'bye' || d.extraType === 'legbye' ? 0 : teamRuns(d));

const isTeamWicket = (d) => Boolean(d.wicket && d.wicket.type && !NON_DISMISSALS.includes(d.wicket.type));

const isBowlerWicket = (d) => Boolean(d.wicket && BOWLER_WICKETS.includes(d.wicket.type));

// Cricket overs notation: 14 legal balls -> 2.2
const oversNotation = (balls) => Number(`${Math.floor(balls / 6)}.${balls % 6}`);

// True overs for rate maths: 14 legal balls -> 2.333
const oversDecimal = (balls) => balls / 6;

const summarizeDeliveries = (deliveries) => {
  const totals = { totalRuns: 0, totalWickets: 0, extras: 0, legalBalls: 0 };
  for (const d of deliveries) {
    totals.totalRuns += teamRuns(d);
    totals.extras += extraRuns(d);
    if (isLegal(d)) totals.legalBalls += 1;
    if (isTeamWicket(d)) totals.totalWickets += 1;
  }
  totals.totalOvers = oversNotation(totals.legalBalls);
  return totals;
};

module.exports = {
  EXTRA_TYPES,
  WICKET_TYPES,
  BOWLER_WICKETS,
  isLegal,
  teamRuns,
  extraRuns,
  batterRuns,
  isBallFaced,
  bowlerRuns,
  isTeamWicket,
  isBowlerWicket,
  oversNotation,
  oversDecimal,
  summarizeDeliveries
};
