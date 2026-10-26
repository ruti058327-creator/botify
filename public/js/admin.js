// מייבאים שירות לשרת ומפענח JWT כדי לאמת את הרשאת המנהל.
import { ApiService } from '../services/api-service.js';
import { parseJwtPayload } from './navbar-auth.js';

// מטמונים בזיכרון כדי לסנן הודעות ומשתמשים בלי לבקש אותם שוב מהשרת.
let allMessagesCache = [];
let allUsersCache = [];

/**
 * מאמת את תפקיד המשתמש ומאתחל את נתוני מסך הניהול.
 * @returns {void} טוען מונים, פניות ומשתמשים עבור מנהל מורשה.
 */
document.addEventListener('DOMContentLoaded', () => {
    // קוראים את אסימון המשתמש; בלעדיו אין אפשרות לגשת למסך ניהול.
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // מפענחים את פרטי האסימון ובודקים שהוא תקין לפני שימוש בפרטי התפקיד.
    const tokenPayload = parseJwtPayload(token);
    // מנקים פרטי התחברות כאשר האסימון אינו ניתן לפענוח.
    if (!tokenPayload) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return;
    }

    // מנרמלים את שם המנהל לתצוגה ומונעים ממשתמש רגיל להיכנס למסך.
    const username = String(tokenPayload.username || 'ADMIN').toUpperCase().trim();
    if (tokenPayload.role !== 'admin') {
        alert('אין לך הרשאה לגשת לעמוד הניהול');
        window.location.href = 'dashboard.html';
        return;
    }

    // מציגים את שם המנהל אם רכיב הכותרת קיים.
    const adminInfoEl = document.getElementById('adminNameDisplay');
    if (adminInfoEl) {
        adminInfoEl.textContent = username;
    }

    // מחברים התנתקות לקישור אם קיים, כדי לנקות את מצב המשתמש לפני היציאה ממסך הניהול.
    document.querySelector('.logout-link')?.addEventListener('click', event => {
        // מונעים ניווט בקישור ומוחקים פרטי התחברות ושיחה לפני חזרה לדף הראשי.
        event.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('currentChatId');
        window.location.href = '../index.html';
    });

    // טוענים במקביל מדדים, הודעות ושמות משתמש עבור מסך הניהול.
    loadSubscriberCount();
    loadMessages();
    loadUsers();
});

/**
 * טוען ומציג את מספר המשתמשים הרשומים.
 * @returns {Promise<void>} מעדכן את מונה המנויים אם הבקשה הצליחה.
 */
async function loadSubscriberCount() {
    // אם בקשת המונה נכשלת, משאירים את הערך הקיים ולא חוסמים את טעינת שאר מסך הניהול.
    try {
        // מבקשים את מספר המשתמשים עם אסימון המנהל בכותרת האימות.
        const response = await ApiService.request('/api/users/count', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        // תשובה שאינה מוצלחת אינה כוללת מונה שניתן להציג.
        if (!response.ok) throw new Error('שגיאה');
        // קוראים את המספר ומעדכנים את רכיב המונה אם השרת החזיר ערך.
        const data = await response.json();
        const countElement = document.getElementById('subscriberCount');
        if (countElement && data.count !== undefined) countElement.textContent = data.count;
    } catch (err) {}
}

/**
 * טוען הודעות פנייה ושיחות ומציג את השיחות הממתינות לטיפול.
 * @returns {Promise<void>} מעדכן את מטמון ההודעות ואת תצוגת השיחות.
 */
async function loadMessages() {
    // מאתרים את אזור השיחות שבו תוצגנה תוצאות הטעינה.
    const container = document.getElementById('messagesList');
    try {
        // מבקשים את הודעות הלקוחות והשיחות שזמינות למנהל.
        const response = await ApiService.request('/api/messages', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });

        // ברירת המחדל מאפשרת להציג שגיאה גם אם גוף התשובה אינו JSON תקין.
        let data = {};
        // אם הגוף אינו JSON, משאירים את האובייקט הריק כדי להשתמש בהודעת שגיאה חלופית.
        try {
            data = await response.json();
        } catch (_) {}

        if (!response.ok) {
            // משתמשים בהודעת השרת כשאפשר, ומנקים הרשאות שפגו במקרה 401/403.
            const serverMessage = data?.message || 'שגיאה בשליפת הודעות';
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // מציגים את סיבת הסירוב ומחזירים למסך הכניסה לאחר השהיה קצרה.
                container.innerHTML = `<p class="status-msg error">${serverMessage}. נא להתחבר מחדש.</p>`;
                setTimeout(() => window.location.href = 'login.html', 1200);
                return;
            }
            // כשבקשת טעינה רגילה נכשלה, מציגים את פרטי השגיאה באזור ההודעות.
            throw new Error(serverMessage);
        }

        // שומרים את התשובה במטמון ומציגים כברירת מחדל שיחות שממתינות לטיפול.
        allMessagesCache = data.messages || [];
        renderAdminChats(allMessagesCache, true);
    } catch (err) {
        // מציגים כשל טעינה במקום להשאיר את אזור ההודעות ריק.
        const message = err?.message || 'שגיאה בטעינת השיחות מהשרת';
        container.innerHTML = `<p class="status-msg error">${message}</p>`;
    }
}

