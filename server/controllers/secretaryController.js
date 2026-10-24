import SecretaryBot from '../models/SecretaryBot.js';
import Payment from '../models/Payment.js';
import nodemailer from 'nodemailer'; // ייבוא מודול nodemailer לשליחת מיילים
import crypto from 'node:crypto'; // ייבוא מודול crypto ליצירת טוקנים אקראיים
import { getBotLimit } from '../utils/plans.js';
const HEBREW_WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// יוצר חיבור Gmail שבו משתמשים לשליחת עדכוני חופשה ללקוחות.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function getSecretaryBotQuota(userId) {
  const [botCount, completedPayment] = await Promise.all([
    SecretaryBot.countDocuments({ userId }),
    Payment.findOne({ userId, status: 'completed' }).sort({ createdAt: -1 }).select('planId')
  ]);
  const botLimit = completedPayment ? getBotLimit(completedPayment.planId) : 1;
  return {
    botCount,
    botLimit,
    planId: completedPayment?.planId || 'בסיסי',
    canCreate: botCount < botLimit
  };
}

/**
 * יוצר או מעדכן את הגדרות בוט המזכירה הראשוניות של בעל העסק.
 */
async function setupSecretary(req, res) {
  try {
    const {
      botUrlKey,
      dayOff,
      openTime,
      closeTime,
      defaultPrice,
      appointmentDurationMinutes,
      breakDurationMinutes
    } = req.body;
    
    // מונע שמירה של הגדרות בסיסיות חלקיות.
    if (!botUrlKey || !dayOff || !openTime || !closeTime) {
      return res.status(400).json({ success: false, message: 'נא למלא את כל שדות החובה' });
    }

    const price = defaultPrice === undefined ? 150 : Number(defaultPrice);
    const appointmentDuration = appointmentDurationMinutes === undefined ? 30 : Number(appointmentDurationMinutes);
    const breakDuration = breakDurationMinutes === undefined ? 10 : Number(breakDurationMinutes);
    if (!/^[a-zA-Z0-9-]+$/.test(botUrlKey) ||
        !HEBREW_WEEKDAYS.slice(0, 6).includes(dayOff) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(openTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(closeTime) ||
        openTime >= closeTime ||
        !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(appointmentDuration) || appointmentDuration < 5 ||
        !Number.isInteger(breakDuration) || breakDuration < 0) {
      return res.status(400).json({ success: false, message: 'נא לבדוק את מזהה הבוט, יום החופש ושעות הפעילות' });
    }

    const existingBot = await SecretaryBot.findOne({ userId: req.user.id, botUrlKey });
    if (!existingBot && req.user.role !== 'admin') {
      const quota = await getSecretaryBotQuota(req.user.id);
      if (!quota.canCreate) {
        return res.status(403).json({
          success: false,
          code: 'SECRETARY_BOT_LIMIT_REACHED',
          message: 'הגעת למכסת בוטי המזכירה במסלול שלך. יש לבחור מסלול בתשלום כדי להוסיף בוט.',
          pricingUrl: '/pages/pricing.html?required=secretary-bot'
        });
      }
    }

    const bot = await SecretaryBot.findOneAndUpdate(
      { userId: req.user.id, botUrlKey },
      {
        $set: {
          dayOff,
          openTime,
          closeTime,
          defaultPrice: price,
          appointmentDurationMinutes: appointmentDuration,
          breakDurationMinutes: breakDuration
        },
        $setOnInsert: { userId: req.user.id, botUrlKey }
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.json({ success: true, message: 'הגדרות בוט המזכירה נשמרו בהצלחה', bot });
  } catch (error) {
    // שומר את פרטי הכשל ביומן, אך מחזיר ללקוח הודעה כללית.
    console.error('Setup secretary error:', error.message);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'מזהה קישור זה כבר בשימוש' });
    }
    return res.status(500).json({ success: false, message: 'שגיאה בשמירת הגדרות המזכירה' });
  }
}

