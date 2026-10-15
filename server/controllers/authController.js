const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = 'mcc_refresh';
const isProduction = process.env.NODE_ENV === 'production';

const refreshSecret = () => process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}:refresh`;

// Compared against when the email is unknown, so timing doesn't reveal accounts
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12);

const signAccess = (user) => jwt.sign({ id: user.id, typ: 'access' }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });

const signRefresh = (user) =>
  jwt.sign({ id: user.id, typ: 'refresh', ver: user.tokenVersion }, refreshSecret(), { expiresIn: REFRESH_TTL_MS / 1000 });

// The web app and API live on different sites in production, so the cookie
// must be SameSite=None there; it is scoped to the auth routes only.
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: REFRESH_TTL_MS
};

const sendSession = (res, user, status = 200) => {
  res.cookie(REFRESH_COOKIE, signRefresh(user), cookieOptions);
  res.status(status).json({
    _id: user.id,
    name: user.name,
    roles: user.roles,
    token: signAccess(user)
  });
};

// Refresh and logout are cookie-authenticated, so only accept them from our own site
const allowedOrigin = (req) => {
  const origin = req.headers.origin;
  if (!origin) return true;
  return (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map((o) => o.trim()).includes(origin);
};

// @desc    Register a new user (player)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, email, password, battingStyle, bowlingStyle } = req.body;
  const normalisedEmail = email.toLowerCase();

  if (await User.exists({ email: normalisedEmail })) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const user = await User.create({
    name,
    email: normalisedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    roles: ['player'], // Default role is player
    battingStyle,
    bowlingStyle
  });

  sendSession(res, user, 201);
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !valid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  sendSession(res, user);
};

// @desc    Exchange the refresh cookie for a new access token (rotates the cookie)
// @route   POST /api/auth/refresh
// @access  Refresh cookie
const refreshSession = async (req, res) => {
  if (!allowedOrigin(req)) return res.status(403).json({ message: 'Origin not allowed' });

  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ message: 'No session' });

  let decoded;
  try {
    decoded = jwt.verify(token, refreshSecret());
  } catch {
    return res.status(401).json({ message: 'Session expired' });
  }

  const user = await User.findById(decoded.id);
  if (decoded.typ !== 'refresh' || !user || user.tokenVersion !== decoded.ver) {
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    return res.status(401).json({ message: 'Session expired' });
  }
  sendSession(res, user);
};

// @desc    End the session everywhere by revoking all refresh tokens
// @route   POST /api/auth/logout
// @access  Refresh cookie
const logoutUser = async (req, res) => {
  if (!allowedOrigin(req)) return res.status(403).json({ message: 'Origin not allowed' });

  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const decoded = jwt.verify(token, refreshSecret());
      await User.updateOne({ _id: decoded.id, tokenVersion: decoded.ver }, { $inc: { tokenVersion: 1 } });
    } catch {
      // An invalid cookie is simply cleared
    }
  }
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ message: 'Logged out' });
};

module.exports = {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser
};