/**
 * מסנן את מטמון השיחות לפי שם המשתמש שהוקלד ומציג תוצאות ממתינות.
 * @returns {void} מרנדר מחדש את רשימת השיחות.
 */
window.filterAdminChats = function() {
    // מנרמלים את טקסט החיפוש ומציגים את כל השיחות כאשר החיפוש ריק.
    const query = document.getElementById('adminSearchClient')?.value.trim().toLowerCase() || '';
    if (!query) {
        renderAdminChats(allMessagesCache, true);
        return;
    }
    // משאירים רק שיחות שבהן שם המשתמש מכיל את טקסט החיפוש.
    const filtered = allMessagesCache.filter(msg => {
        const user = msg.username || '';
        return user.toLowerCase().includes(query);
    });
    renderAdminChats(filtered, true);
};

/**
 * מקבץ ומציג הודעות לפי לקוח ושיחה, עם אפשרות להציג רק שיחות ממתינות.
 * @param {Array<object>} messages הודעות הפנייה להצגה.
 * @param {boolean} [pendingOnly=false] האם להסתיר שיחות שכבר טופלו.
 * @returns {void} מרנדר את השיחות בממשק המנהל.
 */
function renderAdminChats(messages, pendingOnly = false) {
    // מאתרים את אזור הפלט ויוצרים מבנה מקונן לפי משתמש ולאחר מכן לפי מזהה שיחה.
    const container = document.getElementById('messagesList');
    const groupedByUserAndChat = {};

    // חלוקה מדויקת למנהל: קודם שם לקוח, ואז לפי תעודת הזהות של השיחה (chatId)
    /**
     * משייך כל הודעת לקוח לקבוצת המשתמש והשיחה המתאימה.
     * @param {object} msg הודעת פנייה אחת.
     * @returns {void} מוסיף את ההודעה למבנה הקיבוץ.
     */
    messages.forEach(msg => {
        // הודעה ללא שם משויכת לאורח; הודעות המנהלת אינן מוצגות כשיחות לקוח נפרדות.
        const user = msg.username || 'אורח';
        if (user.startsWith('מנהלת')) return; 
        
        // וידוא שיש מזהה שיחה כלשהו
        // הודעות היסטוריות ללא מזהה מקובצות יחד תחת מזהה קבוע.
        const chatId = msg.chatId || 'chat_old_history'; 

        // יוצרים מערך חדש לכל צירוף משתמש/שיחה ומוסיפים אליו את ההודעה.
        if (!groupedByUserAndChat[user]) groupedByUserAndChat[user] = {};
        if (!groupedByUserAndChat[user][chatId]) groupedByUserAndChat[user][chatId] = [];
        
        groupedByUserAndChat[user][chatId].push(msg);
    });

    // מנקים תוצאות קודמות לפני יצירת הרשימה החדשה.
    container.innerHTML = '';
    // מציגים הודעת ריק מתאימה אם אין קבוצות כלל ומסיימים.
    if (Object.keys(groupedByUserAndChat).length === 0) {
        container.innerHTML = pendingOnly
            ? '<p class="status-msg">אין הודעות שממתינות לטיפול</p>'
            : '<p class="status-msg">אין היסטוריית שיחות ללקוח הזה</p>';
        return;
    }

    // המונה מייצר מזהי HTML ייחודיים, והמונה הנוסף מודד כמה שיחות הוצגו בפועל.
    let boxCounter = 1;
    let renderedChatCount = 0;

    // עוברים על כל לקוח ועל אוסף השיחות שקובץ עבורו.
    for (const [user, userChats] of Object.entries(groupedByUserAndChat)) {
        // מציגים כל שיחה של אותו משתמש בנפרד.
        // מעבדים כל שיחה של הלקוח בנפרד כדי לחשב את מצבה ולבנות עבורה כרטיס.
        for (const [chatId, chatMessages] of Object.entries(userChats)) {
            // מסדרים הודעות לפי זמן כדי לקבוע את תחילת השיחה ואת מצבה הנוכחי.
            chatMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            
            // מצב ממתין נקבע לפי ההודעה האחרונה: היא צריכה להיות של הלקוח וללא תגובה.
            const lastMsg = chatMessages[chatMessages.length - 1];
            const needsAttention = !lastMsg.isAdmin && (!lastMsg.reply || lastMsg.reply.trim() === '');
            // כשמציגים רק פניות פתוחות מדלגים על שיחות שכבר קיבלו תגובה.
                if (pendingOnly && !needsAttention) {
                    continue;
                }
            
            // בוחרים מחלקת עיצוב, תווית ומזהה רכיב ייחודי לשיחה הנוכחית.
            const chatStatusClass = needsAttention ? 'is-pending' : 'is-resolved';
            const statusBadge = needsAttention
                ? '<span class="chat-status-badge is-pending">🔴 ממתין לתשובה</span>'
                : '<span class="chat-status-badge is-resolved">🟢 טופל</span>';
            const htmlId = `chatBox_${boxCounter++}`;
            
            // תאריך פתיחת השיחה לתצוגה יפה למנהל
            // ממירים את זמן ההודעה הראשונה להצגה מקומית בעברית.
            const chatStartDate = new Date(chatMessages[0].createdAt).toLocaleString('he-IL');

            // יוצרים תצוגת שיחה: כותרת מתקפלת, הודעות ושדות לשליחת תגובה.
            const chatHtml = `
                <div class="message-card admin-chat-card ${chatStatusClass}">
                    <div class="admin-chat-header ${chatStatusClass}" onclick="toggleChat('${htmlId}')">
                        <div class="admin-chat-header-main">
                            <h3 class="admin-chat-title">💬 שיחה עם: <span class="message-username">${user}</span> <span class="admin-chat-date">(נפתחה: ${chatStartDate})</span></h3>
                            ${statusBadge}
                        </div>
                        <button class="admin-chat-toggle" type="button">הצג / הסתר שיחה ▾</button>
                    </div>
                    
                    <div id="${htmlId}" class="admin-chat-body" hidden>
                        <div class="admin-chat-messages">
                            ${chatMessages.map(
                                /**
                                 * ממירה הודעת שיחה אחת למקטע HTML לפי שולח ההודעה.
                                 * @param {object} m הודעת לקוח או מנהל.
                                 * @returns {string} תוכן HTML של ההודעה.
                                 */
                                m => {
                                // מתחילים כל פריט הודעה ללא תוכן, ומציגים נושא רק להודעת לקוח.
                                let html = '';
                                // מקודדים תווים מיוחדים בנושא כדי למנוע פירושם כסימוני HTML.
                                const subject = !m.isAdmin && m.subject
                                    ? `<div class="admin-chat-meta">נושא הפנייה: ${String(m.subject).replace(/[&<>"']/g, character => ({
                                        '&': '&amp;',
                                        '<': '&lt;',
                                        '>': '&gt;',
                                        '"': '&quot;',
                                        "'": '&#39;'
                                    })[character])}</div>`
                                    : '';
                                // הודעת לקוח מקבלת תווית, זמן, נושא ותוכן בתוך בועת לקוח.
                                if (!m.isAdmin) {
                                    html += `
                                    <div class="admin-chat-bubble admin-chat-bubble-client">
                                        <div class="admin-chat-meta">${new Date(m.createdAt).toLocaleString('he-IL')} - <strong>לקוח</strong></div>
                                        ${subject}
                                        <div class="admin-chat-text">${m.message}</div>
                                    </div>`;
                                // הודעת מנהלת מוצגת בבועה נפרדת המסומנת כתשובת צוות.
                                } else {
                                    html += `
                                    <div class="admin-chat-bubble admin-chat-bubble-admin">
                                        <div class="admin-chat-meta">${new Date(m.createdAt).toLocaleString('he-IL')} - <strong>מנהלת</strong></div>
                                        <div class="admin-chat-text">${m.message}</div>
                                    </div>`;
                                }
                                // מחזירים את מקטע ה-HTML כדי לצרף אותו לרשימת ההודעות.
                                return html;
                                }
                            ).join('')}
                        </div>
                        
                        <div class="reply-section admin-reply-section">
                            <input class="admin-reply-input" type="text" id="reply-input-${htmlId}" placeholder="הקלידי תגובה ללקוח כאן (לחצי Enter לשליחה)..." onkeypress="handleAdminEnter(event, '${user}', '${chatId}', '${htmlId}')">
                            <button class="admin-reply-button" onclick="sendReply('${user}', '${chatId}', '${htmlId}')">שלחי תגובה</button>
                        </div>
                    </div>
                </div>
            `;
            // מוסיפים את כרטיס השיחה לרשימה ומגדילים את מספר השיחות שהוצגו.
            container.innerHTML += chatHtml;
            renderedChatCount += 1;
        }
    }

    // כאשר הסינון העלים את כל התוצאות, מציגים הודעת ריק במקום רשימה ריקה.
    if (renderedChatCount === 0) {
        container.innerHTML = pendingOnly
            ? '<p class="status-msg">אין הודעות שממתינות לטיפול</p>'
            : '<p class="status-msg">אין היסטוריית שיחות ללקוח הזה</p>';
    }
}

