import Bot from '../models/Bot.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { PLANS, getBotLimit } from '../utils/plans.js';
import httpError from '../utils/httpError.js';

export async function createPayment(req, res) {
  const { planId, cardholderName, cardLast4, confirmedBotCount } = req.body;
  const selectedPlan = PLANS[planId];
  const user = await User.findById(req.user.id);
  if (!user) throw httpError(401, 'יש להתחבר מחדש כדי להמשיך');

  const activePayment = await Payment.findOne({ userId: user._id, status: 'completed' })
    .sort({ createdAt: -1 })
    .select('planId');
  if (activePayment?.planId === planId) {
    throw httpError(409, `החשבון שלך כבר נמצא במסלול ${planId}. לא נרשם תשלום נוסף.`, {
      code: 'PLAN_ALREADY_ACTIVE'
    });
  }

  const botIds = await Bot.find({ userId: user._id })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id')
    .lean();
  const botLimit = getBotLimit(planId);
  const botsToDelete = botIds.slice(0, Math.max(0, botIds.length - botLimit));
  if (botsToDelete.length && confirmedBotCount !== botsToDelete.length) {
    throw httpError(
      409,
      `המסלול כולל עד ${botLimit === Infinity ? 'ללא הגבלה' : botLimit} בוטים. כדי להשלים את המעבר יימחקו ${botsToDelete.length} הבוטים הוותיקים ביותר. יש לאשר כדי להמשיך.`,
      {
        code: 'BOT_DELETION_CONFIRMATION_REQUIRED',
        botsToDelete: botsToDelete.length,
        targetBotLimit: botLimit
      }
    );
  }

  const payment = await Payment.create({
    userId: user._id,
    fullName: user.fullName || user.username,
    email: user.email,
    cardholderName,
    cardLast4,
    planId,
    amount: Math.round(selectedPlan.price * 1.18),
    mode: 'recorded',
    status: 'completed'
  });
  user.plan = planId;
  await user.save();
  if (botsToDelete.length) {
    await Bot.deleteMany({ _id: { $in: botsToDelete.map(bot => bot._id) }, userId: user._id });
  }

  return res.status(201).json({
    success: true,
    message: 'התשלום נשמר במסד הנתונים והמסלול הופעל.',
    plan: planId,
    removedBots: botsToDelete.length,
    paymentId: payment._id
  });
}

export default { createPayment };
