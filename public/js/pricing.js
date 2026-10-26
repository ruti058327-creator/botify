// מייבאים שירות בקשות כדי לבדוק מול השרת מכסה ומעבר בין מסלולים.
import { ApiService } from '../services/api-service.js';

// מתרגמים מזהי מסלולים לשמות ידידותיים לצורך הודעות האישור.
const planNames = {
  starter: 'מסלול Starter בתשלום',
  pro: 'בוט מקצועי (Pro)',
  business: 'בוט עסקי (Business)',
  enterprise: 'בוט ארגוני (Enterprise)'
};
// מאתרים מראש את רכיבי חלון האישור ואתחול מצב הבחירה הממתינה.
const planChangeDialog = document.getElementById('plan-change-dialog');
const planChangeTitle = document.getElementById('plan-change-title');
const planChangeMessage = document.getElementById('plan-change-message');
const confirmPlanChangeButton = document.getElementById('confirm-plan-change');
const cancelPlanChangeButton = document.getElementById('cancel-plan-change');
let pendingPlanSelection = null;

/**
 * שומר את בחירת המסלול ומנתב לתשלום או להרשמה בהתאם למצב ההתחברות.
 * @param {string} planId מזהה המסלול שנבחר.
 * @param {number} price מחיר המסלול לפני מס.
 * @param {string} planName שם המסלול להצגה.
 * @param {boolean} returnToCreate האם לחזור ליצירת בוט לאחר התשלום.
 * @param {number} [confirmedBotCount=0] מספר הבוטים שהמשתמש אישר להסיר.
 * @returns {void} שומר את הבחירה ומנווט לעמוד הבא.
 */
function continueToPlan(planId, price, planName, returnToCreate, confirmedBotCount = 0) {
  // שומרים פרטי מסלול וזמן בחירה כדי לשמר הקשר לפני המעבר לעמוד הבא.
  const selectedPlanData = {
    planId: planId,
    name: planName,
    price: price,
    selectedAt: new Date().toISOString()
  };

  // שומרים את הבחירה בדפדפן לשימוש בעמודי התשלום או ההרשמה.
  localStorage.setItem('botify_selected_plan', JSON.stringify(selectedPlanData));

  // בודקים אם המשתמש מחובר כדי לבחור בין תשלום מיידי להרשמה.
  const token = localStorage.getItem('token');
  if (token) {
    // פרמטר required קובע לאיזה מסך חוזרים לאחר שדרוג שהתחיל בעקבות מכסה.
    const required = new URLSearchParams(window.location.search).get('required');
    // יוצרים יעד חזרה ליצירת בוט או לניהול בוטי המזכירה, אם זה מקור המעבר.
    const returnTarget = returnToCreate ? 'create-bot' : required === 'secretary-bot' ? 'secretary-bots' : '';
    // מוסיפים פרמטרים לכתובת התשלום רק כאשר יש יעד חזרה או אישור מחיקה.
    const returnParam = returnTarget ? `&return=${returnTarget}` : '';
    const deletionParam = confirmedBotCount ? `&confirmedBotCount=${confirmedBotCount}` : '';
    // משתמש מחובר ממשיך לעמוד התשלום עם מזהה המסלול והמחיר.
    window.location.href = `payment.html?plan=${planId}&price=${price}${returnParam}${deletionParam}`;
  } else {
    // משתמש חדש ממשיך להרשמה עם הבחירה שכבר ביצע.
    window.location.href = `register.html?plan=${planId}&price=${price}`;
  }
}

/**
 * מבטל את בחירת המעבר וסוגר את תיבת האישור.
 * @returns {void} מאפס את הבחירה הממתינה.
 */
document.getElementById('cancel-plan-change').addEventListener('click', () => {
  // מבטלים את הבחירה שנשמרה ומסיימים את הדו-שיח בלי להמשיך.
  pendingPlanSelection = null;
  planChangeDialog.close();
});

