const crypto = require('crypto');
const Tournament = require('../models/Tournament');
const Fixture = require('../models/Fixture');
const Match = require('../models/Match');

// @desc    Create a tournament
// @route   POST /api/tournaments
// @access  Admin only
const createTournament = async (req, res) => {
  try {
    const { name, format, startDate } = req.body;
    const publicSlug = `trn-${crypto.randomBytes(3).toString('hex')}`;

    const tournament = await Tournament.create({
      name,
      format,
      startDate,
      publicSlug
    });

    res.status(201).json(tournament);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add teams to tournament
// @route   POST /api/tournaments/:id/teams
// @access  Admin only
const addTeamsToTournament = async (req, res) => {
  try {
    const { teamIds } = req.body;
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.status !== 'draft') return res.status(400).json({ message: 'Cannot add teams after draw is published' });

    tournament.teams = teamIds;
    await tournament.save();

    res.json({ message: 'Teams added successfully', tournament });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper for Round Robin Draw
const generateRoundRobin = async (tournamentId, teams) => {
  const fixtures = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      fixtures.push({
        tournamentId,
        round: 'Group Stage',
        teamA: teams[i],
        teamB: teams[j]
      });
    }
  }
  return fixtures;
};

// Helper for Knockout Draw
const generateKnockout = async (tournamentId, teams) => {
  // Shuffle array
  const shuffled = [...teams].sort(() => 0.5 - Math.random());
  const fixtures = [];
  
  // Naive knockout pairing for round 1 (assumes power of 2 for simplicity in MVP)
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      fixtures.push({
        tournamentId,
        round: 'Round 1',
        teamA: shuffled[i],
        teamB: shuffled[i + 1]
      });
    }
  }
  return fixtures;
};

// @desc    Generate Draw
// @route   POST /api/tournaments/:id/generate-draw
// @access  Admin only
const generateDraw = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.teams.length < 2) return res.status(400).json({ message: 'Not enough teams' });

    await Fixture.deleteMany({ tournamentId: tournament._id }); // Reset if regenerated in draft

    let fixtures = [];
    if (tournament.format === 'round-robin') {
      fixtures = await generateRoundRobin(tournament._id, tournament.teams);
    } else if (tournament.format === 'knockout') {
      fixtures = await generateKnockout(tournament._id, tournament.teams);
    } else {
      // For groups-knockout, we can just default to round-robin for the groups initially
      fixtures = await generateRoundRobin(tournament._id, tournament.teams);
    }

    await Fixture.insertMany(fixtures);
    
    tournament.status = 'draw-published';
    await tournament.save();

    res.json({ message: 'Draw generated', fixturesCount: fixtures.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get live tournament (public)
// @route   GET /api/tournaments/live/:slug
// @access  Public
const getLiveTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ publicSlug: req.params.slug }).populate('teams', 'name');
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    const fixtures = await Fixture.find({ tournamentId: tournament._id })
      .populate('teamA', 'name')
      .populate('teamB', 'name')
      .populate('matchId', 'status result');

    res.json({ tournament, fixtures });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Standings
// @route   GET /api/tournaments/:id/standings
// @access  Public
const getStandings = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id).populate('teams', 'name');
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    // In a real scenario, this would aggregate data from Match results linked in Fixtures
    // This is a placeholder for the read-time computation logic described in the spec.
    const standings = tournament.teams.map(team => ({
      teamId: team._id,
      teamName: team.name,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      nrr: 0 // Net Run Rate
    }));

    res.json(standings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTournament,
  addTeamsToTournament,
  generateDraw,
  getLiveTournament,
  getStandings
};
