const express = require('express');
const router = express.Router();
const { subscribe, sendNotification, publicVapidKey } = require('../controllers/notificationController');
const { protect, adminOnly } = require('../middleware/auth');

// Route to serve the public key to the frontend
router.get('/vapid-public-key', (req, res) => {
  res.send(publicVapidKey);
});

router.post('/subscribe', protect, subscribe);
router.post('/send', protect, adminOnly, sendNotification);

module.exports = router;
