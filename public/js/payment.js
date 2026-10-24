/**
 * מאתחל סיכום תשלום, בודק התחברות ומחבר את פעולות האישור.
 * @returns {void} מציג את המסלול ומתקין טיפול בטופס התשלום.
 */
// ממתינים שכל שדות התשלום והסיכום יהיו זמינים לפני התקנת ההתנהגות.
document.addEventListener('DOMContentLoaded', () => {
  // קוראים פרמטרים מהכתובת ומגדירים את שמות ומחירי המסלולים המוצעים.
  const urlParams = new URLSearchParams(window.location.search);
  const plans = {
    starter: { name: 'מסלול Starter בתשלום', price: 49 },
    pro: { name: 'בוט מקצועי (Pro)', price: 149 },
    business: { name: 'בוט עסקי (Business)', price: 299 },
    enterprise: { name: 'בוט ארגוני (Enterprise)', price: 599 }
  };
  // משתמשים ב-Pro כברירת מחדל; מזהה לא מוכר נופל גם הוא למסלול Pro.
  const planId = urlParams.get('plan') || 'pro';
  const selectedPlan = plans[planId] ? { ...plans[planId], planId } : { ...plans.pro, planId: 'pro' };
  // אוספים את אסימון ההתחברות ואת רכיבי הסטטוס, הטופס ודיאלוג המחיקה.
  const token = localStorage.getItem('token');
  const statusMsg = document.getElementById('payment-status');
  const submitBtn = document.getElementById('submit-btn');
  const paymentForm = document.getElementById('payment-form');
  const botDeletionDialog = document.getElementById('bot-deletion-dialog');
  const botDeletionMessage = document.getElementById('bot-deletion-message');
  // שומרים כמה בוטים כבר אושרו למחיקה, ואת הכמות שעדיין ממתינה לאישור.
  let confirmedBotCount = Number.parseInt(urlParams.get('confirmedBotCount') || '0', 10) || 0;
  let pendingBotDeletionCount = 0;

  // מחשבים מס בשיעור 18% ומעגלים לשקל שלם לפני חישוב הסכום הסופי.
  const subtotal = selectedPlan.price;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  // מציגים למשתמש את פירוט המסלול, המחיר לפני מס, המס והסכום הכולל.
  document.getElementById('summary-plan-name').textContent = selectedPlan.name;
  document.getElementById('summary-subtotal').textContent = `₪${subtotal}`;
  document.getElementById('summary-tax').textContent = `₪${tax}`;
  document.getElementById('summary-total').textContent = `₪${total}`;

  // אין לאפשר שליחה לאורח; מציגים הודעה ומסיימים את אתחול התשלום.
  if (!token) {
    submitBtn.disabled = true;
    statusMsg.textContent = 'יש להתחבר כדי לשמור את התשלום ולהפעיל את המסלול.';
    statusMsg.className = 'status-message error';
    statusMsg.style.display = 'block';
    return;
  }

  /**
   * שולח לשרת את פרטי התשלום ואת מספר הבוטים שהמשתמש אישר להסיר.
   * @param {number} botDeletionConfirmation מספר הבוטים העודפים שאושר למחיקה.
   * @returns {Promise<void>} מפעיל מסלול או מציג בקשת אישור/שגיאה.
   */
  async function submitPayment(botDeletionConfirmation) {
    // חוסמים שליחה כפולה ומעדכנים את כפתור הטופס בזמן הפנייה לשרת.
    submitBtn.disabled = true;
    submitBtn.textContent = 'שומר תשלום...';
    // קוראים את שם בעל הכרטיס ואת ארבע הספרות האחרונות מהטופס.
    const cardholderName = document.getElementById('cardholderName').value.trim();
    const cardLast4 = document.getElementById('cardLast4').value.trim();

    try {
      const response = await ApiService.request('/api/payments', {
        // מבקשים מהשרת לשמור את התשלום, כולל פרטי המסלול ואישור מחיקת בוטים.
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: selectedPlan.planId,
          cardholderName,
          cardLast4,
          confirmedBotCount: botDeletionConfirmation
        })
      });
      // מפענחים את תשובת השרת כדי לטפל באישור, שגיאה או צורך באישור נוסף.
      const data = await response.json();
      // השרת מחזיר 409 כאשר חייבים לקבל מהמשתמש אישור למחיקת בוטים עודפים.
      if (response.status === 409 && data.code === 'BOT_DELETION_CONFIRMATION_REQUIRED') {
        pendingBotDeletionCount = data.botsToDelete;
        botDeletionMessage.textContent = data.message;
        botDeletionDialog.showModal();
        submitBtn.disabled = false;
        submitBtn.textContent = 'אישור תשלום';
        return;
      }
      // כל תשובת HTTP שנכשלה הופכת לשגיאה עם הודעת השרת או טקסט חלופי.
      if (!response.ok) throw new Error(data.message || 'לא ניתן לשמור את התשלום');

      // שומרים את המסלול החדש, תוך שימוש בבחירה המקורית אם השרת לא החזיר ערך.
      const activePlan = data.plan || selectedPlan.planId;
      localStorage.setItem('botify_user_plan', activePlan);

      try {
        // מעדכנים גם את פרופיל המשתמש המקומי כדי שהממשק יציג מיד את המסלול החדש.
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.plan = activePlan;
        localStorage.setItem('user', JSON.stringify(user));
      } catch {
        // אם הפרופיל המקומי פגום, מסירים אותו כדי לא להשאיר נתונים לא עקביים.
        localStorage.removeItem('user');
      }

      const returnTo = urlParams.get('return') === 'secretary-bots'
        ? '/pages/secretary-bots.html'
        : '/pages/dashboard.html';
      const dashboardUrl = new URL(returnTo, window.location.origin);
      dashboardUrl.searchParams.set('payment', 'success');
      if (data.removedBots) dashboardUrl.searchParams.set('removedBots', String(data.removedBots));
      window.location.replace(dashboardUrl);
    } catch (error) {
      // מציגים את סיבת הכישלון ומאפשרים למשתמש לנסות לשלוח שוב.
      statusMsg.textContent = error.message;
      statusMsg.className = 'status-message error';
      statusMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'אישור תשלום';
    }
  }

  /**
   * מונע שליחה רגילה של הטופס ומתחיל את שמירת התשלום.
   * @param {SubmitEvent} event אירוע שליחת הטופס.
   * @returns {void} מעביר את מספר האישורים לתהליך התשלום.
   */
  paymentForm.addEventListener('submit', (event) => {
    // מונעים שליחת HTML רגילה ומפעילים את פונקציית התשלום עם מספר האישור העדכני.
    event.preventDefault();
    submitPayment(confirmedBotCount);
  });

  /**
   * מבטל את בקשת אישור מחיקת הבוטים העודפים.
   * @returns {void} מאפס את המונה וסוגר את תיבת הדו-שיח.
   */
  document.getElementById('cancel-bot-deletion').addEventListener('click', () => {
    // ביטול אינו מאשר מחיקות; מאפסים את הכמות וסוגרים את החלון.
    pendingBotDeletionCount = 0;
    botDeletionDialog.close();
  });

  /**
   * מאשר את מספר הבוטים המיועדים למחיקה ומחדש את שמירת התשלום.
   * @returns {void} סוגר את תיבת הדו-שיח וממשיך את תהליך התשלום.
   */
  document.getElementById('confirm-bot-deletion').addEventListener('click', () => {
    // מעבירים לבקשה את מספר הבוטים שאושר, מנקים מצב זמני וממשיכים בתשלום.
    confirmedBotCount = pendingBotDeletionCount;
    pendingBotDeletionCount = 0;
    botDeletionDialog.close();
    submitPayment(confirmedBotCount);
  });
});
import { ApiService } from '../services/api-service.js';
