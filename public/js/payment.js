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

  const subtotal = selectedPlan.price;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  document.getElementById('summary-plan-name').textContent = selectedPlan.name;
  document.getElementById('summary-subtotal').textContent = `₪${subtotal}`; // תוקן לגרש הפוך
  document.getElementById('summary-tax').textContent = `₪${tax}`; // תוקן לגרש הפוך
  document.getElementById('summary-total').textContent = `₪${total}`; // תוקן לגרש הפוך

  if (!token) {
    submitBtn.disabled = true;
    statusMsg.textContent = 'יש להתחבר כדי לשמור את התשלום ולהפעיל את המסלול.';
    statusMsg.className = 'status-message error';
    statusMsg.style.display = 'block';
    return;
  }

  paymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'שומר תשלום...';
    const cardholderName = document.getElementById('cardholderName').value.trim();
    const cardLast4 = document.getElementById('cardLast4').value.trim();

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // תוקן לגרש הפוך
        },
        body: JSON.stringify({ planId: selectedPlan.planId, cardholderName, cardLast4 })
      });
      const data = await response.json();
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

      window.location.replace('/pages/dashboard.html?payment=success');
    } catch (error) {
      statusMsg.textContent = error.message;
      statusMsg.className = 'status-message error';
      statusMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'אישור תשלום';
    }
  });
});