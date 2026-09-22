const ADMIN_CREDENTIALS = {
    "NOA": "578621",
    "RUTI": "578621",
    "MIRYAM": "578621"
};

let allMessagesCache = [];
let allUsersCache = [];

document.addEventListener('DOMContentLoaded', () => {
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

    const rawUsername = userData.username || userData.name || '';
    const username = rawUsername.toString().toUpperCase().trim();

    if (!ADMIN_CREDENTIALS[username]) {
        alert('אין לך הרשאה לגשת לעמוד הניהול');
        window.location.href = 'dashboard.html';
        return;
    }

    const adminInfoEl = document.getElementById('adminNameDisplay');
    if (adminInfoEl) {
        adminInfoEl.textContent = username;
    }

    loadSubscriberCount();
    loadMessages();
    loadUsers();
});

async function loadSubscriberCount() {
    try {
        const response = await fetch('/api/users/count');
        if (!response.ok) throw new Error('שגיאה');
        const data = await response.json();
        const countElement = document.getElementById('subscriberCount');
        if (countElement && data.count !== undefined) countElement.textContent = data.count;
    } catch (err) {}
}

async function loadMessages() {
    const container = document.getElementById('messagesList');
    try {
        const response = await fetch('/api/messages');
        if (!response.ok) throw new Error('שגיאה בשליפת הודעות');

        const data = await response.json();
        allMessagesCache = data.messages || [];
        renderAdminChats(allMessagesCache, true);
    } catch (err) {
        container.innerHTML = '<p class="status-msg error">שגיאה בטעינת השיחות מהשרת</p>';
    }
}

window.filterAdminChats = function() {
    const query = document.getElementById('adminSearchClient')?.value.trim().toLowerCase() || '';
    if (!query) {
        renderAdminChats(allMessagesCache, true);
        return;
    }
    const filtered = allMessagesCache.filter(msg => {
        const user = msg.username || '';
        return user.toLowerCase().includes(query);
    });
    renderAdminChats(filtered, true);
};

