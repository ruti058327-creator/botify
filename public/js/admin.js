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

    const username = String(userData.username || userData.name || '').toUpperCase().trim();
    if (userData.role !== 'admin' || !localStorage.getItem('token')) {
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
        const response = await ApiService.request('/api/users/count', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        if (!response.ok) throw new Error('שגיאה');
        const data = await response.json();
        const countElement = document.getElementById('subscriberCount');
        if (countElement && data.count !== undefined) countElement.textContent = data.count;
    } catch (err) {}
}

async function loadMessages() {
    const container = document.getElementById('messagesList');
    try {
        const response = await ApiService.request('/api/messages', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
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
        container.innerHTML = pendingOnly
            ? '<p class="status-msg">אין הודעות שממתינות לטיפול</p>'
            : '<p class="status-msg">אין היסטוריית שיחות ללקוח הזה</p>';
        return;
    }

    let boxCounter = 1;
    let renderedChatCount = 0;

    for (const [user, userChats] of Object.entries(groupedByUserAndChat)) {
        for (const [chatId, chatMessages] of Object.entries(userChats)) {
            chatMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            
            const lastMsg = chatMessages[chatMessages.length - 1];
            const needsAttention = !lastMsg.isAdmin && (!lastMsg.reply || lastMsg.reply.trim() === '');
                if (pendingOnly && !needsAttention) {
                    continue;
                }
            
            const chatStatusClass = needsAttention ? 'is-pending' : 'is-resolved';
            const statusBadge = needsAttention
                ? '<span class="chat-status-badge is-pending">🔴 ממתין לתשובה</span>'
                : '<span class="chat-status-badge is-resolved">🟢 טופל</span>';
            const htmlId = `chatBox_${boxCounter++}`;
            
            // תאריך פתיחת השיחה לתצוגה יפה למנהל
            const chatStartDate = new Date(chatMessages[0].createdAt).toLocaleString('he-IL');

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
                            ${chatMessages.map(m => {
                                let html = '';
                                if (!m.isAdmin) {
                                    html += `
                                    <div class="admin-chat-bubble admin-chat-bubble-client">
                                        <div class="admin-chat-meta">${new Date(m.createdAt).toLocaleString('he-IL')} - <strong>לקוח</strong></div>
                                        <div class="admin-chat-text">${m.message}</div>
                                    </div>`;
                                } else {
                                    html += `
                                    <div class="admin-chat-bubble admin-chat-bubble-admin">
                                        <div class="admin-chat-meta">${new Date(m.createdAt).toLocaleString('he-IL')} - <strong>מנהלת</strong></div>
                                        <div class="admin-chat-text">${m.message}</div>
                                    </div>`;
                                }
                                return html;
                            }).join('')}
                        </div>
                        
                        <div class="reply-section admin-reply-section">
                            <input class="admin-reply-input" type="text" id="reply-input-${htmlId}" placeholder="הקלידי תגובה ללקוח כאן (לחצי Enter לשליחה)..." onkeypress="handleAdminEnter(event, '${user}', '${chatId}', '${htmlId}')">
                            <button class="admin-reply-button" onclick="sendReply('${user}', '${chatId}', '${htmlId}')">שלחי תגובה</button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += chatHtml;
            renderedChatCount += 1;
        }
    }

    if (renderedChatCount === 0) {
        container.innerHTML = pendingOnly
            ? '<p class="status-msg">אין הודעות שממתינות לטיפול</p>'
            : '<p class="status-msg">אין היסטוריית שיחות ללקוח הזה</p>';
    }
}

window.toggleChat = function(htmlId) {
    const chatDiv = document.getElementById(htmlId);
    if (chatDiv) chatDiv.hidden = !chatDiv.hidden;
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
        const response = await ApiService.request('/api/reply', {
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
        const response = await ApiService.request('/api/users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
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
                <button class="btn-secondary client-history-btn" data-username="${escapeHtml(user.username || '')}">
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
    renderAdminChats(allMessagesCache.filter(message => message.username === username), false);

    const messagesTitle = document.getElementById('messagesSectionTitle');
    if (messagesTitle) {
        messagesTitle.textContent = `היסטוריית השיחות של ${username}`;
    }

    document.getElementById('messagesList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.showAllClientChats = function() {
    const searchInput = document.getElementById('adminSearchClient');
    if (searchInput) searchInput.value = '';
    renderAdminChats(allMessagesCache, true);
    const messagesTitle = document.getElementById('messagesSectionTitle');
    if (messagesTitle) messagesTitle.textContent = 'הודעות נכנסות (ממתינות לטיפול)';
};

window.showConversationHistory = function() {
    const searchInput = document.getElementById('adminSearchClient');
    if (searchInput) searchInput.value = '';
    renderAdminChats(allMessagesCache, false);
    const messagesTitle = document.getElementById('messagesSectionTitle');
    if (messagesTitle) messagesTitle.textContent = 'היסטוריית שיחות';
};

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}