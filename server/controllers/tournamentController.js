const Tournament = require('../models/Tournament');
const Fixture = require('../models/Fixture');
const Match = require('../models/Match');
const Team = require('../models/Team');
const { createWithSlug, shuffle } = require('../lib/slug');
const draw = require('../services/draw');
const { getStandings: standingsFor, computeStandings, clearStandingsCache } = require('../services/standings');
const { emitTournamentUpdate } = require('../services/matchFlow');

// @desc    Create a tournament
// @route   POST /api/tournaments
// @access  Admin only
const createTournament = async (req, res) => {
  const { name, format, startDate } = req.body;
  const tournament = await createWithSlug(Tournament, 'trn', { name, format, startDate });
  res.status(201).json(tournament);
};

// @desc    Get all tournaments
// @route   GET /api/tournaments
// @access  Public
const getTournaments = async (req, res) => {
  const tournaments = await Tournament.find().sort({ startDate: -1 });
  res.json(tournaments);
};

const loadDraftTournament = async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) {
    res.status(404).json({ message: 'Tournament not found' });
    return null;
  }
  if (tournament.status !== 'draft') {
    res.status(400).json({ message: 'Cannot change teams after the draw is published' });
    return null;
  }
  const { teamIds } = req.body;
  if ((await Team.countDocuments({ _id: { $in: teamIds } })) !== new Set(teamIds).size) {
    res.status(400).json({ message: 'One or more teams do not exist' });
    return null;
  }
  return tournament;
};

// @desc    Add teams to tournament (keeps existing entries)
// @route   POST /api/tournaments/:id/teams
// @access  Admin only
const addTeamsToTournament = async (req, res) => {
  const tournament = await loadDraftTournament(req, res);
  if (!tournament) return;

  const ids = new Set(tournament.teams.map(String));
  req.body.teamIds.forEach((id) => ids.add(id));
  tournament.teams = [...ids];
  await tournament.save();

  res.json({ message: 'Teams added successfully', tournament });
};

// @desc    Replace the tournament's team list
// @route   PUT /api/tournaments/:id/teams
// @access  Admin only
const setTournamentTeams = async (req, res) => {
  const tournament = await loadDraftTournament(req, res);
  if (!tournament) return;

  tournament.teams = [...new Set(req.body.teamIds)];
  await tournament.save();

  res.json({ message: 'Teams updated successfully', tournament });
};

// @desc    Generate Draw (re-runnable until a match has been created from it)
// @route   POST /api/tournaments/:id/generate-draw
// @access  Admin only
const generateDraw = async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
  if (!['draft', 'draw-published'].includes(tournament.status)) {
    return res.status(400).json({ message: 'The tournament is already under way' });
  }
  if (await Fixture.exists({ tournamentId: tournament._id, matchId: { $ne: null } })) {
    return res.status(400).json({ message: 'Matches have already been created from this draw' });
  }

  const teams = tournament.teams;
  if (teams.length < 2) return res.status(400).json({ message: 'Not enough teams' });

  let fixtures;
  if (tournament.format === 'round-robin') {
    fixtures = draw.roundRobinFixtures(tournament._id, teams);
  } else if (tournament.format === 'knockout') {
    fixtures = draw.knockoutFixtures(tournament._id, shuffle(teams));
  } else {
    const groupCount = req.body.groupCount || Math.max(2, Math.round(teams.length / 4));
    if (teams.length < groupCount * 2) {
      return res.status(400).json({ message: `Need at least ${groupCount * 2} teams for ${groupCount} groups` });
    }
    fixtures = draw.groupFixtures(tournament._id, teams, groupCount);
    tournament.groupCount = groupCount;
  }

  await Fixture.deleteMany({ tournamentId: tournament._id });
  await Fixture.insertMany(fixtures);

  tournament.status = 'draw-published';
  await tournament.save();
  clearStandingsCache(tournament._id);
  emitTournamentUpdate(req.app.get('io'), tournament._id);

  res.json({ message: 'Draw generated', fixturesCount: fixtures.filter((f) => !f.isBye).length });
};

// @desc    Build the knockout bracket from the group tables
// @route   POST /api/tournaments/:id/generate-knockout
// @access  Admin only
const generateKnockout = async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
  if (tournament.format !== 'groups-knockout') {
    return res.status(400).json({ message: 'Only groups-knockout tournaments have a knockout stage to generate' });
  }
  if (await Fixture.exists({ tournamentId: tournament._id, stage: 'knockout' })) {
    return res.status(400).json({ message: 'The knockout stage already exists' });
  }

  const groupFixtures = await Fixture.find({ tournamentId: tournament._id, stage: 'group' });
  const completed = await Match.countDocuments({
    _id: { $in: groupFixtures.map((f) => f.matchId).filter(Boolean) },
    status: 'completed'
  });
  if (!groupFixtures.length || completed !== groupFixtures.length) {
    return res.status(400).json({ message: 'Finish every group match first' });
  }

  const standings = await computeStandings(tournament._id);
  const groups = new Map();
  for (const row of standings) {
    if (!groups.has(row.group)) groups.set(row.group, []);
    groups.get(row.group).push(row);
  }
  const tables = [...groups.keys()].sort().map((g) => groups.get(g));

  const fixtures = draw.knockoutFixtures(tournament._id, draw.crossSeedQualifiers(tables));
  await Fixture.insertMany(fixtures);
  emitTournamentUpdate(req.app.get('io'), tournament._id);

  res.json({ message: 'Knockout stage generated', fixturesCount: fixtures.filter((f) => !f.isBye).length });
};

// @desc    Fixtures for one tournament (admin match creation)
// @route   GET /api/tournaments/:id/fixtures
// @access  Public
const getFixtures = async (req, res) => {
  const fixtures = await Fixture.find({ tournamentId: req.params.id })
    .sort({ stage: 1, roundNumber: 1 })
    .populate('teamA', 'name')
    .populate('teamB', 'name');
  res.json(fixtures);
};

// @desc    Get live tournament (public)
// @route   GET /api/tournaments/live/:slug
// @access  Public
const getLiveTournament = async (req, res) => {
  const tournament = await Tournament.findOne({ publicSlug: req.params.slug }).populate('teams', 'name');
  if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

  const fixtures = await Fixture.find({ tournamentId: tournament._id })
    .sort({ stage: 1, roundNumber: 1 })
    .populate('teamA', 'name')
    .populate('teamB', 'name')
    .populate('winner', 'name')
    .populate({ path: 'matchId', select: 'status result publicSlug isPublic' });

  // Private matches stay listed, but without a link to their scoreboard
  const safeFixtures = fixtures.map((f) => {
    const json = f.toJSON();
    if (json.matchId && !json.matchId.isPublic) delete json.matchId.publicSlug;
    return json;
  });

  res.json({ tournament, fixtures: safeFixtures });
};

// @desc    Get Standings
// @route   GET /api/tournaments/:id/standings
// @access  Public
const getStandings = async (req, res) => {
  const standings = await standingsFor(req.params.id);
  if (!standings) return res.status(404).json({ message: 'Tournament not found' });
  res.json(standings);
};

module.exports = {
  createTournament,
  getTournaments,
  addTeamsToTournament,
  setTournamentTeams,
  generateDraw,
  generateKnockout,
  getFixtures,
  getLiveTournament,
  getStandings
};
