// פונקציית בחירת מסלול ומעבר לשלב התשלום / הרשמה
function choosePlan(planId, price, planName) {
  // 1. שמירת הבחירה בזיכרון המקומי של הדפדפן
  const selectedPlanData = {
    planId: planId,
    name: planName,
    price: price,
    selectedAt: new Date().toISOString()
  };

  localStorage.setItem('botify_selected_plan', JSON.stringify(selectedPlanData));

  // 2. בדיקה האם המשתמש כבר מחובר (יש לו Token)
  const token = localStorage.getItem('token');

  if (token) {
    // אם המשתמש כבר מחובר - מעבירים אותו ישירות לדף התשלום
    window.location.href = payment.html?plan=${planId}&price=${price};
  } else {
    // אם המשתמש חדש - מעבירים אותו להרשמה שתוביל ישירות לתשלום
    window.location.href = register.html?plan=${planId}&price=${price};
  }
}