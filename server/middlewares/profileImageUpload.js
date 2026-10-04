const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDirectory = path.resolve(__dirname, '../../public/uploads/profile-images');
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename(req, file, callback) {
    callback(null, `${crypto.randomUUID()}${allowedTypes[file.mimetype] || ''}`);
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!allowedTypes[file.mimetype]) {
      const error = new Error('אפשר להעלות תמונת JPG, PNG או WebP בלבד');
      error.statusCode = 400;
      return callback(error);
    }
    return callback(null, true);
  }
});