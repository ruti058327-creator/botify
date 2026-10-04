/**
 * מאתחל סיכום תשלום, בודק התחברות ומחבר את פעולות האישור.
 * @returns {void} מציג את המסלול ומתקין טיפול בטופס התשלום.
 */
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const plans = {
    starter: { name: 'מסלול Starter בתשלום', price: 49 },
    pro: { name: 'בוט מקצועי (Pro)', price: 149 },
    business: { name: 'בוט עסקי (Business)', price: 299 },
    enterprise: { name: 'בוט ארגוני (Enterprise)', price: 599 }
  };
  const planId = urlParams.get('plan') || 'pro';
  const selectedPlan = plans[planId] ? { ...plans[planId], planId } : { ...plans.pro, planId: 'pro' };
  const token = localStorage.getItem('token');
  const statusMsg = document.getElementById('payment-status');
  const submitBtn = document.getElementById('submit-btn');
  const paymentForm = document.getElementById('payment-form');
  const botDeletionDialog = document.getElementById('bot-deletion-dialog');
  const botDeletionMessage = document.getElementById('bot-deletion-message');
  let confirmedBotCount = Number.parseInt(urlParams.get('confirmedBotCount') || '0', 10) || 0;
  let pendingBotDeletionCount = 0;

  const subtotal = selectedPlan.price;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  document.getElementById('summary-plan-name').textContent = selectedPlan.name;
  document.getElementById('summary-subtotal').textContent = `₪${subtotal}`;
  document.getElementById('summary-tax').textContent = `₪${tax}`;
  document.getElementById('summary-total').textContent = `₪${total}`;

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
    submitBtn.disabled = true;
    submitBtn.textContent = 'שומר תשלום...';
    const cardholderName = document.getElementById('cardholderName').value.trim();
    const cardLast4 = document.getElementById('cardLast4').value.trim();

    try {
      const response = await ApiService.request('/api/payments', {
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
      const data = await response.json();
      if (response.status === 409 && data.code === 'BOT_DELETION_CONFIRMATION_REQUIRED') {
        pendingBotDeletionCount = data.botsToDelete;
        botDeletionMessage.textContent = data.message;
        botDeletionDialog.showModal();
        submitBtn.disabled = false;
        submitBtn.textContent = 'אישור תשלום';
        return;
      }
      if (!response.ok) throw new Error(data.message || 'לא ניתן לשמור את התשלום');

      const activePlan = data.plan || selectedPlan.planId;
      localStorage.setItem('botify_user_plan', activePlan);

      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.plan = activePlan;
        localStorage.setItem('user', JSON.stringify(user));
      } catch {
        localStorage.removeItem('user');
      }

      const dashboardUrl = new URL('/pages/dashboard.html', window.location.origin);
      dashboardUrl.searchParams.set('payment', 'success');
      if (data.removedBots) dashboardUrl.searchParams.set('removedBots', String(data.removedBots));
      window.location.replace(dashboardUrl);
    } catch (error) {
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
    event.preventDefault();
    submitPayment(confirmedBotCount);
  });

  /**
   * מבטל את בקשת אישור מחיקת הבוטים העודפים.
   * @returns {void} מאפס את המונה וסוגר את תיבת הדו-שיח.
   */
  document.getElementById('cancel-bot-deletion').addEventListener('click', () => {
    pendingBotDeletionCount = 0;
    botDeletionDialog.close();
  });

  /**
   * מאשר את מספר הבוטים המיועדים למחיקה ומחדש את שמירת התשלום.
   * @returns {void} סוגר את תיבת הדו-שיח וממשיך את תהליך התשלום.
   */
  document.getElementById('confirm-bot-deletion').addEventListener('click', () => {
    confirmedBotCount = pendingBotDeletionCount;
    pendingBotDeletionCount = 0;
    botDeletionDialog.close();
    submitPayment(confirmedBotCount);
  });
});