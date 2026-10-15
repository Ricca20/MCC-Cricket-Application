const express = require('express');
const router = express.Router();
const { getPlayers, getPlayerById, getPlayerTrends, updatePlayerRole, updatePlayerProfile } = require('../controllers/playerController');
const { protect, adminOnly } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');

const id = validateObjectId('id');

router.get('/', getPlayers);
router.get('/:id', id, getPlayerById);
router.put('/:id', id, protect, validate('updateProfile'), updatePlayerProfile);
router.get('/:id/trends', id, getPlayerTrends);
router.patch('/:id/role', id, protect, adminOnly, validate('updateRole'), updatePlayerRole);

module.exports = router;