async function getOwnedSecretaryBots(req, res) {
  try {
    const [bots, quota] = await Promise.all([
      SecretaryBot.find({ userId: req.user.id })
        .select('botUrlKey dayOff openTime closeTime defaultPrice appointmentDurationMinutes breakDurationMinutes')
        .sort({ createdAt: 1 })
        .lean(),
      getSecretaryBotQuota(req.user.id)
    ]);

    return res.json({ success: true, bots, quota });
  } catch (error) {
    console.error('Get owned secretary bots error:', error);
    return res.status(500).json({ success: false, message: 'שגיאה בטעינת בוטי המזכירה' });
  }
}

async function deleteSecretaryBot(req, res) {
  try {
    const bot = await SecretaryBot.findOneAndDelete({
      botUrlKey: req.params.botUrlKey,
      userId: req.user.id
    });
    if (!bot) {
      return res.status(404).json({ success: false, message: 'הבוט לא נמצא או שאין הרשאה למחוק אותו' });
    }
    return res.json({ success: true, message: 'בוט המזכירה נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete secretary bot error:', error);
    return res.status(500).json({ success: false, message: 'שגיאה במחיקת בוט המזכירה' });
  }
}

/**
 * בודק האם תאריך לועזי מסוים נופל על חג יהודי או שבת באמצעות @hebcal/core.
 */
async function isHolidayOrShabbat(dateString) {
  try {
    // טעינה דינמית של הספריה
    const { HDate, HebrewCalendar } = await import('@hebcal/core');
    
    const [year, month, day] = dateString.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const hdate = new HDate(dateObj);

    if (dateObj.getDay() === 6) return true;

    const events = HebrewCalendar.getHolidaysOnDate(hdate, true) || [];

    return events.some(ev => ev.hasFlag('CHAG'));
  } catch (err) {
    // במקרה שחישוב לוח השנה נכשל, מתעדים ומאפשרים לקוד הקורא להמשיך.
    console.error('Hebcal error:', err.message);
    return false;
  }
}

/**
 * מחזיר את כל ימי החודש הלועזי, כולל שבתות, חגים וחופשות עבור לוח השנה.
 */
async function getMonthCalendar(req, res) {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'Year and month are required' });
    }

    const y = Number(year);
    const m = Number(month);
    if (!Number.isInteger(y) || y < 100 || y > 9999 || !Number.isInteger(m) || m < 1 || m > 12) {
      return res.status(400).json({ success: false, message: 'Invalid year or month' });
    }

    const bot = await SecretaryBot.findOne({ botUrlKey: req.params.botUrlKey });
    if (!bot) {
      return res.status(404).json({ success: false, message: 'בוט המזכירה לא נמצא' });
    }

    console.log(`Fetching calendar for Year: ${y}, Month: ${m}`);

    // ייבוא דינמי של Hebcal
    const { HDate, HebrewCalendar } = await import('@hebcal/core');

    const daysInMonth = new Date(y, m, 0).getDate();
    const calendarDays = [];

    for (let day = 1; day <= daysInMonth; day++) {
      // 1. יצירת התאריך המקומי ליום הנוכחי בלולאה
      const localDate = new Date(y, m - 1, day);
      const hdate = new HDate(localDate);
      const yearStr = localDate.getFullYear();
      const monthStr = String(localDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(localDate.getDate()).padStart(2, '0');
      const dateString = `${yearStr}-${monthStr}-${dayStr}`;
      
      // 2. בדיקת שבת מדויקת לפי היום בשבוע (6 = שבת)
      const dayOfWeek = localDate.getDay();
      const isShabbat = (dayOfWeek === 6);

      let isHoliday = false;
      let holidayName = null;
      
      try {
        // 3. בדיקת חגים בצורה נקייה ומדויקת
        const events = HebrewCalendar.getHolidaysOnDate(hdate, true) || [];

        const holidayEvent = events.find(ev => ev.hasFlag('CHAG'));
        if (holidayEvent) {
          isHoliday = true;
          holidayName = holidayEvent.render('he');
        }
      } catch (err) {
        console.error('Hebcal event calculation error:', err.message);
      }

      // 4. חסימה רק אם זה שבת ממש או חג ממש או חופשה פתאומית
      const isDayOff = HEBREW_WEEKDAYS[dayOfWeek] === String(bot.dayOff || '').trim();
      const isEmergencyVacation = Array.isArray(bot.emergencyVacations) &&
        bot.emergencyVacations.some(v => v.date === dateString);
      const isBlocked = isShabbat || isHoliday || isDayOff || isEmergencyVacation;

      calendarDays.push({
        dayNumber: day,
        dateString,
        dayOfWeek,
        isDayOff,
        isShabbat,
        isHoliday,
        holidayName,
        isBlocked
      });
    }

    return res.json({
      success: true,
      year: y,
      month: m,
      calendarDays
    });

  } catch (error) {
    console.error("Error in getMonthCalendar:", error);
    return res.status(500).json({ success: false, message: 'שגיאה בטעינת לוח השנה' });
  }
}

