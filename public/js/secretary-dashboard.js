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
      const bookingUrl = data.bookingUrl || new URL(
        `/client-booking.html?bot=${encodeURIComponent(data.bot.botUrlKey)}`,
        window.location.origin
      ).href;
      const successMessage = document.createElement('p');
      successMessage.textContent = 'הבוט נוצר בהצלחה, העתק את הקישור המופיע למטה לאתר שלך כדי להפוך אותו זמין ללקוחות';
      const bookingLink = document.createElement('a');
      bookingLink.href = bookingUrl;
      bookingLink.target = '_blank';
      bookingLink.rel = 'noopener noreferrer';
      bookingLink.textContent = bookingUrl;
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = 'העתקת הקישור';
      const copyStatus = document.createElement('span');
      copyStatus.setAttribute('role', 'status');
      copyStatus.setAttribute('aria-live', 'polite');
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(bookingUrl);
          copyButton.textContent = 'הקישור הועתק';
          copyStatus.textContent = '';
        } catch {
          copyStatus.textContent = 'לא ניתן להעתיק אוטומטית. אפשר לסמן ולהעתיק את הקישור שמופיע למעלה.';
          copyStatus.style.color = '#dc2626';
        }
      });
      const botsLink = document.createElement('a');
      botsLink.href = 'secretary-bots.html';
      botsLink.textContent = 'לרשימת הבוטים הפעילים';
      messageDiv.replaceChildren(successMessage, bookingLink, copyButton, copyStatus, botsLink);
      messageDiv.style.color = '#16a34a';
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