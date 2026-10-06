const User = require('../models/User');
const PlayerStats = require('../models/PlayerStats');
const Match = require('../models/Match');
const Innings = require('../models/Innings');

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
    const playerId = req.params.id;
    const player = await User.findById(playerId);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    // Find all innings, populate match date
    const allInnings = await Innings.find({
      $or: [
        { 'deliveries.batsman': playerId },
        { 'deliveries.bowler': playerId }
      ]
    }).populate('matchId', 'date status');

    const matchStatsMap = {};

    for (const inn of allInnings) {
      if (!inn.matchId || inn.matchId.status !== 'completed') continue;

      const dateStr = new Date(inn.matchId.date).toISOString().split('T')[0];
      if (!matchStatsMap[dateStr]) {
        matchStatsMap[dateStr] = { matchDate: dateStr, runs: 0, wickets: 0 };
      }

      for (const d of inn.deliveries) {
        if (d.batsman && d.batsman.toString() === playerId && !['WD'].includes(d.extraType)) {
          matchStatsMap[dateStr].runs += d.runs;
        }
        if (d.bowler && d.bowler.toString() === playerId && d.wicket && (!d.wicket.type || !['run out'].includes(d.wicket.type))) {
          matchStatsMap[dateStr].wickets += 1;
        }
      }
    }

    const trends = Object.values(matchStatsMap).sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
    
    // Grab career stats to pass along
    const careerStats = await PlayerStats.findOne({ userId: playerId });

    res.json({ trends, careerStats });
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

// @desc    Update player profile
// @route   PUT /api/players/:id
// @access  Protected (self only)
const updatePlayerProfile = async (req, res) => {
  try {
    const { name, nickname, profilePhoto, battingStyle, bowlingStyle, jerseyNumber } = req.body;
    
    // Check if user is editing their own profile or is admin
    if (req.user.id !== req.params.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Not authorized to edit this profile' });
    }

    const player = await User.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    player.name = name || player.name;
    player.nickname = nickname !== undefined ? nickname : player.nickname;
    player.profilePhoto = profilePhoto !== undefined ? profilePhoto : player.profilePhoto;
    player.battingStyle = battingStyle !== undefined ? battingStyle : player.battingStyle;
    player.bowlingStyle = bowlingStyle !== undefined ? bowlingStyle : player.bowlingStyle;

    if (jerseyNumber !== undefined && jerseyNumber !== '') {
      const jNum = Number(jerseyNumber);
      if (isNaN(jNum) || jNum < 1 || jNum > 999) {
        return res.status(400).json({ message: 'Jersey number must be between 1 and 999' });
      }

      // Validate uniqueness if changing jersey number
      if (player.jerseyNumber !== jNum) {
        const existingJersey = await User.findOne({ jerseyNumber: jNum });
        if (existingJersey) {
          return res.status(400).json({ message: 'Jersey number is already taken by another player' });
        }
      }
      player.jerseyNumber = jNum;
    } else if (jerseyNumber === '') {
      player.jerseyNumber = undefined;
    }

    await player.save();
    res.json(player);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Jersey number is already taken by another player' });
    }
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPlayers,
  getPlayerById,
  getPlayerTrends,
  updatePlayerRole,
  updatePlayerProfile
};