/**
 * לקוח קובע תור חדש דרך הקישור של הבוט.
 */
async function bookAppointment(req, res) {
  try {
    // מזהה הבוט מגיע מהנתיב, ופרטי הלקוח והמועד מגיעים מגוף הבקשה.
    const { botUrlKey } = req.params;
    // הוספנו את idNumber לחילוץ מה-body
    const { clientName, phone, email, date, time, idNumber } = req.body;

    console.log("Incoming booking request:", req.body); // לוג לבדיקה

    // כל הפרטים נדרשים כדי לרשום תור ולשלוח עדכונים ללקוח.
    if (!clientName || !phone || !email || !date || !time) {
      return res.status(400).json({ success: false, message: 'נא למלא את כל פרטי הלקוח והתור' });
    }

    // מאתר את הבוט לפי הקישור הציבורי הייחודי שניתן ללקוח.
    const bot = await SecretaryBot.findOne({ botUrlKey });
    if (!bot) {
      return res.status(404).json({ success: false, message: 'בוט המזכירה לא נמצא' });
    }

    // בדיקה האם השעה תפוסה כבר
    // מחפש תור פעיל באותו מועד; תורים שבוטלו אינם חוסמים את השעה.
    const existingAppointment = bot.appointments.find(app => app.date === date && app.time === time && app.status === 'confirmed');
    if (existingAppointment) {
      return res.status(400).json({ success: false, message: 'השעה שנבחרה כבר תפוסה, נא לבחור שעה אחרת' });
    }

    // הוספת התור לרשימה (כולל idNumber אם צריך)
    bot.appointments.push({
      clientName,
      phone,
      email,
      date,
      time,
      idNumber: idNumber || '',
      status: 'confirmed'
    });

    // שומר את הבוט כדי להתמיד בתור החדש במסד הנתונים.
    await bot.save();

    // מחזיר אישור ואת המחיר שהוגדר לבוט המזכירה.
    return res.json({
      success: true,
      message: 'התור נקבע בהצלחה!',
      priceToPay: bot.defaultPrice
    });
  } catch (error) {
    console.error('Book appointment error:', error); // הדפסת השגיאה המלאה לטרמינל
    return res.status(500).json({ success: false, message: 'שגיאה בקביעת התור: ' + error.message });
  }
}

/**
 * מחזיר את שעות הפעילות והשעות הפנויות ליום מסוים עבור הלקוח.
 */
