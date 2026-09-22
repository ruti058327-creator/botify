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

        const grouped = {};
        messages.forEach(msg => {
            const user = msg.username || 'אורח';
            if (user.startsWith('מנהלת')) return; 
            if (!grouped[user]) grouped[user] = [];
            grouped[user].push(msg);
        });

        container.innerHTML = '';
        if (Object.keys(grouped).length === 0) {
            container.innerHTML = '<p class="status-msg">אין שיחות פעילות כרגע</p>';
            return;
        }

        for (const [user, userMessages] of Object.entries(grouped)) {
            userMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            
            const lastMsg = userMessages[userMessages.length - 1];
            // סטטוס: אם ההודעה האחרונה היא לא של אדמין, אז היא ממתינה לתשובה
            const needsAttention = !lastMsg.isAdmin && (!lastMsg.reply || lastMsg.reply.trim() === '');
            
            const statusBadge = needsAttention 
                ? '<span style="background: #fee2e2; color: #dc2626; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">🔴 ממתין לתשובה</span>' 
                : '<span style="background: #dcfce7; color: #16a34a; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">🟢 טופל</span>';

            const borderColor = needsAttention ? '#fca5a5' : '#e2e8f0';
            const headerBg = needsAttention ? '#fef2f2' : '#f8fafc';
            const displayState = needsAttention ? 'block' : 'none';

            const chatHtml = `
                <div class="message-card" style="margin-bottom: 15px; border: 1px solid ${borderColor}; border-radius: 8px; overflow: hidden; background: #fff;">
                    <div style="background: ${headerBg}; padding: 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border-bottom: 1px solid #e2e8f0;" onclick="toggleChat('${user}')">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <h3 style="margin: 0; font-size: 16px; color: #1e293b;">💬 שיחה עם: <span style="color: #2563eb;">${user}</span></h3>
                            ${statusBadge}
                        </div>
                        <button class="btn-secondary" style="background: #e2e8f0; color: #334155; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">הצג / הסתר שיחה ▾</button>
                    </div>
                    
                    <div id="chat-${user}" style="display: ${displayState}; padding: 15px;">
                        <div style="max-height: 350px; overflow-y: auto; margin-bottom: 15px; display: flex; flex-direction: column; gap: 12px; padding-left: 5px;">
                            ${userMessages.map(m => {
                                let html = '';
                                if (!m.isAdmin) {
                                    html += `
                                    <div style="align-self: flex-start; background: #f1f5f9; padding: 12px 16px; border-radius: 16px 16px 16px 0; max-width: 85%; border: 1px solid #e2e8f0;">
                                        <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">${new Date(m.createdAt).toLocaleString('he-IL')} - <strong>לקוח</strong></div>
                                        <div style="color: #334155;">${m.message}</div>
                                    </div>`;
                                    if (m.reply) {
                                        html += `
                                        <div style="align-self: flex-end; background: #eff6ff; padding: 12px 16px; border-radius: 16px 16px 0 16px; max-width: 85%; border: 1px solid #bfdbfe; margin-top: 12px;">
                                            <div style="color: #3b82f6; font-size: 11px; margin-bottom: 4px;"><strong>מנהלת</strong></div>
                                            <div style="color: #1e40af;">${m.reply}</div>
                                        </div>`;
                                    }
                                } else {
                                    html += `
                                    <div style="align-self: flex-end; background: #eff6ff; padding: 12px 16px; border-radius: 16px 16px 0 16px; max-width: 85%; border: 1px solid #bfdbfe;">
                                        <div style="color: #3b82f6; font-size: 11px; margin-bottom: 4px;">${new Date(m.createdAt).toLocaleString('he-IL')} - <strong>מנהלת</strong></div>
                                        <div style="color: #1e40af;">${m.message}</div>
                                    </div>`;
                                }
                                return html;
                            }).join('')}
                        </div>
                        
                        <div style="display: flex; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                            <input type="text" id="reply-input-${user}" placeholder="הקלידי תגובה ללקוח כאן..." style="flex: 1; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none;">
                            <button onclick="sendReply('${user}')" style="background: #2563eb; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: bold; cursor: pointer;">שלחי תגובה</button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += chatHtml;
        }
    } catch (err) {
        console.error('Error loading messages:', err);
        container.innerHTML = '<p class="status-msg error">שגיאה בטעינת השיחות מהשרת</p>';
    }
}

window.toggleChat = function(username) {
    const chatDiv = document.getElementById(`chat-${username}`);
    if (chatDiv) chatDiv.style.display = chatDiv.style.display === 'none' ? 'block' : 'none';
};

async function sendReply(username) {
    const replyInput = document.getElementById(`reply-input-${username}`);
    const replyText = replyInput.value.trim();

    if (!replyText) {
        alert('נא להקליד תוכן לתגובה');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username, reply: replyText }) 
        });

        const data = await response.json();
        if (data.success || response.ok) {
            loadMessages(); 
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