const crypto = require('crypto');
const Tournament = require('../models/Tournament');
const Fixture = require('../models/Fixture');
const Match = require('../models/Match');
const Innings = require('../models/Innings');

// In-memory cache for Standings (simulating Redis for performance)
const standingsCache = new Map();


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
    const tournamentId = req.params.id;

    // Check Cache first
    if (standingsCache.has(tournamentId)) {
      console.log(`[Cache Hit] Serving standings for tournament ${tournamentId}`);
      return res.json(standingsCache.get(tournamentId));
    }

    console.log(`[Cache Miss] Calculating standings for tournament ${tournamentId}`);

    const tournament = await Tournament.findById(tournamentId).populate('teams', 'name');
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    // Initialize standings table
    const standingsMap = {};
    tournament.teams.forEach(team => {
      standingsMap[team._id.toString()] = {
        teamId: team._id,
        teamName: team.name,
        played: 0,
        won: 0,
        lost: 0,
        points: 0,
        totalRunsScored: 0,
        totalOversFaced: 0,
        totalRunsConceded: 0,
        totalOversBowled: 0,
        nrr: 0 // Net Run Rate
      };
    });

    // Find all fixtures linked to completed matches
    const fixtures = await Fixture.find({ tournamentId: tournament._id, matchId: { $exists: true } })
      .populate('matchId');

    for (const fixture of fixtures) {
      if (fixture.matchId && fixture.matchId.status === 'completed') {
        const match = fixture.matchId;
        const innings = await Innings.find({ matchId: match._id });

        if (innings.length >= 2) {
          // Simplistic logic assuming innings[0] is teamA and innings[1] is teamB
          const inn1 = innings[0];
          const inn2 = innings[1];

          // Determine winner by total runs (ignoring super overs, chasing balls remaining, etc for MVP)
          let winnerId = null;
          let loserId = null;

          if (inn1.totalRuns > inn2.totalRuns) {
            winnerId = match.teamA.id.toString();
            loserId = match.teamB.id.toString();
          } else if (inn2.totalRuns > inn1.totalRuns) {
            winnerId = match.teamB.id.toString();
            loserId = match.teamA.id.toString();
          }

          const teamAId = match.teamA.id.toString();
          const teamBId = match.teamB.id.toString();

          if (standingsMap[teamAId] && standingsMap[teamBId]) {
            standingsMap[teamAId].played += 1;
            standingsMap[teamBId].played += 1;

            if (winnerId === teamAId) {
              standingsMap[teamAId].won += 1;
              standingsMap[teamAId].points += 2;
              standingsMap[teamBId].lost += 1;
            } else if (winnerId === teamBId) {
              standingsMap[teamBId].won += 1;
              standingsMap[teamBId].points += 2;
              standingsMap[teamAId].lost += 1;
            } else {
              // Tie
              standingsMap[teamAId].points += 1;
              standingsMap[teamBId].points += 1;
            }

            // NRR Calculation accumulation
            standingsMap[teamAId].totalRunsScored += inn1.totalRuns;
            standingsMap[teamAId].totalOversFaced += inn1.totalOvers || 20; // Assume 20 if undefined
            standingsMap[teamAId].totalRunsConceded += inn2.totalRuns;
            standingsMap[teamAId].totalOversBowled += inn2.totalOvers || 20;

            standingsMap[teamBId].totalRunsScored += inn2.totalRuns;
            standingsMap[teamBId].totalOversFaced += inn2.totalOvers || 20;
            standingsMap[teamBId].totalRunsConceded += inn1.totalRuns;
            standingsMap[teamBId].totalOversBowled += inn1.totalOvers || 20;
          }
        }
      }
    }

    // Calculate final NRR and sort
    const standings = Object.values(standingsMap).map(team => {
      const runRateFor = team.totalOversFaced > 0 ? (team.totalRunsScored / team.totalOversFaced) : 0;
      const runRateAgainst = team.totalOversBowled > 0 ? (team.totalRunsConceded / team.totalOversBowled) : 0;
      team.nrr = parseFloat((runRateFor - runRateAgainst).toFixed(3));
      return team;
    });

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.nrr - a.nrr;
    });

    // Save to Cache (set to expire after 5 mins or invalidate on match completion)
    standingsCache.set(tournamentId, standings);
    setTimeout(() => standingsCache.delete(tournamentId), 5 * 60 * 1000); // 5 min TTL

    res.json(standings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to expose cache invalidation (to be used by completeMatch if needed)
const clearStandingsCache = (tournamentId) => {
  if (tournamentId) standingsCache.delete(tournamentId.toString());
  else standingsCache.clear();
};

module.exports = {
  createTournament,
  addTeamsToTournament,
  generateDraw,
  getLiveTournament,
  getStandings,
  clearStandingsCache
};
