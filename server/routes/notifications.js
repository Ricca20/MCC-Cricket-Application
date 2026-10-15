const express = require('express');
const router = express.Router();
const { getPublicKey, subscribe, sendNotification } = require('../controllers/notificationController');
const { protect, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.get('/vapid-public-key', getPublicKey);
router.post('/subscribe', protect, validate('pushSubscription'), subscribe);
router.post('/send', protect, adminOnly, validate('sendNotification'), sendNotification);

module.exports = router;
