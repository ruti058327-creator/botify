let currentUserMessages = [];
let currentChatId = localStorage.getItem('currentChatId') || null;
let loggedInUsername = '';

/**
 * מאתחל את לוח המשתמש, פרופיל, שיחות, בוטים ופקדי הממשק.
 * @returns {void} טוען מידע ראשוני ומתקין מאזיני אירועים.
 */
document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('auth-buttons-container');
  const welcomeTitle = document.getElementById('userNameDisplay');

  if (!authContainer) return;

  const storedUser = localStorage.getItem('user');

  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      loggedInUsername = userData.username || userData.fullName || 'משתמש';

            const profileImagePreview = document.getElementById('profileImagePreview');
            const profileImageInput = document.getElementById('profileImageInput');
            const profileImageStatus = document.getElementById('profileImageStatus');
            if (userData.profileImage && profileImagePreview) {
                profileImagePreview.src = userData.profileImage;
                profileImagePreview.hidden = false;
            }
            /**
             * מעלה תמונת פרופיל שנבחרה ושומר את כתובתה בפרטי המשתמש המקומיים.
             * @returns {Promise<void>} מעדכן תצוגה או מציג שגיאת העלאה.
             */
            profileImageInput?.addEventListener('change', async () => {
                const file = profileImageInput.files?.[0];
                if (!file) return;

                profileImageStatus.textContent = 'מעלה תמונה...';
                const formData = new FormData();
                formData.append('profileImage', file);

                try {
                    const response = await ApiService.request('/api/users/me/profile-image', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
                        body: formData
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'העלאת התמונה נכשלה');

                    profileImagePreview.src = data.profileImage;
                    profileImagePreview.hidden = false;
                    profileImageStatus.textContent = 'התמונה עודכנה';
                    userData.profileImage = data.profileImage;
                    localStorage.setItem('user', JSON.stringify(userData));
                } catch (error) {
                    profileImageStatus.textContent = error.message;
                } finally {
                    profileImageInput.value = '';
                }
            });

      if (welcomeTitle) welcomeTitle.textContent = `שלום, ${loggedInUsername}!`;

            const planNames = {
                starter: 'מסלול Starter בתשלום',
                pro: 'בוט מקצועי (Pro)',
                business: 'בוט עסקי (Business)',
                enterprise: 'בוט ארגוני (Enterprise)',
                'בסיסי': 'מסלול חינמי - בוט אחד'
            };
      const planEl = document.getElementById('userPlanDisplay');
            const planName = planNames[userData.plan] || userData.plan || 'מסלול חינמי - בוט אחד';
            if (planEl) planEl.textContent = planName;

            const paymentNotice = document.getElementById('paymentSuccessNotice');
            if (paymentNotice && new URLSearchParams(window.location.search).get('payment') === 'success') {
                const removedBots = Number.parseInt(new URLSearchParams(window.location.search).get('removedBots') || '0', 10);
                const removalNotice = removedBots > 0
                    ? ` הוסרו ${removedBots} הבוטים הוותיקים ביותר כדי להתאים למכסה החדשה.`
                    : '';
                paymentNotice.textContent = `התשלום נקלט והמסלול ${planName} הופעל.${removalNotice}`;
                paymentNotice.hidden = false;
            }

      const dateEl = document.getElementById('userDateDisplay');
      if (dateEl && userData.createdAt) {
        dateEl.textContent = new Date(userData.createdAt).toLocaleDateString('he-IL');
      } else if (dateEl) {
        dateEl.textContent = 'פעיל במערכת';
      }

      // טעינה ראשונית של השיחות מהשרת
      loadUserMessages(loggedInUsername);
    loadOwnedBots();

      authContainer.innerHTML = `
                <div class="user-greeting">
          <span>👤</span>
          <span>${loggedInUsername}</span>
        </div>
                <button id="logout-btn" class="btn-logout">התנתקות</button>
      `;

      /**
       * מסיר נתוני התחברות ומחזיר את המשתמש לעמוד הבית.
       * @returns {void} מנקה אחסון מקומי ומנווט לעמוד הציבורי.
       */
      document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('currentChatId');
        // חזרה לדף הבית הציבורי שנמצא בתיקיית השורש
        window.location.href = '../index.html';
      });

    } catch (e) {
      console.error('Error parsing session data', e);
    }
  } else {
    // בדיקה: אם אין נתוני משתמש אך יש טוקן פעיל, לא זורקים החוצה
    const token = localStorage.getItem('token');
    if (!token) window.location.href = 'login.html';
  }

  // הפעלת מקש Enter בצ'אט הלקוח
  const chatInput = document.getElementById('chatInputDashboard');
  if (chatInput) {
      /**
       * שולח הודעה בלחיצה על Enter בלי להוסיף שורה חדשה.
       * @param {KeyboardEvent} event אירוע המקלדת.
       * @returns {void} מטפל במקש Enter בלבד.
       */
      chatInput.addEventListener('keydown', function(event) {
          if (event.key === 'Enter') {
              event.preventDefault(); 
              sendMessageFromDashboard();
          }
      });
  }
});

