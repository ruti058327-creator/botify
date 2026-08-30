document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('auth-buttons-container');
  const welcomeTitle = document.getElementById('welcome-title');

  if (!authContainer) return;

  // שליפת נתוני המשתמש מתוך הזיכרון המקומי
  const storedUser = localStorage.getItem('user');

  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      const username = userData.username || userData.fullName || 'משתמש';

      // עדכון כותרת ראשית בדף עם שם המשתמש
      if (welcomeTitle) {
        welcomeTitle.textContent = `שלום, ${username}!`;
      }

      // הזרקת עיצוב הכפתורים ושם המשתמש לסרגל הניווט (במקום התחברות והרשמה)
      authContainer.innerHTML = `
        <div class="user-greeting">
          <span>👤</span>
          <span>${username}</span>
        </div>
        <button id="logout-btn" class="btn-logout">התנתקות</button>
      `;

      // טיפול בלחיצה על כפתור התנתקות
      document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        // חזרה לדף הבית הציבורי שנמצא בתיקיית השורש (public/index.html)
        window.location.href = '../index.html';
      });

    } catch (e) {
      console.error('Error parsing user session data', e);
    }
  } else {
    // אם אין משתמש מחובר, הפניה חזרה לדף ההתחברות באותה תיקייה
    window.location.href = 'login.html';
  }
});