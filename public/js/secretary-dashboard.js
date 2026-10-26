// מאזינים לשליחת טופס ההגדרה כדי לשמור את פרטי בוט המזכירה בלי לרענן את הדף.
document.getElementById('secretaryForm').addEventListener('submit', async (e) => {
  // מונעים מהדפדפן לבצע שליחת טופס רגילה, שתגרום לטעינה מחדש לפני הצגת התוצאה.
  e.preventDefault();
  // שומרים הפניה לאזור שבו יוצגו הצלחה, שגיאה או קישור הבוט לאחר השמירה.
  const messageDiv = document.getElementById('message');
  
// אוספים את הערכים שהוזנו בטופס וממירים שדות מספריים ממחרוזת למספר לפני שליחתם.
const payload = {
  // מפתח הכתובת של הבוט מנוקה מרווחים כדי לשמש באופן עקבי בכתובות ובשרת.
  botUrlKey: document.getElementById('botUrlKey').value.trim(),
  // יום המנוחה ושעות הפעילות נשמרים כערכי הטופס שהמשתמש בחר.
  dayOff: document.getElementById('dayOff').value,
  openTime: document.getElementById('openTime').value,
  closeTime: document.getElementById('closeTime').value,
  // המחיר ומשך התור וההפסקה מומרִים למספרים כדי שהשרת יקבל ערכים מספריים.
  defaultPrice: Number(document.getElementById('defaultPrice').value),
  appointmentDurationMinutes: Number(document.getElementById('appointmentDurationMinutes').value),
  breakDurationMinutes: Number(document.getElementById('breakDurationMinutes').value)
};

  // קוראים אסימון התחברות; השם החלופי מאפשר תמיכה בדפים ישנים ששמרו אותו כמפתח jwtToken.
  const token = localStorage.getItem('token') || localStorage.getItem('jwtToken');
  // בלי אסימון אין דרך לזהות את בעל הבוט, ולכן לא שולחים בקשת הגדרה לשרת.
  if (!token) {
    // מסמנים את ההודעה כשגיאה ומסבירים למשתמש שעליו להתחבר מחדש.
    messageDiv.style.color = '#dc2626';
    messageDiv.textContent = 'שגיאה: אינך מחובר למערכת. נא להתחבר מחדש.';
    return;
  }

  // מגישים את פרטי הבוט לשרת בבקשת POST ומעבירים את האסימון לצורך אימות המשתמש.
  try {
    const response = await fetch('/api/secretary/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    // מפענחים את גוף התשובה כדי לדעת אם הבוט נוצר או שהשרת החזיר סיבה לכישלון.
    const data = await response.json();
    // מציגים קישור שימושי רק כאשר השרת מאשר במפורש שהפעולה הסתיימה בהצלחה.
    if (data.success) {
      // מעדיפים קישור שהשרת סיפק; אם אינו קיים, בונים קישור מהדומיין ומפתח הבוט.
      const bookingUrl = data.bookingUrl || new URL(
        `/client-booking.html?bot=${encodeURIComponent(data.bot.botUrlKey)}`,
        window.location.origin
      ).href;
      // יוצרים הודעת הצלחה כרכיב טקסט, בלי לפרש את תוכן ההודעה כ-HTML.
      const successMessage = document.createElement('p');
      successMessage.textContent = 'הבוט נוצר בהצלחה, העתק את הקישור המופיע למטה לאתר שלך כדי להפוך אותו זמין ללקוחות';
      // יוצרים קישור לפתיחת מסך קביעת התור בחלון חדש, עם הגנת noopener.
      const bookingLink = document.createElement('a');
      bookingLink.href = bookingUrl;
      bookingLink.target = '_blank';
      bookingLink.rel = 'noopener noreferrer';
      bookingLink.textContent = bookingUrl;
      // יוצרים כפתור העתקה נפרד, שאינו שולח את טופס ההגדרה בלחיצה עליו.
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = 'העתקת הקישור';
      // אזור סטטוס נגיש מאפשר לקוראי מסך להודיע אם ההעתקה הצליחה או נכשלה.
      const copyStatus = document.createElement('span');
      copyStatus.setAttribute('role', 'status');
      copyStatus.setAttribute('aria-live', 'polite');
      // מנסים להעתיק ללוח; במקרה של הצלחה משנים את הכיתוב, ובכישלון נותנים הוראות ידניות.
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
      // מוסיפים גם קישור לעמוד שבו ניתן לצפות ולנהל את הבוטים שכבר נוצרו.
      const botsLink = document.createElement('a');
      botsLink.href = 'secretary-bots.html';
      botsLink.textContent = 'לרשימת הבוטים הפעילים';
      // מחליפים את התוכן הקודם ברכיבי ההצלחה, ואז צובעים את אזור ההודעה בירוק.
      messageDiv.replaceChildren(successMessage, bookingLink, copyButton, copyStatus, botsLink);
      messageDiv.style.color = '#16a34a';
    // אם מכסת הבוטים הסתיימה, מעבירים את המשתמש לעמוד התמחור הרלוונטי.
    } else if (data.code === 'SECRETARY_BOT_LIMIT_REACHED') {
      window.location.href = data.pricingUrl || '/pages/pricing.html?required=secretary-bot';
    // בשגיאות אחרות מציגים את ההודעה מהשרת או נוסח כללי אם לא נשלחה הודעה.
    } else {
      messageDiv.style.color = '#dc2626';
      messageDiv.textContent = data.message || 'שגיאה בשמירת הנתונים';
    }
  // כשל רשת או שגיאה בפענוח התשובה יוצגו כשגיאת תקשורת למשתמש.
  } catch (err) {
    messageDiv.style.color = '#dc2626';
    messageDiv.textContent = 'שגיאת תקשורת מול השרת';
  }
}); 