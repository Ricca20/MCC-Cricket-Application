const Match = require('../models/Match');
const Innings = require('../models/Innings');
const Team = require('../models/Team');
const User = require('../models/User');
const Fixture = require('../models/Fixture');
const Tournament = require('../models/Tournament');
const { canScore } = require('../middleware/auth');
const { createWithSlug } = require('../lib/slug');
const flow = require('../services/matchFlow');

const LIST_FIELDS = 'matchType date venue oversLimit teamA.name teamB.name status result publicSlug isPublic scorerId tournamentId fixtureId';

const loadMatch = async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) res.status(404).json({ message: 'Match not found' });
  return match;
};

// Loads the match and checks the caller is its assigned scorer or an admin
const loadScorableMatch = async (req, res) => {
  const match = await loadMatch(req, res);
  if (!match) return null;
  if (!canScore(req.user, match)) {
    res.status(403).json({ message: 'Not authorized to score this match' });
    return null;
  }
  return match;
};

const matchTeam = (team) => ({
  teamId: team._id,
  name: team.name,
  players: team.players.map((p) => ({ name: p.name, userId: p.userId }))
});

// @desc    List matches: admins see all, scorers see their assigned matches
// @route   GET /api/matches
// @access  Protected
const listMatches = async (req, res) => {
  const filter = req.user.roles.includes('admin') ? {} : { scorerId: req.user._id };
  const matches = await Match.find(filter).select(LIST_FIELDS).sort({ date: -1 }).limit(50);
  res.json(matches);
};

// @desc    List public matches for the live-scores page
// @route   GET /api/matches/public
// @access  Public
const listPublicMatches = async (req, res) => {
  const matches = await Match.find({ isPublic: true })
    .select('matchType date venue oversLimit teamA.name teamB.name status result publicSlug')
    .sort({ date: -1 })
    .limit(30);
  res.json(matches);
};

// @desc    Create a new match, optionally from a tournament fixture
// @route   POST /api/matches
// @access  Admin only
const createMatch = async (req, res) => {
  const { matchType, date, venue, oversLimit, fixtureId, isPublic } = req.body;

  let fixture = null;
  let teamIds = [req.body.teamA, req.body.teamB];
  if (fixtureId) {
    fixture = await Fixture.findById(fixtureId);
    if (!fixture) return res.status(404).json({ message: 'Fixture not found' });
    if (fixture.matchId) return res.status(409).json({ message: 'A match already exists for this fixture' });
    if (!fixture.teamA || !fixture.teamB) return res.status(409).json({ message: 'Both teams for this fixture are not known yet' });
    teamIds = [fixture.teamA, fixture.teamB];
  }

  const [teamA, teamB] = await Promise.all(teamIds.map((id) => Team.findById(id)));
  if (!teamA || !teamB) return res.status(404).json({ message: 'Team not found' });

  const scorerId = req.body.scorerId || req.user.id;
  const scorer = await User.findById(scorerId).select('roles');
  if (!scorer || !scorer.roles.some((r) => r === 'scorer' || r === 'admin')) {
    return res.status(400).json({ message: 'The assigned scorer must have the scorer role' });
  }

  const match = await createWithSlug(Match, 'match', {
    matchType: fixture ? 'tournament' : matchType,
    tournamentId: fixture ? fixture.tournamentId : null,
    fixtureId: fixture ? fixture._id : null,
    date,
    venue,
    oversLimit,
    teamA: matchTeam(teamA),
    teamB: matchTeam(teamB),
    scorerId,
    isPublic: isPublic ?? true
  });

  if (fixture) {
    // Guarded link: if another request linked the fixture first, roll back
    const linked = await Fixture.updateOne({ _id: fixture._id, matchId: null }, { $set: { matchId: match._id } });
    if (linked.modifiedCount !== 1) {
      await match.deleteOne();
      return res.status(409).json({ message: 'A match already exists for this fixture' });
    }
    await Tournament.updateOne({ _id: fixture.tournamentId, status: 'draw-published' }, { $set: { status: 'in-progress' } });
    flow.emitTournamentUpdate(req.app.get('io'), fixture.tournamentId);
  }

  res.status(201).json(match);
};

// @desc    Get match by ID
// @route   GET /api/matches/:id
// @access  Protected
const getMatchById = async (req, res) => {
  const match = await loadMatch(req, res);
  if (!match) return;
  const innings = await Innings.find({ matchId: match._id }).sort({ inningsNumber: 1 });
  res.json({ match, innings });
};

const findPublicMatch = (slug) => Match.findOne({ publicSlug: slug, isPublic: true }).select('-scorerId -statsApplied');

