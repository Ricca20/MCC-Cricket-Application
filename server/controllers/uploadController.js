const crypto = require('crypto');

const FOLDER = 'mcc/avatars';
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp';

const cloudinaryConfig = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return null;
  return { cloudName: CLOUDINARY_CLOUD_NAME, apiKey: CLOUDINARY_API_KEY, apiSecret: CLOUDINARY_API_SECRET };
};

// Only images uploaded to our own Cloudinary folder may be used as profile photos
const allowedPhotoUrl = (url) => {
  const config = cloudinaryConfig();
  if (!config) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.startsWith(`/${config.cloudName}/image/upload/`) &&
      parsed.pathname.includes(`/${FOLDER}/`);
  } catch {
    return false;
  }
};

// @desc    Sign a direct-to-Cloudinary upload so the API secret stays on the server
// @route   POST /api/uploads/signature
// @access  Protected
const getUploadSignature = (req, res) => {
  const config = cloudinaryConfig();
  if (!config) {
    return res.status(503).json({ message: 'Photo uploads are not configured' });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params = { allowed_formats: ALLOWED_FORMATS, folder: FOLDER, timestamp };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const signature = crypto.createHash('sha1').update(toSign + config.apiSecret).digest('hex');

  res.json({
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    signature,
    ...params
  });
};

module.exports = { getUploadSignature, allowedPhotoUrl };
