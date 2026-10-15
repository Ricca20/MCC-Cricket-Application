const Team = require('../models/Team');
const User = require('../models/User');

// @desc    Create a new team
// @route   POST /api/teams
// @access  Admin only
const createTeam = async (req, res) => {
  const { name, isClubTeam, players = [] } = req.body;

  // Linked players must be real accounts; visiting players stay name-only
  const userIds = [...new Set(players.filter((p) => p.userId).map((p) => p.userId))];
  if (userIds.length && (await User.countDocuments({ _id: { $in: userIds } })) !== userIds.length) {
    return res.status(400).json({ message: 'One or more linked players do not exist' });
  }

  const team = await Team.create({
    name,
    isClubTeam: isClubTeam || false,
    players: players.map((p) => ({ name: p.name, userId: p.userId || null }))
  });

  res.status(201).json(team);
};

// @desc    Get all teams
// @route   GET /api/teams
// @access  Public
const getTeams = async (req, res) => {
  const teams = await Team.find({}).sort({ name: 1 });
  res.json(teams);
};

module.exports = {
  createTeam,
  getTeams
};
