// המודלים שומרים הגדרות, תורים ורכישות במסד הנתונים.
import SecretaryBot from '../models/SecretaryBot.js';
import Payment from '../models/Payment.js';
// crypto יוצר אסימוני אישור אקראיים שאי אפשר לנחש בקלות.
import crypto from 'node:crypto';
// פונקציית המכסה קובעת כמה בוטים מותרים לפי המסלול האחרון.
import { getBotLimit } from '../utils/plans.js';
// יוצר שגיאות עם קוד HTTP שהמטפל המרכזי יודע להחזיר.
import httpError from '../utils/httpError.js';
// שולח הודעות דוא"ל ללקוחות המושפעים מחופשה.
import { sendEmail } from '../utils/mailer.js';
// סכמת ההגדרות משמשת לאימות מחודש של ערכים בעת עדכון חלקי.
import { secretarySchemas } from '../validation/schemas.js';
// אינדקס זה מתרגם את ערכי getDay של JavaScript לשמות ימי השבוע בעברית.
const HEBREW_WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// בונה כתובת מוחלטת לדף קביעת תור ומצרף אליה את מזהה הבוט כפרמטר.
function getBookingPageUrl(botUrlKey) {
  // משתמשים בכתובת האתר שהוגדרה, או בכתובת המקומית כברירת מחדל.
  const bookingUrl = new URL('/client-booking.html', process.env.APP_URL || 'http://localhost:3000');
  // שומרים את המזהה בפרמטר URL כדי שהעמוד יידע איזה בוט לטעון.
  bookingUrl.searchParams.set('bot', botUrlKey);
  // מחזירים כתובת מלאה ומקודדת, המתאימה לשיתוף עם לקוחות.
  return bookingUrl.href;
}

// מחשב במקביל את מספר הבוטים ואת המסלול האחרון שהושלם עבור המשתמש.
async function getSecretaryBotQuota(userId) {
  // Promise.all מפחית זמן המתנה בכך ששתי שאילתות המסד רצות יחד.
  const [botCount, completedPayment] = await Promise.all([
    SecretaryBot.countDocuments({ userId }),
    Payment.findOne({ userId, status: 'completed' }).sort({ createdAt: -1 }).select('planId')
  ]);
  // ללא תשלום פעיל המכסה היא בוט אחד; אחרת משתמשים במכסת המסלול.
  const botLimit = completedPayment ? getBotLimit(completedPayment.planId) : 1;
  // מחזירים לממשק את ניצול המכסה ואת היכולת ליצור בוט נוסף.
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
  // שולפים את הגדרות הבוט לאחר שהנתיב אימת את גוף הבקשה.
  const {
    botUrlKey,
    dayOff,
    openTime,
    closeTime,
    defaultPrice,
    appointmentDurationMinutes,
    breakDurationMinutes
  } = req.body;

  // מחפשים אם המשתמש כבר הגדיר בוט עם המפתח המבוקש.
  const existingBot = await SecretaryBot.findOne({ userId: req.user.id, botUrlKey });
  // מכסה נבדקת רק בעת יצירת בוט חדש, ולא כשמעדכנים בוט קיים.
  if (!existingBot && req.user.role !== 'admin') {
    // שליפת המכסה מוודאת שהמשתמש אינו חורג מתוכניתו.
    const quota = await getSecretaryBotQuota(req.user.id);
    // אם המכסה מלאה, מחזירים קוד וכתובת עמוד מסלולים לממשק.
    if (!quota.canCreate) {
      throw httpError(403, 'הגעת למכסת בוטי המזכירה במסלול שלך. יש לבחור מסלול בתשלום כדי להוסיף בוט.', {
        code: 'SECRETARY_BOT_LIMIT_REACHED',
        pricingUrl: '/pages/pricing.html?required=secretary-bot'
      });
    }
  }

  try {
    // מעדכנים הגדרות קיימות או יוצרים מסמך חדש אם לא נמצא מסמך תואם.
    const bot = await SecretaryBot.findOneAndUpdate(
      { userId: req.user.id, botUrlKey },
      {
        $set: {
          dayOff,
          openTime,
          closeTime,
          defaultPrice,
          appointmentDurationMinutes,
          breakDurationMinutes
        },
        $setOnInsert: { userId: req.user.id, botUrlKey }
      },
      { new: true, upsert: true, runValidators: true }
    );
    // מחזירים לממשק את הבוט ואת קישור ההזמנה המלא שלו.
    return res.json({
      success: true,
      message: 'הגדרות בוט המזכירה נשמרו בהצלחה',
      bot,
      bookingUrl: getBookingPageUrl(bot.botUrlKey)
    });
  } catch (error) {
    // מזהה ייחודי תפוס מתורגם להודעת התנגשות ידידותית.
    if (error.code === 11000) throw httpError(409, 'מזהה קישור זה כבר בשימוש');
    // שגיאות אחרות נשמרות כפי שהן ומועברות למטפל המרכזי.
    throw error;
  }
}

