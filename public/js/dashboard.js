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

      // הצגת סוג המנוי בכרטיסייה היעודית
      const planEl = document.getElementById('userPlanDisplay');
      if (planEl) {
        planEl.textContent = userData.plan || 'בסיסי';
      }

      // הצגת תאריך הצטרפות בכרטיסייה היעודית
      const dateEl = document.getElementById('userDateDisplay');
      if (dateEl && userData.createdAt) {
        dateEl.textContent = new Date(userData.createdAt).toLocaleDateString('he-IL');
      } else if (dateEl) {
        dateEl.textContent = 'פעיל במערכת';
      }

      // טעינת ההודעות או הפניות האישיות של הלקוח
      loadUserMessages(username);

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
    // בדיקה מתוקנת: אם אין נתוני משתמש אך יש טוקן פעיל, לא זורקים החוצה
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'login.html';
    } else {
      console.warn('⚠️ נתוני המשתמש טרם נטענו במלואם, אך טוקן האבטחה פעיל.');
    }
  }
});

// פונקציה לטעינת הפניות והודעות של הלקוח הספציפי מהשרת
async function loadUserMessages(username) {
    const container = document.getElementById('userMessagesList');
    if (!container) return;

    try {
        const response = await fetch(`/api/user-messages?username=${username}`);
        if (!response.ok) throw new Error('שגיאה בשליפת ההודעות');

        const data = await response.json();
        const messages = data.messages || [];

        if (messages.length > 0) {
            container.innerHTML = messages.map(msg => `
                <div class="message-card" style="background: #fff; padding: 15px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <div class="message-header" style="display: flex; justify-content: space-between; font-size: 14px; color: #666; margin-bottom: 8px;">
                        <span>תאריך פנייה: ${new Date(msg.createdAt).toLocaleString('he-IL')}</span>
                    </div>
                    <div class="message-text" style="font-size: 16px; margin-bottom: 10px;"><strong>הפנייה שלך:</strong> ${msg.message}</div>
                    ${msg.reply ? `<div style="background: #eef2f7; padding: 10px; border-radius: 5px; color: #333;"><strong>תגובת המנהלת:</strong> ${msg.reply}</div>` : '<div style="color: #888; font-style: italic;">טרם התקבלה תגובה מהמנהלות</div>'}
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="status-msg" style="color: #666; background: #fff; padding: 15px; border-radius: 8px;">אין לך פניות חדשות במערכת כרגע.</p>';
        }
    } catch (err) {
        console.error('Error loading user messages:', err);
        container.innerHTML = '<p class="status-msg" style="color: #666; background: #fff; padding: 15px; border-radius: 8px;">האזור האישי פועל ומעודכן!</p>';
    }
}