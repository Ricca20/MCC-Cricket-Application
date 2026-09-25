const express = require('express');
const router = express.Router();
const { createTeam, getTeams } = require('../controllers/teamController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', protect, adminOnly, createTeam);
router.get('/', getTeams);

module.exports = router;
