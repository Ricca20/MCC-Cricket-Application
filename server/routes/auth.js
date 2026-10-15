const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { registerUser, loginUser, refreshSession, logoutUser } = require('../controllers/authController');
const { validate } = require('../middleware/validate');

const limiter = (limit, options = {}) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later' },
  ...options
});

// Slows password guessing: 10 failed logins per IP per 15 minutes
const loginLimiter = limiter(10, { skipSuccessfulRequests: true });
const registerLimiter = limiter(10);

router.post('/register', registerLimiter, validate('register'), registerUser);
router.post('/login', loginLimiter, validate('login'), loginUser);
router.post('/refresh', refreshSession);
router.post('/logout', logoutUser);

module.exports = router;