/**
 * משנה את מצב התצוגה של גוף שיחה במסך הניהול.
 * @param {string} htmlId מזהה רכיב השיחה.
 * @returns {void} מציג או מסתיר את תוכן השיחה.
 */
window.toggleChat = function(htmlId) {
    // הופכים את מצב hidden של גוף השיחה המתאים למזהה שנוצר בעת הרינדור.
    const chatDiv = document.getElementById(htmlId);
    if (chatDiv) chatDiv.hidden = !chatDiv.hidden;
};

// --- הפונקציה החדשה למנהל לטיפול במקש Enter ---
/**
 * שולח את תגובת המנהל כאשר מקש Enter נלחץ בשדה התגובה.
 * @param {KeyboardEvent} event אירוע המקלדת.
 * @param {string} username שם הלקוח.
 * @param {string} chatId מזהה השיחה.
 * @param {string} htmlId מזהה רכיב השיחה בממשק.
 * @returns {void} מונע ירידת שורה ושולח את התגובה בעת הצורך.
 */
window.handleAdminEnter = function(event, username, chatId, htmlId) {
    // Enter שולח תגובה במקום לבצע פעולה רגילה של מעבר שורה/שליחת טופס.
    if (event.key === 'Enter') {
        event.preventDefault();
        sendReply(username, chatId, htmlId);
    }
};

