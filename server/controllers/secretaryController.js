import SecretaryBot from '../models/SecretaryBot.js';
import Payment from '../models/Payment.js';
import crypto from 'node:crypto';
import { getBotLimit } from '../utils/plans.js';
import httpError from '../utils/httpError.js';
import { sendEmail } from '../utils/mailer.js';
import { secretarySchemas } from '../validation/schemas.js';
const HEBREW_WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function getBookingPageUrl(botUrlKey) {
  const bookingUrl = new URL('/client-booking.html', process.env.APP_URL || 'http://localhost:3000');
  bookingUrl.searchParams.set('bot', botUrlKey);
  return bookingUrl.href;
}

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
  const {
    botUrlKey,
    dayOff,
    openTime,
    closeTime,
    defaultPrice,
    appointmentDurationMinutes,
    breakDurationMinutes
  } = req.body;

  const existingBot = await SecretaryBot.findOne({ userId: req.user.id, botUrlKey });
  if (!existingBot && req.user.role !== 'admin') {
    const quota = await getSecretaryBotQuota(req.user.id);
    if (!quota.canCreate) {
      throw httpError(403, 'הגעת למכסת בוטי המזכירה במסלול שלך. יש לבחור מסלול בתשלום כדי להוסיף בוט.', {
        code: 'SECRETARY_BOT_LIMIT_REACHED',
        pricingUrl: '/pages/pricing.html?required=secretary-bot'
      });
    }
  }

  try {
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
    return res.json({
      success: true,
      message: 'הגדרות בוט המזכירה נשמרו בהצלחה',
      bot,
      bookingUrl: getBookingPageUrl(bot.botUrlKey)
    });
  } catch (error) {
    if (error.code === 11000) throw httpError(409, 'מזהה קישור זה כבר בשימוש');
    throw error;
  }
}

async function getOwnedSecretaryBots(req, res) {
  const [bots, quota] = await Promise.all([
    SecretaryBot.find({ userId: req.user.id })
      .select('botUrlKey dayOff openTime closeTime defaultPrice appointmentDurationMinutes breakDurationMinutes')
      .sort({ createdAt: 1 })
      .lean(),
    getSecretaryBotQuota(req.user.id)
  ]);

  return res.json({ success: true, bots, quota });
}

async function deleteSecretaryBot(req, res) {
  const bot = await SecretaryBot.findOneAndDelete({
    botUrlKey: req.params.botUrlKey,
    userId: req.user.id
  });
  if (!bot) throw httpError(404, 'הבוט לא נמצא או שאין הרשאה למחוק אותו');
  return res.json({ success: true, message: 'בוט המזכירה נמחק בהצלחה' });
}

/**
 * בודק האם תאריך לועזי מסוים נופל על חג יהודי או שבת באמצעות @hebcal/core.
 */
async function checkHolidayOrShabbat(dateString) {
  const { HDate, HebrewCalendar } = await import('@hebcal/core');
  const [year, month, day] = dateString.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const hdate = new HDate(dateObj);

  if (dateObj.getDay() === 6) return true;
  const events = HebrewCalendar.getHolidaysOnDate(hdate, true) || [];
  return events.some(event => event.hasFlag('CHAG'));
}

async function isHolidayOrShabbat(req, res) {
  const isClosed = await checkHolidayOrShabbat(req.validatedQuery.date);
  return res.json({ success: true, isHolidayOrShabbat: isClosed });
}

/**
 * מחזיר את כל ימי החודש הלועזי, כולל שבתות, חגים וחופשות עבור לוח השנה.
 */
async function getMonthCalendar(req, res) {
  const { year, month } = req.validatedQuery;
  const bot = await SecretaryBot.findOne({ botUrlKey: req.params.botUrlKey });
  if (!bot) throw httpError(404, 'בוט המזכירה לא נמצא');

  const { HDate, HebrewCalendar } = await import('@hebcal/core');
  const daysInMonth = new Date(year, month, 0).getDate();
  const calendarDays = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const localDate = new Date(year, month - 1, day);
    const hdate = new HDate(localDate);
    const dateString = [
      localDate.getFullYear(),
      String(localDate.getMonth() + 1).padStart(2, '0'),
      String(localDate.getDate()).padStart(2, '0')
    ].join('-');
    const dayOfWeek = localDate.getDay();
    const isShabbat = dayOfWeek === 6;
    const events = HebrewCalendar.getHolidaysOnDate(hdate, true) || [];
    const holidayEvent = events.find(event => event.hasFlag('CHAG'));
    const isHoliday = Boolean(holidayEvent);
    const isDayOff = HEBREW_WEEKDAYS[dayOfWeek] === String(bot.dayOff || '').trim();
    const isEmergencyVacation = Array.isArray(bot.emergencyVacations) &&
      bot.emergencyVacations.some(vacation => vacation.date === dateString);

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

  return res.json({ success: true, year, month, calendarDays });
}