// @desc    Get live match by slug
// @route   GET /api/matches/live/:slug
// @access  Public
const getLiveMatch = async (req, res) => {
  const match = await findPublicMatch(req.params.slug);
  if (!match) return res.status(404).json({ message: 'Match not found' });

  const innings = await Innings.find({ matchId: match._id }).sort({ inningsNumber: 1 });
  res.json({ match, innings });
};

// @desc    Get shareable match summary
// @route   GET /api/matches/live/:slug/summary
// @access  Public
const getMatchSummary = async (req, res) => {
  const match = await findPublicMatch(req.params.slug);
  if (!match) return res.status(404).json({ message: 'Match not found' });

  const innings = await Innings.find({ matchId: match._id }).select('-deliveries').sort({ inningsNumber: 1 });
  res.json({
    title: `${match.teamA.name} vs ${match.teamB.name}`,
    result: match.result || 'Match in progress',
    inningsSummary: innings.map((inn) => ({
      team: inn.battingTeam,
      score: `${inn.totalRuns}/${inn.totalWickets}`,
      overs: inn.totalOvers
    }))
  });
};

// @desc    Record the toss and open the first innings
// @route   POST /api/matches/:id/start
// @access  Assigned scorer or admin
const startMatch = async (req, res) => {
  const match = await loadScorableMatch(req, res);
  if (!match) return;
  const started = await flow.startMatch(match, req.body);
  flow.emitTournamentUpdate(req.app.get('io'), started.tournamentId);
  req.app.get('io')?.to(`match:${started._id}`).emit('match:update', { type: 'started', status: started.status });
  res.json(started);
};

// @desc    Add a delivery (ball-by-ball); idempotent per clientEntryId
// @route   POST /api/matches/:id/deliveries
// @access  Assigned scorer or admin
const addDelivery = async (req, res) => {
  const match = await loadScorableMatch(req, res);
  if (!match) return;

  const { duplicate, innings } = await flow.recordDelivery(match, req.body, req.app.get('io'));
  if (duplicate) {
    return res.status(200).json({ message: 'Delivery already recorded (duplicate)', duplicate: true });
  }

  const [fresh, allInnings] = await Promise.all([
    Match.findById(match._id).select('status result winner'),
    Innings.find({ matchId: match._id }).select('-deliveries').sort({ inningsNumber: 1 })
  ]);
  res.status(201).json({
    message: 'Delivery recorded',
    inningsNumber: innings.inningsNumber,
    match: fresh,
    innings: allInnings
  });
};

// @desc    Undo the most recent delivery
// @route   DELETE /api/matches/:id/deliveries/last
// @access  Assigned scorer or admin
const undoLastDelivery = async (req, res) => {
  const match = await loadScorableMatch(req, res);
  if (!match) return;
  const { removed } = await flow.undoLastBall(match, req.app.get('io'));
  res.json({ message: 'Last ball removed', removed });
};

// @desc    End the current innings early (declaration, short side all out)
// @route   POST /api/matches/:id/innings/end
// @access  Assigned scorer or admin
const endInnings = async (req, res) => {
  const match = await loadScorableMatch(req, res);
  if (!match) return;
  await flow.endInningsManually(match, req.app.get('io'));
  res.json({ message: 'Innings ended' });
};

// @desc    Finalise a match (e.g. abandoned) and recompute stats
// @route   POST /api/matches/:id/complete
// @access  Assigned scorer or admin
const completeMatch = async (req, res) => {
  const match = await loadScorableMatch(req, res);
  if (!match) return;
  if (match.status === 'completed') {
    return res.status(409).json({ message: 'Match is already completed' });
  }

  const completed = await flow.finalizeMatch(match, req.app.get('io'), { result: req.body.result });
  if (!completed) return res.status(409).json({ message: 'Match is already completed' });
  res.json({ message: 'Match completed successfully', result: completed.result });
};

// @desc    Update a specific delivery (Admin correction tool)
// @route   PATCH /api/matches/:id/deliveries/:deliveryId
// @access  Admin only
const updateDelivery = async (req, res) => {
  const match = await loadMatch(req, res);
  if (!match) return;
  const delivery = await flow.correctDelivery(match, req.params.deliveryId, req.body, req.app.get('io'));
  res.json({ message: 'Delivery updated successfully', delivery });
};

module.exports = {
  listMatches,
  listPublicMatches,
  createMatch,
  getMatchById,
  getLiveMatch,
  getMatchSummary,
  startMatch,
  addDelivery,
  undoLastDelivery,
  endInnings,
  completeMatch,
  updateDelivery
};
