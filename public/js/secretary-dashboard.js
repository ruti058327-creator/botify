document.getElementById('secretaryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const messageDiv = document.getElementById('message');
  
const payload = {
  botUrlKey: document.getElementById('botUrlKey').value.trim(),
  dayOff: document.getElementById('dayOff').value,
  openTime: document.getElementById('openTime').value,
  closeTime: document.getElementById('closeTime').value,
  defaultPrice: Number(document.getElementById('defaultPrice').value),
  appointmentDurationMinutes: Number(document.getElementById('appointmentDurationMinutes').value),
  breakDurationMinutes: Number(document.getElementById('breakDurationMinutes').value)
};

  // שליפת הטוקן של המשתמש המחובר מתוך ה-Local Storage
  const token = localStorage.getItem('token') || localStorage.getItem('jwtToken');
  if (!token) {
    messageDiv.style.color = '#dc2626';
    messageDiv.textContent = 'שגיאה: אינך מחובר למערכת. נא להתחבר מחדש.';
    return;
  }

  try {
    const response = await fetch('/api/secretary/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.success) {
      messageDiv.style.color = '#16a34a';
      messageDiv.textContent = 'ההגדרות נשמרו בהצלחה! מעביר לרשימת הבוטים...';
      window.setTimeout(() => {
        window.location.href = 'secretary-bots.html';
      }, 700);
    } else if (data.code === 'SECRETARY_BOT_LIMIT_REACHED') {
      window.location.href = data.pricingUrl || '/pages/pricing.html?required=secretary-bot';
    } else {
      messageDiv.style.color = '#dc2626';
      messageDiv.textContent = data.message || 'שגיאה בשמירת הנתונים';
    }
  } catch (err) {
    messageDiv.style.color = '#dc2626';
    messageDiv.textContent = 'שגיאת תקשורת מול השרת';
  }
}); 