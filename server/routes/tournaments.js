const express = require('express');
const router = express.Router();
const { createTournament, addTeamsToTournament, generateDraw, getLiveTournament, getStandings } = require('../controllers/tournamentController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', protect, adminOnly, createTournament);
router.post('/:id/teams', protect, adminOnly, addTeamsToTournament);
router.post('/:id/generate-draw', protect, adminOnly, generateDraw);
router.get('/:id/standings', getStandings);
router.get('/live/:slug', getLiveTournament);

module.exports = router;
