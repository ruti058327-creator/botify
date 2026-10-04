const planNames = {
  starter: 'מסלול Starter בתשלום',
  pro: 'בוט מקצועי (Pro)',
  business: 'בוט עסקי (Business)',
  enterprise: 'בוט ארגוני (Enterprise)'
};
const planChangeDialog = document.getElementById('plan-change-dialog');
const planChangeTitle = document.getElementById('plan-change-title');
const planChangeMessage = document.getElementById('plan-change-message');
const confirmPlanChangeButton = document.getElementById('confirm-plan-change');
const cancelPlanChangeButton = document.getElementById('cancel-plan-change');
let pendingPlanSelection = null;

function continueToPlan(planId, price, planName, returnToCreate, confirmedBotCount = 0) {
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
    const deletionParam = confirmedBotCount ? `&confirmedBotCount=${confirmedBotCount}` : '';
    window.location.href = `payment.html?plan=${planId}&price=${price}${returnParam}${deletionParam}`;
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
  planChangeTitle.textContent = 'אישור החלפת מסלול';
  confirmPlanChangeButton.hidden = false;
  confirmPlanChangeButton.textContent = 'המשך לתשלום';
  cancelPlanChangeButton.textContent = 'ביטול';
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

    checkPlanChange(planId, price, planName, returnToCreate, currentPlanId);
    return;
  }

  continueToPlan(planId, price, planName, returnToCreate);
}

async function checkPlanChange(planId, price, planName, returnToCreate, currentPlanId) {
  let quota = null;
  try {
    const token = localStorage.getItem('token');
    const response = await ApiService.request(`/api/bots/quota?planId=${encodeURIComponent(planId)}`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (response.ok) quota = await response.json();
  } catch {
    quota = null;
  }

  const activePlanId = planNames[quota?.planId] ? quota.planId : currentPlanId;
  if (planNames[activePlanId] && activePlanId === planId) {
    planChangeTitle.textContent = 'את/ה כבר במסלול הזה';
    planChangeMessage.textContent = `החשבון שלך כבר נמצא במסלול ${planNames[planId]}. כדי לקבל מכסת בוטים גדולה יותר, יש לבחור מסלול אחר. לא תישלח בקשת תשלום.`;
    confirmPlanChangeButton.hidden = true;
    cancelPlanChangeButton.textContent = 'הבנתי';
    pendingPlanSelection = null;
    planChangeDialog.showModal();
    return;
  }

  const botsToDelete = quota?.botsToDelete || 0;
  const isPlanChange = Boolean(planNames[activePlanId] && activePlanId !== planId);
  if (isPlanChange || botsToDelete > 0) {
    const nextPlanName = planNames[planId] || planName;
    const messages = [];

    if (isPlanChange) {
      messages.push(`האם את/ה בטוח/ה שברצונך לעבור מ-${planNames[activePlanId]} ל-${nextPlanName}?`);
    } else {
      messages.push(`המסלול ${nextPlanName} יופעל לאחר אישור התשלום.`);
    }
    if (botsToDelete > 0) {
      messages.push(`המכסה במסלול היא ${quota.targetBotLimit} בוטים. ${botsToDelete} הבוטים הוותיקים ביותר יימחקו לצמיתות.`);
    }
    messages.push('המשך לתשלום?');

    planChangeTitle.textContent = 'אישור החלפת מסלול';
    confirmPlanChangeButton.hidden = false;
    confirmPlanChangeButton.textContent = 'המשך לתשלום';
    cancelPlanChangeButton.textContent = 'ביטול';
    planChangeMessage.textContent = messages.join(' ');
    pendingPlanSelection = [planId, price, planName, returnToCreate, botsToDelete];
    planChangeDialog.showModal();
    return;
  }

  continueToPlan(planId, price, planName, returnToCreate);
}

window.choosePlan = choosePlan;