const express = require('express');
const router = express.Router();
const { getUploadSignature } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

router.post('/signature', protect, getUploadSignature);

module.exports = router;
