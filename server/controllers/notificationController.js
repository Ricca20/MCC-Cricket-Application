const webpush = require('web-push');
const User = require('../models/User');

const MAX_SUBSCRIPTIONS = 5;

// Push needs a matching VAPID key pair and a real contact; without them it is off
const vapidSubject = () => {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const clientUrl = process.env.CLIENT_URL || '';
  return clientUrl.startsWith('https://') ? clientUrl.split(',')[0].trim() : null;
};

const pushEnabled = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && vapidSubject());

if (pushEnabled) {
  webpush.setVapidDetails(vapidSubject(), process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
} else {
  console.warn('Push notifications disabled: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT');
}

// @desc    Public VAPID key for the browser's PushManager
// @route   GET /api/notifications/vapid-public-key
// @access  Public
const getPublicKey = (req, res) => {
  if (!pushEnabled) return res.status(503).json({ message: 'Push notifications are not configured' });
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

// @desc    Subscribe to push notifications
// @route   POST /api/notifications/subscribe
// @access  Protected
const subscribe = async (req, res) => {
  if (!pushEnabled) return res.status(503).json({ message: 'Push notifications are not configured' });

  const subscription = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const others = user.pushSubscriptions.filter((sub) => sub.endpoint !== subscription.endpoint);
  // Keep the newest few devices only
  user.pushSubscriptions = [...others, subscription].slice(-MAX_SUBSCRIPTIONS);
  await user.save();

  res.status(201).json({ message: 'Subscribed successfully' });
};

// @desc    Send a push notification (Utility for admin or automated triggers)
// @route   POST /api/notifications/send
// @access  Admin only
const sendNotification = async (req, res) => {
  if (!pushEnabled) return res.status(503).json({ message: 'Push notifications are not configured' });

  const { userId, title, body } = req.body;
  const users = userId
    ? await User.find({ _id: userId })
    : await User.find({ 'pushSubscriptions.0': { $exists: true } });

  const payload = JSON.stringify({ title, body });
  let sent = 0;
  for (const user of users) {
    const results = await Promise.allSettled(
      user.pushSubscriptions.map((sub) => webpush.sendNotification(sub, payload, { TTL: 3600 }))
    );
    // Drop subscriptions the push service says are gone
    const expired = user.pushSubscriptions.filter((sub, i) =>
      results[i].status === 'rejected' && [404, 410].includes(results[i].reason?.statusCode)
    ).map((sub) => sub.endpoint);
    sent += results.filter((r) => r.status === 'fulfilled').length;
    if (expired.length) {
      await User.updateOne({ _id: user._id }, { $pull: { pushSubscriptions: { endpoint: { $in: expired } } } });
    }
  }

  res.json({ message: 'Notifications sent', sent });
};

module.exports = {
  getPublicKey,
  subscribe,
  sendNotification
};
