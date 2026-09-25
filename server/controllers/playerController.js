const User = require('../models/User');
const PlayerStats = require('../models/PlayerStats');
const Match = require('../models/Match'); // Might need this later for match history

// @desc    Get all players (club player pool)
// @route   GET /api/players
// @access  Public or Protected depending on preference (Assuming Public/Authenticated)
const getPlayers = async (req, res) => {
  try {
    const players = await User.find({ roles: 'player' }).select('-passwordHash');
    res.json(players);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get player profile, stats, and match history
// @route   GET /api/players/:id
// @access  Public or Protected
const getPlayerById = async (req, res) => {
  try {
    const player = await User.findById(req.params.id).select('-passwordHash');
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Find stats, create if they don't exist yet
    let stats = await PlayerStats.findOne({ userId: player._id });
    if (!stats) {
      stats = await PlayerStats.create({ userId: player._id });
    }

    // TODO: fetch match history involving this player (once Match data is populated)
    const matchHistory = [];

    res.json({
      player,
      stats,
      matchHistory
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get player stat trends for charts (Phase 3)
// @route   GET /api/players/:id/trends
// @access  Public or Protected
const getPlayerTrends = async (req, res) => {
  try {
    const player = await User.findById(req.params.id);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    // In a real implementation, you would aggregate data from all Innings where this player batted or bowled
    // grouping by match date to generate a chronological array for Recharts
    const mockTrends = [
      { date: '2023-01-01', runs: 20, wickets: 1 },
      { date: '2023-02-01', runs: 55, wickets: 0 },
      { date: '2023-03-01', runs: 12, wickets: 3 }
    ];

    res.json(mockTrends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update player role (e.g. admin grants scorer role)
// @route   PATCH /api/players/:id/role
// @access  Admin Only
const updatePlayerRole = async (req, res) => {
  try {
    const { role } = req.body; // e.g. "scorer"
    const player = await User.findById(req.params.id);

    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    if (!player.roles.includes(role)) {
      player.roles.push(role);
      await player.save();
    }

    res.json({ message: 'Role updated successfully', roles: player.roles });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPlayers,
  getPlayerById,
  getPlayerTrends,
  updatePlayerRole
};
