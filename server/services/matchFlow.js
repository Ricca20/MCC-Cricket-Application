const Match = require('../models/Match');
const Innings = require('../models/Innings');
const Fixture = require('../models/Fixture');
const Tournament = require('../models/Tournament');
const rules = require('../lib/cricketRules');
const { HttpError } = require('../middleware/error');
const { recomputePlayerStats, participantIds } = require('./stats');
const { clearStandingsCache } = require('./standings');

const other = (side) => (side === 'A' ? 'B' : 'A');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Viewers refetch on this event; the payload only says what changed
const emitMatchUpdate = (io, match, type) => {
  if (io) io.to(`match:${match._id}`).emit('match:update', { type, status: match.status });
};

const emitTournamentUpdate = (io, tournamentId) => {
  if (io && tournamentId) io.to(`tournament:${tournamentId}`).emit('tournament:update', { tournamentId });
};

// All out when every batter but one is dismissed; unknown rosters assume 11 players
const maxWicketsFor = (team) => (team.players?.length >= 2 ? team.players.length - 1 : 10);

const createInnings = (match, inningsNumber, battingSide, target = null) => {
  const batting = match.side(battingSide);
  const bowling = match.side(other(battingSide));
  return Innings.create({
    matchId: match._id,
    inningsNumber,
    battingSide,
    battingTeam: batting.name,
    bowlingTeam: bowling.name,
    maxWickets: maxWicketsFor(batting),
    target
  });
};

const startMatch = async (match, { tossWinner, decision }) => {
  const started = await Match.findOneAndUpdate(
    { _id: match._id, status: 'upcoming' },
    { $set: { status: 'live', toss: { winner: tossWinner, decision } } },
    { returnDocument: 'after' }
  );
  if (!started) throw new HttpError(409, 'This match has already started');

  const battingSide = decision === 'bat' ? tossWinner : other(tossWinner);
  await createInnings(started, 1, battingSide);
  return started;
};

const toDelivery = (input) => ({
  clientEntryId: input.clientEntryId,
  batsman: input.batsman.id || null,
  batsmanName: input.batsman.name,
  nonStriker: input.nonStriker?.id || null,
  nonStrikerName: input.nonStriker?.name,
  bowler: input.bowler.id || null,
  bowlerName: input.bowler.name,
  runs: input.runs,
  extraType: input.extraType || null,
  wicket: input.wicket
    ? {
        type: input.wicket.type,
        playerOut: input.wicket.playerOut.id || null,
        playerOutName: input.wicket.playerOut.name,
        fielder: input.wicket.fielder?.id || null,
        fielderName: input.wicket.fielder?.name
      }
    : null
});

const inningsShouldEnd = (match, innings) =>
  innings.legalBalls >= match.oversLimit * 6 ||
  innings.totalWickets >= innings.maxWickets ||
  (innings.target !== null && innings.totalRuns >= innings.target);

const computeResult = (match, first, second) => {
  if (second.totalRuns >= second.target) {
    const wicketsLeft = second.maxWickets - second.totalWickets;
    return { winner: second.battingSide, result: `${second.battingTeam} won by ${plural(wicketsLeft, 'wicket')}` };
  }
  const margin = second.target - 1 - second.totalRuns;
  if (margin === 0) return { winner: null, result: 'Match tied' };
  return { winner: first.battingSide, result: `${first.battingTeam} won by ${plural(margin, 'run')}` };
};

// Moves a knockout winner into the next round and closes finished tournaments
const advanceTournament = async (match) => {
  if (!match.fixtureId) return;
  const fixture = await Fixture.findById(match.fixtureId);
  if (!fixture) return;

  const winnerTeamId = match.winner ? match.side(match.winner).teamId : null;
  if (winnerTeamId) {
    fixture.winner = winnerTeamId;
    await fixture.save();
    if (fixture.nextFixture) {
      await Fixture.updateOne(
        { _id: fixture.nextFixture },
        { $set: { [fixture.nextSlot === 'A' ? 'teamA' : 'teamB']: winnerTeamId } }
      );
    }
  }

  let finished = false;
  if (fixture.stage === 'knockout') {
    finished = !fixture.nextFixture && Boolean(winnerTeamId);
  } else if (fixture.stage === 'league') {
    const league = await Fixture.find({ tournamentId: fixture.tournamentId, stage: 'league' });
    const done = await Match.countDocuments({ _id: { $in: league.map((f) => f.matchId) }, status: 'completed' });
    finished = done === league.length;
  }
  if (finished) await Tournament.updateOne({ _id: fixture.tournamentId }, { $set: { status: 'completed' } });
};

