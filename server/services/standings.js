const Tournament = require('../models/Tournament');
const Fixture = require('../models/Fixture');
const Match = require('../models/Match');
const Innings = require('../models/Innings');

// Small per-process cache; entries expire after 5 minutes or on match completion
const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const clearStandingsCache = (tournamentId) => {
  if (tournamentId) cache.delete(tournamentId.toString());
  else cache.clear();
};

const blankRow = (team, group) => ({
  teamId: team._id,
  teamName: team.name,
  group,
  played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
  runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0,
  nrr: 0
});

// A side that is bowled out is charged its full quota of overs (standard NRR rule)
const ballsCharged = (innings, oversLimit) =>
  innings.totalWickets >= innings.maxWickets ? oversLimit * 6 : innings.legalBalls;

const computeStandings = async (tournamentId) => {
  const tournament = await Tournament.findById(tournamentId).populate('teams', 'name');
  if (!tournament) return null;

  const fixtures = await Fixture.find({ tournamentId, stage: { $in: ['league', 'group'] } });

  // Group membership comes from the draw; league tournaments have one table
  const groupOf = new Map();
  for (const f of fixtures) {
    if (f.teamA) groupOf.set(f.teamA.toString(), f.group);
    if (f.teamB) groupOf.set(f.teamB.toString(), f.group);
  }

  const rows = new Map();
  for (const team of tournament.teams) {
    rows.set(team._id.toString(), blankRow(team, groupOf.get(team._id.toString()) || null));
  }

  const matchIds = fixtures.filter((f) => f.matchId).map((f) => f.matchId);
  const matches = await Match.find({ _id: { $in: matchIds }, status: 'completed' });
  const innings = await Innings.find({ matchId: { $in: matches.map((m) => m._id) } }).select('-deliveries');

  for (const match of matches) {
    const a = rows.get(match.teamA.teamId?.toString());
    const b = rows.get(match.teamB.teamId?.toString());
    if (!a || !b) continue;

    const matchInnings = innings.filter((i) => i.matchId.equals(match._id));
    const innA = matchInnings.find((i) => i.battingSide === 'A');
    const innB = matchInnings.find((i) => i.battingSide === 'B');

    a.played += 1;
    b.played += 1;

    if (!innA || !innB) {
      a.noResult += 1; b.noResult += 1;
      a.points += 1; b.points += 1;
      continue;
    }

    if (match.winner === 'A') {
      a.won += 1; a.points += 2; b.lost += 1;
    } else if (match.winner === 'B') {
      b.won += 1; b.points += 2; a.lost += 1;
    } else {
      a.tied += 1; b.tied += 1;
      a.points += 1; b.points += 1;
    }

    const ballsA = ballsCharged(innA, match.oversLimit);
    const ballsB = ballsCharged(innB, match.oversLimit);
    a.runsFor += innA.totalRuns; a.ballsFaced += ballsA;
    a.runsAgainst += innB.totalRuns; a.ballsBowled += ballsB;
    b.runsFor += innB.totalRuns; b.ballsFaced += ballsB;
    b.runsAgainst += innA.totalRuns; b.ballsBowled += ballsA;
  }

  const standings = [...rows.values()].map((row) => {
    const rateFor = row.ballsFaced ? row.runsFor / (row.ballsFaced / 6) : 0;
    const rateAgainst = row.ballsBowled ? row.runsAgainst / (row.ballsBowled / 6) : 0;
    return { ...row, nrr: Number((rateFor - rateAgainst).toFixed(3)) };
  });

  standings.sort((x, y) =>
    (x.group || '').localeCompare(y.group || '') || y.points - x.points || y.nrr - x.nrr
  );
  return standings;
};

const getStandings = async (tournamentId) => {
  const id = tournamentId.toString();
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.data;

  const data = await computeStandings(id);
  if (data) cache.set(id, { data, expires: Date.now() + TTL_MS });
  return data;
};

module.exports = { getStandings, computeStandings, clearStandingsCache };
