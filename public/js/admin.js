// רשימת המנהלות המורשות והסיסמה האחידה שלהן (57862)
const ADMIN_CREDENTIALS = {
    "NOA": "578621",
    "RUTI": "578621",
    "MIRYAM": "578621"
};

document.addEventListener('DOMContentLoaded', () => {
    // אבטחת עמוד הניהול - בדיקה האם המשתמש מחובר והוא אכן אחת משלושת המנהלות
    const storedUser = localStorage.getItem('user');
    
    if (!storedUser) {
        window.location.href = 'login.html';
        return;
    }

    let userData;
    try {
        userData = JSON.parse(storedUser);
    } catch (e) {
        window.location.href = 'login.html';
        return;
    }

    // המרה לאותיות גדולות וגם בדיקה בטוחה של מבנה האובייקט
    const rawUsername = userData.username || userData.name || '';
    const username = rawUsername.toString().toUpperCase().trim();

    // בדיקה האם שם המשתמש נמצא ברשימת המנהלות המורשות
    if (!ADMIN_CREDENTIALS[username]) {
        alert('אין לך הרשאה לגשת לעמוד הניהול');
        window.location.href = 'dashboard.html';
        return;
    }

    // הצגת שם המנהלת המחוברת בסיידבר
    const adminInfoEl = document.getElementById('adminNameDisplay');
    if (adminInfoEl) {
        adminInfoEl.textContent = username;
    }

    // טעינת נתוני המערכת
    loadSubscriberCount();
    loadMessages();
    loadUsers();
});

async function loadSubscriberCount() {
    try {
        const response = await fetch('/api/users/count');
        if (!response.ok) throw new Error('שגיאה בשליפת כמות מנויים');
        
        const data = await response.json();
        const countElement = document.getElementById('subscriberCount');
        if (countElement && data.count !== undefined) {
            countElement.textContent = data.count;
        }
    } catch (err) {
        console.error('Error fetching count:', err);
        const countElement = document.getElementById('subscriberCount');
        if (countElement) countElement.textContent = '-';
    }
}

async function loadMessages() {
    const container = document.getElementById('messagesList');
    try {
        const response = await fetch('/api/messages');
        if (!response.ok) throw new Error('שגיאה בשליפת הודעות');

        const data = await response.json();
        const messages = data.messages || [];

        if (messages.length > 0) {
            container.innerHTML = messages.map(msg => `
                <div class="message-card">
                    <div class="message-header">
                        <span>שם משתמש: <span class="message-username">${msg.username || 'לא צויין'}</span></span>
                        <span class="message-date">${new Date(msg.createdAt).toLocaleString('he-IL')}</span>
                    </div>
                    <div class="message-text">${msg.message}</div>
                    
                    <div class="reply-section">
                        <input type="text" id="reply-${msg._id}" placeholder="הקלד תגובה למשתמש...">
                        <button onclick="sendReply('${msg.username}', '${msg._id}')">שלח תגובה</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="status-msg">אין הודעות חדשות כרגע</p>';
        }
    } catch (err) {
        console.error('Error loading messages:', err);
        container.innerHTML = '<p class="status-msg error">שגיאה בטעינת ההודעות מהשרת</p>';
    }
}

async function sendReply(username, messageId) {
    const replyInput = document.getElementById(`reply-${messageId}`);
    const replyText = replyInput.value.trim();

    if (!replyText) {
        alert('נא להקליד תוכן לתגובה');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/reply', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            // הוספנו כאן את ה-messageId
            body: JSON.stringify({ username, messageId, reply: replyText }) 
        });

        const data = await response.json();
        if (data.success || response.ok) {
            alert('התגובה נשלחה ונשמרה בהצלחה!');
            replyInput.value = '';
        } else {
            alert('שגיאה בשליחת התגובה: ' + (data.message || 'לא סופקה סיבה'));
        }
    } catch (err) {
        console.error('Error:', err);
        alert('שגיאת תקשורת מול השרת');
    }
}

async function loadUsers() {
    const tableBody = document.getElementById('usersTableBody');
    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('שגיאת תקשורת מול השרת');

        const data = await response.json();
        const users = Array.isArray(data) ? data : (data.users || []);
        
        tableBody.innerHTML = '';

        if (users.length > 0) {
            users.forEach((user, index) => {
                const row = `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${user.username || 'ללא שם'}</td>
                        <td>${user.email || 'לא עודכן'}</td>
                        <td><span class="plan-tag">${user.plan || 'בסיסי'}</span></td>
                        <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString('he-IL') : 'חדש'}</td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" class="status-msg">אין משתמשים רשומים כרגע במערכת</td></tr>';
        }
    } catch (err) {
        console.error('Error:', err);
        tableBody.innerHTML = '<tr><td colspan="5" class="status-msg error">שגיאה בטעינת הנתונים מהשרת</td></tr>';
    }
}