async function getAvailableSlots(req, res) {
  try {
    const { botUrlKey } = req.params;
    const { date } = req.query; // תאריך נבחר בפורמט YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ success: false, message: 'נא לספק תאריך בדיקה' });
    }

    const bot = await SecretaryBot.findOne({ botUrlKey });
    if (!bot) {
      return res.status(404).json({ success: false, message: 'בוט המזכירה לא נמצא' });
    }

    const isVacation = Array.isArray(bot.emergencyVacations) &&
      bot.emergencyVacations.some(v => v.date === date);
    if (isVacation) {
      return res.json({ success: true, availableSlots: [], message: 'העסק סגור בתאריך זה עקב חופשה' });
    }

    // 1. בדיקה האם התאריך הוא שבת או חג (שימוש ב-await כדי שהפונקציה האסינכרונית תעבוד נכון)
    const isHolidayOrRest = await isHolidayOrShabbat(date);
    if (isHolidayOrRest) {
      return res.json({ success: true, availableSlots: [], message: 'העסק סגור בשבתות וחגים' });
    }

    // 2. בדיקה האם התאריך נפגש עם יום החופש הקבוע של העסק
    const [year, month, day] = date.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    if (HEBREW_WEEKDAYS[dayOfWeek] === bot.dayOff) {
      return res.json({ success: true, availableSlots: [], message: `העסק סגור בימי ${bot.dayOff}` });
    }

    // 3. חישוב רשת השעות בהתאם לשעות הפתיחה, אורך התור וההפסקות
    const slots = [];
    let currentTimeMinutes = timeToMinutes(bot.openTime);
    const closeTimeMinutes = timeToMinutes(bot.closeTime);
    const duration = bot.appointmentDurationMinutes || 30;
    const breakTime = bot.breakDurationMinutes || 10;

    // שליפת התורים שכבר קיימים באותו יום בבסיס הנתונים
    const bookedTimes = bot.appointments
      .filter(app => app.date === date && app.status === 'confirmed')
      .map(app => app.time);

    while (currentTimeMinutes + duration <= closeTimeMinutes) {
      const timeString = minutesToTime(currentTimeMinutes);
      
      // בדיקה האם השעה כבר תפוסה בבסיס הנתונים המקומי
      const isBooked = bookedTimes.includes(timeString);

      if (!isBooked) {
        slots.push(timeString);
      }

      // התקדמות לשעה הבאה כולל אורך התור וההפסקה
      currentTimeMinutes += duration + breakTime;
    }

    return res.json({
      success: true,
      availableSlots: slots,
      price: bot.defaultPrice
    });

  } catch (error) {
    console.error('Get available slots error:', error.message);
    return res.status(500).json({ success: false, message: 'שגיאה בחישוב השעות הפנויות' });
  }
}

// פונקציות עזר להמרת דקות לשעות ולהפך
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** 
 * מראה התורים עבור בעל העסק
*/
async function getBusinessAppointments(req, res) {
  try {
    const { botUrlKey } = req.params;
    const bot = await SecretaryBot.findOne({ botUrlKey, userId: req.user.id });
    
    if (!bot) {
      return res.status(404).json({ success: false, message: 'הבוט לא נמצא או שאין הרשאה לצפות בו' });
    }

    const { year, month } = req.query;
    if ((year && !month) || (!year && month)) {
      return res.status(400).json({ success: false, message: 'נא לספק שנה וחודש יחד' });
    }
    if (year && (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || Number(month) < 1 || Number(month) > 12)) {
      return res.status(400).json({ success: false, message: 'חודש או שנה אינם תקינים' });
    }

    const appointments = bot.appointments
      .filter(appointment => !year || appointment.date.startsWith(`${year}-${String(month).padStart(2, '0')}-`))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    return res.json({
      success: true,
      appointments
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({ success: false, message: 'שגיאה בטעינת התורים' });
  }
}

/**
 * עדכון הגדרות הבוט עבור בעל העסק (מחיר ברירת מחדל, יום חופש וכו')
 */
async function updateBotSettings(req, res) {
  try {
    const { botUrlKey } = req.params;
    const {
      botUrlKey: newBotUrlKey,
      defaultPrice,
      dayOff,
      openTime,
      closeTime,
      appointmentDurationMinutes,
      breakDurationMinutes
    } = req.body;

    const bot = await SecretaryBot.findOne({ botUrlKey, userId: req.user.id });
    if (!bot) {
      return res.status(404).json({ success: false, message: 'הבוט לא נמצא או שאין הרשאה לערוך אותו' });
    }

    const nextBotUrlKey = newBotUrlKey === undefined ? bot.botUrlKey : String(newBotUrlKey).trim();
    const nextDayOff = dayOff === undefined ? bot.dayOff : dayOff;
    const nextOpenTime = openTime === undefined ? bot.openTime : openTime;
    const nextCloseTime = closeTime === undefined ? bot.closeTime : closeTime;
    if (!/^[a-zA-Z0-9-]+$/.test(nextBotUrlKey) ||
        !HEBREW_WEEKDAYS.slice(0, 6).includes(nextDayOff) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(nextOpenTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(nextCloseTime) ||
        nextOpenTime >= nextCloseTime ||
        (defaultPrice !== undefined && (!Number.isFinite(Number(defaultPrice)) || Number(defaultPrice) < 0)) ||
        (appointmentDurationMinutes !== undefined && (!Number.isInteger(Number(appointmentDurationMinutes)) || Number(appointmentDurationMinutes) < 5)) ||
        (breakDurationMinutes !== undefined && (!Number.isInteger(Number(breakDurationMinutes)) || Number(breakDurationMinutes) < 0))) {
      return res.status(400).json({ success: false, message: 'נא לבדוק את כל הגדרות הבוט' });
    }

    bot.botUrlKey = nextBotUrlKey;
    bot.dayOff = nextDayOff;
    bot.openTime = nextOpenTime;
    bot.closeTime = nextCloseTime;
    if (defaultPrice !== undefined) bot.defaultPrice = Number(defaultPrice);
    if (appointmentDurationMinutes !== undefined) bot.appointmentDurationMinutes = Number(appointmentDurationMinutes);
    if (breakDurationMinutes !== undefined) bot.breakDurationMinutes = Number(breakDurationMinutes);
    try {
      await bot.save();
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'מזהה קישור זה כבר בשימוש' });
      }
      throw error;
    }

    return res.json({
      success: true,
      message: 'הגדרות הבוט עודכנו בהצלחה',
      bot
    });
  } catch (error) {
    console.error('Error updating bot settings:', error);
    return res.status(500).json({ success: false, message: 'שגיאה בעדכון ההגדרות' });
  }
}

