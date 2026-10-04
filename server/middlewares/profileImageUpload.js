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
  /**
   * מייצר שם קובץ ייחודי ושומר על סיומת התמונה המותרת.
   * @param {import('express').Request} req בקשת ההעלאה.
   * @param {import('multer').File} file פרטי הקובץ שהועלה.
   * @param {import('multer').DiskStorageOptions['filename']} callback מחזיר שם קובץ ל-Multer.
   * @returns {void} מוסר ל-Multer את שם הקובץ.
   */
  filename(req, file, callback) {
    callback(null, `${crypto.randomUUID()}${allowedTypes[file.mimetype] || ''}`);
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  /**
   * דוחה סוגי MIME שאינם JPEG, PNG או WebP.
   * @param {import('express').Request} req בקשת ההעלאה.
   * @param {import('multer').File} file פרטי הקובץ שהועלה.
   * @param {import('multer').FileFilterCallback} callback מקבל או דוחה את הקובץ.
   * @returns {void} מעביר ל-Multer החלטת קבלה או שגיאת ולידציה.
   */
  fileFilter(req, file, callback) {
    if (!allowedTypes[file.mimetype]) {
      const error = new Error('אפשר להעלות תמונת JPG, PNG או WebP בלבד');
      error.statusCode = 400;
      return callback(error);
    }
    return callback(null, true);
  }
});