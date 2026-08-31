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

// פונקציה מעודכנת המציגה את ההודעות כמו צ'אט בוואטסאפ
async function loadUserMessages(username) {
    const container = document.getElementById('userMessagesList');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/user-messages?username=${username}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('שגיאה בשליפת ההודעות מהשרת');

        const data = await response.json();
        const messages = data.messages || [];

        if (messages.length > 0) {
            // סידור היסטוריית השיחה מהישן לחדש
            messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            
            // בניית ממשק צ'אט (בועות הודעה ימין ושמאל)
            container.innerHTML = `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto;">
                    ${messages.map(msg => `
                        <div style="align-self: flex-start; background: #ffffff; padding: 12px 16px; border-radius: 16px 16px 16px 0; max-width: 85%; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">${new Date(msg.createdAt).toLocaleString('he-IL')} - <strong>אני</strong></div>
                            <div style="color: #334155; font-size: 15px;">${msg.message}</div>
                        </div>
                        ${msg.reply ? `
                        <div style="align-self: flex-end; background: #eff6ff; padding: 12px 16px; border-radius: 16px 16px 0 16px; max-width: 85%; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #bfdbfe;">
                            <div style="font-size: 11px; color: #3b82f6; margin-bottom: 4px;"><strong>תגובת צוות Botify</strong></div>
                            <div style="color: #1e40af; font-size: 15px;">${msg.reply}</div>
                        </div>
                        ` : ''}
                    `).join('')}
                </div>
                <div style="margin-top: 15px; text-align: center;">
                    <a href="contact.html" style="color: #2563eb; font-weight: bold; text-decoration: none;">+ פנייה חדשה / המשך שיחה</a>
                </div>
            `;
        } else {
            container.innerHTML = '<p class="status-msg" style="color: #64748b; background: #f8fafc; padding: 20px; border-radius: 12px; text-align: center;">אין לך פניות או התכתבויות קודמות במערכת.</p>';
        }
    } catch (err) {
        console.error('Error loading user messages:', err);
        container.innerHTML = '<p class="status-msg" style="color: #dc2626; background: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #f87171;">שגיאה בטעינת ההודעות. ייתכן והשרת דורש התחברות מחדש.</p>';
    }
}