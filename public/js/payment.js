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

  paymentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitPayment(confirmedBotCount);
  });

  document.getElementById('cancel-bot-deletion').addEventListener('click', () => {
    pendingBotDeletionCount = 0;
    botDeletionDialog.close();
  });

  document.getElementById('confirm-bot-deletion').addEventListener('click', () => {
    confirmedBotCount = pendingBotDeletionCount;
    pendingBotDeletionCount = 0;
    botDeletionDialog.close();
    submitPayment(confirmedBotCount);
  });
});