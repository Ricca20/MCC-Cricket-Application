const express = require('express');
const router = express.Router();
const { createMatch, getMatchById, getLiveMatch, addDelivery, completeMatch } = require('../controllers/matchController');
const { protect, adminOnly, scorerOrAdmin } = require('../middleware/auth');

router.post('/', protect, adminOnly, createMatch);
router.get('/live/:slug', getLiveMatch); // Public
router.get('/:id', protect, getMatchById); // Protected
router.post('/:id/deliveries', protect, scorerOrAdmin, addDelivery);
router.post('/:id/complete', protect, scorerOrAdmin, completeMatch);

module.exports = router;
