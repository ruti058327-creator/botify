/**
 * מאתחל את טופס הפנייה, מצב ההתחברות, ספירת המילים ושליחת ההודעה.
 * @returns {void} מתקין מאזיני DOM ומעדכן את ממשק הפנייה.
 */
// מייבאים עטיפה אחידה לשליחת בקשות לשרת.
import { ApiService } from '../services/api-service.js';

// מחכים לטעינת ה-DOM כדי שכל רכיבי הטופס יהיו זמינים לפני חיבור ההתנהגות.
document.addEventListener('DOMContentLoaded', () => {
  // קוראים מהאחסון המקומי את פרטי המשתמש שהדפדפן שמר בעת ההתחברות.
  const token = localStorage.getItem('token');
  const userString = localStorage.getItem('user');

  // מאתרים את רכיבי ההתחברות, הטופס, ההודעה, שדה התוכן והמשוב.
  const unauthBox = document.getElementById('unauth-box');
  const contactForm = document.getElementById('contact-form');
  const userDisplay = document.getElementById('current-user-display');
  const messageInput = document.getElementById('contact-message');
  const wordCountDisplay = document.getElementById('word-count-display');
  const feedbackMsg = document.getElementById('feedback-msg');
  const submitBtn = document.getElementById('btn-submit-contact');
  // קובעים מגבלת תוכן של 200 מילים כדי למנוע שליחת הודעות ארוכות מדי.
  const MAX_WORDS = 200;

  // בלי אסימון התחברות אין הרשאה לשלוח פנייה, ולכן מציגים הודעת התחברות ומסיימים.
  if (!token) {
    if (unauthBox) unauthBox.style.display = 'block';
    if (contactForm) contactForm.style.display = 'none';
    return;
  }

  // משתמש מחובר יכול לראות את הטופס; מסתירים ממנו את ההודעה למשתמשים לא מחוברים.
  if (unauthBox) unauthBox.style.display = 'none';
  if (contactForm) contactForm.style.display = 'block';

  // מפענחים את פרטי המשתמש השמורים; אם המידע פגום או חסר משתמשים באובייקט ריק.
  let userData = {};
  try {
    userData = userString ? JSON.parse(userString) : {};
  } catch (e) {
    userData = {};
  }

  // בוחרים את השם הזמין ביותר ומציגים אותו לצד כתובת האימייל אם קיימת.
  const displayName = userData.username || userData.email || userData.name || 'משתמש רשום';
  if (userDisplay) {
    userDisplay.textContent = `${displayName} (${userData.email || 'אימייל שמור במערכת'})`;
  }

  // מאזינים להקלדה בשדה ההודעה כדי לעדכן את המונה ולשמור על מגבלת המילים.
  if (messageInput) {
    /**
     * סופר מילים בזמן הקלדה ואוכף את מגבלת 200 המילים.
     * @returns {void} מעדכן מונה מילים ומקצר טקסט החורג מהמגבלה.
     */
    messageInput.addEventListener('input', () => {
      // מסירים רווחים בקצוות ומפרידים מילים לפי רצף של רווחים או מעברי שורה.
      const text = messageInput.value.trim();
      const words = text === '' ? [] : text.split(/\s+/);
      const wordCount = words.length;

      // במקרה של חריגה חותכים את הקלט למספר המילים המרבי ומציגים אזהרה חזותית.
      if (wordCount > MAX_WORDS) {
        const trimmedWords = words.slice(0, MAX_WORDS);
        messageInput.value = trimmedWords.join(' ');
        if (wordCountDisplay) {
          wordCountDisplay.textContent = `${MAX_WORDS} / ${MAX_WORDS} מילים (הגעת למגבלה!)`;
          wordCountDisplay.classList.add('limit-reached');
        }
      // כאשר התוכן עומד במגבלה מציגים את הספירה ומסירים את סגנון החריגה.
      } else {
        if (wordCountDisplay) {
          wordCountDisplay.textContent = `${wordCount} / ${MAX_WORDS} מילים`;
          wordCountDisplay.classList.remove('limit-reached');
        }
      }
    });
  }

  // מחברים שליחה אסינכרונית רק אם טופס הפנייה קיים בדף הנוכחי.
  if (contactForm) {
    /**
     * מאמת ושולח את טופס הפנייה, ומציג את תוצאת השליחה למשתמש.
     * @param {SubmitEvent} e אירוע שליחת טופס הפנייה.
     * @returns {Promise<void>} שולח את הפנייה ומעדכן מצב טעינה/תוצאה.
     */
    contactForm.addEventListener('submit', async (e) => {
      // מונעים מהדפדפן לרענן את הדף וממשיכים לשליחה באמצעות JavaScript.
      e.preventDefault();

      // אוספים את נושא הפנייה ואת תוכן ההודעה לאחר הסרת רווחים מיותרים.
      const subject = document.getElementById('contact-subject')?.value;
      const message = messageInput ? messageInput.value.trim() : '';

      // עוצרים שליחה אם אחד משני השדות החיוניים ריק.
      if (!subject || !message) {
        showFeedback('אנא מלאו את כל השדות הדרושים', false);
        return;
      }

      // משביתים את הכפתור ומשנים את הכיתוב כדי למנוע לחיצות חוזרות בזמן הבקשה.
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'שולח פנייה...';
      }

      try {
        // שולחים לשרת את נושא הפנייה והתוכן, בצירוף אסימון ההתחברות בכותרת.
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

        // קוראים את גוף התשובה בפורמט JSON כדי לבדוק הצלחה או הודעת שגיאה.
        const result = await response.json();

        // הצלחה מחייבת גם תשובת HTTP תקינה וגם סימון הצלחה מפורש של השרת.
        if (response.ok && result.success === true) {
          showFeedback('הפנייה נשלחה בהצלחה! מנהל המערכת קיבל את פרטיך ויחזור אליך בהקדם.', true);
          contactForm.reset();
          if (wordCountDisplay) wordCountDisplay.textContent = `0 / ${MAX_WORDS} מילים`;
          // מציגים שגיאה ידידותית כאשר השרת דחה את הפנייה או החזיר תוצאה לא מוצלחת.
        } else {
          showFeedback(result.message || 'אירעה שגיאה בשליחת הפנייה. נסו שוב מאוחר יותר.', false);
        }
        // תקלה ברשת או בפענוח התשובה נרשמת למסוף ומוצגת כהודעת תקשורת.
      } catch (err) {
        console.error('Error sending contact message:', err);
        showFeedback('לא ניתן לשלוח את הפנייה כרגע. בדקו את החיבור ונסו שוב.', false);
        // בכל תוצאה מחזירים את כפתור השליחה למצב פעיל ולכיתובו המקורי.
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
    // אם רכיב המשוב לא קיים אין מקום להציג את ההודעה.
    if (!feedbackMsg) return;
    // מעדכנים את הטקסט ואת מחלקות העיצוב לפי הצלחה או שגיאה.
    feedbackMsg.textContent = msg;
    feedbackMsg.className = `feedback-message ${isSuccess ? 'feedback-success' : 'feedback-error'}`;
    // מציגים את הודעת המשוב לאחר שהוכנה.
    feedbackMsg.style.display = 'block';

    /**
     * מסתירה את הודעת המשוב לאחר שהוצגה למשך שש שניות.
     * @returns {void} מסתירה את רכיב המשוב.
     */
    // מסתירים את המשוב לאחר שש שניות כדי שלא יישאר על המסך לצמיתות.
    setTimeout(() => {
      feedbackMsg.style.display = 'none';
    }, 6000);
  }
});