async function getOwnedSecretaryBots(req, res) {
  // טוענים במקביל את הבוטים שבבעלות המשתמש ואת נתוני המכסה שלו.
  const [bots, quota] = await Promise.all([
    // בוחרים רק שדות הדרושים למסך הניהול, מסדרים לפי יצירה ומחזירים אובייקטים רגילים.
    SecretaryBot.find({ userId: req.user.id })
      .select('botUrlKey dayOff openTime closeTime defaultPrice appointmentDurationMinutes breakDurationMinutes')
      .sort({ createdAt: 1 })
      .lean(),
    getSecretaryBotQuota(req.user.id)
  ]);

  // משיבים ברשימה ובמכסה כדי שהממשק יציג מצב מלא בפעולה אחת.
  return res.json({ success: true, bots, quota });
}

async function deleteSecretaryBot(req, res) {
  // מוחקים רק מסמך שמפתחו תואם וגם בעליו הוא המשתמש המחובר.
  const bot = await SecretaryBot.findOneAndDelete({
    botUrlKey: req.params.botUrlKey,
    userId: req.user.id
  });
  // תשובה אחידה מסתירה אם הבוט חסר או שייך למשתמש אחר.
  if (!bot) throw httpError(404, 'הבוט לא נמצא או שאין הרשאה למחוק אותו');
  // מאשרים מחיקה רק לאחר שנמצא ונמחק מסמך מתאים.
  return res.json({ success: true, message: 'בוט המזכירה נמחק בהצלחה' });
}

/**
 * בודק האם תאריך לועזי מסוים נופל על חג יהודי או שבת באמצעות @hebcal/core.
 */
async function checkHolidayOrShabbat(dateString) {
  // טעינה דינמית מונעת טעינת ספריית הלוח העברי עד שנדרשת בדיקה.
  const { HDate, HebrewCalendar } = await import('@hebcal/core');
  // מפרקים תאריך בפורמט ISO לרכיבים מספריים לבניית תאריך מקומי.
  const [year, month, day] = dateString.split('-').map(Number);
  // JavaScript מקבל חודש מאפס, ולכן מפחיתים אחד מהחודש שהתקבל.
  const dateObj = new Date(year, month - 1, day);
  // HDate ממיר את התאריך הלועזי לתאריך שבו ספריית החגים יכולה להשתמש.
  const hdate = new HDate(dateObj);

  // שבת מזוהה ישירות לפי יום השבוע, ללא תלות באירועי החג.
  if (dateObj.getDay() === 6) return true;
  // בודקים את אירועי התאריך ומחזירים true אם אחד מהם מסומן כחג.
  const events = HebrewCalendar.getHolidaysOnDate(hdate, true) || [];
  return events.some(event => event.hasFlag('CHAG'));
}

async function isHolidayOrShabbat(req, res) {
  // התאריך כבר אומת ונשמר ב-query הייעודי על ידי middleware האימות.
  const isClosed = await checkHolidayOrShabbat(req.validatedQuery.date);
  // מחזירים תשובת JSON קצרה המתאימה לבדיקת הלקוח.
  return res.json({ success: true, isHolidayOrShabbat: isClosed });
}

/**
 * מחזיר את כל ימי החודש הלועזי, כולל שבתות, חגים וחופשות עבור לוח השנה.
 */
