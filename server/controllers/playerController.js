const User = require('../models/User');
const PlayerStats = require('../models/PlayerStats');
const { playerMatchLines } = require('../services/stats');
const { allowedPhotoUrl } = require('./uploadController');

const toDateString = (date) => new Date(date).toISOString().split('T')[0];

// @desc    Get all players (club player pool)
// @route   GET /api/players
// @access  Public (public fields only)
const getPlayers = async (req, res) => {
  const players = await User.find({}).select(User.PUBLIC_FIELDS).sort({ name: 1 });
  res.json(players);
};

// @desc    Get player profile, stats, and match history
// @route   GET /api/players/:id
// @access  Public (public fields only)
const getPlayerById = async (req, res) => {
  const player = await User.findById(req.params.id).select(User.PUBLIC_FIELDS);
  if (!player) {
    return res.status(404).json({ message: 'Player not found' });
  }

  // Unsaved defaults when the player hasn't played yet: a GET never writes
  const stats = (await PlayerStats.findOne({ userId: player._id })) || new PlayerStats({ userId: player._id });

  const lines = await playerMatchLines(player._id);
  const matchHistory = lines.reverse().map((l) => ({
    matchId: l.matchId,
    matchDate: toDateString(l.matchDate),
    title: l.title,
    result: l.result,
    publicSlug: l.publicSlug,
    batting: l.batted ? { runs: l.runs, balls: l.balls, out: l.out } : null,
    bowling: l.bowled ? { wickets: l.wickets, runsConceded: l.runsConceded, balls: l.ballsBowled } : null
  }));

  res.json({ player, stats, matchHistory });
};

// @desc    Get player stat trends for charts (one point per completed match)
// @route   GET /api/players/:id/trends
// @access  Public
const getPlayerTrends = async (req, res) => {
  if (!(await User.exists({ _id: req.params.id }))) {
    return res.status(404).json({ message: 'Player not found' });
  }

  const lines = await playerMatchLines(req.params.id);
  const trends = lines.map((l) => ({
    matchId: l.matchId,
    matchDate: toDateString(l.matchDate),
    runs: l.runs,
    wickets: l.wickets
  }));
  const careerStats = (await PlayerStats.findOne({ userId: req.params.id })) || new PlayerStats({ userId: req.params.id });

  res.json({ trends, careerStats });
};

// @desc    Grant or revoke a role (e.g. admin grants scorer role)
// @route   PATCH /api/players/:id/role
// @access  Admin Only
const updatePlayerRole = async (req, res) => {
  const { role, action } = req.body;

  if (action === 'revoke' && role === 'admin' && req.params.id === req.user.id) {
    return res.status(400).json({ message: 'You cannot remove your own admin role' });
  }

  const update = action === 'grant' ? { $addToSet: { roles: role } } : { $pull: { roles: role } };
  const player = await User.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' }).select('roles');
  if (!player) {
    return res.status(404).json({ message: 'Player not found' });
  }

  res.json({ message: 'Role updated successfully', roles: player.roles });
};

// @desc    Update player profile
// @route   PUT /api/players/:id
// @access  Protected (self or admin)
const updatePlayerProfile = async (req, res) => {
  const { name, nickname, profilePhoto, battingStyle, bowlingStyle, jerseyNumber } = req.body;

  if (req.user.id !== req.params.id && !req.user.roles.includes('admin')) {
    return res.status(403).json({ message: 'Not authorized to edit this profile' });
  }

  const player = await User.findById(req.params.id);
  if (!player) {
    return res.status(404).json({ message: 'Player not found' });
  }

  if (profilePhoto !== undefined && profilePhoto !== '' && !allowedPhotoUrl(profilePhoto)) {
    return res.status(400).json({ message: 'Profile photo must be uploaded through the app' });
  }

  if (name !== undefined) player.name = name;
  if (nickname !== undefined) player.nickname = nickname;
  if (profilePhoto !== undefined) player.profilePhoto = profilePhoto || undefined;
  if (battingStyle !== undefined) player.battingStyle = battingStyle;
  if (bowlingStyle !== undefined) player.bowlingStyle = bowlingStyle;

  if (jerseyNumber === '') {
    player.jerseyNumber = undefined;
  } else if (jerseyNumber !== undefined && player.jerseyNumber !== jerseyNumber) {
    if (await User.exists({ jerseyNumber, _id: { $ne: player._id } })) {
      return res.status(400).json({ message: 'Jersey number is already taken by another player' });
    }
    player.jerseyNumber = jerseyNumber;
  }

  try {
    await player.save();
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Jersey number is already taken by another player' });
    }
    throw error;
  }

  const updated = await User.findById(player._id).select(User.PUBLIC_FIELDS);
  res.json(updated);
};

module.exports = {
  getPlayers,
  getPlayerById,
  getPlayerTrends,
  updatePlayerRole,
  updatePlayerProfile
};
