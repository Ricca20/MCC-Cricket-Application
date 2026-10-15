const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
  if (decoded.typ !== 'access') {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }

  // Roles are re-read on every request, so a revoked role takes effect immediately
  req.user = await User.findById(decoded.id).select('-passwordHash -pushSubscriptions');
  if (!req.user) {
    return res.status(401).json({ message: 'User not found' });
  }
  next();
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.roles.includes('admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

const scorerOrAdmin = (req, res, next) => {
  if (req.user && (req.user.roles.includes('scorer') || req.user.roles.includes('admin'))) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as a scorer' });
  }
};

// The assigned scorer or an admin may score/finalise a match
const canScore = (user, match) =>
  user.roles.includes('admin') || (match.scorerId && match.scorerId.toString() === user.id);

module.exports = { protect, adminOnly, scorerOrAdmin, canScore };
