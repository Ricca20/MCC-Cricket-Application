const Team = require('../models/Team');

// @desc    Create a new team
// @route   POST /api/teams
// @access  Admin only
const createTeam = async (req, res) => {
  try {
    const { name, isClubTeam, players } = req.body;

    const team = await Team.create({
      name,
      isClubTeam: isClubTeam || false,
      players: players || []
    });

    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all teams
// @route   GET /api/teams
// @access  Public or Protected
const getTeams = async (req, res) => {
  try {
    const teams = await Team.find({});
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTeam,
  getTeams
};
