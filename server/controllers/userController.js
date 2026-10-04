const fs = require('fs/promises');
const path = require('path');
const User = require('../models/User');

const uploadDirectory = path.resolve(__dirname, '../../public/uploads/profile-images');

async function countUsers(req, res) {
  try {
    const count = await User.countDocuments();
    return res.json({ success: true, count });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'שגיאה בספירת המשתמשים' });
  }
}

async function listUsers(req, res) {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'שגיאה בשליפת המשתמשים' });
  }
}

async function hasValidImageSignature(filePath, mimeType) {
  const contents = await fs.readFile(filePath);
  if (mimeType === 'image/jpeg') {
    return contents[0] === 0xff && contents[1] === 0xd8 && contents[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return contents.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/webp') {
    return contents.toString('ascii', 0, 4) === 'RIFF' && contents.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

async function uploadProfileImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'יש לבחור קובץ תמונה' });
  }

  try {
    if (!(await hasValidImageSignature(req.file.path, req.file.mimetype))) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, message: 'תוכן הקובץ אינו תמונה תקינה' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ success: false, message: 'המשתמש לא נמצא' });
    }

    const previousImage = user.profileImage;
    user.profileImage = `/uploads/profile-images/${req.file.filename}`;
    await user.save();

    if (typeof previousImage === 'string' && /^\/uploads\/profile-images\/[^/]+$/.test(previousImage)) {
      await fs.unlink(path.join(uploadDirectory, path.basename(previousImage))).catch(() => {});
    }

    return res.json({ success: true, profileImage: user.profileImage });
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    console.error('Profile image upload error:', error.message);
    return res.status(500).json({ success: false, message: 'לא ניתן לשמור את תמונת הפרופיל כרגע' });
  }
}

module.exports = { countUsers, listUsers, uploadProfileImage };