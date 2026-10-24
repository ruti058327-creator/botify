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
    // טעינה דינמית שפתרה את שגיאת התאימות של Node.js
    const { HDate, HebrewCalendar, greg } = await import('@hebcal/core');

    // המרת התאריך הלועזי לאובייקט HDate
    // ממיר את תאריך הקלט לתאריך JavaScript ולתאריך עברי לחישוב אירועים.
    const dateObj = new Date(dateString);
    const hdate = new HDate(dateObj);

    // בדיקה אם התאריך הוא שבת (יום 6 בשבוע)
    if (dateObj.getDay() === 6) return true;

    // חישוב אירועים יהודיים עבור השנה של התאריך הנתון
    // מחשב אירועי שנה עברית ומסנן אותם לתאריך הלועזי שנבדק.
    const events = HebrewCalendar.calcFy(hdate.getFullYear()).filter(ev => {
      const evDate = greg.fromLocaleDate(ev.getDate().greg());
      return evDate.toDateString() === dateObj.toDateString();
    });

    // בדיקה אם יש אירועים שהם חגים או ימי טוב
    // מחזיר אמת אם אחד האירועים מסומן כחג או כיום טוב.
    return events.some(ev => ev.getFlags() & (HebrewCalendar.CHAG | HebrewCalendar.YOM_TOV));
  } catch (err) {
    // במקרה שחישוב לוח השנה נכשל, מתעדים ומאפשרים לקוד הקורא להמשיך.
    console.error('Hebcal error:', err.message);
    return false;
  }
}

/**
 * לקוח קובע תור חדש דרך הקישור של הבוט.
 */
async function bookAppointment(req, res) {
  try {
    // מזהה הבוט מגיע מהנתיב, ופרטי הלקוח והמועד מגיעים מגוף הבקשה.
    const { botUrlKey } = req.params;
    const { clientName, phone, email, date, time } = req.body;

    // כל הפרטים נדרשים כדי לרשום תור ולשלוח עדכונים ללקוח.
    if (!clientName || !phone || !email || !date || !time) {
      return res.status(400).json({ success: false, message: 'נא למלא את כל פרטי הלקוח והתור' });
    }

    // מאתר את הבוט לפי הקישור הציבורי הייחודי שניתן ללקוח.
    const bot = await SecretaryBot.findOne({ botUrlKey });
    if (!bot) {
      return res.status(404).json({ success: false, message: 'בוט המזכירה לא נמצא' });
    }

    // בדיקה האם התאריך הוא שבת או חג
    if (isHolidayOrShabbat(date)) {
      return res.status(400).json({ success: false, message: 'לא ניתן לקבוע תורים בשבתות וחגים' });
    }

    // בדיקה האם התאריך נפגש עם יום החופש הקבוע של העסק
    // מפיק את שם יום השבוע בעברית ומשווה ליום הסגירה שהוגדר לעסק.
    const dayOfWeek = new Date(date).toLocaleDateString('he-IL', { weekday: 'long' });
    if (dayOfWeek === bot.dayOff) {
      return res.status(400).json({ success: false, message: `העסק סגור בימי ${bot.dayOff}` });
    }

    // בדיקה האם השעה תפוסה כבר
    // מחפש תור פעיל באותו מועד; תורים שבוטלו אינם חוסמים את השעה.
    const existingAppointment = bot.appointments.find(app => app.date === date && app.time === time && app.status === 'confirmed');
    if (existingAppointment) {
      return res.status(400).json({ success: false, message: 'השעה שנבחרה כבר תפוסה, נא לבחור שעה אחרת' });
    }

    // הוספת התור לרשימה
    // מוסיף תור חדש במצב מאושר לרשימה המשויכת למסמך הבוט.
    bot.appointments.push({
      clientName,
      phone,
      email,
      date,
      time,
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
    // מתעד את הכשל ומחזיר סטטוס שרת אחיד במקרה לא צפוי.
    console.error('Book appointment error:', error.message);
    return res.status(500).json({ success: false, message: 'שגיאה בקביעת התור' });
  }
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
  requestEmergencyVacation
};