const express = require('express');
const router = express.Router();
const { getPlayers, getPlayerById, getPlayerTrends, updatePlayerRole, updatePlayerProfile } = require('../controllers/playerController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', getPlayers);
router.get('/:id', getPlayerById);
router.put('/:id', protect, updatePlayerProfile);
router.get('/:id/trends', getPlayerTrends);
router.patch('/:id/role', protect, adminOnly, updatePlayerRole);

module.exports = router;
