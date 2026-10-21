import Contact from '../models/Contact.js';


/**
 * Returns all contact messages to an administrator, newest first.
 * @param {import('express').Request} req Authenticated API request.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} JSON message list.
 */
async function listAll(req, res) {
  const messages = await Contact.find().sort({ createdAt: -1 });
  return res.json({ success: true, messages });
}

/**
 * Returns the signed-in user's contact messages, newest first.
 * @param {import('express').Request} req Authenticated request.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} JSON message list.
 */
async function listMine(req, res) {
  const messages = await Contact.find({ username: req.user.username }).sort({ createdAt: -1 });
  return res.json({ success: true, messages });
}

/**
 * Saves a contact message for the signed-in user.
 * @param {import('express').Request} req Validated message and authenticated user.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} Confirmation response.
 */
async function create(req, res) {
  const { subject, message, chatId } = req.body;
  await new Contact({
    username: req.user.username,
    subject,
    message,
    chatId: chatId || 'chat_old_history',
    isAdmin: false
  }).save();
  return res.json({ success: true, message: 'ההודעה נשלחה בהצלחה' });
}

/**
 * Saves an administrator response as a new message in the customer's conversation.
 * @param {import('express').Request} req Validated reply, username, and optional chat identifier.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} Confirmation response.
 */
async function reply(req, res) {
  const { username, chatId, reply: replyText } = req.body;
  await new Contact({
    username,
    chatId: chatId || 'chat_old_history',
    message: replyText,
    isAdmin: true
  }).save();
  return res.json({ success: true, message: 'התגובה נשמרה בהצלחה כהודעה חדשה בשיחה' });
}

export default { listAll, listMine, create, reply };
