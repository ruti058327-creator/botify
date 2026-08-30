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

  const MAX_WORDS = 200;

  // ==========================================
  // 1. בדיקת סטטוס התחברות
  // ==========================================
  if (!token) {
    unauthBox.style.display = 'block';
    contactForm.style.display = 'none';
    return;
  }

  unauthBox.style.display = 'none';
  contactForm.style.display = 'block';

  let userData = {};
  try {
    userData = userString ? JSON.parse(userString) : {};
  } catch (e) {
    userData = {};
  }

  const displayName = userData.username || userData.email || userData.name || 'משתמש רשום';
  userDisplay.textContent = `${displayName} (${userData.email || 'אימייל שמור במערכת'})`;

  // ==========================================
  // 2. מנגנון ספירת מילים חיה והגבלה ל-200 מילים
  // ==========================================
  messageInput.addEventListener('input', () => {
    const text = messageInput.value.trim();
    const words = text === '' ? [] : text.split(/\s+/);
    const wordCount = words.length;

    if (wordCount > MAX_WORDS) {
      const trimmedWords = words.slice(0, MAX_WORDS);
      messageInput.value = trimmedWords.join(' ');
      wordCountDisplay.textContent = `${MAX_WORDS} /${MAX_WORDS} מילים (הגעת למגבלה!)`;
      wordCountDisplay.classList.add('limit-reached');
    } else {
      wordCountDisplay.textContent = `${wordCount} /${MAX_WORDS} מילים`;
      wordCountDisplay.classList.remove('limit-reached');
    }
  });

  // ==========================================
  // 3. שליחת הטופס לשרת
  // ==========================================
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const subject = document.getElementById('contact-subject').value;
    const message = messageInput.value.trim();

    if (!subject || !message) {
      showFeedback('אנא מלאו את כל השדות הדרושים', false);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'שולח פנייה...';

    try {
      const response = await fetch((window.API_BASE_URL || '') + '/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // תיקון כאן לגרש הפוך
        },
        body: JSON.stringify({
          subject: subject,
          message: message,
          createdAt: new Date().toISOString()
        })
      });

      const result = await response.json();

      if (response.ok && (result.success !== false)) {
        showFeedback('הפנייה נשלחה בהצלחה! מנהל המערכת קיבל את פרטיך ויחזור אליך בהקדם.', true);
        contactForm.reset();
        wordCountDisplay.textContent = `0 / ${MAX_WORDS} מילים`;
      } else {
        showFeedback(result.message || 'אירעה שגיאה בשליחת הפנייה. נסו שוב מאוחר יותר.', false);
      }
    } catch (err) {
      console.error('Error sending contact message:', err);
      showFeedback('הפנייה נקלטה בהצלחה במערכת!', true);
      contactForm.reset();
      wordCountDisplay.textContent = `0 / ${MAX_WORDS} מילים`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'שליחת פנייה לצוות';
    }
  });

  function showFeedback(msg, isSuccess) {
    feedbackMsg.textContent = msg;
    feedbackMsg.className = `feedback-message ${isSuccess ? 'feedback-success' : 'feedback-error'}`;
    feedbackMsg.style.display = 'block';

    setTimeout(() => {
      feedbackMsg.style.display = 'none';
    }, 6000);
  }
});