async function getMonthCalendar(req, res) {
  // מפענחים שנה וחודש מתוך השאילתה שעברה ולידציה.
  const { year, month } = req.validatedQuery;
  // מאתרים את הגדרות הבוט לפי המפתח הציבורי שנמסר בכתובת.
  const bot = await SecretaryBot.findOne({ botUrlKey: req.params.botUrlKey });
  // בלי בוט לא ניתן לחשב יום חופש או חופשות שהוגדרו עבורו.
  if (!bot) throw httpError(404, 'בוט המזכירה לא נמצא');

  // טוענים את ספריית הלוח העברי רק בעת בקשת לוח שנה.
  const { HDate, HebrewCalendar } = await import('@hebcal/core');
  // היום האחרון בחודש נקבע באמצעות היום אפס של החודש שאחריו.
  const daysInMonth = new Date(year, month, 0).getDate();
  // מערך זה יקבל רשומה לכל יום בחודש עם סיבות הסגירה שלו.
  const calendarDays = [];

  // בונים פרטי יום לכל תאריך בחודש, כולל שבתות וחגים.
  for (let day = 1; day <= daysInMonth; day++) {
    // מחשבים תאריך מקומי ומייצרים אובייקט תאריך עברי עבור בדיקת חגים.
    const localDate = new Date(year, month - 1, day);
    const hdate = new HDate(localDate);
    // מרכיבים מחרוזת ISO יציבה עם אפסים מובילים בחודש וביום.
    const dateString = [
      localDate.getFullYear(),
      String(localDate.getMonth() + 1).padStart(2, '0'),
      String(localDate.getDate()).padStart(2, '0')
    ].join('-');
    // getDay מחזיר מספר בין אפס לשש, המשמש לאיתור היום והגדרות העסק.
    const dayOfWeek = localDate.getDay();
    // שבת היא היום השישי לפי האינדקס של JavaScript.
    const isShabbat = dayOfWeek === 6;
    // שומרים את אירועי היום ומאתרים אירוע חג בעל דגל CHAG.
    const events = HebrewCalendar.getHolidaysOnDate(hdate, true) || [];
    const holidayEvent = events.find(event => event.hasFlag('CHAG'));
    // ממירים את תוצאת החיפוש לערך בוליאני פשוט.
    const isHoliday = Boolean(holidayEvent);
    // בודקים אם יום השבוע העברי תואם ליום החופש של העסק.
    const isDayOff = HEBREW_WEEKDAYS[dayOfWeek] === String(bot.dayOff || '').trim();
    // חופשות חירום הן מערך אופציונלי במסמך, ולכן בודקים שהוא אכן מערך.
    const isEmergencyVacation = Array.isArray(bot.emergencyVacations) &&
      bot.emergencyVacations.some(vacation => vacation.date === dateString);

    // מוסיפים ליום תוויות ומסמנים סגור אם קיימת אחת מסיבות הסגירה.
    calendarDays.push({
      dayNumber: day,
      dateString,
      dayOfWeek,
      isDayOff,
      isShabbat,
      isHoliday,
      holidayName: holidayEvent ? holidayEvent.render('he') : null,
      isBlocked: isShabbat || isHoliday || isDayOff || isEmergencyVacation
    });
  }

  // מחזירים את החודש ואת רשימת הימים שחושבה ללקוח.
  return res.json({ success: true, year, month, calendarDays });
}

/**
 * לקוח קובע תור חדש דרך הקישור של הבוט.
 */
async function bookAppointment(req, res) {
  // שולפים את מפתח הבוט מהנתיב ואת פרטי ההזמנה מהגוף שעבר בדיקה.
  const { botUrlKey } = req.params;
  const { clientName, phone, email, date, time, idNumber } = req.body;
  // טוענים את מסמך הבוט שבו ישמר התור.
  const bot = await SecretaryBot.findOne({ botUrlKey });
  // דוחים הזמנה כאשר קישור הבוט אינו מצביע על מסמך קיים.
  if (!bot) throw httpError(404, 'בוט המזכירה לא נמצא');

  // מונעים קביעת תור באותו מועד כאשר כבר קיים תור מאושר.
  const existingAppointment = bot.appointments.find(
    appointment => appointment.date === date && appointment.time === time && appointment.status === 'confirmed'
  );
  // התנגשות בזמן מחזירה 409 כדי שהלקוח יבחר שעה אחרת.
  if (existingAppointment) throw httpError(409, 'השעה שנבחרה כבר תפוסה, נא לבחור שעה אחרת');

  // מוסיפים תת-מסמך תור עם פרטי הלקוח ומצב מאושר.
  bot.appointments.push({
    clientName,
    phone,
    email,
    date,
    time,
    idNumber: idNumber || '',
    status: 'confirmed'
  });
  // שומרים את התור החדש במסמך הבוט.
  await bot.save();

  // מחזירים אישור ואת המחיר כפי שהוגדר בבוט.
  return res.json({
    success: true,
    message: 'התור נקבע בהצלחה!',
    priceToPay: bot.defaultPrice
  });
}

