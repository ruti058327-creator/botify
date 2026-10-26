// מייבאים שירות API ומפענח אסימון לצורך טעינת נתוני המשתמש המאומת.
import { ApiService } from '../services/api-service.js';
import { parseJwtPayload } from './navbar-auth.js';

// שומרים בזיכרון הודעות, מזהה שיחה פעילה ושם משתמש לשימוש בפעולות הדף.
let currentUserMessages = [];
let currentChatId = localStorage.getItem('currentChatId') || null;
let loggedInUsername = '';

/**
 * מאתחל את לוח המשתמש, פרופיל, שיחות, בוטים ופקדי הממשק.
 * @returns {void} טוען מידע ראשוני ומתקין מאזיני אירועים.
 */
document.addEventListener('DOMContentLoaded', () => {
  // משתמש חייב להיות מחובר כדי לצפות באזור האישי.
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // מפענחים את האסימון לפני שמסתמכים על פרטי המשתמש שבו.
  const tokenPayload = parseJwtPayload(token);
  // אסימון לא תקין מנוקה והמשתמש מוחזר למסך הכניסה.
  if (!tokenPayload) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
    return;
  }
  // מנהל משתמש במסך הניהול הנפרד, ולכן מעבירים אותו אליו.
  if (tokenPayload.role === 'admin') {
    window.location.href = 'admin.html';
    return;
  }

  // מאתרים את כותרת הפתיחה וקוראים את פרופיל המשתמש שנשמר בעת ההתחברות.
  const welcomeTitle = document.getElementById('userNameDisplay');
  const storedUser = localStorage.getItem('user');

  if (token) {
    try {
      // מפענחים את הפרופיל המקומי ובוחרים שם להצגה לפי המידע הזמין.
      const userData = storedUser ? JSON.parse(storedUser) : {};
      loggedInUsername = tokenPayload.username || userData.username || userData.fullName || 'משתמש';

            // מאתרים את רכיבי תמונת הפרופיל ואת הודעת הסטטוס של ההעלאה.
            const profileImagePreview = document.getElementById('profileImagePreview');
            const profileImageInput = document.getElementById('profileImageInput');
            const profileImageStatus = document.getElementById('profileImageStatus');
            // אם התמונה כבר שמורה בפרופיל, מציגים אותה במקום תמונת ברירת המחדל.
            if (userData.profileImage && profileImagePreview) {
                profileImagePreview.src = userData.profileImage;
                profileImagePreview.hidden = false;
            }
            /**
             * מעלה תמונת פרופיל שנבחרה ושומר את כתובתה בפרטי המשתמש המקומיים.
             * @returns {Promise<void>} מעדכן תצוגה או מציג שגיאת העלאה.
             */
            profileImageInput?.addEventListener('change', async () => {
                // משתמשים בקובץ הראשון שנבחר; ללא קובץ אין מה להעלות.
                const file = profileImageInput.files?.[0];
                if (!file) return;

                // מעדכנים סטטוס ויוצרים FormData כדי לשלוח את הקובץ כמולטימדיה.
                profileImageStatus.textContent = 'מעלה תמונה...';
                const formData = new FormData();
                formData.append('profileImage', file);

                try {
                    // מעלים את התמונה לשרת תחת שם שדה ה-API ומוסיפים אסימון אימות.
                    const response = await ApiService.request('/api/users/me/profile-image', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
                        body: formData
                    });
                    // קוראים את כתובת התמונה החדשה ואת הודעת השגיאה האפשרית.
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'העלאת התמונה נכשלה');

                    // מציגים את התמונה, מעדכנים הודעת מצב ושומרים פרופיל מקומי מעודכן.
                    profileImagePreview.src = data.profileImage;
                    profileImagePreview.hidden = false;
                    profileImageStatus.textContent = 'התמונה עודכנה';
                    userData.profileImage = data.profileImage;
                    localStorage.setItem('user', JSON.stringify(userData));
                } catch (error) {
                    // מציגים את סיבת כישלון ההעלאה ברכיב הסטטוס.
                    profileImageStatus.textContent = error.message;
                } finally {
                    // מאפסים את בחירת הקובץ כדי שניתן יהיה לבחור שוב גם באותו קובץ.
                    profileImageInput.value = '';
                }
            });

      // מציגים ברכת שלום עם שם המשתמש שנבחר מהאסימון או מהפרופיל.
      if (welcomeTitle) welcomeTitle.textContent = `שלום, ${loggedInUsername}!`;

            // ממפים מזהי מסלולים לתוויות בעברית, כולל שם המסלול החינמי.
            const planNames = {
                starter: 'מסלול Starter בתשלום',
                pro: 'בוט מקצועי (Pro)',
                business: 'בוט עסקי (Business)',
                enterprise: 'בוט ארגוני (Enterprise)',
                'בסיסי': 'מסלול חינמי - בוט אחד'
            };
      // מציגים שם מסלול קריא או ערך ברירת מחדל אם אין מידע בפרופיל.
      const planEl = document.getElementById('userPlanDisplay');
            const planName = planNames[userData.plan] || userData.plan || 'מסלול חינמי - בוט אחד';
            if (planEl) planEl.textContent = planName;

            // אם המשתמש חזר מתשלום מוצלח, מציגים הודעה ואפשרות לציין בוטים שהוסרו.
            const paymentNotice = document.getElementById('paymentSuccessNotice');
            if (paymentNotice && new URLSearchParams(window.location.search).get('payment') === 'success') {
                // ממירים את מספר הבוטים מהכתובת למספר; ערך חסר מתחיל באפס.
                const removedBots = Number.parseInt(new URLSearchParams(window.location.search).get('removedBots') || '0', 10);
                // בונים תוספת להודעת הצלחה רק אם השרת דיווח על הסרת בוטים.
                const removalNotice = removedBots > 0
                    ? ` הוסרו ${removedBots} הבוטים הוותיקים ביותר כדי להתאים למכסה החדשה.`
                    : '';
                // מעדכנים את הודעת התשלום ומציגים אותה לאחר בניית הטקסט.
                paymentNotice.textContent = `התשלום נקלט והמסלול ${planName} הופעל.${removalNotice}`;
                paymentNotice.hidden = false;
            }

      // מציגים את תאריך יצירת החשבון או מצב כללי כשהתאריך אינו זמין.
      const dateEl = document.getElementById('userDateDisplay');
      if (dateEl && userData.createdAt) {
        dateEl.textContent = new Date(userData.createdAt).toLocaleDateString('he-IL');
      } else if (dateEl) {
        dateEl.textContent = 'פעיל במערכת';
      }

      // טוענים את שיחות התמיכה ואת הבוטים בבעלות המשתמש עם פתיחת לוח הבקרה.
      loadUserMessages(loggedInUsername);
    loadOwnedBots();

    } catch (e) {
      // שגיאת JSON או פרופיל פגום נרשמת כדי לסייע באבחון בלי לשבור את הדף.
      console.error('Error parsing session data', e);
    }
  }

  // מוסיפים קיצור שליחה ב-Enter רק אם תיבת ההודעה קיימת.
  const chatInput = document.getElementById('chatInputDashboard');
  if (chatInput) {
      /**
       * שולח הודעה בלחיצה על Enter בלי להוסיף שורה חדשה.
       * @param {KeyboardEvent} event אירוע המקלדת.
       * @returns {void} מטפל במקש Enter בלבד.
       */
      chatInput.addEventListener('keydown', function(event) {
          // Enter שולח הודעה במקום להכניס מעבר שורה בשדה הצ'אט.
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
    // מאתרים אזור תצוגה; אם אינו קיים אין צורך להמשיך בבקשת ההיסטוריה.
    const container = document.getElementById('userMessagesList');
    if (!container) return;

    try {
        // מבקשים הודעות המשויכות לשם המשתמש ומעבירים אסימון אימות.
        const token = localStorage.getItem('token');
        const response = await ApiService.request(`/api/user-messages?username=${encodeURIComponent(username)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        // שגיאת שרת תועבר לטיפול catch במקום להציג נתונים חלקיים.
        if (!response.ok) throw new Error('שגיאה בשליפת ההודעות');

        // שומרים את ההודעות בזיכרון ומרעננים את בחירת השיחה ואת תצוגתה.
        const data = await response.json();
        currentUserMessages = data.messages || [];

        populateChatHistoryDropdown();
        renderCurrentChatWindow();
    } catch (err) {
        // מציגים הודעת טעינה ברורה באזור ההיסטוריה כשהבקשה נכשלה.
        container.innerHTML = '<p class="status-msg dashboard-status-error">שגיאה בטעינת השיחות.</p>';
    }
}

/**
 * טוען את הבוטים שבבעלות המשתמש ואת מכסת הבוטים שלו.
 * @returns {Promise<void>} מעדכן את רשימת הבוטים ואת נתוני המכסה.
 */
async function loadOwnedBots() {
    // אין צורך בבקשות אם רכיב רשימת הבוטים אינו חלק מהדף הנוכחי.
    const container = document.getElementById('botsListContainer');
    if (!container) return;

    try {
        // טוענים יחד את רשימת הבוטים ואת המכסה כדי להציג נתונים תואמים.
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token || ''}` };
        const [response, quotaResponse, secretaryResponse] = await Promise.all([
            ApiService.request('/api/bots', { headers }),
            ApiService.request('/api/bots/quota', { headers }),
            ApiService.request('/api/secretary/mine', { headers })
        ]);
        // ממתינים לשתי התשובות ומפענחים את גופן כ-JSON.
        const [data, quotaData, secretaryData] = await Promise.all([
            response.json(),
            quotaResponse.json(),
            secretaryResponse.json()
        ]);
        // הודעת שגיאה מכל אחד מהשירותים עוצרת הצגת מידע לא שלם.
        if (!response.ok) throw new Error(data.message || 'לא ניתן לטעון את הבוטים');
        if (!quotaResponse.ok) throw new Error(quotaData.message || 'לא ניתן לטעון את מכסת הבוטים');
        if (!secretaryResponse.ok) throw new Error(secretaryData.message || 'לא ניתן לטעון את בוטי המזכירה');

        // מציגים מספר שימוש ומגבלה; ערך חסר או לא מספרי מוצג כ"ללא הגבלה".
        const quotaDisplay = document.getElementById('botQuotaDisplay');
        if (quotaDisplay) {
            const limit = quotaData.botLimit;
            const limitText = limit == null || !Number.isFinite(limit) ? 'ללא הגבלה' : limit;
            quotaDisplay.textContent = `${data.bots.length} מתוך ${limitText} בוטים`;
        }

        // מנקים נתונים קודמים ומציגים הודעה כאשר למשתמש עדיין אין בוטים.
        container.replaceChildren();
        if (!data.bots?.length && !secretaryData.bots?.length) {
            container.textContent = 'עדיין לא יצרת בוט.';
            return;
        }

        // בונים שורת ממשק נפרדת לכל בוט שהשרת החזיר.
        for (const bot of data.bots) {
            // יוצרים את מעטפת הבוט ואת כתובת האתר כטקסט שאינו מפורש כ-HTML.
            const row = document.createElement('div');
            row.className = 'owned-bot-row';

            const title = document.createElement('strong');
            title.className = 'owned-bot-title';
            title.textContent = bot.websiteUrl;

            // יוצרים אזור פעולות אחיד לעריכה ולמחיקה.
            const actions = document.createElement('div');
            actions.className = 'owned-bot-actions';

            // כפתור העריכה הראשון מנווט לטופס יצירה/עריכה עם מזהה הבוט.
            const editButton = document.createElement('button');
            editButton.className = 'owned-bot-action';
            editButton.type = 'button';
            editButton.textContent = 'עריכה';
            editButton.addEventListener('click', event => {
                // מונעים מאזיני לחיצה נוספים על אותה פעולה לפני הניווט לטופס העריכה.
                event.stopImmediatePropagation();
                window.location.href = `create-bot.html?id=${encodeURIComponent(bot.id)}`;
            });
            /**
             * מבקש הנחיות חדשות לבוט, שומר אותן בשרת ומרענן את הרשימה.
             * @returns {Promise<void>} משלים את עדכון ההנחיות אם אושר.
             */
            editButton.addEventListener('click', async () => {
                // מבקשים מהמשתמש הנחיות חדשות; ביטול החלון משאיר את הנתונים כפי שהם.
                const instructions = window.prompt('הנחיות לבוט:', bot.instructions || '');
                if (instructions === null) return;

                // מעדכנים את הבוט בשרת ושולחים את ההנחיות כ-JSON.
                const updateResponse = await ApiService.request(`/api/bots/${encodeURIComponent(bot.id)}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                    },
                    body: JSON.stringify({ instructions })
                });
                // מציגים שגיאה אם השרת לא שמר את השינויים.
                if (!updateResponse.ok) {
                    alert('לא ניתן לעדכן את הנחיות הבוט');
                    return;
                }
                // טוענים מחדש כדי שהרשימה תשקף את ההנחיות המעודכנות.
                await loadOwnedBots();
            });

            // יוצרים כפתור מחיקה לבוט הנוכחי.
            const deleteButton = document.createElement('button');
            deleteButton.className = 'owned-bot-action owned-bot-action-delete';
            deleteButton.type = 'button';
            deleteButton.textContent = 'מחיקה';
            /**
             * מבקש אישור למחיקת הבוט ומרענן את הרשימה לאחר המחיקה.
             * @returns {Promise<void>} מוחק את הבוט לאחר אישור המשתמש.
             */
            deleteButton.addEventListener('click', async () => {
                // מבצעים מחיקה רק לאחר אישור מפורש בחלון הדפדפן.
                if (!window.confirm('למחוק את הבוט?')) return;
                // שולחים בקשת DELETE עם מזהה הבוט ואסימון המשתמש.
                const deleteResponse = await ApiService.request(`/api/bots/${encodeURIComponent(bot.id)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
                });
                // הודעת שגיאה נשארת בדף אם השרת דחה את המחיקה.
                if (!deleteResponse.ok) {
                    alert('לא ניתן למחוק את הבוט');
                    return;
                }
                // אחרי מחיקה מוצלחת טוענים מחדש את הרשימה והמכסה.
                await loadOwnedBots();
            });

            // מחברים את הקישורים והכפתורים לשורת הבוט ומוסיפים אותה לרשימה.
            actions.append(editButton, deleteButton);
            row.append(title, actions);
            container.appendChild(row);
        }

        // מציגים גם את בוטי המזכירה ברשימת הבוטים הפעילים באזור האישי.
        // מוסיפים בנפרד את בוטי המזכירה, שאינם נכללים ברשימת הבוטים הרגילים.
        for (const bot of secretaryData.bots || []) {
            // כל בוט מקבל שורה עצמאית עם שם הבוט ופעולות הניהול שלו.
            const row = document.createElement('div');
            row.className = 'owned-bot-row';

            // מציגים את המפתח הציבורי של בוט המזכירה בכותרת השורה.
            const title = document.createElement('strong');
            title.className = 'owned-bot-title';
            title.textContent = `בוט מזכירה: ${bot.botUrlKey}`;

            // מרכזים קישור עריכה וכפתור מחיקה באזור פעולות אחד.
            const actions = document.createElement('div');
            actions.className = 'owned-bot-actions';

            // קישור העריכה פותח את הגדרת בוט המזכירה לפי המפתח שלו.
            const editLink = document.createElement('a');
            editLink.className = 'owned-bot-action';
            editLink.href = `secretary-bots.html?bot=${encodeURIComponent(bot.botUrlKey)}`;
            editLink.textContent = 'עריכה';

            // כפתור המחיקה מאפשר להסיר את הבוט ואת יומן התורים המשויך אליו.
            const deleteButton = document.createElement('button');
            deleteButton.className = 'owned-bot-action owned-bot-action-delete';
            deleteButton.type = 'button';
            deleteButton.textContent = 'מחיקה';
            deleteButton.addEventListener('click', async () => {
                // דורשים אישור מפורש לפני מחיקת הבוט והנתונים ההיסטוריים שלו.
                if (!window.confirm(`למחוק את בוט המזכירה "${bot.botUrlKey}" ואת יומן התורים שלו?`)) return;
                // מונעים בקשות מחיקה חוזרות בזמן שהפעולה הנוכחית מתבצעת.
                deleteButton.disabled = true;
                try {
                    // שולחים את מזהה הבוט והכותרות המשותפות, כולל אסימון האימות.
                    const deleteResponse = await ApiService.request(
                        `/api/secretary/${encodeURIComponent(bot.botUrlKey)}`,
                        { method: 'DELETE', headers }
                    );
                    // קוראים את תוצאת השרת כדי לבדוק גם סטטוס וגם הצלחה מפורשת.
                    const deleteData = await deleteResponse.json();
                    if (!deleteResponse.ok || !deleteData.success) {
                        throw new Error(deleteData.message || 'לא ניתן למחוק את בוט המזכירה');
                    }
                    // מרעננים את שתי רשימות הבוטים ואת המכסה לאחר מחיקה שאושרה.
                    await loadOwnedBots();
                } catch (error) {
                    // מציגים את סיבת הכישלון ומאפשרים ניסיון נוסף לאחר שחרור הכפתור.
                    alert(error.message || 'שגיאה במחיקת בוט המזכירה');
                    deleteButton.disabled = false;
                }
            });

            // מחברים את פעולות העריכה והמחיקה לשורה ומוסיפים אותה למיכל.
            actions.append(editLink, deleteButton);
            row.append(title, actions);
            container.appendChild(row);
        }
    } catch (error) {
        // מציגים תקלה במקום רשימת הבוטים כשאחת מהבקשות נכשלה.
        container.textContent = error.message || 'שגיאה בטעינת הבוטים';
    }
}

/**
 * בונה את רשימת השיחות הייחודיות ומסמן את השיחה הפעילה.
 * @returns {void} מעדכן את תיבת בחירת השיחה.
 */
function populateChatHistoryDropdown() {
    // מאתרים את תיבת בחירת השיחה ונמנעים מעבודה כשהיא אינה קיימת.
    const selectEl = document.getElementById('chatHistorySelect');
    if (!selectEl) return;

    // יוצרים מערך של מזהי שיחה ייחודיים; הודעות ישנות ללא מזהה מקובצות יחד.
    const uniqueChats = [...new Set(currentUserMessages.map(m => m.chatId || 'chat_old_history'))];
    
    // מנקים אפשרויות קודמות לפני יצירת רשימת השיחות המעודכנת.
    selectEl.innerHTML = '';
    if (uniqueChats.length === 0) {
        // אם אין שיחות, מציגים אפשרות יחידה המסבירה שאין היסטוריה.
        selectEl.innerHTML = '<option value="">אין שיחות קודמות</option>';
        return;
    }

    /**
     * יוצר אפשרות בחירה עם תאריך תחילת השיחה.
     * @param {string} chatId מזהה השיחה.
     * @returns {void} מוסיף אפשרות לרשימת השיחות.
     */
    uniqueChats.forEach((chatId) => {
        // מוצאים הודעה ראשונה בשיחה כדי להשתמש בתאריך שלה כתווית לבחירה.
        const firstMsg = currentUserMessages.find(m => (m.chatId || 'chat_old_history') === chatId);
        const dateStr = firstMsg ? new Date(firstMsg.createdAt).toLocaleString('he-IL') : 'שיחה';
        
        // בונים אפשרות עם מזהה השיחה, תאריך קריא וסימון אם היא פעילה.
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
    // מאתרים את מיכל ההודעות שאליו מרונדרת השיחה הפעילה.
    const container = document.getElementById('userMessagesList');
    
    if (currentUserMessages.length === 0) {
        // היסטוריה ריקה מציגה הנחיה לפתוח שיחה באמצעות כתיבת הודעה.
        container.innerHTML = '<p class="status-msg dashboard-chat-empty">אין היסטוריית שיחות. הקלד הודעה למטה כדי להתחיל.</p>';
        return;
    }

    // אם עדיין לא נשמרה שיחה פעילה, בוחרים את השיחה של ההודעה האחרונה.
    if (!currentChatId) {
        const lastMsg = currentUserMessages[currentUserMessages.length - 1];
        currentChatId = lastMsg.chatId || 'chat_old_history';
        localStorage.setItem('currentChatId', currentChatId);
    }
    
    // מסנכרנים את תיבת הבחירה עם מזהה השיחה שנבחר.
    const selectEl = document.getElementById('chatHistorySelect');
    if (selectEl) selectEl.value = currentChatId;

    // מסננים את המטמון כך שיוצגו רק ההודעות ששייכות לשיחה שנבחרה.
    const chatMessages = currentUserMessages.filter(m => (m.chatId || 'chat_old_history') === currentChatId);

    if (chatMessages.length === 0) {
        // שיחה חדשה ללא הודעות מקבלת הודעת פתיחה במקום בועות ריקות.
        container.innerHTML = '<p class="status-msg dashboard-chat-new">✨ שיחה חדשה פתוחה! הקלד/י למטה כדי להתחיל.</p>';
        return;
    }

    // מציגים הודעות מהישנה לחדשה לפי מועד יצירתן.
    chatMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // ממירים כל הודעה לבועה המתאימה ומחברים את כל הבועות ברצף אחד.
    container.innerHTML = chatMessages.map(
        /**
         * ממירה הודעה אחת לבועת צ׳אט בהתאם לזהות השולח.
         * @param {object} msg הודעת לקוח או מנהל.
         * @returns {string} HTML של בועת ההודעה.
         */
        msg => {
        // כל הודעה מקבלת HTML אחר לפי זהות השולח.
        let html = '';
        if (!msg.isAdmin) {
            // מציגים הודעת משתמש עם תאריך ותווית "אני".
            html += `
            <div class="dashboard-chat-row">
                <div class="dashboard-chat-bubble dashboard-chat-bubble-user">
                    <div class="dashboard-chat-meta">${new Date(msg.createdAt).toLocaleString('he-IL')} - <strong>אני</strong></div>
                    <div class="dashboard-chat-text">${msg.message}</div>
                </div>
            </div>`;
        } else {
            // מציגים תשובת צוות עם תאריך ותווית נפרדת.
            html += `
            <div class="dashboard-chat-row">
                <div class="dashboard-chat-bubble dashboard-chat-bubble-admin">
                    <div class="dashboard-chat-meta">${new Date(msg.createdAt).toLocaleString('he-IL')} - <strong>צוות Botify</strong></div>
                    <div class="dashboard-chat-text">${msg.message}</div>
                </div>
            </div>`;
        }
        // מחזירים את ה-HTML כדי לצרף את כל ההודעות למיכל.
        return html;
        }
    ).join('');

    // מגלגלים לסוף ההיסטוריה כדי להציג את ההודעות האחרונות.
    container.scrollTop = container.scrollHeight;
}

// לחיצה על הכפתור שמנקה את המסך לשיחה חדשה
/**
 * יוצר מזהה שיחה חדש ומנקה את תצוגת השיחה הקודמת.
 * @returns {void} שומר את השיחה החדשה ובונה מחדש את חלון השיחה.
 */
window.startNewChat = function() {
    // משתמשים בזמן הנוכחי ליצירת מזהה ייחודי ושומרים אותו מיד בדפדפן.
    currentChatId = 'chat_' + Date.now();
    localStorage.setItem('currentChatId', currentChatId); // שומר מיד!
    
    // מנקים את בחירת ההיסטוריה ומרנדרים חלון שיחה חדש וריק.
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
    // מוודאים שקיימת בחירה לפני שמחליפים את השיחה הפעילה.
    const selectEl = document.getElementById('chatHistorySelect');
    if (!selectEl || !selectEl.value) return;
    
    // מעדכנים את המזהה המקומי ומציירים מחדש את ההודעות המתאימות.
    currentChatId = selectEl.value;
    localStorage.setItem('currentChatId', currentChatId);
    renderCurrentChatWindow();
};

/**
 * שולח הודעת משתמש לצוות התמיכה בשיחה הפעילה.
 * @returns {Promise<void>} שומר את ההודעה וטוען מחדש את ההיסטוריה.
 */
window.sendMessageFromDashboard = async function() {
    // קוראים את הודעת המשתמש ומונעים בקשה עבור טקסט ריק.
    const input = document.getElementById('chatInputDashboard');
    const text = input.value.trim();
    if (!text) return;

    // מבטיחים שלכל הודעה יהיה מזהה שיחה ושומרים אותו לפני שליחתה.
    // מייצרים מזהה שיחה אם עדיין אין שיחה פעילה שאפשר לצרף אליה את ההודעה.
    if (!currentChatId) {
        currentChatId = 'chat_' + Date.now();
        localStorage.setItem('currentChatId', currentChatId);
    }
    
    // שומרים עותק כדי שניתן יהיה לחזור לאותה שיחה לאחר רענון נתוני ההיסטוריה.
    const activeChatToKeep = currentChatId;

    try {
        // שולחים לשרת את נושא התמיכה, המשתמש, גוף ההודעה ומזהה השיחה הפעילה.
        const token = localStorage.getItem('token');
        const response = await ApiService.request('/api/contact', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                subject: 'אחר',
                username: loggedInUsername, 
                message: text,
                chatId: activeChatToKeep 
            })
        });

        // מפענחים את תוצאת השליחה כדי להציג כישלון או לרענן את התצוגה.
        const data = await response.json();
        // מקבלים הצלחה אם השרת אישר אותה בגוף התשובה או בסטטוס ה-HTTP.
        if (response.ok || data.success) {
            // לאחר הצלחה מנקים את שדה הטקסט ומשחזרים את השיחה שנשלחה אליה ההודעה.
            input.value = ''; 
            
            // מחזיר בכוח את ה-chatId הנכון לזיכרון לפני הריענון כדי שלא נקפוץ לשיחה ישנה
            currentChatId = activeChatToKeep;
            localStorage.setItem('currentChatId', activeChatToKeep);
            
            // טוענים מחדש את ההודעות כדי שהתוכן החדש יופיע בחלון הצ'אט.
            await loadUserMessages(loggedInUsername); 
        } else {
            // מציגים הודעה במקרה שהשרת קיבל את הבקשה אך לא סימן הצלחה.
            alert('שגיאה בשליחת ההודעה.');
        }
    } catch (err) {
        // תקלה ברשת מדווחת בלי למחוק את הטקסט, כדי לאפשר ניסיון שליחה נוסף.
        alert('שגיאת תקשורת מול השרת.');
    }
};