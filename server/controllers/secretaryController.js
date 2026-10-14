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

/**
 * לקוח קובע תור חדש דרך הקישור של הבוט.
 */
async function bookAppointment(req, res) {
  try {
    const { botUrlKey } = req.params;
    const { clientName, phone, email, date, time } = req.body;

    if (!clientName || !phone || !email || !date || !time) {
      return res.status(400).json({ success: false, message: 'נא למלא את כל פרטי הלקוח והתור' });
    }

    const bot = await SecretaryBot.findOne({ botUrlKey });
    if (!bot) {
      return res.status(404).json({ success: false, message: 'בוט המזכירה לא נמצא' });
    }

    // בדיקה האם התאריך הוא שבת או חג
    if (isHolidayOrShabbat(date)) {
      return res.status(400).json({ success: false, message: 'לא ניתן לקבוע תורים בשבתות וחגים' });
    }

    // בדיקה האם התאריך נפגש עם יום החופש הקבוע של העסק
    const dayOfWeek = new Date(date).toLocaleDateString('he-IL', { weekday: 'long' });
    if (dayOfWeek === bot.dayOff) {
      return res.status(400).json({ success: false, message: `העסק סגור בימי ${bot.dayOff}` });
    }

    // בדיקה האם השעה תפוסה כבר
    const existingAppointment = bot.appointments.find(app => app.date === date && app.time === time && app.status === 'confirmed');
    if (existingAppointment) {
      return res.status(400).json({ success: false, message: 'השעה שנבחרה כבר תפוסה, נא לבחור שעה אחרת' });
    }

    // הוספת התור לרשימה
    bot.appointments.push({
      clientName,
      phone,
      email,
      date,
      time,
      status: 'confirmed'
    });

    await bot.save();

    return res.json({
      success: true,
      message: 'התור נקבע בהצלחה!',
      priceToPay: bot.defaultPrice
    });
  } catch (error) {
    console.error('Book appointment error:', error.message);
    return res.status(500).json({ success: false, message: 'שגיאה בקביעת התור' });
  }
}

/**
 * בעל העסק מגיש בקשה לחופשה פתאומית ושולח מייל ללקוחות המושפעים.
 */
async function requestEmergencyVacation(req, res) {
  try {
    const { botId } = req.params;
    const { vacationDate, customMessage } = req.body;

    const bot = await SecretaryBot.findById(botId);
    if (!bot || String(bot.userId) !== req.user.id) {
      return res.status(404).json({ success: false, message: 'הבוט אינו קיים או שאין הרשאה' });
    }

    // איתור תורים שנקבעו לאותו תאריך של חופשה
    const affectedAppointments = bot.appointments.filter(app => app.date === vacationDate && app.status === 'confirmed');

    const clientConfirmations = [];

    // שליחת מיילים ללקוחות המושפעים
    for (const app of affectedAppointments) {
      const token = crypto.randomBytes(20).toString('hex');
      clientConfirmations.push({
        clientEmail: app.email,
        confirmedRead: false,
        confirmationToken: token
      });

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const confirmUrl = `http://localhost:3000/api/secretary/confirm-read/${token}`;
        await transporter.sendMail({
          from: `"ניהול תורים - Botify" <${process.env.EMAIL_USER}>`,
          to: app.email,
          subject: 'עדכון דחוף לגבי התור שלך / בקשת חופשה',
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
              <h3>שלום ${app.clientName},</h3>
              <p>${customMessage || 'עקב נסיבות דחופות, בעל העסק נאלץ לצאת לחופשה בתאריך שנקבע.'}</p>
              <p>אנא לחץ על הכפתור שלהלן כדי לאשר שקראת הודעה זו:</p>
              <a href="${confirmUrl}" style="background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">אשר קריאת הודעה</a>
            </div>
          `
        });
      }
    }

    bot.emergencyVacations.push({
      date: vacationDate,
      messageSent: true,
      clientConfirmations
    });

    await bot.save();

    return res.json({
      success: true,
      message: `בקשת החופשה נקלטה ונשלחו הודעות ל-${affectedAppointments.length} לקוחות.`
    });
  } catch (error) {
    console.error('Emergency vacation error:', error.message);
    return res.status(500).json({ success: false, message: 'שגיאה בטיפול בחופשה הפתאומית' });
  }
}

module.exports = {
  setupSecretary,
  bookAppointment,
  requestEmergencyVacation
};