// Idempotent: only the first caller flips the status and applies side effects
const finalizeMatch = async (match, io, { result: manualResult } = {}) => {
  const inningsList = await Innings.find({ matchId: match._id }).sort({ inningsNumber: 1 });
  const [first, second] = inningsList;

  const decided = first?.status === 'completed' && second && inningsShouldEnd(match, second);
  const outcome = decided
    ? computeResult(match, first, second)
    : { winner: null, result: manualResult || 'No result' };

  const completed = await Match.findOneAndUpdate(
    { _id: match._id, status: { $ne: 'completed' } },
    { $set: { status: 'completed', result: outcome.result, winner: outcome.winner, statsApplied: true } },
    { returnDocument: 'after' }
  );
  if (!completed) return null;

  await Innings.updateMany({ matchId: match._id, status: 'in-progress' }, { $set: { status: 'completed' } });
  await recomputePlayerStats(participantIds(completed, inningsList));
  await advanceTournament(completed);
  clearStandingsCache(completed.tournamentId);

  emitMatchUpdate(io, completed, 'completed');
  emitTournamentUpdate(io, completed.tournamentId);
  return completed;
};

// Closes an innings once; the first innings hands over to the chase
const closeInnings = async (match, innings, io) => {
  const closed = await Innings.findOneAndUpdate(
    { _id: innings._id, status: 'in-progress' },
    { $set: { status: 'completed' } },
    { returnDocument: 'after' }
  );
  if (!closed) return;

  if (closed.inningsNumber === 1) {
    try {
      await createInnings(match, 2, other(closed.battingSide), closed.totalRuns + 1);
    } catch (error) {
      if (error.code !== 11000) throw error; // already created by a concurrent request
    }
    emitMatchUpdate(io, match, 'innings');
  } else {
    await finalizeMatch(match, io);
  }
};

// Appends one ball atomically. The array-length guard serialises concurrent
// writes and the clientEntryId guard makes offline retries idempotent.
const recordDelivery = async (match, input, io) => {
  if (match.status !== 'live') throw new HttpError(409, 'This match is not live');

  for (let attempt = 0; attempt < 5; attempt++) {
    const innings = await Innings.findOne({ matchId: match._id, inningsNumber: input.inningsNumber });
    if (!innings) throw new HttpError(409, 'That innings has not started');
    if (innings.deliveries.some((d) => d.clientEntryId === input.clientEntryId)) {
      return { duplicate: true, innings };
    }
    if (innings.status !== 'in-progress') throw new HttpError(409, 'That innings is already over');

    const delivery = toDelivery(input);
    delivery.over = Math.floor(innings.legalBalls / 6);
    delivery.ballInOver = (innings.legalBalls % 6) + 1;
    const legal = rules.isLegal(delivery) ? 1 : 0;

    const length = innings.deliveries.length;
    const update = await Innings.updateOne(
      {
        _id: innings._id,
        status: 'in-progress',
        [`deliveries.${length}`]: { $exists: false },
        'deliveries.clientEntryId': { $ne: input.clientEntryId }
      },
      {
        $push: { deliveries: delivery },
        $inc: {
          totalRuns: rules.teamRuns(delivery),
          totalWickets: rules.isTeamWicket(delivery) ? 1 : 0,
          extras: rules.extraRuns(delivery),
          legalBalls: legal
        },
        $set: { totalOvers: rules.oversNotation(innings.legalBalls + legal) }
      },
      { runValidators: true }
    );

    if (update.modifiedCount === 1) {
      const saved = await Innings.findById(innings._id);
      emitMatchUpdate(io, match, 'delivery');
      if (inningsShouldEnd(match, saved)) await closeInnings(match, saved, io);
      return { duplicate: false, innings: saved };
    }
  }
  throw new HttpError(409, 'Scoring conflict, please retry');
};

