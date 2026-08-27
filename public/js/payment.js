document.addEventListener('DOMContentLoaded', () => {
  // 1. שליפת פרטי המסלול
  const urlParams = new URLSearchParams(window.location.search);
  const planParam = urlParams.get('plan');
  const priceParam = urlParams.get('price');

  let selectedPlan = {
    name: 'בוט מקצועי (Pro)',
    price: 149,
    planId: 'pro'
  };

  if (priceParam && planParam) {
    selectedPlan.planId = planParam;
    selectedPlan.price = parseFloat(priceParam);
    selectedPlan.name = planParam.toUpperCase();
  } else {
    const savedPlan = localStorage.getItem('botify_selected_plan');
    if (savedPlan) {
      selectedPlan = JSON.parse(savedPlan);
    }
  }

  // 2. חישוב מחירים
  const subtotal = selectedPlan.price;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  // 3. הצגת נתונים בסיכום (תוקן לגרשים הפוכים)
  document.getElementById('summary-plan-name').textContent = selectedPlan.name;
  document.getElementById('summary-subtotal').textContent = `₪${subtotal}`;
  document.getElementById('summary-tax').textContent = `₪${tax}`;
  document.getElementById('summary-total').textContent = `₪${total}`;

  // 4. שליחת הטופס לשרת
  const paymentForm = document.getElementById('payment-form');
  const statusMsg = document.getElementById('payment-status');
  const submitBtn = document.getElementById('submit-btn');

  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = 'שומר נתונים ומבצע חיוב...';

    try {
      // שליחת בקשת POST לשרת
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: fullName,
          email: email,
          planId: selectedPlan.planId,
          amount: total
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'אירעה שגיאה בביצוע התשלום');
      }

      // הצלחה
      statusMsg.textContent = '✓ התשלום נשמר בהצלחה במסד הנתונים! מעביר ללוח הבקרה...';
      statusMsg.className = 'status-message success';
      statusMsg.style.display = 'block';

      localStorage.setItem('botify_user_plan', selectedPlan.planId);

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1500);

    } catch (error) {
      // תוקן לגרשים הפוכים
      statusMsg.textContent = `❌ ${error.message}`;
      statusMsg.className = 'status-message error';
      statusMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'אישור תשלום והפעלת הבוט 🔒';
    }
  });
});