/**
 * מאשר מעבר למסלול וממשיך לתהליך ההרשמה או התשלום.
 * @returns {void} מנקה מצב זמני ומבצע את הבחירה שאושרה.
 */
document.getElementById('confirm-plan-change').addEventListener('click', () => {
  // מעתיקים את הנתונים לפני איפוסם, סוגרים את החלון ומבצעים בחירה קיימת.
  const selection = pendingPlanSelection;
  pendingPlanSelection = null;
  planChangeDialog.close();
  // ממשיכים רק אם נשמרה בחירה; סגירה ללא בחירה אינה מפעילה ניווט.
  if (selection) continueToPlan(...selection);
});

/**
 * מאפס את כותרות וכפתורי הדו-שיח לאחר סגירתו.
 * @returns {void} משחזר את מצב ברירת המחדל של חלון האישור.
 */
planChangeDialog.addEventListener('close', () => {
  // בכל סגירה מנקים בחירה ישנה ומשחזרים את כותרות וכיתובי ברירת המחדל.
  pendingPlanSelection = null;
  planChangeTitle.textContent = 'אישור החלפת מסלול';
  confirmPlanChangeButton.hidden = false;
  confirmPlanChangeButton.textContent = 'המשך לתשלום';
  cancelPlanChangeButton.textContent = 'ביטול';
});

/**
 * מתחיל בחירת מסלול, תוך בדיקת המכסה והמסלול הפעיל למשתמש מחובר.
 * @param {string} planId מזהה המסלול.
 * @param {number} price מחיר המסלול.
 * @param {string} planName שם המסלול לתצוגה.
 * @returns {void} מציג אישור מעבר או ממשיך למסלול שנבחר.
 */
function choosePlan(planId, price, planName) {
  // מזהים התחברות וגם האם המשתמש הגיע בעקבות דרישה ליצור בוט.
  const token = localStorage.getItem('token');
  // דף תמחור שנפתח בגלל מכסת יצירת בוט יחזיר משתמש למסך יצירת הבוט לאחר התשלום.
  const returnToCreate = new URLSearchParams(window.location.search).get('required') === 'bot';

  if (token) {
    // קוראים את המסלול הנוכחי מהפרופיל המקומי; JSON לא תקין נחשב לחוסר מידע.
    let currentPlanId = '';
    try {
      currentPlanId = JSON.parse(localStorage.getItem('user') || '{}').plan || '';
    } catch {
      currentPlanId = '';
    }

    // מחוברים צריכים לבדוק מכסה ומעבר לפני הצגת מסלול התשלום.
    checkPlanChange(planId, price, planName, returnToCreate, currentPlanId);
    return;
  }

  // משתמש שאינו מחובר עדיין יכול להמשיך למסלול ההרשמה.
  continueToPlan(planId, price, planName, returnToCreate);
}

/**
 * בודק מול השרת את המכסה במסלול ומבקש אישור לפני מחיקה או החלפה.
 * @param {string} planId מזהה המסלול החדש.
 * @param {number} price מחיר המסלול.
 * @param {string} planName שם המסלול לתצוגה.
 * @param {boolean} returnToCreate האם לחזור ליצירת בוט לאחר התשלום.
 * @param {string} currentPlanId מזהה המסלול המקומי הפעיל.
 * @returns {Promise<void>} מציג את פרטי המעבר או ממשיך לתשלום.
 */
