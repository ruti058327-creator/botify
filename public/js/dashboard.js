let currentUserMessages = [];
let currentChatId = localStorage.getItem('currentChatId') || null;
let loggedInUsername = '';

document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('auth-buttons-container');
  const welcomeTitle = document.getElementById('welcome-title');

  if (!authContainer) return;

  const storedUser = localStorage.getItem('user');

  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      loggedInUsername = userData.username || userData.fullName || 'משתמש';

      if (welcomeTitle) welcomeTitle.textContent = `שלום, ${loggedInUsername}!`;

      const planEl = document.getElementById('userPlanDisplay');
      if (planEl) planEl.textContent = userData.plan || 'בסיסי';

      const dateEl = document.getElementById('userDateDisplay');
      if (dateEl && userData.createdAt) {
        dateEl.textContent = new Date(userData.createdAt).toLocaleDateString('he-IL');
      } else if (dateEl) {
        dateEl.textContent = 'פעיל במערכת';
      }

      // טעינה ראשונית של השיחות מהשרת
      loadUserMessages(loggedInUsername);

      authContainer.innerHTML = `
        <div class="user-greeting">
          <span>👤</span>
          <span>${loggedInUsername}</span>
        </div>
        <button id="logout-btn" class="btn-logout">התנתקות</button>
      `;

      document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('currentChatId');
        window.location.href = '../index.html';
      });

    } catch (e) {
      console.error('Error parsing session data', e);
    }
  } else {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = 'login.html';
  }

  // הפעלת מקש Enter בצ'אט הלקוח
  const chatInput = document.getElementById('chatInputDashboard');
  if (chatInput) {
      chatInput.addEventListener('keydown', function(event) {
          if (event.key === 'Enter') {
              event.preventDefault(); 
              sendMessageFromDashboard();
          }
      });
  }
});

async function loadUserMessages(username) {
    const container = document.getElementById('userMessagesList');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/user-messages?username=${username}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('שגיאה בשליפת ההודעות');

        const data = await response.json();
        currentUserMessages = data.messages || [];

        populateChatHistoryDropdown();
        renderCurrentChatWindow();
    } catch (err) {
        container.innerHTML = '<p class="status-msg" style="color: #dc2626;">שגיאה בטעינת השיחות.</p>';
    }
}

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

    uniqueChats.forEach((chatId) => {
        // מציאת ההודעה הראשונה בשיחה הזו כדי לתת לה תאריך הגיוני
        const firstMsg = currentUserMessages.find(m => (m.chatId || 'chat_old_history') === chatId);
        const dateStr = firstMsg ? new Date(firstMsg.createdAt).toLocaleString('he-IL') : 'שיחה';
        
        const option = document.createElement('option');
        option.value = chatId;
        option.textContent = `שיחה מ- ${dateStr}`;
        if (chatId === currentChatId) {
            option.selected = true;
        }
        selectEl.appendChild(option);
    });
}

function renderCurrentChatWindow() {
    const container = document.getElementById('userMessagesList');
    
    if (currentUserMessages.length === 0) {
        container.innerHTML = '<p class="status-msg" style="text-align: center; margin-top: 20px;">אין היסטוריית שיחות. הקלד הודעה למטה כדי להתחיל.</p>';
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
        container.innerHTML = '<p class="status-msg" style="text-align: center; margin-top: 20px; font-weight: bold; color: #2563eb;">✨ שיחה חדשה פתוחה! הקלד/י למטה כדי להתחיל.</p>';
        return;
    }

    chatMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    container.innerHTML = chatMessages.map(msg => {
        let html = '';
        if (!msg.isAdmin) {
            html += `
            <div style="display: flex; flex-direction: column; margin-bottom: 12px;">
                <div style="align-self: flex-start; background: #ffffff; padding: 12px 16px; border-radius: 16px 16px 16px 0; max-width: 85%; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">${new Date(msg.createdAt).toLocaleString('he-IL')} - <strong>אני</strong></div>
                    <div style="color: #334155; font-size: 15px;">${msg.message}</div>
                </div>
            </div>`;
        } else {
            html += `
            <div style="display: flex; flex-direction: column; margin-bottom: 12px;">
                <div style="align-self: flex-end; background: #eff6ff; padding: 12px 16px; border-radius: 16px 16px 0 16px; max-width: 85%; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #bfdbfe;">
                    <div style="font-size: 11px; color: #3b82f6; margin-bottom: 4px;">${new Date(msg.createdAt).toLocaleString('he-IL')} - <strong>צוות Botify</strong></div>
                    <div style="color: #1e40af; font-size: 15px;">${msg.message}</div>
                </div>
            </div>`;
        }
        return html;
    }).join('');

    // ירידה אוטומטית לסוף חלון הצ'אט
    container.scrollTop = container.scrollHeight;
}

// לחיצה על הכפתור שמנקה את המסך לשיחה חדשה
window.startNewChat = function() {
    currentChatId = 'chat_' + Date.now();
    localStorage.setItem('currentChatId', currentChatId); // שומר מיד!
    
    const selectEl = document.getElementById('chatHistorySelect');
    if (selectEl) selectEl.value = ""; 
    
    renderCurrentChatWindow(); // זה יראה חלון נקי הודות לבדיקה ברינדור
};

// כשבוחרים שיחה ישנה מהרשימה
window.loadSelectedChat = function() {
    const selectEl = document.getElementById('chatHistorySelect');
    if (!selectEl || !selectEl.value) return;
    
    currentChatId = selectEl.value;
    localStorage.setItem('currentChatId', currentChatId);
    renderCurrentChatWindow();
};

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
        const response = await fetch('/api/contact', {
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