function renderAdminChats(messages, pendingOnly = false) {
    const container = document.getElementById('messagesList');
    const groupedByUserAndChat = {};

    // חלוקה מדויקת למנהל: קודם שם לקוח, ואז לפי תעודת הזהות של השיחה (chatId)
    messages.forEach(msg => {
        const user = msg.username || 'אורח';
        if (user.startsWith('מנהלת')) return; 
        
        // וידוא שיש מזהה שיחה כלשהו
        const chatId = msg.chatId || 'chat_old_history'; 

        if (!groupedByUserAndChat[user]) groupedByUserAndChat[user] = {};
        if (!groupedByUserAndChat[user][chatId]) groupedByUserAndChat[user][chatId] = [];
        
        groupedByUserAndChat[user][chatId].push(msg);
    });

    container.innerHTML = '';
    if (Object.keys(groupedByUserAndChat).length === 0) {
        container.innerHTML = '<p class="status-msg">אין שיחות פעילות כרגע</p>';
        return;
    }

    let boxCounter = 1;

    for (const [user, userChats] of Object.entries(groupedByUserAndChat)) {
        for (const [chatId, chatMessages] of Object.entries(userChats)) {
            chatMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            
            const lastMsg = chatMessages[chatMessages.length - 1];
            const needsAttention = !lastMsg.isAdmin && (!lastMsg.reply || lastMsg.reply.trim() === '');
            
            const statusBadge = needsAttention 
                ? '<span style="background: #fee2e2; color: #dc2626; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">🔴 ממתין לתשובה</span>' 
                : '<span style="background: #dcfce7; color: #16a34a; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">🟢 טופל</span>';

            const borderColor = needsAttention ? '#fca5a5' : '#e2e8f0';
            const headerBg = needsAttention ? '#fef2f2' : '#f8fafc';
            const htmlId = `chatBox_${boxCounter++}`;
            
            // תאריך פתיחת השיחה לתצוגה יפה למנהל
            const chatStartDate = new Date(chatMessages[0].createdAt).toLocaleString('he-IL');

            const chatHtml = `
                <div class="message-card" style="margin-bottom: 15px; border: 1px solid ${borderColor}; border-radius: 8px; overflow: hidden; background: #fff;">
                    <div style="background: ${headerBg}; padding: 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border-bottom: 1px solid #e2e8f0;" onclick="toggleChat('${htmlId}')">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <h3 style="margin: 0; font-size: 16px; color: #1e293b;">💬 שיחה עם: <span style="color: #2563eb;">${user}</span> <span style="font-size: 12px; color: #64748b;">(נפתחה: ${chatStartDate})</span></h3>
                            ${statusBadge}
                        </div>
                        <button class="btn-secondary" style="background: #e2e8f0; color: #334155; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">הצג / הסתר שיחה ▾</button>
                    </div>
                    
                    <div id="${htmlId}" style="display: none; padding: 15px;">
                        <div style="max-height: 350px; overflow-y: auto; margin-bottom: 15px; display: flex; flex-direction: column; gap: 12px; padding-left: 5px;">
                            ${chatMessages.map(m => {
                                let html = '';
                                if (!m.isAdmin) {
                                    html += `
                                    <div style="align-self: flex-start; background: #f1f5f9; padding: 12px 16px; border-radius: 16px 16px 16px 0; max-width: 85%; border: 1px solid #e2e8f0;">
                                        <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">${new Date(m.createdAt).toLocaleString('he-IL')} - <strong>לקוח</strong></div>
                                        <div style="color: #334155;">${m.message}</div>
                                    </div>`;
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
                            <input type="text" id="reply-input-${htmlId}" placeholder="הקלידי תגובה ללקוח כאן (לחצי Enter לשליחה)..." style="flex: 1; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none;" onkeypress="handleAdminEnter(event, '${user}', '${chatId}', '${htmlId}')">
                            <button onclick="sendReply('${user}', '${chatId}', '${htmlId}')" style="background: #2563eb; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: bold; cursor: pointer;">שלחי תגובה</button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += chatHtml;
        }
    }
}

window.toggleChat = function(htmlId) {
    const chatDiv = document.getElementById(htmlId);
    if (chatDiv) chatDiv.style.display = chatDiv.style.display === 'none' ? 'block' : 'none';
};

// --- הפונקציה החדשה למנהל לטיפול במקש Enter ---
window.handleAdminEnter = function(event, username, chatId, htmlId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendReply(username, chatId, htmlId);
    }
};

async function sendReply(username, chatId, htmlId) {
    const replyInput = document.getElementById(`reply-input-${htmlId}`);
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
            body: JSON.stringify({ username, chatId, reply: replyText }) 
        });

        const data = await response.json();
        if (data.success || response.ok) {
            loadMessages(); // טוען מחדש ומרנדר את השיחות כדי להציג את התגובה שנשלחה
        } else {
            alert('שגיאה בשליחת התגובה');
        }
    } catch (err) {
        alert('שגיאת תקשורת מול השרת');
    }
}

async function loadUsers() {
    const tableBody = document.getElementById('usersTableBody');
    try {
        const response = await fetch('/api/users');
        if (!response.ok) return;
        const data = await response.json();
        allUsersCache = Array.isArray(data) ? data : (data.users || []);
        renderUsers(allUsersCache);
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="6" class="status-msg">שגיאה בטעינת רשימת הלקוחות</td></tr>';
    }
}

window.filterAdminUsers = function() {
    const query = document.getElementById('adminSearchUsers')?.value.trim().toLowerCase() || '';
    const filteredUsers = allUsersCache.filter(user => {
        const searchableText = `${user.username || ''} ${user.fullName || ''} ${user.email || ''}`.toLowerCase();
        return searchableText.includes(query);
    });
    renderUsers(filteredUsers);
};

function renderUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="status-msg">לא נמצאו לקוחות</td></tr>';
        return;
    }

    tableBody.innerHTML = users.map((user, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(user.username || user.fullName || 'ללא שם')}</td>
            <td>${escapeHtml(user.email || 'לא עודכן')}</td>
            <td><span class="plan-tag">${escapeHtml(user.plan || 'בסיסי')}</span></td>
            <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString('he-IL') : 'חדש'}</td>
            <td>
                <button class="btn-secondary client-history-btn" data-username="${escapeHtml(user.username || '')}" style="padding: 6px 10px; border: 0; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer;">
                    צפה בהיסטוריה
                </button>
            </td>
        </tr>
    `).join('');

    tableBody.querySelectorAll('.client-history-btn').forEach(button => {
        button.addEventListener('click', () => showClientHistory(button.dataset.username));
    });
}

window.showClientHistory = function(username) {
    const searchInput = document.getElementById('adminSearchClient');
    if (searchInput) searchInput.value = username;
    renderAdminChats(allMessagesCache.filter(message => message.username === username));

    const messagesTitle = document.querySelector('#messagesList')?.previousElementSibling?.querySelector('h2');
    if (messagesTitle) {
        messagesTitle.textContent = `היסטוריית השיחות של ${username}`;
    }

    document.getElementById('messagesList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.showAllClientChats = function() {
    const searchInput = document.getElementById('adminSearchClient');
    if (searchInput) searchInput.value = '';
    renderAdminChats(allMessagesCache);
};

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}