/**
 * מאתחל את טופס הפנייה, מצב ההתחברות, ספירת המילים ושליחת ההודעה.
 * @returns {void} מתקין מאזיני DOM ומעדכן את ממשק הפנייה.
 */
import { ApiService } from '../services/api-service.js';

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

  if (!token) {
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

  if (messageInput) {
    /**
     * סופר מילים בזמן הקלדה ואוכף את מגבלת 200 המילים.
     * @returns {void} מעדכן מונה מילים ומקצר טקסט החורג מהמגבלה.
     */
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

  if (contactForm) {
    /**
     * מאמת ושולח את טופס הפנייה, ומציג את תוצאת השליחה למשתמש.
     * @param {SubmitEvent} e אירוע שליחת טופס הפנייה.
     * @returns {Promise<void>} שולח את הפנייה ומעדכן מצב טעינה/תוצאה.
     */
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
        const response = await ApiService.request('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || ''}`
          },
          body: JSON.stringify({
            subject: subject,
            message: message
          })
        });

        const result = await response.json();

        if (response.ok && result.success === true) {
          showFeedback('הפנייה נשלחה בהצלחה! מנהל המערכת קיבל את פרטיך ויחזור אליך בהקדם.', true);
          contactForm.reset();
          if (wordCountDisplay) wordCountDisplay.textContent = `0 / ${MAX_WORDS} מילים`;
        } else {
          showFeedback(result.message || 'אירעה שגיאה בשליחת הפנייה. נסו שוב מאוחר יותר.', false);
        }
      } catch (err) {
        console.error('Error sending contact message:', err);
        showFeedback('לא ניתן לשלוח את הפנייה כרגע. בדקו את החיבור ונסו שוב.', false);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'שליחת פנייה לצוות';
        }
      }
    });
  }

  /**
   * מציג הודעת הצלחה או שגיאה זמנית בטופס הפנייה.
   * @param {string} msg הטקסט שיוצג.
   * @param {boolean} isSuccess האם מדובר בהודעת הצלחה.
   * @returns {void} מעדכן את רכיב המשוב ומסתירו לאחר שש שניות.
   */
  function showFeedback(msg, isSuccess) {
    if (!feedbackMsg) return;
    feedbackMsg.textContent = msg;
    feedbackMsg.className = `feedback-message ${isSuccess ? 'feedback-success' : 'feedback-error'}`;
    feedbackMsg.style.display = 'block';

    /**
     * מסתירה את הודעת המשוב לאחר שהוצגה למשך שש שניות.
     * @returns {void} מסתירה את רכיב המשוב.
     */
    setTimeout(() => {
      feedbackMsg.style.display = 'none';
    }, 6000);
  }
});