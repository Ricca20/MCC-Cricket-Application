const webpush = require('web-push');
const User = require('../models/User');

// VAPID keys should ideally be in env variables
// Generating them on the fly for development/MVP purposes if not provided
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || webpush.generateVAPIDKeys().publicKey;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || webpush.generateVAPIDKeys().privateKey;

webpush.setVapidDetails('mailto:test@example.com', publicVapidKey, privateVapidKey);

// @desc    Subscribe to push notifications
// @route   POST /api/notifications/subscribe
// @access  Protected
const subscribe = async (req, res) => {
  try {
    const subscription = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Save subscription if it doesn't already exist
    const exists = user.pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
    if (!exists) {
      user.pushSubscriptions.push(subscription);
      await user.save();
    }

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a push notification (Utility for admin or automated triggers)
// @route   POST /api/notifications/send
// @access  Admin only
const sendNotification = async (req, res) => {
  try {
    const { userId, title, body } = req.body;
    
    let users = [];
    if (userId) {
      const user = await User.findById(userId);
      if (user) users.push(user);
    } else {
      // Broadcast to everyone (for match starts, etc.)
      users = await User.find({ 'pushSubscriptions.0': { $exists: true } });
    }

    const payload = JSON.stringify({ title, body });
    
    users.forEach(user => {
      user.pushSubscriptions.forEach(sub => {
        webpush.sendNotification(sub, payload).catch(err => console.error('Push error:', err));
      });
    });

    res.json({ message: 'Notifications sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  subscribe,
  sendNotification,
  publicVapidKey // Export for the route that provides the key to the frontend
};