// Removes the most recent ball, reopening the first innings if the chase hasn't begun
const undoLastBall = async (match, io) => {
  if (match.status !== 'live') throw new HttpError(409, 'Only a live match can be undone; ask an admin to correct it');

  let current = await Innings.findOne({ matchId: match._id }).sort({ inningsNumber: -1 });
  if (!current) throw new HttpError(409, 'Nothing to undo');

  if (!current.deliveries.length) {
    if (current.inningsNumber !== 2) throw new HttpError(409, 'Nothing to undo');
    await current.deleteOne();
    current = await Innings.findOne({ matchId: match._id, inningsNumber: 1 });
    current.status = 'in-progress';
  }

  const removed = current.deliveries.pop();
  Object.assign(current, rules.summarizeDeliveries(current.deliveries));
  await current.save();
  emitMatchUpdate(io, match, 'undo');
  return { removed, innings: current };
};

// Admin correction: edits one ball, then re-derives totals, result and stats
const correctDelivery = async (match, deliveryId, changes, io) => {
  const innings = await Innings.findOne({ matchId: match._id, 'deliveries._id': deliveryId });
  if (!innings) throw new HttpError(404, 'Delivery not found');
  const affectedBefore = participantIds(match, [innings]);

  const delivery = innings.deliveries.id(deliveryId);
  if (changes.runs !== undefined) delivery.runs = changes.runs;
  if (changes.extraType !== undefined) delivery.extraType = changes.extraType;
  if (changes.batsman) {
    delivery.batsman = changes.batsman.id || null;
    delivery.batsmanName = changes.batsman.name;
  }
  if (changes.bowler) {
    delivery.bowler = changes.bowler.id || null;
    delivery.bowlerName = changes.bowler.name;
  }
  if (changes.wicket !== undefined) {
    delivery.wicket = changes.wicket
      ? {
          type: changes.wicket.type,
          playerOut: changes.wicket.playerOut.id || null,
          playerOutName: changes.wicket.playerOut.name,
          fielder: changes.wicket.fielder?.id || null,
          fielderName: changes.wicket.fielder?.name
        }
      : null;
  }

  Object.assign(innings, rules.summarizeDeliveries(innings.deliveries));
  await innings.save();

  if (match.status === 'completed') {
    const inningsList = await Innings.find({ matchId: match._id }).sort({ inningsNumber: 1 });
    const [first, second] = inningsList;
    if (first && second) {
      second.target = first.totalRuns + 1;
      await second.save();
      if (inningsShouldEnd(match, second)) {
        const outcome = computeResult(match, first, second);
        await Match.updateOne({ _id: match._id }, { $set: outcome });
      }
    }
    const affected = new Set([...affectedBefore, ...participantIds(match, inningsList)]);
    await recomputePlayerStats([...affected]);
    clearStandingsCache(match.tournamentId);
    emitTournamentUpdate(io, match.tournamentId);
  }

  emitMatchUpdate(io, match, 'correction');
  return delivery;
};

const endInningsManually = async (match, io) => {
  if (match.status !== 'live') throw new HttpError(409, 'This match is not live');
  const current = await Innings.findOne({ matchId: match._id, status: 'in-progress' });
  if (!current) throw new HttpError(409, 'No innings in progress');

  if (current.inningsNumber === 2) {
    // A chase ended early (e.g. all out with a short side) is still decided on runs
    current.maxWickets = Math.min(current.maxWickets, current.totalWickets);
    await current.save();
  }
  await closeInnings(match, current, io);
};

module.exports = {
  startMatch,
  recordDelivery,
  undoLastBall,
  correctDelivery,
  finalizeMatch,
  endInningsManually,
  emitTournamentUpdate
};