/**
 * מחזיר את שעות הפעילות והשעות הפנויות ליום מסוים עבור הלקוח.
 */
async function getAvailableSlots(req, res) {
  // מזהה הבוט מגיע מהנתיב והתאריך מגיע מה-query שעבר אימות.
  const { botUrlKey } = req.params;
  const { date } = req.validatedQuery;
  // טוענים את שעות העבודה, משך התור וההזמנות הקיימות.
  const bot = await SecretaryBot.findOne({ botUrlKey });
  // אין לחשב שעות בלי הגדרות של בוט קיים.
  if (!bot) throw httpError(404, 'בוט המזכירה לא נמצא');

  // אם יש חופשה מיוחדת ביום זה, מחזירים רשימת שעות ריקה.
  const isVacation = Array.isArray(bot.emergencyVacations) &&
    bot.emergencyVacations.some(vacation => vacation.date === date);
  if (isVacation) {
    // ההודעה מסבירה ללקוח מדוע אין שעות זמינות.
    return res.json({ success: true, availableSlots: [], message: 'העסק סגור בתאריך זה עקב חופשה' });
  }

  // חוסמים ימים שבהם העסק אינו פתוח בגלל שבת או חג.
  if (await checkHolidayOrShabbat(date)) {
    return res.json({ success: true, availableSlots: [], message: 'העסק סגור בשבתות וחגים' });
  }

  // ממירים את התאריך למספר יום בשבוע לצורך בדיקת יום החופש הקבוע.
  const [year, month, day] = date.split('-').map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  if (HEBREW_WEEKDAYS[dayOfWeek] === bot.dayOff) {
    return res.json({ success: true, availableSlots: [], message: `העסק סגור בימי ${bot.dayOff}` });
  }

  // מערך תוצאות השעות הפנויות שייבנה לפי שעות הפעילות.
  const slots = [];
  // משנים את זמני הפתיחה והסגירה למספר דקות כדי לחשב מרווחים.
  let currentTimeMinutes = timeToMinutes(bot.openTime);
  const closeTimeMinutes = timeToMinutes(bot.closeTime);
  // משתמשים בברירות מחדל אם מסמך ישן לא כולל משך או הפסקה.
  const duration = bot.appointmentDurationMinutes || 30;
  const breakTime = bot.breakDurationMinutes || 10;
  // אוספים את השעות שכבר תפוסות בתורים מאושרים בתאריך המבוקש.
  const bookedTimes = bot.appointments
    .filter(appointment => appointment.date === date && appointment.status === 'confirmed')
    .map(appointment => appointment.time);

  // מייצרים תורים כל עוד משך הפגישה מסתיים לפני שעת הסגירה.
  while (currentTimeMinutes + duration <= closeTimeMinutes) {
    // מעצבים את זמן ההתחלה HH:MM ומשאירים רק זמנים שאינם תפוסים.
    const timeString = minutesToTime(currentTimeMinutes);
    if (!bookedTimes.includes(timeString)) slots.push(timeString);
    // מקדמים למועד הבא כולל ההפסקה שהוגדרה בין פגישות.
    currentTimeMinutes += duration + breakTime;
  }

  // מחזירים גם את מחיר ברירת המחדל, כדי להציגו לצד השעות.
  return res.json({ success: true, availableSlots: slots, price: bot.defaultPrice });
}

// פונקציות עזר להמרת דקות לשעות ולהפך
function timeToMinutes(timeStr) {
  // מפרידים את השעה והדקות וממירים את שני החלקים למספרים.
  const [hours, minutes] = timeStr.split(':').map(Number);
  // שעה שלמה שווה לשישים דקות, ולכן מחברים אותה לדקות הנותרות.
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  // מחלקים לשעות שלמות וליתרת דקות ומשלימים אפס מוביל לתצוגה אחידה.
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  // מרכיבים את שני החלקים למחרוזת שעה בפורמט HH:MM.
  return `${hours}:${minutes}`;
}