async function checkPlanChange(planId, price, planName, returnToCreate, currentPlanId) {
  // מכסה תישאר null אם השרת אינו זמין, כדי שאפשר יהיה להמשיך לפי המידע המקומי.
  let quota = null;
  try {
    // מבקשים את פרטי המכסה למסלול החדש ושולחים את אסימון המשתמש.
    const token = localStorage.getItem('token');
    const response = await ApiService.request(`/api/bots/quota?planId=${encodeURIComponent(planId)}`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    // משתמשים בתשובת המכסה רק כשהשרת אישר את הבקשה.
    // שומרים נתוני מכסה רק בתשובת HTTP מוצלחת, אחרת משתמשים בהמשך בגיבוי המקומי.
    if (response.ok) quota = await response.json();
  } catch {
    // במקרה של תקלה בבדיקת המכסה ממשיכים עם מידע ברירת המחדל.
    quota = null;
  }

  // מעדיפים את המסלול שהשרת מאשר; אחרת נשענים על המסלול המקומי.
  const activePlanId = planNames[quota?.planId] ? quota.planId : currentPlanId;
  // בחירת אותו מסלול אינה נחשבת לשדרוג, ולכן מסבירים זאת בחלון ללא אפשרות תשלום.
  if (planNames[activePlanId] && activePlanId === planId) {
    // בחירה של אותו מסלול אינה דורשת תשלום; מציגים הסבר בלבד.
    planChangeTitle.textContent = 'את/ה כבר במסלול הזה';
    planChangeMessage.textContent = `החשבון שלך כבר נמצא במסלול ${planNames[planId]}. כדי לקבל מכסת בוטים גדולה יותר, יש לבחור מסלול אחר. לא תישלח בקשת תשלום.`;
    confirmPlanChangeButton.hidden = true;
    cancelPlanChangeButton.textContent = 'הבנתי';
    pendingPlanSelection = null;
    planChangeDialog.showModal();
    return;
  }

  // מחשבים אם המעבר משנה מסלול והאם הוא מחייב הסרת בוטים מעבר למכסה.
  const botsToDelete = quota?.botsToDelete || 0;
  const isPlanChange = Boolean(planNames[activePlanId] && activePlanId !== planId);
  // נדרשת תיבת אישור כאשר זו החלפת מסלול או כשהשרת מצא בוטים מעבר למכסה.
  if (isPlanChange || botsToDelete > 0) {
    // בונים הודעת אישור בהתאם למעבר ולמחיקות שהשרת חישב.
    const nextPlanName = planNames[planId] || planName;
    const messages = [];

    if (isPlanChange) {
      // במקרה של שינוי מסלול, מציגים את המסלול הקיים ואת זה שהמשתמש ביקש.
      messages.push(`האם את/ה בטוח/ה שברצונך לעבור מ-${planNames[activePlanId]} ל-${nextPlanName}?`);
    } else {
      // במסלול חדש ללא שינוי קיים מסבירים שהפעלתו תתרחש לאחר התשלום.
      messages.push(`המסלול ${nextPlanName} יופעל לאחר אישור התשלום.`);
    }
    if (botsToDelete > 0) {
      // מפרטים את המכסה ואת מספר הבוטים הישנים שיוסרו, כדי שהמשתמש ידע את השלכות האישור.
      messages.push(`המכסה במסלול היא ${quota.targetBotLimit} בוטים. ${botsToDelete} הבוטים הוותיקים ביותר יימחקו לצמיתות.`);
    }
    // מוסיפים שאלת אישור לסיום ההודעה שמורכבת מהשלכות המעבר.
    messages.push('המשך לתשלום?');

    // מציגים את ההשלכות ושומרים את הפרטים עד שהמשתמש יאשר או יבטל.
    planChangeTitle.textContent = 'אישור החלפת מסלול';
    confirmPlanChangeButton.hidden = false;
    confirmPlanChangeButton.textContent = 'המשך לתשלום';
    cancelPlanChangeButton.textContent = 'ביטול';
    planChangeMessage.textContent = messages.join(' ');
    pendingPlanSelection = [planId, price, planName, returnToCreate, botsToDelete];
    planChangeDialog.showModal();
    return;
  }

  // אם אין מעבר מסלול או מחיקות נדרשות, עוברים ישירות לתשלום.
  continueToPlan(planId, price, planName, returnToCreate);
}

// חושפים את פונקציית הבחירה כגלובלית כדי שכפתורי המסלול שב-HTML יוכלו להפעיל אותה.
window.choosePlan = choosePlan;
