const express = require('express');
const router = express.Router();
const {
  listMatches, listPublicMatches, createMatch, getMatchById, getLiveMatch, getMatchSummary,
  startMatch, addDelivery, undoLastDelivery, endInnings, completeMatch, updateDelivery
} = require('../controllers/matchController');
const { protect, adminOnly, scorerOrAdmin } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');

const id = validateObjectId('id');

router.get('/', protect, scorerOrAdmin, listMatches);
router.get('/public', listPublicMatches); // Public
router.post('/', protect, adminOnly, validate('createMatch'), createMatch);
router.get('/live/:slug', getLiveMatch); // Public
router.get('/live/:slug/summary', getMatchSummary); // Public shareable summary
router.get('/:id', id, protect, getMatchById); // Protected
router.post('/:id/start', id, protect, scorerOrAdmin, validate('startMatch'), startMatch);
router.post('/:id/deliveries', id, protect, scorerOrAdmin, validate('delivery'), addDelivery);
router.delete('/:id/deliveries/last', id, protect, scorerOrAdmin, undoLastDelivery);
router.patch('/:id/deliveries/:deliveryId', validateObjectId('id', 'deliveryId'), protect, adminOnly, validate('updateDelivery'), updateDelivery); // Admin correction
router.post('/:id/innings/end', id, protect, scorerOrAdmin, endInnings);
router.post('/:id/complete', id, protect, scorerOrAdmin, validate('completeMatch'), completeMatch);

module.exports = router;