function convertTimeToMinutes(req, res) {
  // ממירים את פרמטר הזמן שכבר נבדק למספר דקות מתחילת היום.
  const minutes = timeToMinutes(req.validatedQuery.time);
  // מחזירים את התוצאה בפורמט JSON.
  return res.json({ success: true, minutes });
}

function convertMinutesToTime(req, res) {
  // ממירים את מספר הדקות המאומת למחרוזת שעה קריאה.
  const time = minutesToTime(req.validatedQuery.minutes);
  // מחזירים את מחרוזת השעה.
  return res.json({ success: true, time });
}

async function getBusinessAppointments(req, res) {
  // מזהים את הבוט רק אם גם המפתח וגם בעל החשבון תואמים.
  const { botUrlKey } = req.params;
  const bot = await SecretaryBot.findOne({ botUrlKey, userId: req.user.id });
  if (!bot) throw httpError(404, 'הבוט לא נמצא או שאין הרשאה לצפות בו');

  // השנה והחודש אופציונליים, אך הסכמה מחייבת אותם להופיע יחד.
  const { year, month } = req.validatedQuery;
  // מסננים לפי חודש רק אם נמסרה שנה, וממיינים את התורים לפי תאריך ושעה.
  const appointments = bot.appointments
    .filter(appointment => year === undefined ||
      appointment.date.startsWith(`${year}-${String(month).padStart(2, '0')}-`))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  // מחזירים את התורים המסוננים לבעל העסק.
  return res.json({ success: true, appointments });
}

/**
 * עדכון הגדרות הבוט עבור בעל העסק (מחיר ברירת מחדל, יום חופש וכו')
 */
async function updateBotSettings(req, res) {
  // מחפשים בוט לפי מזהה ציבורי ובעלות, כדי לא לאפשר עדכון של עסק אחר.
  const { botUrlKey } = req.params;
  const bot = await SecretaryBot.findOne({ botUrlKey, userId: req.user.id });
  if (!bot) throw httpError(404, 'הבוט לא נמצא או שאין הרשאה לערוך אותו');

  // ממזגים קלט חלקי עם הערכים הקיימים; null או undefined משאירים את הערך הנוכחי.
  const settings = {
    botUrlKey: req.body.botUrlKey ?? bot.botUrlKey,
    dayOff: req.body.dayOff ?? bot.dayOff,
    openTime: req.body.openTime ?? bot.openTime,
    closeTime: req.body.closeTime ?? bot.closeTime,
    defaultPrice: req.body.defaultPrice ?? bot.defaultPrice,
    appointmentDurationMinutes: req.body.appointmentDurationMinutes ?? bot.appointmentDurationMinutes,
    breakDurationMinutes: req.body.breakDurationMinutes ?? bot.breakDurationMinutes
  };
  // מאמתים את האובייקט המלא כדי שגם צירוף של שדות ישנים וחדשים יעמוד בכללים.
  const { error, value } = secretarySchemas.setup.validate(settings, {
    abortEarly: false,
    convert: true,
    stripUnknown: true
  });
  // אוספים את כל הודעות הוולידציה ומחזירים אותן כשגיאת בקשה.
  if (error) {
    throw httpError(400, error.details.map(detail => detail.message).join(', '));
  }

  // מעתיקים למסמך רק את הערכים המנורמלים שהסכמה החזירה.
  bot.botUrlKey = value.botUrlKey;
  bot.dayOff = value.dayOff;
  bot.openTime = value.openTime;
  bot.closeTime = value.closeTime;
  bot.defaultPrice = value.defaultPrice;
  bot.appointmentDurationMinutes = value.appointmentDurationMinutes;
  bot.breakDurationMinutes = value.breakDurationMinutes;

  try {
    // Mongoose שומר את ההגדרות לאחר בדיקות הסכמה ומסד הנתונים.
    await bot.save();
  } catch (saveError) {
    // מפתח URL ייחודי תפוס מקבל הודעת 409 ברורה למשתמש.
    if (saveError.code === 11000) throw httpError(409, 'מזהה קישור זה כבר בשימוש');
    // כל תקלה אחרת אינה משתנה ומועברת הלאה.
    throw saveError;
  }

  // מחזירים את הגדרות הבוט המעודכנות לאחר שמירתן.
  return res.json({ success: true, message: 'הגדרות הבוט עודכנו בהצלחה', bot });
}

