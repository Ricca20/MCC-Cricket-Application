const express = require('express');
const router = express.Router();
const {
  createTournament, getTournaments, addTeamsToTournament, setTournamentTeams, generateDraw,
  generateKnockout, getFixtures, getLiveTournament, getStandings
} = require('../controllers/tournamentController');
const { protect, adminOnly } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');

const id = validateObjectId('id');

router.post('/', protect, adminOnly, validate('createTournament'), createTournament);
router.get('/', getTournaments);
router.get('/live/:slug', getLiveTournament);
router.post('/:id/teams', id, protect, adminOnly, validate('tournamentTeams'), addTeamsToTournament);
router.put('/:id/teams', id, protect, adminOnly, validate('tournamentTeams'), setTournamentTeams);
router.post('/:id/generate-draw', id, protect, adminOnly, validate('generateDraw'), generateDraw);
router.post('/:id/generate-knockout', id, protect, adminOnly, generateKnockout);
router.get('/:id/fixtures', id, getFixtures);
router.get('/:id/standings', id, getStandings);

module.exports = router;