/**
 * לקוח קובע תור חדש דרך הקישור של הבוט.
 */
async function bookAppointment(req, res) {
  const { botUrlKey } = req.params;
  const { clientName, phone, email, date, time, idNumber } = req.body;
  const bot = await SecretaryBot.findOne({ botUrlKey });
  if (!bot) throw httpError(404, 'בוט המזכירה לא נמצא');

  const existingAppointment = bot.appointments.find(
    appointment => appointment.date === date && appointment.time === time && appointment.status === 'confirmed'
  );
  if (existingAppointment) throw httpError(409, 'השעה שנבחרה כבר תפוסה, נא לבחור שעה אחרת');

  bot.appointments.push({
    clientName,
    phone,
    email,
    date,
    time,
    idNumber: idNumber || '',
    status: 'confirmed'
  });
  await bot.save();

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
  const { botUrlKey } = req.params;
  const { date } = req.validatedQuery;
  const bot = await SecretaryBot.findOne({ botUrlKey });
  if (!bot) throw httpError(404, 'בוט המזכירה לא נמצא');

  const isVacation = Array.isArray(bot.emergencyVacations) &&
    bot.emergencyVacations.some(vacation => vacation.date === date);
  if (isVacation) {
    return res.json({ success: true, availableSlots: [], message: 'העסק סגור בתאריך זה עקב חופשה' });
  }

  if (await checkHolidayOrShabbat(date)) {
    return res.json({ success: true, availableSlots: [], message: 'העסק סגור בשבתות וחגים' });
  }

  const [year, month, day] = date.split('-').map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  if (HEBREW_WEEKDAYS[dayOfWeek] === bot.dayOff) {
    return res.json({ success: true, availableSlots: [], message: `העסק סגור בימי ${bot.dayOff}` });
  }

  const slots = [];
  let currentTimeMinutes = timeToMinutes(bot.openTime);
  const closeTimeMinutes = timeToMinutes(bot.closeTime);
  const duration = bot.appointmentDurationMinutes || 30;
  const breakTime = bot.breakDurationMinutes || 10;
  const bookedTimes = bot.appointments
    .filter(appointment => appointment.date === date && appointment.status === 'confirmed')
    .map(appointment => appointment.time);

  while (currentTimeMinutes + duration <= closeTimeMinutes) {
    const timeString = minutesToTime(currentTimeMinutes);
    if (!bookedTimes.includes(timeString)) slots.push(timeString);
    currentTimeMinutes += duration + breakTime;
  }

  return res.json({ success: true, availableSlots: slots, price: bot.defaultPrice });
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

function convertTimeToMinutes(req, res) {
  const minutes = timeToMinutes(req.validatedQuery.time);
  return res.json({ success: true, minutes });
}

function convertMinutesToTime(req, res) {
  const time = minutesToTime(req.validatedQuery.minutes);
  return res.json({ success: true, time });
}

async function getBusinessAppointments(req, res) {
  const { botUrlKey } = req.params;
  const bot = await SecretaryBot.findOne({ botUrlKey, userId: req.user.id });
  if (!bot) throw httpError(404, 'הבוט לא נמצא או שאין הרשאה לצפות בו');

  const { year, month } = req.validatedQuery;
  const appointments = bot.appointments
    .filter(appointment => year === undefined ||
      appointment.date.startsWith(`${year}-${String(month).padStart(2, '0')}-`))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  return res.json({ success: true, appointments });
}

/**
 * עדכון הגדרות הבוט עבור בעל העסק (מחיר ברירת מחדל, יום חופש וכו')
 */
async function updateBotSettings(req, res) {
  const { botUrlKey } = req.params;
  const bot = await SecretaryBot.findOne({ botUrlKey, userId: req.user.id });
  if (!bot) throw httpError(404, 'הבוט לא נמצא או שאין הרשאה לערוך אותו');

  const settings = {
    botUrlKey: req.body.botUrlKey ?? bot.botUrlKey,
    dayOff: req.body.dayOff ?? bot.dayOff,
    openTime: req.body.openTime ?? bot.openTime,
    closeTime: req.body.closeTime ?? bot.closeTime,
    defaultPrice: req.body.defaultPrice ?? bot.defaultPrice,
    appointmentDurationMinutes: req.body.appointmentDurationMinutes ?? bot.appointmentDurationMinutes,
    breakDurationMinutes: req.body.breakDurationMinutes ?? bot.breakDurationMinutes
  };
  const { error, value } = secretarySchemas.setup.validate(settings, {
    abortEarly: false,
    convert: true,
    stripUnknown: true
  });
  if (error) {
    throw httpError(400, error.details.map(detail => detail.message).join(', '));
  }

  bot.botUrlKey = value.botUrlKey;
  bot.dayOff = value.dayOff;
  bot.openTime = value.openTime;
  bot.closeTime = value.closeTime;
  bot.defaultPrice = value.defaultPrice;
  bot.appointmentDurationMinutes = value.appointmentDurationMinutes;
  bot.breakDurationMinutes = value.breakDurationMinutes;

  try {
    await bot.save();
  } catch (saveError) {
    if (saveError.code === 11000) throw httpError(409, 'מזהה קישור זה כבר בשימוש');
    throw saveError;
  }

  return res.json({ success: true, message: 'הגדרות הבוט עודכנו בהצלחה', bot });
}

/**
 * בעל העסק מגיש בקשה לחופשה פתאומית ושולח מייל ללקוחות המושפעים.
 */
async function requestEmergencyVacation(req, res) {
  const { botUrlKey } = req.params;
  const { vacationDate, customMessage } = req.body;
  const bot = await SecretaryBot.findOne({ botUrlKey, userId: req.user.id });
  if (!bot) throw httpError(404, 'הבוט אינו קיים או שאין הרשאה');

  if (bot.emergencyVacations.some(vacation => vacation.date === vacationDate)) {
    throw httpError(409, 'כבר הוגדרה חופשה לתאריך זה');
  }

  const affectedAppointments = bot.appointments.filter(
    appointment => appointment.date === vacationDate && appointment.status === 'confirmed'
  );
  const appointmentsByEmail = new Map();
  for (const appointment of affectedAppointments) {
    const email = appointment.email.trim().toLowerCase();
    const clientAppointments = appointmentsByEmail.get(email) || [];
    clientAppointments.push(appointment);
    appointmentsByEmail.set(email, clientAppointments);
  }

  if (appointmentsByEmail.size > 0 && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
    throw httpError(503, 'שליחת המיילים אינה מוגדרת בשרת, לא בוצעו שינויים בתורים');
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
  const appUrl = process.env.APP_URL.replace(/\/+$/, '');

  for (const [email, appointments] of appointmentsByEmail) {
    const token = crypto.randomBytes(20).toString('hex');
    const clientName = appointments[0].clientName;
    const appointmentTimes = appointments
      .map(appointment => escapeHtml(appointment.time))
      .join(', ');
    const confirmUrl = `${appUrl}/api/secretary/confirm-read/${token}`;
    try {
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
      clientConfirmations.push({
        clientEmail: email,
        confirmedRead: false,
        confirmationToken: token
      });
    } catch (error) {
      console.error('Emergency vacation email failed:', error);
      emailErrors.push(email);
    }
  }

  for (const appointment of affectedAppointments) appointment.status = 'cancelled';
  bot.emergencyVacations.push({
    date: vacationDate,
    customMessage,
    messageSent: emailErrors.length === 0,
    clientConfirmations
  });
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
}

/**
 * קבלת אישור קריאת המייל מהלקוח
 */
async function confirmReadMessage(req, res) {
  const { token } = req.params;
  const bot = await SecretaryBot.findOne({
    'emergencyVacations.clientConfirmations.confirmationToken': token
  });
  if (!bot) throw httpError(404, 'הקישור שגוי או פג תוקפו');

  for (const vacation of bot.emergencyVacations) {
    const confirmation = vacation.clientConfirmations.find(item => item.confirmationToken === token);
    if (confirmation) {
      confirmation.confirmedRead = true;
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
  timeToMinutes: convertTimeToMinutes,
  minutesToTime: convertMinutesToTime,
  getBusinessAppointments,
  updateBotSettings,
  confirmReadMessage
};