// מודל המזכירה שומר הגדרות עסקיות, תורים ורישומי חופשות.
const SecretaryBot = require('../models/SecretaryBot');
const nodemailer = require('nodemailer'); // ייבוא מודול nodemailer לשליחת מיילים
const crypto = require('crypto'); // ייבוא מודול crypto ליצירת טוקנים אקראיים

// יוצר חיבור Gmail שבו משתמשים לשליחת עדכוני חופשה ללקוחות.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * יוצר או מעדכן את הגדרות בוט המזכירה הראשוניות של בעל העסק.
 */
async function setupSecretary(req, res) {
  try {
    // קורא מהבקשה את כתובת הבוט ואת הגדרות שעות הפעילות והתמחור.
    const { botUrlKey, dayOff, openTime, closeTime, defaultPrice } = req.body;
    
    // מונע שמירה של הגדרות בסיסיות חלקיות.
    if (!botUrlKey || !dayOff || !openTime || !closeTime) {
      return res.status(400).json({ success: false, message: 'נא למלא את כל שדות החובה' });
    }

    // מאתר את בוט המזכירה של המשתמש המחובר כדי לעדכן או ליצור אותו.
    let bot = await SecretaryBot.findOne({ userId: req.user.id });
    if (bot) {
      // מעדכן את ההגדרות הקיימות ושומר מחיר ברירת מחדל כשלא נשלח מחיר.
      bot.botUrlKey = botUrlKey;
      bot.dayOff = dayOff;
      bot.openTime = openTime;
      bot.closeTime = closeTime;
      bot.defaultPrice = defaultPrice || 150;
      await bot.save();
    } else {
      // אם זו הגדרה ראשונה, יוצר מסמך חדש המשויך למשתמש המאומת.
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

    // מחזיר ללקוח אישור ואת ההגדרות שנשמרו.
    return res.json({ success: true, message: 'הגדרות בוט המזכירה נשמרו בהצלחה', bot });
  } catch (error) {
    // שומר את פרטי הכשל ביומן, אך מחזיר ללקוח הודעה כללית.
    console.error('Setup secretary error:', error.message);
    return res.status(500).json({ success: false, message: 'שגיאה בשמירת הגדרות המזכירה' });
  }
}

/**
 * בודק האם תאריך לועזי מסוים נופל על חג יהודי או שבת באמצעות @hebcal/core.
 */
async function isHolidayOrShabbat(dateString) {
  try {
    // טעינה דינמית של הספריה
    const { HDate, HebrewCalendar, greg } = await import('@hebcal/core');
    
    const dateObj = new Date(dateString);
    const hdate = new HDate(dateObj);

    if (dateObj.getDay() === 6) return true;

    const events = HebrewCalendar.calcFy(hdate.getFullYear()).filter(ev => {
      const evDate = greg.fromLocaleDate(ev.getDate().greg());
      return evDate.toDateString() === dateObj.toDateString();
    });

    return events.some(ev => ev.getFlags() & (HebrewCalendar.CHAG | HebrewCalendar.YOM_TOV));
  } catch (err) {
    // במקרה שחישוב לוח השנה נכשל, מתעדים ומאפשרים לקוד הקורא להמשיך.
    console.error('Hebcal error:', err.message);
    return false;
  }
}

/**
 * מחזיר את כל ימי החודש הלועזי כולל תאריך עברי, שבתות וחגים עבור לוח השנה.
 */
async function getMonthCalendar(req, res) {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const y = parseInt(year);
    const m = parseInt(month);

    console.log(`Fetching calendar for Year: ${y}, Month: ${m}`);

    // ייבוא דינמי של Hebcal
    const { HDate, HebrewCalendar, greg } = await import('@hebcal/core');

    const daysInMonth = new Date(y, m, 0).getDate();
    const calendarDays = [];

    for (let day = 1; day <= daysInMonth; day++) {
      // 1. יצירת התאריך המקומי ליום הנוכחי בלולאה
      const localDate = new Date(y, m - 1, day);
      const hdate = new HDate(localDate);
      
      // 2. בדיקת שבת מדויקת לפי היום בשבוע (6 = שבת)
      const dayOfWeek = localDate.getDay();
      const isShabbat = (dayOfWeek === 6);

      let isHoliday = false;
      let holidayName = null;
      
      try {
        // 3. בדיקת חגים בצורה נקייה ומדויקת
        const events = HebrewCalendar.calcFy(hdate.getFullYear()).filter(ev => {
          const evDate = greg.fromLocaleDate(ev.getDate().greg());
          return evDate.getFullYear() === localDate.getFullYear() &&
                 evDate.getMonth() === localDate.getMonth() &&
                 evDate.getDate() === localDate.getDate();
        });

        const holidayEvent = events.find(ev => ev.getFlags() & (HebrewCalendar.CHAG | HebrewCalendar.YOM_TOV));
        if (holidayEvent) {
          isHoliday = true;
          holidayName = holidayEvent.render('he');
        }
      } catch (err) {
        console.error('Hebcal event calculation error:', err.message);
      }

      // 4. חסימה רק אם זה שבת ממש או חג ממש
      const isBlocked = isShabbat || isHoliday;

      const yearStr = localDate.getFullYear();
      const monthStr = String(localDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(localDate.getDate()).padStart(2, '0');
      const dateString = `${yearStr}-${monthStr}-${dayStr}`;

      calendarDays.push({
        dayNumber: day,
        dateString,
        dayOfWeek,
        isShabbat,
        isHoliday,
        holidayName,
        hebrewDate: hdate.render('he'),
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
    return res.status(500).json({ error: error.message });
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

    // 1. בדיקה האם התאריך הוא שבת או חג (שימוש ב-await כדי שהפונקציה האסינכרונית תעבוד נכון)
    const isHolidayOrRest = await isHolidayOrShabbat(date);
    if (isHolidayOrRest) {
      return res.json({ success: true, availableSlots: [], message: 'העסק סגור בשבתות וחגים' });
    }

    // 2. בדיקה האם התאריך נפגש עם יום החופש הקבוע של העסק
    const dayOfWeek = new Date(date).toLocaleDateString('he-IL', { weekday: 'long' });
    if (dayOfWeek === bot.dayOff) {
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
 * בעל העסק מגיש בקשה לחופשה פתאומית ושולח מייל ללקוחות המושפעים.
 */
async function requestEmergencyVacation(req, res) {
  try {
    // מזהה הבוט והיום המבוקש מגיעים מהנתיב ומגוף הבקשה.
    const { botId } = req.params;
    const { vacationDate, customMessage } = req.body;

    // מוודא שהבוט קיים ושהמשתמש המחובר אכן בעליו.
    const bot = await SecretaryBot.findById(botId);
    if (!bot || String(bot.userId) !== req.user.id) {
      return res.status(404).json({ success: false, message: 'הבוט אינו קיים או שאין הרשאה' });
    }

    // איתור תורים שנקבעו לאותו תאריך של חופשה
    // בוחר רק תורים מאושרים בתאריך החופשה, שאותם צריך להודיע ללקוחותיהם.
    const affectedAppointments = bot.appointments.filter(app => app.date === vacationDate && app.status === 'confirmed');

    // אוסף פרטי אישור קריאה ואסימון ייחודי עבור כל לקוח שנפגע.
    const clientConfirmations = [];

    // שליחת מיילים ללקוחות המושפעים
    for (const app of affectedAppointments) {
      // מייצר אסימון אקראי שאפשר לשייך לאישור קריאת ההודעה של הלקוח.
      const token = crypto.randomBytes(20).toString('hex');
      clientConfirmations.push({
        clientEmail: app.email,
        confirmedRead: false,
        confirmationToken: token
      });

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        // יוצר קישור אישי לאישור הקריאה ושולח הודעה לכתובת הלקוח.
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

    // מתעד את החופשה ואת רשימת האסימונים במסמך הבוט.
    bot.emergencyVacations.push({
      date: vacationDate,
      messageSent: true,
      clientConfirmations
    });

    // מתמיד את רשומת החופשה לאחר יצירת נתוני האישורים.
    await bot.save();

    // מדווח כמה לקוחות היו בעלי תורים מאושרים בתאריך שנבחר.
    return res.json({
      success: true,
      message: `בקשת החופשה נקלטה ונשלחו הודעות ל-${affectedAppointments.length} לקוחות.`
    });
  } catch (error) {
    // רושם שגיאות בלתי צפויות ומחזיר הודעה כללית למבקש.
    console.error('Emergency vacation error:', error.message);
    return res.status(500).json({ success: false, message: 'שגיאה בטיפול בחופשה הפתאומית' });
  }
}

// מייצא את פעולות ההגדרה, קביעת התור וניהול החופשה לשכבת הנתיבים.
module.exports = {
  setupSecretary,
  bookAppointment,
  requestEmergencyVacation,
  getAvailableSlots,
  getMonthCalendar,
  isHolidayOrShabbat,
  timeToMinutes,
  minutesToTime
};