const Match = require('../models/Match');
const Innings = require('../models/Innings');
const PlayerStats = require('../models/PlayerStats');
const rules = require('../lib/cricketRules');

const key = (id) => (id ? id.toString() : null);
const round2 = (n) => Math.round(n * 100) / 100;

const blankLine = (match) => ({
  matchId: match._id,
  matchDate: match.date,
  title: `${match.teamA.name} vs ${match.teamB.name}`,
  result: match.result,
  publicSlug: match.isPublic ? match.publicSlug : null,
  batted: false, out: false, runs: 0, balls: 0, fours: 0, sixes: 0,
  bowled: false, ballsBowled: 0, runsConceded: 0, wickets: 0,
  catches: 0, stumpings: 0, runOuts: 0
});

// User IDs of everyone who appears in a match (roster or scorecard)
const participantIds = (match, inningsList) => {
  const ids = new Set();
  for (const p of [...(match.teamA.players || []), ...(match.teamB.players || [])]) {
    if (p.userId) ids.add(key(p.userId));
  }
  for (const inn of inningsList) {
    for (const d of inn.deliveries) {
      for (const id of [d.batsman, d.nonStriker, d.bowler, d.wicket?.playerOut, d.wicket?.fielder]) {
        if (id) ids.add(key(id));
      }
    }
  }
  return [...ids];
};

// One line per completed match per player: what they did in that match
const buildLines = (matches, inningsByMatch, userIds) => {
  const wanted = new Set(userIds.map(key));
  const lines = new Map(userIds.map((id) => [key(id), []]));

  for (const match of matches) {
    const perMatch = new Map();
    const line = (id) => {
      const uid = key(id);
      if (!uid || !wanted.has(uid)) return null;
      if (!perMatch.has(uid)) perMatch.set(uid, blankLine(match));
      return perMatch.get(uid);
    };

    for (const p of [...(match.teamA.players || []), ...(match.teamB.players || [])]) line(p.userId);

    for (const inn of inningsByMatch.get(key(match._id)) || []) {
      for (const d of inn.deliveries) {
        const striker = line(d.batsman);
        if (striker) {
          striker.batted = true;
          const runs = rules.batterRuns(d);
          striker.runs += runs;
          if (rules.isBallFaced(d)) striker.balls += 1;
          if (runs === 4) striker.fours += 1;
          if (runs === 6) striker.sixes += 1;
        }
        const nonStriker = line(d.nonStriker);
        if (nonStriker) nonStriker.batted = true;

        const bowler = line(d.bowler);
        if (bowler) {
          bowler.bowled = true;
          bowler.runsConceded += rules.bowlerRuns(d);
          if (rules.isLegal(d)) bowler.ballsBowled += 1;
          if (rules.isBowlerWicket(d)) bowler.wickets += 1;
        }

        if (d.wicket) {
          const out = line(d.wicket.playerOut);
          if (out && rules.isTeamWicket(d)) {
            out.batted = true;
            out.out = true;
          }
          const fielder = line(d.wicket.fielder);
          if (fielder) {
            if (d.wicket.type === 'caught') fielder.catches += 1;
            if (d.wicket.type === 'stumped') fielder.stumpings += 1;
            if (d.wicket.type === 'run out') fielder.runOuts += 1;
          }
        }
      }
    }

    for (const [uid, l] of perMatch) lines.get(uid).push(l);
  }
  return lines;
};

const careerFromLines = (lines) => {
  const batting = lines.filter((l) => l.batted);
  const bowling = lines.filter((l) => l.bowled);
  const sum = (list, field) => list.reduce((total, l) => total + l[field], 0);

  const runs = sum(batting, 'runs');
  const ballsFaced = sum(batting, 'balls');
  const notOuts = batting.filter((l) => !l.out).length;
  const dismissals = batting.length - notOuts;
  const ballsBowled = sum(bowling, 'ballsBowled');
  const runsConceded = sum(bowling, 'runsConceded');

  const best = [...bowling].sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)[0];

  return {
    matchesPlayed: lines.length,
    innings: batting.length,
    notOuts,
    runs,
    ballsFaced,
    fours: sum(batting, 'fours'),
    sixes: sum(batting, 'sixes'),
    highScore: Math.max(0, ...batting.map((l) => l.runs)),
    fifties: batting.filter((l) => l.runs >= 50 && l.runs < 100).length,
    hundreds: batting.filter((l) => l.runs >= 100).length,
    battingAverage: dismissals ? round2(runs / dismissals) : null,
    strikeRate: ballsFaced ? round2((runs / ballsFaced) * 100) : 0,
    wickets: sum(bowling, 'wickets'),
    ballsBowled,
    oversBowled: rules.oversNotation(ballsBowled),
    runsConceded,
    bestBowling: best ? `${best.wickets}/${best.runsConceded}` : '-',
    economy: ballsBowled ? round2(runsConceded / rules.oversDecimal(ballsBowled)) : 0,
    threeWicketHauls: bowling.filter((l) => l.wickets >= 3).length,
    catches: sum(lines, 'catches'),
    runOuts: sum(lines, 'runOuts'),
    stumpings: sum(lines, 'stumpings'),
    updatedAt: new Date()
  };
};

// Loads every completed match involving these players, with their innings
const loadPlayerMatches = async (userIds) => {
  const ids = userIds.map(key);
  const fromDeliveries = await Innings.distinct('matchId', {
    $or: [
      { 'deliveries.batsman': { $in: ids } },
      { 'deliveries.nonStriker': { $in: ids } },
      { 'deliveries.bowler': { $in: ids } },
      { 'deliveries.wicket.playerOut': { $in: ids } },
      { 'deliveries.wicket.fielder': { $in: ids } }
    ]
  });
  const matches = await Match.find({
    status: 'completed',
    $or: [
      { _id: { $in: fromDeliveries } },
      { 'teamA.players.userId': { $in: ids } },
      { 'teamB.players.userId': { $in: ids } }
    ]
  }).sort({ date: 1 });

  const allInnings = await Innings.find({ matchId: { $in: matches.map((m) => m._id) } });
  const inningsByMatch = new Map();
  for (const inn of allInnings) {
    const k = key(inn.matchId);
    if (!inningsByMatch.has(k)) inningsByMatch.set(k, []);
    inningsByMatch.get(k).push(inn);
  }
  return { matches, inningsByMatch };
};

// Full recompute from source data: safe to run any number of times
const recomputePlayerStats = async (userIds) => {
  if (!userIds.length) return;
  const { matches, inningsByMatch } = await loadPlayerMatches(userIds);
  const lines = buildLines(matches, inningsByMatch, userIds);
  await PlayerStats.bulkWrite(
    [...lines].map(([userId, playerLines]) => ({
      updateOne: {
        filter: { userId },
        update: { $set: careerFromLines(playerLines) },
        upsert: true
      }
    }))
  );
};

// Per-match history for one player, oldest first
const playerMatchLines = async (userId) => {
  const { matches, inningsByMatch } = await loadPlayerMatches([userId]);
  return buildLines(matches, inningsByMatch, [userId]).get(key(userId));
};

module.exports = { recomputePlayerStats, playerMatchLines, participantIds };