/**
 * שולח תגובת מנהל לשרת וטוען מחדש את השיחות לאחר הצלחה.
 * @param {string} username שם הלקוח המקבל.
 * @param {string} chatId מזהה השיחה שאליה מתווספת התגובה.
 * @param {string} htmlId מזהה רכיב הקלט של השיחה.
 * @returns {Promise<void>} שולח את התגובה ומעדכן את התצוגה.
 */
async function sendReply(username, chatId, htmlId) {
    // קוראים את שדה התגובה של אותה שיחה ומסירים רווחים בקצוות.
    const replyInput = document.getElementById(`reply-input-${htmlId}`);
    const replyText = replyInput.value.trim();

    // אין לשלוח תגובה ריקה; מבקשים מהמנהל לכתוב תוכן לפני שליחה.
    if (!replyText) {
        alert('נא להקליד תוכן לתגובה');
        return;
    }

    try {
        // שולחים את זהות הלקוח, מזהה השיחה והתגובה לשרת.
        const token = localStorage.getItem('token');
        const response = await ApiService.request('/api/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username, chatId, reply: replyText }) 
        });

        // בודקים גם דגל הצלחה וגם סטטוס HTTP לפני רענון השיחות.
        const data = await response.json();
        if (data.success || response.ok) {
            // בקשה תקינה מרעננת את המטמון ומרנדרת את התגובה החדשה.
            loadMessages(); // טוען מחדש ומרנדר את השיחות כדי להציג את התגובה שנשלחה
        } else {
            // תשובה שלא אושרה מוצגת כהודעת כשל למנהל.
            alert('שגיאה בשליחת התגובה');
        }
    } catch (err) {
        // תקלה בבקשה או בתקשורת מוצגת בלי לשנות את תוכן הטיוטה.
        alert('שגיאת תקשורת מול השרת');
    }
}

