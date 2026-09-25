const express = require('express');
const router = express.Router();
const { getPlayers, getPlayerById, getPlayerTrends, updatePlayerRole } = require('../controllers/playerController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', getPlayers);
router.get('/:id', getPlayerById);
router.get('/:id/trends', getPlayerTrends);
router.patch('/:id/role', protect, adminOnly, updatePlayerRole);

module.exports = router;