/**
 * בעל העסק מגיש בקשה לחופשה פתאומית ושולח מייל ללקוחות המושפעים.
 */
async function requestEmergencyVacation(req, res) {
  try {
    const { botUrlKey } = req.params;
    const vacationDate = typeof req.body.vacationDate === 'string' ? req.body.vacationDate : '';
    const customMessage = typeof req.body.customMessage === 'string' ? req.body.customMessage.trim() : '';
    const dateMatch = vacationDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch || !customMessage || customMessage.length > 1000) {
      return res.status(400).json({ success: false, message: 'נא לבחור תאריך תקין ולכתוב הודעה באורך של עד 1000 תווים' });
    }

    const [, year, month, day] = dateMatch;
    const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (parsedDate.toISOString().slice(0, 10) !== vacationDate) {
      return res.status(400).json({ success: false, message: 'תאריך החופשה אינו תקין' });
    }

    const bot = await SecretaryBot.findOne({ botUrlKey, userId: req.user.id });
    if (!bot || String(bot.userId) !== req.user.id) {
      return res.status(404).json({ success: false, message: 'הבוט אינו קיים או שאין הרשאה' });
    }

    if (Array.isArray(bot.emergencyVacations) &&
        bot.emergencyVacations.some(vacation => vacation.date === vacationDate)) {
      return res.status(409).json({ success: false, message: 'כבר הוגדרה חופשה לתאריך זה' });
    }

    const affectedAppointments = bot.appointments.filter(app => app.date === vacationDate && app.status === 'confirmed');
    const appointmentsByEmail = new Map();
    for (const appointment of affectedAppointments) {
      const email = appointment.email.trim().toLowerCase();
      const clientAppointments = appointmentsByEmail.get(email) || [];
      clientAppointments.push(appointment);
      appointmentsByEmail.set(email, clientAppointments);
    }

    if (appointmentsByEmail.size > 0 && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
      return res.status(503).json({ success: false, message: 'שליחת המיילים אינה מוגדרת בשרת, לא בוצעו שינויים בתורים' });
    }

    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
    const messageHtml = escapeHtml(customMessage).replace(/\r?\n/g, '<br>');
    const clientConfirmations = [];
    const emailErrors = [];

    for (const [email, appointments] of appointmentsByEmail) {
      const token = crypto.randomBytes(20).toString('hex');
      const clientName = appointments[0].clientName;
      const appointmentTimes = appointments
        .map(appointment => escapeHtml(appointment.time))
        .join(', ');
      const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const confirmUrl = `${appUrl}/api/secretary/confirm-read/${token}`;
      try {
        await transporter.sendMail({
          from: `"ניהול תורים - Botify" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `עדכון לגבי התור שלך בתאריך ${vacationDate}`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
              <h3>שלום ${escapeHtml(clientName)},</h3>
              <p>${messageHtml}</p>
              <p>התור שלך בתאריך ${escapeHtml(vacationDate)} בשעה ${appointmentTimes} בוטל עקב החופשה.</p>
              <p>אנא לחץ על הכפתור שלהלן כדי לאשר שקראת הודעה זו:</p>
              <a href="${confirmUrl}" style="background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">אשר קריאת הודעה</a>
            </div>
          `
        });
        clientConfirmations.push({
          clientEmail: email,
          confirmedRead: false,
          confirmationToken: token
        });
      } catch (error) {
        console.error('Emergency vacation email failed:', error.message);
        emailErrors.push(email);
      }
    }

    for (const appointment of affectedAppointments) {
      appointment.status = 'cancelled';
    }

    bot.emergencyVacations.push({
      date: vacationDate,
      customMessage,
      messageSent: emailErrors.length === 0,
      clientConfirmations
    });

    // מתמיד את רשומת החופשה לאחר יצירת נתוני האישורים.
    await bot.save();

    const sentCount = clientConfirmations.length;
    const failedCount = emailErrors.length;
    const message = failedCount
      ? `החופשה נשמרה ו-${affectedAppointments.length} תורים בוטלו. נשלחו ${sentCount} מיילים; שליחת ${failedCount} מיילים נכשלה.`
      : affectedAppointments.length
        ? `החופשה נשמרה ו-${affectedAppointments.length} תורים בוטלו. נשלחו מיילים ל-${sentCount} לקוחות.`
        : 'החופשה נשמרה. לא נמצאו תורים פעילים בתאריך זה ולכן לא נשלחו מיילים.';

    return res.json({
      success: true,
      message,
      emailsSent: sentCount,
      emailFailures: failedCount
    });
  } catch (error) {
    // רושם שגיאות בלתי צפויות ומחזיר הודעה כללית למבקש.
    console.error('Emergency vacation error:', error.message);
    return res.status(500).json({ success: false, message: 'שגיאה בטיפול בחופשה הפתאומית' });
  }
}

