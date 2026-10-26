// מודל הפניות מאפשר לקרוא ולשמור הודעות לקוחות במסד הנתונים.
import Contact from '../models/Contact.js';


/**
 * Returns all contact messages to an administrator, newest first.
 * @param {import('express').Request} req Authenticated API request.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} JSON message list.
 */
async function listAll(req, res) {
  // מחזיר את כל ההודעות כשהחדשות ביותר מוצגות ראשונות למנהל.
  const messages = await Contact.find().sort({ createdAt: -1 });
  // עוטף את הרשימה במבנה התשובה האחיד של ה-API.
  return res.json({ success: true, messages });
}

/**
 * Returns the signed-in user's contact messages, newest first.
 * @param {import('express').Request} req Authenticated request.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} JSON message list.
 */
async function listMine(req, res) {
  // מסנן לפי שם המשתמש שנקבע בבקשתו המאומתת, ולא לפי קלט חופשי מהלקוח.
  const messages = await Contact.find({ username: req.user.username }).sort({ createdAt: -1 });
  // מחזיר למשתמש רק את השיחות ששויכו לזהותו.
  return res.json({ success: true, messages });
}

/**
 * Saves a contact message for the signed-in user.
 * @param {import('express').Request} req Validated message and authenticated user.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} Confirmation response.
 */
async function create(req, res) {
  // שולף מהקלט את שדות ההודעה שהסכמה כבר אימתה.
  const { subject, message, chatId } = req.body;
  // יוצר הודעת לקוח ומשייך אותה לזהותו המאומתת ולשיחה שסופקה או לברירת מחדל.
  await new Contact({
    username: req.user.username,
    subject,
    message,
    chatId: chatId || 'chat_old_history',
    isAdmin: false
  }).save();
  // מחזיר אישור פשוט לאחר שהשמירה במסד הושלמה.
  return res.json({ success: true, message: 'ההודעה נשלחה בהצלחה' });
}

/**
 * Saves an administrator response as a new message in the customer's conversation.
 * @param {import('express').Request} req Validated reply, username, and optional chat identifier.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} Confirmation response.
 */
async function reply(req, res) {
  // מפענח את יעד התגובה ואת הטקסט שהמנהל כתב.
  const { username, chatId, reply: replyText } = req.body;
  // שומר תשובת מנהל כרשומת הודעה נפרדת באותו שרשור שיחה.
  await new Contact({
    username,
    chatId: chatId || 'chat_old_history',
    message: replyText,
    isAdmin: true
  }).save();
  // מציין ללקוח שהתגובה נשמרה בהצלחה.
  return res.json({ success: true, message: 'התגובה נשמרה בהצלחה כהודעה חדשה בשיחה' });
}

// חושף לנתבים רק את פעולות הקריאה, היצירה והמענה של בקר הפניות.
export default { listAll, listMine, create, reply };
