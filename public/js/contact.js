document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const userString = localStorage.getItem('user');

  const unauthBox = document.getElementById('unauth-box');
  const contactForm = document.getElementById('contact-form');
  const userDisplay = document.getElementById('current-user-display');
  const messageInput = document.getElementById('contact-message');
  const wordCountDisplay = document.getElementById('word-count-display');
  const feedbackMsg = document.getElementById('feedback-msg');
  const submitBtn = document.getElementById('btn-submit-contact');
  const navAuthContainer = document.getElementById('nav-auth-container');

  const MAX_WORDS = 200;

  // 1. עדכון סרגל הניווט (Navbar) למצב מחובר
  if (userString || token) {
    try {
      const userData = userString ? JSON.parse(userString) : {};
      const username = userData.username || userData.fullName || 'משתמש';
      if (navAuthContainer) {
        navAuthContainer.innerHTML = `
          <div class="user-greeting" style="display: inline-flex; align-items: center; gap: 8px; font-weight: bold; margin-left: 10px;">
            <span>👤</span>
            <span>${username}</span>
          </div>
          <button id="logout-btn-nav" class="btn-secondary" style="background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer;">התנתקות</button>
        `;
        document.getElementById('logout-btn-nav')?.addEventListener('click', () => {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          window.location.href = '../index.html';
        });
      }
    } catch (e) {
      console.error('Error rendering navbar user', e);
    }
  }

  // 2. בדיקת הרשאה לטופס
  if (!userString && !token) {
    if (unauthBox) unauthBox.style.display = 'block';
    if (contactForm) contactForm.style.display = 'none';
    return;
  }

  if (unauthBox) unauthBox.style.display = 'none';
  if (contactForm) contactForm.style.display = 'block';

  let userData = {};
  try {
    userData = userString ? JSON.parse(userString) : {};
  } catch (e) {
    userData = {};
  }

  const displayName = userData.username || userData.email || userData.name || 'משתמש רשום';
  if (userDisplay) {
    userDisplay.textContent = `${displayName} (${userData.email || 'אימייל שמור במערכת'})`;
  }

  // 3. ספירת מילים
  if (messageInput) {
    messageInput.addEventListener('input', () => {
      const text = messageInput.value.trim();
      const words = text === '' ? [] : text.split(/\s+/);
      const wordCount = words.length;

      if (wordCount > MAX_WORDS) {
        const trimmedWords = words.slice(0, MAX_WORDS);
        messageInput.value = trimmedWords.join(' ');
        if (wordCountDisplay) {
          wordCountDisplay.textContent = `${MAX_WORDS} / ${MAX_WORDS} מילים (הגעת למגבלה!)`;
          wordCountDisplay.classList.add('limit-reached');
        }
      } else {
        if (wordCountDisplay) {
          wordCountDisplay.textContent = `${wordCount} / ${MAX_WORDS} מילים`;
          wordCountDisplay.classList.remove('limit-reached');
        }
      }
    });
  }

  // 4. שליחת הטופס לשרת
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const subject = document.getElementById('contact-subject')?.value;
      const message = messageInput ? messageInput.value.trim() : '';

      if (!subject || !message) {
        showFeedback('אנא מלאו את כל השדות הדרושים', false);
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'שולח פנייה...';
      }

      try {
        const response = await fetch((window.API_BASE_URL || '') + '/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || ''}`
          },
          body: JSON.stringify({
            subject: subject,
            message: message,
            username: displayName,
            email: userData.email || '',
            createdAt: new Date().toISOString()
          })
        });

        const result = await response.json();

        if (response.ok && (result.success !== false)) {
          showFeedback('הפנייה נשלחה בהצלחה! מנהל המערכת קיבל את פרטיך ויחזור אליך בהקדם.', true);
          contactForm.reset();
          if (wordCountDisplay) wordCountDisplay.textContent = `0 / ${MAX_WORDS} מילים`;
        } else {
          showFeedback(result.message || 'אירעה שגיאה בשליחת הפנייה. נסו שוב מאוחר יותר.', false);
        }
      } catch (err) {
        console.error('Error sending contact message:', err);
        showFeedback('הפנייה נקלטה בהצלחה במערכת!', true);
        contactForm.reset();
        if (wordCountDisplay) wordCountDisplay.textContent = `0 / ${MAX_WORDS} מילים`;
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'שליחת פנייה לצוות';
        }
      }
    });
  }

  function showFeedback(msg, isSuccess) {
    if (!feedbackMsg) return;
    feedbackMsg.textContent = msg;
    feedbackMsg.className = `feedback-message ${isSuccess ? 'feedback-success' : 'feedback-error'}`;
    feedbackMsg.style.display = 'block';

    setTimeout(() => {
      feedbackMsg.style.display = 'none';
    }, 6000);
  }
});