/**
 * קבלת אישור קריאת המייל מהלקוח
 */
async function confirmReadMessage(req, res) {
  try {
    const { token } = req.params;

    // חיפוש הבוט שמכיל את אישור הקריאה עם הטוקן הזה
    const bot = await SecretaryBot.findOne({ 'emergencyVacations.clientConfirmations.confirmationToken': token });
    if (!bot) {
      return res.status(404).send('<h2 dir="rtl" style="text-align:center; font-family:Arial;">הקישור שגוי או פג תוקפו.</h2>');
    }

    // עדכון הסטטוס של הלקוח הספציפי ל-true
    for (const vacation of bot.emergencyVacations) {
      const conf = vacation.clientConfirmations.find(c => c.confirmationToken === token);
      if (conf) {
        conf.confirmedRead = true;
        break;
      }
    }

    await bot.save();

    return res.send(`
      <div dir="rtl" style="text-align:center; font-family:Arial; margin-top:50px;">
        <h2 style="color: #16a34a;">תודה רבה!</h2>
        <p>אישור קריאת ההודעה נקלט בהצלחה במערכת.</p>
      </div>
    `);
  } catch (error) {
    console.error('Confirm read error:', error);
    return res.status(500).send('<h2 dir="rtl" style="text-align:center; font-family:Arial;">שגיאה בשרת.</h2>');
  }
}

export default {
  setupSecretary,
  getOwnedSecretaryBots,
  deleteSecretaryBot,
  bookAppointment,
  requestEmergencyVacation,
  getAvailableSlots,
  getMonthCalendar,
  isHolidayOrShabbat,
  timeToMinutes,
  minutesToTime,
  getBusinessAppointments,
  updateBotSettings,
  requestEmergencyVacation,
  confirmReadMessage
};