/**
 * טוען את הודעות המשתמש המחובר ומציג את היסטוריית השיחות.
 * @param {string} username שם המשתמש שעבורו נטענות ההודעות.
 * @returns {Promise<void>} מעדכן את מטמון ההודעות ואת ממשק השיחות.
 */
async function loadUserMessages(username) {
    const container = document.getElementById('userMessagesList');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        const response = await ApiService.request(`/api/user-messages?username=${encodeURIComponent(username)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('שגיאה בשליפת ההודעות');

        const data = await response.json();
        currentUserMessages = data.messages || [];

        populateChatHistoryDropdown();
        renderCurrentChatWindow();
    } catch (err) {
        container.innerHTML = '<p class="status-msg dashboard-status-error">שגיאה בטעינת השיחות.</p>';
    }
}

/**
 * טוען את הבוטים שבבעלות המשתמש ואת מכסת הבוטים שלו.
 * @returns {Promise<void>} מעדכן את רשימת הבוטים ואת נתוני המכסה.
 */
async function loadOwnedBots() {
    const container = document.getElementById('botsListContainer');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token || ''}` };
        const [response, quotaResponse] = await Promise.all([
            ApiService.request('/api/bots', { headers }),
            ApiService.request('/api/bots/quota', { headers })
        ]);
        const [data, quotaData] = await Promise.all([response.json(), quotaResponse.json()]);
        if (!response.ok) throw new Error(data.message || 'לא ניתן לטעון את הבוטים');
        if (!quotaResponse.ok) throw new Error(quotaData.message || 'לא ניתן לטעון את מכסת הבוטים');

        const quotaDisplay = document.getElementById('botQuotaDisplay');
        if (quotaDisplay) {
            const limit = quotaData.botLimit;
            const limitText = limit == null || !Number.isFinite(limit) ? 'ללא הגבלה' : limit;
            quotaDisplay.textContent = `${data.bots.length} מתוך ${limitText} בוטים`;
        }

        container.replaceChildren();
        if (!data.bots?.length) {
            container.textContent = 'עדיין לא יצרת בוט.';
            return;
        }

        for (const bot of data.bots) {
            const row = document.createElement('div');
            row.className = 'owned-bot-row';

            const title = document.createElement('strong');
            title.className = 'owned-bot-title';
            title.textContent = bot.websiteUrl;

            const actions = document.createElement('div');
            actions.className = 'owned-bot-actions';

            const openLink = document.createElement('a');
            openLink.href = `chat.html?botId=${encodeURIComponent(bot.id)}`;
            openLink.textContent = 'פתיחת צ׳אט';

            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.textContent = 'עריכת הנחיות';
            /**
             * מבקש הנחיות חדשות לבוט, שומר אותן בשרת ומרענן את הרשימה.
             * @returns {Promise<void>} משלים את עדכון ההנחיות אם אושר.
             */
            editButton.addEventListener('click', async () => {
                const instructions = window.prompt('הנחיות לבוט:', bot.instructions || '');
                if (instructions === null) return;

                const updateResponse = await ApiService.request(`/api/bots/${encodeURIComponent(bot.id)}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                    },
                    body: JSON.stringify({ instructions })
                });
                if (!updateResponse.ok) {
                    alert('לא ניתן לעדכן את הנחיות הבוט');
                    return;
                }
                await loadOwnedBots();
            });

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.textContent = 'מחיקה';
            /**
             * מבקש אישור למחיקת הבוט ומרענן את הרשימה לאחר המחיקה.
             * @returns {Promise<void>} מוחק את הבוט לאחר אישור המשתמש.
             */
            deleteButton.addEventListener('click', async () => {
                if (!window.confirm('למחוק את הבוט?')) return;
                const deleteResponse = await ApiService.request(`/api/bots/${encodeURIComponent(bot.id)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
                });
                if (!deleteResponse.ok) {
                    alert('לא ניתן למחוק את הבוט');
                    return;
                }
                await loadOwnedBots();
            });

            actions.append(openLink, editButton, deleteButton);
            row.append(title, actions);
            container.appendChild(row);
        }
    } catch (error) {
        container.textContent = error.message || 'שגיאה בטעינת הבוטים';
    }
}

