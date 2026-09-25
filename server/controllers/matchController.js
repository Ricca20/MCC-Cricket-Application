const crypto = require('crypto');
const Match = require('../models/Match');
const Innings = require('../models/Innings');

// @desc    Create a new match
// @route   POST /api/matches
// @access  Admin only
const createMatch = async (req, res) => {
  try {
    const { matchType, date, venue, oversLimit, teamA, teamB, scorerId } = req.body;

    const publicSlug = `match-${crypto.randomBytes(3).toString('hex')}`;

    const match = await Match.create({
      matchType,
      date,
      venue,
      oversLimit,
      teamA,
      teamB,
      scorerId,
      publicSlug
    });

    // Create initial empty innings for the match
    await Innings.create({
      matchId: match._id,
      battingTeam: teamA.name,
      bowlingTeam: teamB.name
    });

    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get match by ID
// @route   GET /api/matches/:id
// @access  Protected
const getMatchById = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    
    const innings = await Innings.find({ matchId: match._id });
    res.json({ match, innings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get live match by slug
// @route   GET /api/matches/live/:slug
// @access  Public
const getLiveMatch = async (req, res) => {
  try {
    const match = await Match.findOne({ publicSlug: req.params.slug });
    if (!match) return res.status(404).json({ message: 'Match not found' });

    const innings = await Innings.find({ matchId: match._id });
    res.json({ match, innings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a delivery (ball-by-ball)
// @route   POST /api/matches/:id/deliveries
// @access  Scorer or Admin
const addDelivery = async (req, res) => {
  try {
    const { clientEntryId, over, ballInOver, bowler, bowlerName, batsman, batsmanName, runs, extraType, wicket } = req.body;
    
    // Find the current active innings
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    // Ensure user is the assigned scorer or an admin
    if (match.scorerId && match.scorerId.toString() !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Not authorized to score this match' });
    }

    const innings = await Innings.findOne({ matchId: match._id }).sort({ _id: -1 });
    if (!innings) return res.status(404).json({ message: 'Innings not found' });

    // Dedupe check
    const isDuplicate = innings.deliveries.some(d => d.clientEntryId === clientEntryId);
    if (isDuplicate) {
      return res.status(200).json({ message: 'Delivery already recorded (duplicate)' });
    }

    const delivery = {
      clientEntryId, over, ballInOver, bowler, bowlerName, batsman, batsmanName, runs, extraType, wicket
    };

    // Note: Transaction logic is recommended for production (as per spec), skipped here for basic MVP flow
    innings.deliveries.push(delivery);
    innings.totalRuns += (runs + (extraType ? 1 : 0)); // simplistic calc for extras
    if (wicket) innings.totalWickets += 1;
    // Calculate totalOvers based on legal deliveries logic (simplified here)
    
    await innings.save();

    // Broadcast via Socket.io
    const io = req.app.get('io');
    io.to(`match:${match._id}`).emit('match:delivery', { inningsTotals: { runs: innings.totalRuns, wickets: innings.totalWickets }, delivery });

    res.status(201).json({ message: 'Delivery recorded', inningsTotals: { runs: innings.totalRuns, wickets: innings.totalWickets } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Complete a match and trigger stats recompute
// @route   POST /api/matches/:id/complete
// @access  Scorer or Admin
const completeMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    match.status = 'completed';
    match.result = req.body.result || 'Match Completed';
    await match.save();

    // TODO: Trigger stats recompute for players involved
    // ...

    const io = req.app.get('io');
    io.to(`match:${match._id}`).emit('match:status', { status: 'completed', result: match.result });

    res.json({ message: 'Match completed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createMatch,
  getMatchById,
  getLiveMatch,
  addDelivery,
  completeMatch
};
