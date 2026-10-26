// המודלים מתעדים את הרכישה ומאפשרים להתאים את מכסת הבוטים למנוי.
import Bot from '../models/Bot.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { PLANS, getBotLimit } from '../utils/plans.js';
import httpError from '../utils/httpError.js';

export async function createPayment(req, res) {
  // קלט התשלום כבר עבר אימות בסכמת הנתיב; מחיר המסלול נלקח מהגדרות השרת.
  const { planId, cardholderName, cardLast4, confirmedBotCount } = req.body;
  // פרטי המחיר והמכסה נלקחים ממיפוי התוכניות המקומי, לא מהמחיר שסיפק הלקוח.
  const selectedPlan = PLANS[planId];
  // מאתרים את המשתמש לפי המזהה שנלקח מאסימון ההתחברות המאומת.
  const user = await User.findById(req.user.id);
  if (!user) throw httpError(401, 'יש להתחבר מחדש כדי להמשיך');

  // מזהים אם יש כבר תשלום מוצלח למסלול הנבחר כדי למנוע חיוב כפול.
  const activePayment = await Payment.findOne({ userId: user._id, status: 'completed' })
    .sort({ createdAt: -1 })
    .select('planId');
  if (activePayment?.planId === planId) {
    throw httpError(409, `החשבון שלך כבר נמצא במסלול ${planId}. לא נרשם תשלום נוסף.`, {
      code: 'PLAN_ALREADY_ACTIVE'
    });
  }

  // שולפים מזהי בוטים בסדר יצירה כדי לחשב אילו ישנים חורגים מהמכסה החדשה.
  const botIds = await Bot.find({ userId: user._id })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id')
    .lean();
  const botLimit = getBotLimit(planId);
  // במקרה של חריגה, רשימת הפריטים הראשונים בסדר היא אלה שיוסרו.
  const botsToDelete = botIds.slice(0, Math.max(0, botIds.length - botLimit));
  // דורשים הסכמה מפורשת לכמות המחיקות, כדי להימנע ממחיקה לא צפויה בעת מעבר מסלול.
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

  // רושמים תשלום במצב recorded; הסכום מחושב בצד השרת כולל 18% מס.
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
  // מעדכנים את המסלול בחשבון ושומרים אותו לפני השלמת פעולת ההסרה.
  user.plan = planId;
  await user.save();
  // מוחקים רק את הבוטים ששייכים למשתמש ושנכללו בחישוב החריגה.
  if (botsToDelete.length) {
    await Bot.deleteMany({ _id: { $in: botsToDelete.map(bot => bot._id) }, userId: user._id });
  }

  // מחזירים ללקוח אישור, מזהה הרכישה ומספר הבוטים שהוסרו.
  return res.status(201).json({
    success: true,
    message: 'התשלום נשמר במסד הנתונים והמסלול הופעל.',
    plan: planId,
    removedBots: botsToDelete.length,
    paymentId: payment._id
  });
}

export default { createPayment };
