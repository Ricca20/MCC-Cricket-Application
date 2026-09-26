const express = require('express');
const router = express.Router();
const { createMatch, getMatchById, getLiveMatch, addDelivery, completeMatch, updateDelivery, getMatchSummary } = require('../controllers/matchController');
const { protect, adminOnly, scorerOrAdmin } = require('../middleware/auth');
const { validateDelivery } = require('../middleware/validate');

router.post('/', protect, adminOnly, createMatch);
router.get('/live/:slug', getLiveMatch); // Public
router.get('/:id/summary', getMatchSummary); // Public shareable summary
router.get('/:id', protect, getMatchById); // Protected
router.post('/:id/deliveries', protect, scorerOrAdmin, validateDelivery, addDelivery);
router.patch('/:id/deliveries/:deliveryId', protect, adminOnly, updateDelivery); // Admin correction
router.post('/:id/complete', protect, scorerOrAdmin, completeMatch);

module.exports = router;