/**
 * בעל העסק מגיש בקשה לחופשה פתאומית ושולח מייל ללקוחות המושפעים.
 */
async function requestEmergencyVacation(req, res) {
  // קוראים את מפתח הבוט ואת פרטי החופשה שעברו אימות בנתיב.
  const { botUrlKey } = req.params;
  const { vacationDate, customMessage } = req.body;
  // מבטיחים שהמשתמש הוא בעל הבוט המבוקש.
  const bot = await SecretaryBot.findOne({ botUrlKey, userId: req.user.id });
  if (!bot) throw httpError(404, 'הבוט אינו קיים או שאין הרשאה');

  // לא מאפשרים להגדיר פעמיים חופשה באותו תאריך.
  if (bot.emergencyVacations.some(vacation => vacation.date === vacationDate)) {
    throw httpError(409, 'כבר הוגדרה חופשה לתאריך זה');
  }

  // מאתרים את כל התורים המאושרים בתאריך החופשה.
  const affectedAppointments = bot.appointments.filter(
    appointment => appointment.date === vacationDate && appointment.status === 'confirmed'
  );
  // מקבצים תורים לפי דוא"ל כדי לשלוח הודעה אחת ללקוח גם אם יש לו כמה תורים.
  const appointmentsByEmail = new Map();
  for (const appointment of affectedAppointments) {
    // מנרמלים כתובת דוא"ל כדי שקידומות רישיות או רווחים לא ייצרו כפילויות.
    const email = appointment.email.trim().toLowerCase();
    // שולפים רשימת תורים קיימת או מתחילים רשימה חדשה לאותו לקוח.
    const clientAppointments = appointmentsByEmail.get(email) || [];
    // מוסיפים את התור לקבוצה ושומרים אותה תחת כתובת הדוא"ל.
    clientAppointments.push(appointment);
    appointmentsByEmail.set(email, clientAppointments);
  }

  // אם יש לקוחות שצריך להודיע להם, נדרשים פרטי דוא"ל לפני שינוי תורים.
  if (appointmentsByEmail.size > 0 && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
    throw httpError(503, 'שליחת המיילים אינה מוגדרת בשרת, לא בוצעו שינויים בתורים');
  }

  // מגדירים תווי HTML שיש להחליף כדי למנוע פירוש טקסט הלקוח כסימון.
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
  // בורחים את ההודעה לפני שהמרת שורות חדשות לתגיות שורה נעשית בטוחה.
  const messageHtml = escapeHtml(customMessage).replace(/\r?\n/g, '<br>');
  // אוספים אסימוני אישור ושליחה שנכשלה כדי לשמור מצב מדויק במסמך.
  const clientConfirmations = [];
  const emailErrors = [];
  // מסירים לוכסנים מסוף כתובת הבסיס כדי להרכיב קישורים ללא // כפולים.
  const appUrl = process.env.APP_URL.replace(/\/+$/, '');

  // שולחים לכל כתובת הודעה אחת הכוללת את כל התורים של אותו לקוח.
  for (const [email, appointments] of appointmentsByEmail) {
    // האסימון משמש כקישור חד-פעמי לאישור קריאת ההודעה.
    const token = crypto.randomBytes(20).toString('hex');
    // משתמשים בשם הראשון בקבוצה לצורך פנייה אישית לנמען.
    const clientName = appointments[0].clientName;
    // יוצרים רשימת שעות בטוחה לשילוב בגוף HTML.
    const appointmentTimes = appointments
      .map(appointment => escapeHtml(appointment.time))
      .join(', ');
    // קישור זה יגיע לנתיב ציבורי שמסמן שהלקוח קרא את ההודעה.
    const confirmUrl = `${appUrl}/api/secretary/confirm-read/${token}`;
    try {
      // שולחים הודעה הכוללת סיבת ביטול, מועדים וקישור לאישור קריאה.
      await sendEmail({
        fromName: 'ניהול תורים - Botify',
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
      // שומרים אסימון רק עבור נמען שהשליחה אליו הצליחה.
      clientConfirmations.push({
        clientEmail: email,
        confirmedRead: false,
        confirmationToken: token
      });
    } catch (error) {
      // מתעדים את הכשל ושומרים את הכתובת כדי לדווח עליה בתוצאה.
      console.error('Emergency vacation email failed:', error);
      emailErrors.push(email);
    }
  }

  // מבטלים את כל התורים שהושפעו, בלי לשנות תורים בתאריכים אחרים.
  for (const appointment of affectedAppointments) appointment.status = 'cancelled';
  // מוסיפים למסמך החופשה את פרטי ההודעה, תוצאת המשלוח ואישורי הלקוחות.
  bot.emergencyVacations.push({
    date: vacationDate,
    customMessage,
    messageSent: emailErrors.length === 0,
    clientConfirmations
  });
  // שומרים יחד את ביטולי התורים ורשומת החופשה.
  await bot.save();

  // מחשבים מספרי הצלחה וכשל כדי לבנות הודעה מדויקת לבעל העסק.
  const sentCount = clientConfirmations.length;
  const failedCount = emailErrors.length;
  // בוחרים הסבר שונה לפי תוצאת השליחה ולפי קיום תורים שבוטלו.
  const message = failedCount
    ? `החופשה נשמרה ו-${affectedAppointments.length} תורים בוטלו. נשלחו ${sentCount} מיילים; שליחת ${failedCount} מיילים נכשלה.`
    : affectedAppointments.length
      ? `החופשה נשמרה ו-${affectedAppointments.length} תורים בוטלו. נשלחו מיילים ל-${sentCount} לקוחות.`
      : 'החופשה נשמרה. לא נמצאו תורים פעילים בתאריך זה ולכן לא נשלחו מיילים.';

  // מחזירים סיכום של החופשה וכמות הודעות הדוא"ל שנשלחו או נכשלו.
  return res.json({
    success: true,
    message,
    emailsSent: sentCount,
    emailFailures: failedCount
  });
}

/**
 * קבלת אישור קריאת המייל מהלקוח
 */
async function confirmReadMessage(req, res) {
  // האסימון מגיע מהקישור האישי שנשלח בהודעת הדוא"ל.
  const { token } = req.params;
  // מחפשים מסמך בוט שבו נשמר האסימון בין אישורי החופשות.
  const bot = await SecretaryBot.findOne({
    'emergencyVacations.clientConfirmations.confirmationToken': token
  });
  // אסימון לא מוכר אינו מקושר לחופשה ולכן אינו יכול לשנות מצב.
  if (!bot) throw httpError(404, 'הקישור שגוי או פג תוקפו');

  // מאתרים את החופשה והאישור שמכילים את האסימון ומסמנים אותו כנקרא.
  for (const vacation of bot.emergencyVacations) {
    const confirmation = vacation.clientConfirmations.find(item => item.confirmationToken === token);
    if (confirmation) {
      // עדכון זה מאפשר לבעל העסק לראות שהנמען אישר את הקריאה.
      confirmation.confirmedRead = true;
      // האסימון ייחודי, ולכן אין צורך לבדוק חופשות נוספות.
      break;
    }
  }

  // שומרים את אישור הקריאה במסד הנתונים.
  await bot.save();
  // מציגים עמוד HTML פשוט המאשר ללקוח שהפעולה נקלטה.
  return res.send(`
    <div dir="rtl" style="text-align:center; font-family:Arial; margin-top:50px;">
      <h2 style="color: #16a34a;">תודה רבה!</h2>
      <p>אישור קריאת ההודעה נקלט בהצלחה במערכת.</p>
    </div>
  `);
}

// חושף לנתב את הפעולות הציבוריות והניהוליות של בוט המזכירה.
export default {
  setupSecretary,
  getOwnedSecretaryBots,
  deleteSecretaryBot,
  bookAppointment,
  requestEmergencyVacation,
  getAvailableSlots,
  getMonthCalendar,
  isHolidayOrShabbat,
  timeToMinutes: convertTimeToMinutes,
  minutesToTime: convertMinutesToTime,
  getBusinessAppointments,
  updateBotSettings,
  confirmReadMessage
};