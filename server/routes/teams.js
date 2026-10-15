const express = require('express');
const router = express.Router();
const { createTeam, getTeams } = require('../controllers/teamController');
const { protect, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.post('/', protect, adminOnly, validate('createTeam'), createTeam);
router.get('/', getTeams);

module.exports = router;
