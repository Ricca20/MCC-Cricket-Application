const express = require('express');
const router = express.Router();
const { getPlayers, getPlayerById, updatePlayerRole } = require('../controllers/playerController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', getPlayers);
router.get('/:id', getPlayerById);
router.patch('/:id/role', protect, adminOnly, updatePlayerRole);

module.exports = router;