/**
 * בונה את רשימת השיחות הייחודיות ומסמן את השיחה הפעילה.
 * @returns {void} מעדכן את תיבת בחירת השיחה.
 */
function populateChatHistoryDropdown() {
    const selectEl = document.getElementById('chatHistorySelect');
    if (!selectEl) return;

    // הוצאת רשימת מזהי השיחות הקיימים בלי כפילויות
    const uniqueChats = [...new Set(currentUserMessages.map(m => m.chatId || 'chat_old_history'))];
    
    selectEl.innerHTML = '';
    if (uniqueChats.length === 0) {
        selectEl.innerHTML = '<option value="">אין שיחות קודמות</option>';
        return;
    }

    /**
     * יוצר אפשרות בחירה עם תאריך תחילת השיחה.
     * @param {string} chatId מזהה השיחה.
     * @returns {void} מוסיף אפשרות לרשימת השיחות.
     */
    uniqueChats.forEach((chatId) => {
        // מציאת ההודעה הראשונה בשיחה הזו כדי לתת לה תאריך הגיוני
        const firstMsg = currentUserMessages.find(m => (m.chatId || 'chat_old_history') === chatId);
        const dateStr = firstMsg ? new Date(firstMsg.createdAt).toLocaleString('he-IL') : 'שיחה';
        
        const option = document.createElement('option');
        option.value = chatId;
        option.textContent = `שיחה מ-${dateStr}`;
        if (chatId === currentChatId) {
            option.selected = true;
        }
        selectEl.appendChild(option);
    });
}

/**
 * מרנדר את הודעות השיחה הפעילה או הודעת מצב מתאימה.
 * @returns {void} מציג את השיחה הנבחרת ומגלגל לסופה.
 */
