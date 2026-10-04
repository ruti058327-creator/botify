const planNames = {
  starter: 'מסלול Starter בתשלום',
  pro: 'בוט מקצועי (Pro)',
  business: 'בוט עסקי (Business)',
  enterprise: 'בוט ארגוני (Enterprise)'
};
const planChangeDialog = document.getElementById('plan-change-dialog');
const planChangeMessage = document.getElementById('plan-change-message');
let pendingPlanSelection = null;

function continueToPlan(planId, price, planName, returnToCreate) {
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
    const returnParam = returnToCreate ? '&return=create-bot' : '';
    window.location.href = `payment.html?plan=${planId}&price=${price}${returnParam}`;
  } else {
    window.location.href = `register.html?plan=${planId}&price=${price}`;
  }
}

document.getElementById('cancel-plan-change').addEventListener('click', () => {
  pendingPlanSelection = null;
  planChangeDialog.close();
});

document.getElementById('confirm-plan-change').addEventListener('click', () => {
  const selection = pendingPlanSelection;
  pendingPlanSelection = null;
  planChangeDialog.close();
  if (selection) continueToPlan(...selection);
});

planChangeDialog.addEventListener('close', () => {
  pendingPlanSelection = null;
});

function choosePlan(planId, price, planName) {
  const token = localStorage.getItem('token');
  const returnToCreate = new URLSearchParams(window.location.search).get('required') === 'bot';

  if (token) {
    let currentPlanId = '';
    try {
      currentPlanId = JSON.parse(localStorage.getItem('user') || '{}').plan || '';
    } catch {
      currentPlanId = '';
    }

    if (planNames[currentPlanId] && currentPlanId !== planId) {
      const currentPlanName = planNames[currentPlanId];
      const nextPlanName = planNames[planId] || planName;
      planChangeMessage.textContent = `האם את/ה בטוח/ה שברצונך לעבור מ-${currentPlanName} ל-${nextPlanName}? המסלול החדש יופעל לאחר אישור התשלום.`;
      pendingPlanSelection = [planId, price, planName, returnToCreate];
      planChangeDialog.showModal();
      return;
    }
  }

  continueToPlan(planId, price, planName, returnToCreate);
}

window.choosePlan = choosePlan;