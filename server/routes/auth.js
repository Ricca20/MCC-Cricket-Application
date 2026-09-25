const express = require('express');
const router = express.Router();
const { registerUser, loginUser, seedAdmin } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/seed-admin', seedAdmin);

module.exports = router;