function renderCurrentChatWindow() {
    const container = document.getElementById('userMessagesList');
    
    if (currentUserMessages.length === 0) {
        container.innerHTML = '<p class="status-msg dashboard-chat-empty">אין היסטוריית שיחות. הקלד הודעה למטה כדי להתחיל.</p>';
        return;
    }

    // אם הלקוח נכנס ולא בחר כלום, מראים את השיחה הכי חדשה כברירת מחדל
    if (!currentChatId) {
        const lastMsg = currentUserMessages[currentUserMessages.length - 1];
        currentChatId = lastMsg.chatId || 'chat_old_history';
        localStorage.setItem('currentChatId', currentChatId);
    }
    
    const selectEl = document.getElementById('chatHistorySelect');
    if (selectEl) selectEl.value = currentChatId;

    const chatMessages = currentUserMessages.filter(m => (m.chatId || 'chat_old_history') === currentChatId);

    if (chatMessages.length === 0) {
        container.innerHTML = '<p class="status-msg dashboard-chat-new">✨ שיחה חדשה פתוחה! הקלד/י למטה כדי להתחיל.</p>';
        return;
    }

    chatMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    container.innerHTML = chatMessages.map(
        /**
         * ממירה הודעה אחת לבועת צ׳אט בהתאם לזהות השולח.
         * @param {object} msg הודעת לקוח או מנהל.
         * @returns {string} HTML של בועת ההודעה.
         */
        msg => {
        let html = '';
        if (!msg.isAdmin) {
            html += `
            <div class="dashboard-chat-row">
                <div class="dashboard-chat-bubble dashboard-chat-bubble-user">
                    <div class="dashboard-chat-meta">${new Date(msg.createdAt).toLocaleString('he-IL')} - <strong>אני</strong></div>
                    <div class="dashboard-chat-text">${msg.message}</div>
                </div>
            </div>`;
        } else {
            html += `
            <div class="dashboard-chat-row">
                <div class="dashboard-chat-bubble dashboard-chat-bubble-admin">
                    <div class="dashboard-chat-meta">${new Date(msg.createdAt).toLocaleString('he-IL')} - <strong>צוות Botify</strong></div>
                    <div class="dashboard-chat-text">${msg.message}</div>
                </div>
            </div>`;
        }
        return html;
        }
    ).join('');

    // ירידה אוטומטית לסוף חלון הצ'אט
    container.scrollTop = container.scrollHeight;
}

// לחיצה על הכפתור שמנקה את המסך לשיחה חדשה
/**
 * יוצר מזהה שיחה חדש ומנקה את תצוגת השיחה הקודמת.
 * @returns {void} שומר את השיחה החדשה ובונה מחדש את חלון השיחה.
 */
window.startNewChat = function() {
    currentChatId = 'chat_' + Date.now();
    localStorage.setItem('currentChatId', currentChatId); // שומר מיד!
    
    const selectEl = document.getElementById('chatHistorySelect');
    if (selectEl) selectEl.value = ""; 
    
    renderCurrentChatWindow(); // זה יראה חלון נקי הודות לבדיקה ברינדור
};

// כשבוחרים שיחה ישנה מהרשימה
/**
 * טוען את השיחה שנבחרה מתיבת היסטוריית השיחות.
 * @returns {void} שומר את מזהה השיחה ומציג את תוכנה.
 */
window.loadSelectedChat = function() {
    const selectEl = document.getElementById('chatHistorySelect');
    if (!selectEl || !selectEl.value) return;
    
    currentChatId = selectEl.value;
    localStorage.setItem('currentChatId', currentChatId);
    renderCurrentChatWindow();
};

/**
 * שולח הודעת משתמש לצוות התמיכה בשיחה הפעילה.
 * @returns {Promise<void>} שומר את ההודעה וטוען מחדש את ההיסטוריה.
 */
window.sendMessageFromDashboard = async function() {
    const input = document.getElementById('chatInputDashboard');
    const text = input.value.trim();
    if (!text) return;

    // התיקון הקריטי: מוודא שה-chatId נשמר לפני השליחה!
    if (!currentChatId) {
        currentChatId = 'chat_' + Date.now();
        localStorage.setItem('currentChatId', currentChatId);
    }
    
    // שומר בצד את מזהה השיחה שאנחנו נמצאים בה עכשיו, כדי לחזור אליה במדויק אחרי הריענון
    const activeChatToKeep = currentChatId;

    try {
        const token = localStorage.getItem('token');
        const response = await ApiService.request('/api/contact', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                username: loggedInUsername, 
                message: text,
                chatId: activeChatToKeep 
            })
        });

        const data = await response.json();
        if (response.ok || data.success) {
            input.value = ''; 
            
            // מחזיר בכוח את ה-chatId הנכון לזיכרון לפני הריענון כדי שלא נקפוץ לשיחה ישנה
            currentChatId = activeChatToKeep;
            localStorage.setItem('currentChatId', activeChatToKeep);
            
            await loadUserMessages(loggedInUsername); 
        } else {
            alert('שגיאה בשליחת ההודעה.');
        }
    } catch (err) {
        alert('שגיאת תקשורת מול השרת.');
    }
};