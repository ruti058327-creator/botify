document.addEventListener('DOMContentLoaded', () => {
  // 1. שליפת פרטי המסלול שנבחר (מ-URL או מ-localStorage)
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

  // 2. חישוב מחירים ומע"מ
  const subtotal = selectedPlan.price;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  // 3. הצגת הנתונים בסיכום ההזמנה
  document.getElementById('summary-plan-name').textContent = selectedPlan.name;
  document.getElementById('summary-subtotal').textContent = `₪${subtotal}`;
  document.getElementById('summary-tax').textContent = `₪${tax}`;
  document.getElementById('summary-total').textContent = `₪${total}`;

  // 4. טיפול בלחיצה על אישור תשלום
  const paymentForm = document.getElementById('payment-form');
  const statusMsg = document.getElementById('payment-status');
  const submitBtn = document.getElementById('submit-btn');

  paymentForm.addEventListener('submit', (e) => {
    e.preventDefault();

    submitBtn.disabled = true;
    submitBtn.textContent = 'מעבד תשלום מאובטח...';

    // הדמיית תהליך סליקה
    setTimeout(() => {
      // שמירת סטטוס המנוי המאושר
      localStorage.setItem('botify_user_plan', selectedPlan.planId);
      localStorage.setItem('botify_payment_success', 'true');

      statusMsg.textContent = '✓ התשלום בוצע בהצלחה! מעביר אותך ללוח הבקרה...';
      statusMsg.className = 'status-message success';

      // ניתוב ללוח הבקרה של המשתמש
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1500);
    }, 1200);
  });
});