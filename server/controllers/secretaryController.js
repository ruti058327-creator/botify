const SecretaryBot = require('../models/SecretaryBot');
const { HDate, HebrewCalendar, greg } = require('@hebcal/core');// ייבוא מודול hebcal-core לעבודה עם תאריכים עבריים
const nodemailer = require('nodemailer'); // ייבוא מודול nodemailer לשליחת מיילים
const crypto = require('crypto'); // ייבוא מודול crypto ליצירת טוקנים אקראיים

/**
 * יוצר או מעדכן את הגדרות בוט המזכירה הראשוניות של בעל העסק.
 */
async function setupSecretary(req, res) {
  try {
    const { botUrlKey, dayOff, openTime, closeTime, defaultPrice } = req.body;
    
    if (!botUrlKey || !dayOff || !openTime || !closeTime) {
      return res.status(400).json({ success: false, message: 'נא למלא את כל שדות החובה' });
    }

    let bot = await SecretaryBot.findOne({ userId: req.user.id });
    if (bot) {
      bot.botUrlKey = botUrlKey;
      bot.dayOff = dayOff;
      bot.openTime = openTime;
      bot.closeTime = closeTime;
      bot.defaultPrice = defaultPrice || 150;
      await bot.save();
    } else {
      bot = new SecretaryBot({
        userId: req.user.id,
        botUrlKey,
        dayOff,
        openTime,
        closeTime,
        defaultPrice: defaultPrice || 150
      });
      await bot.save();
    }

    return res.json({ success: true, message: 'הגדרות בוט המזכירה נשמרו בהצלחה', bot });
  } catch (error) {
    console.error('Setup secretary error:', error.message);
    return res.status(500).json({ success: false, message: 'שגיאה בשמירת הגדרות המזכירה' });
  }
}

/**
 * בודק האם תאריך לועזי מסוים נופל על חג יהודי או שבת באמצעות @hebcal/core.
 */
function isHolidayOrShabbat(dateString) {
  try {
    const dateObj = new Date(dateString);
    const hdate = new HDate(dateObj);
    // בדיקה האם מדובר בשבת (יום 6 ב-JS, או שבת ב-hebcal)
    if (dateObj.getDay() === 6) return true;

    // בדיקת חגים באותו יום
    const events = HebrewCalendar.calcFy(hdate.getFullYear()).filter(ev => {
      const evDate = greg.fromLocaleDate(ev.getDate().greg());
      return evDate.toDateString() === dateObj.toDateString();
    });

    // מחזיר true אם יש חג מרכזי
    return events.some(ev => ev.getFlags() & (HebrewCalendar.CHAG | HebrewCalendar.YOM_TOV));
  } catch (err) {
    return false;
  }
}