/**
 * טוען משתמשים מהשרת ושומר אותם במטמון לצורך סינון.
 * @returns {Promise<void>} מרנדר את המשתמשים או הודעת שגיאה.
 */
async function loadUsers() {
    // מאתרים את גוף הטבלה שבו תופיע רשימת המשתמשים.
    const tableBody = document.getElementById('usersTableBody');
    try {
        // מבקשים מהשרת משתמשים עם אסימון מנהל.
        const response = await ApiService.request('/api/users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        // אין לרנדר תשובה שנדחתה; משאירים את הטבלה כפי שהיא.
        if (!response.ok) return;
        // מקבלים גם תשובת מערך ישירה וגם תשובה שעוטפת את המשתמשים במאפיין users.
        const data = await response.json();
        // תומכים בתשובה כמערך ישיר וגם במעטפת אובייקט המכילה את המערך.
        allUsersCache = Array.isArray(data) ? data : (data.users || []);
        renderUsers(allUsersCache);
    } catch (err) {
        // מציגים שורת שגיאה בטבלה כאשר טעינת הרשימה נכשלה.
        tableBody.innerHTML = '<tr><td colspan="6" class="status-msg">שגיאה בטעינת רשימת הלקוחות</td></tr>';
    }
}

/**
 * מסנן את רשימת המשתמשים לפי שם משתמש, שם מלא או כתובת דוא״ל.
 * @returns {void} מרנדר את המשתמשים התואמים לחיפוש.
 */
window.filterAdminUsers = function() {
    // קוראים את טקסט החיפוש ומחפשים בו-זמנית בשם המשתמש, בשם המלא ובאימייל.
    const query = document.getElementById('adminSearchUsers')?.value.trim().toLowerCase() || '';
    // מציגים מחדש רק משתמשים שהשדות המורכבים שלהם כוללים את הביטוי שחיפשו.
    const filteredUsers = allUsersCache.filter(user => {
        const searchableText = `${user.username || ''} ${user.fullName || ''} ${user.email || ''}`.toLowerCase();
        return searchableText.includes(query);
    });
    renderUsers(filteredUsers);
};

/**
 * מרנדר את רשימת המשתמשים בטבלה ומקשר פעולות להצגת היסטוריית לקוח.
 * @param {Array<object>} users המשתמשים להצגה.
 * @returns {void} מעדכן את גוף טבלת המשתמשים.
 */
function renderUsers(users) {
    // מאתרים את גוף הטבלה ומפסיקים אם אין יעד להצגת המשתמשים.
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    // מציגים הודעת ריק אם הסינון או התשובה לא החזירו משתמשים.
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="status-msg">לא נמצאו לקוחות</td></tr>';
        return;
    }

    // בונים שורת טבלה לכל משתמש ומקודדים ערכים שמוכנסים לתוך HTML.
    tableBody.innerHTML = users.map(
        /**
         * יוצר שורת טבלה עם פרטי משתמש וקישור להיסטוריית השיחות שלו.
         * @param {object} user נתוני המשתמש.
         * @param {number} index מיקום המשתמש ברשימה.
         * @returns {string} HTML של שורת המשתמש.
         */
        (user, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(user.username || user.fullName || 'ללא שם')}</td>
            <td>${escapeHtml(user.email || 'לא עודכן')}</td>
            <td><span class="plan-tag">${escapeHtml(user.plan || 'בסיסי')}</span></td>
            <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString('he-IL') : 'חדש'}</td>
            <td>
                <button class="btn-secondary client-history-btn" data-username="${escapeHtml(user.username || '')}">
                    צפה בהיסטוריה
                </button>
            </td>
        </tr>
    `).join('');

    /**
     * מקשר כל כפתור היסטוריה לטעינת השיחות של הלקוח המתאים.
     * @param {HTMLButtonElement} button כפתור ההיסטוריה שנוצר בטבלה.
     * @returns {void} מתקין מאזין לחיצה עבור הלקוח.
     */
    tableBody.querySelectorAll('.client-history-btn').forEach(button => {
        // כל כפתור פותח את השיחות של שם המשתמש שמאוחסן ב-data-username.
        button.addEventListener('click', () => showClientHistory(button.dataset.username));
    });
}

/**
 * מציג את היסטוריית השיחות של לקוח מסוים ומגלגל אליה.
 * @param {string} username שם המשתמש שאת שיחותיו מציגים.
 * @returns {void} מעדכן כותרת ותצוגת שיחות.
 */
window.showClientHistory = function(username) {
    // מסנכרנים את שדה החיפוש עם הלקוח ומציגים את כל שיחותיו.
    const searchInput = document.getElementById('adminSearchClient');
    if (searchInput) searchInput.value = username;
    renderAdminChats(allMessagesCache.filter(message => message.username === username), false);

    // משנים כותרת ומגלגלים לאזור השיחות כדי להציג את ההיסטוריה מיד.
    const messagesTitle = document.getElementById('messagesSectionTitle');
    if (messagesTitle) {
        messagesTitle.textContent = `היסטוריית השיחות של ${username}`;
    }

    document.getElementById('messagesList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/**
 * מציג את השיחות הממתינות של כלל הלקוחות.
 * @returns {void} מאפס את החיפוש ומציג שיחות לא מטופלות.
 */
window.showAllClientChats = function() {
    // מנקים סינון ומציגים לכל המשתמשים רק פניות שממתינות למענה.
    const searchInput = document.getElementById('adminSearchClient');
    if (searchInput) searchInput.value = '';
    renderAdminChats(allMessagesCache, true);
    const messagesTitle = document.getElementById('messagesSectionTitle');
    if (messagesTitle) messagesTitle.textContent = 'הודעות נכנסות (ממתינות לטיפול)';
};

/**
 * מציג את היסטוריית כל השיחות, כולל שיחות שכבר טופלו.
 * @returns {void} מאפס את החיפוש ומרנדר מחדש את השיחות.
 */
window.showConversationHistory = function() {
    // מנקים את שדה החיפוש ומרנדרים היסטוריה מלאה, כולל שיחות שכבר טופלו.
    const searchInput = document.getElementById('adminSearchClient');
    if (searchInput) searchInput.value = '';
    renderAdminChats(allMessagesCache, false);
    const messagesTitle = document.getElementById('messagesSectionTitle');
    if (messagesTitle) messagesTitle.textContent = 'היסטוריית שיחות';
};

/**
 * מקודד תווים מיוחדים כדי להציג ערך טקסטואלי בבטחה בתוך HTML.
 * @param {*} value הערך שיש לקודד.
 * @returns {string} מחרוזת עם תווי HTML מוחלפים בישויות.
 */
function escapeHtml(value) {
    // ממירים תחילה ampersand כדי שהישויות שנוסיף בהמשך לא יקודדו פעם נוספת.
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}