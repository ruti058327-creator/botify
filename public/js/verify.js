/**
 * מאתחל אימות הרשמה תלוי-שלבים ומוודא שקיימים פרטי הרשמה ממתינים.
 * @returns {void} מציג את הדוא״ל, מפעיל טיימר ומחבר את פעולות האימות.
 */
// מפעילים את מסך האימות רק לאחר טעינת רכיבי הדף.
document.addEventListener('DOMContentLoaded', () => {
    // פרטי משתמש ממתינים נשמרים זמנית במהלך תהליך ההרשמה המדורג.
    const pendingData = sessionStorage.getItem('pendingUser');

    // מי שנכנס לדף האימות ללא פרטי הרשמה חוזר לטופס ההרשמה.
    if (!pendingData) {
        window.location.href = '/register.html';
        return;
    }

    // מפענחים את פרטי ההרשמה שנשמרו בשלב הקודם ומציגים את כתובת הדוא״ל.
    const userData = JSON.parse(pendingData);
    const sentEmailDisplay = document.getElementById('sentEmailDisplay');
    if (sentEmailDisplay) {
        sentEmailDisplay.textContent = userData.email;
    }

    // אוספים הפניות לשדות ולכפתורים כדי להשתמש בהם באימות ובמשוב.
    const verifyForm = document.getElementById('verifyForm');
    const messageDiv = document.getElementById('message');
    const timerDisplay = document.getElementById('timerDisplay');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendCodeBtn = document.getElementById('resendCodeBtn');
    const editDetailsBtn = document.getElementById('editDetailsBtn');

    /**
     * מציג הודעת הצלחה או שגיאה במסך אימות ההרשמה.
     * @param {string} text ההודעה להצגה.
     * @param {boolean} [isError=true] האם מדובר בהודעת שגיאה.
     * @returns {void} מעדכן את רכיב ההודעה.
     */
    function showMessage(text, isError = true) {
        // רכיב ההודעה אופציונלי; אם אינו קיים אין מה לעדכן.
        if (!messageDiv) return;
        // מציגים את הטקסט ומחליפים מחלקת CSS בהתאם לסוג ההודעה.
        messageDiv.style.display = 'block';
        messageDiv.textContent = text;
        messageDiv.className = isError ? 'error-msg' : 'success-msg';
    }

    /**
     * מסתיר ומנקה את הודעת האימות הנוכחית.
     * @returns {void} מאפס את רכיב ההודעה אם הוא קיים.
     */
    function clearMessage() {
        // משאירים את הפונקציה בטוחה גם בדפים שאין בהם רכיב הודעה.
        if (!messageDiv) return;
        // מסתירים את הרכיב ומנקים טקסט קודם כדי לא להציג מצב מיושן.
        messageDiv.style.display = 'none';
        messageDiv.textContent = '';
    }

    // הקוד תקף חמש דקות; ההפניה נשמרת כדי לאפשר עצירה והתחלה מחדש.
    let timeLeft = 5 * 60;
    let countdownInterval = null;

    /**
     * מתחיל מחדש ספירה לאחור של חמש דקות לתוקף קוד האימות.
     * @returns {void} מאפשר אימות ומעדכן את תצוגת הזמן.
     */
    function startTimer() {
        // עוצרים ספירה ישנה ומתחילים חלון תוקף חדש של חמש דקות.
        clearInterval(countdownInterval);
        timeLeft = 5 * 60;
        // מפעילים את כפתור האימות מחדש בכל פעם שמתחיל תוקף קוד חדש.
        if (verifyBtn) verifyBtn.disabled = false;

        /**
         * מציג את הזמן שנותר ומשבית את כפתור האימות עם פקיעת הקוד.
         * @returns {void} מעדכן את התצוגה ומטפל בפקיעת הקוד.
         */
        countdownInterval = setInterval(() => {
            // מפרקים את מספר השניות לדקות ולשניות לצורך הצגה ברורה.
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            
            // מעדכנים את התצוגה רק אם רכיב הטיימר קיים.
            if (timerDisplay) {
                timerDisplay.textContent = `זמן שנותר להזנת הקוד: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            
            if (timeLeft <= 0) {
                // כשהזמן נגמר עוצרים את הטיימר, משביתים אימות ומבקשים קוד חדש.
                clearInterval(countdownInterval);
                if (timerDisplay) timerDisplay.textContent = 'פג תוקף הקוד! לחץ על שליחת קוד חדש.';
                if (verifyBtn) verifyBtn.disabled = true;
                showMessage('פג תוקף קוד האימות (עברו 5 דקות). באפשרותך לבקש קוד חדש.', true);
            }
            // מקטינים את הזמן שנותר לקראת העדכון הבא של הטיימר.
            timeLeft--;
        }, 1000);
    }

    // מתחילים את חמש הדקות עם הצגת מסך האימות.
    startTimer();

    // מטפלים בשליחת הטופס רק אם רכיב הטופס קיים.
    if (verifyForm) {
        /**
         * שולח את קוד האימות ופרטי המשתמש ליצירת חשבון.
         * @param {SubmitEvent} e אירוע שליחת טופס האימות.
         * @returns {Promise<void>} משלים הרשמה או מציג שגיאת אימות.
         */
        verifyForm.addEventListener('submit', async (e) => {
            // מונעים מהטופס לטעון מחדש את הדף ומנקים הודעת תוצאה קודמת.
            e.preventDefault();
            clearMessage();

            // קוראים קוד נקי מרווחים ומוודאים שהוזנו שש ספרות/תווים.
            const otpCode = document.getElementById('otpCode').value.trim();
            if (!otpCode || otpCode.length !== 6) {
                showMessage('נא להזין קוד אימות מלא בן 6 ספרות.', true);
                return;
            }

            // משנים את מצב הכפתור כדי למנוע ניסיונות מקבילים ולסמן התקדמות.
            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.textContent = 'מאמת ויוצר חשבון...';
            }

            try {
                // שולחים לשרת את נתוני ההרשמה הזמניים ואת קוד האימות שהוזן.
                const response = await ApiService.request('/api/register-verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...userData, otpCode })
                });

                // מפענחים את גוף התשובה כדי להציג את הודעת השרת במקרה הצורך.
                const data = await response.json();

                if (!response.ok) {
                    // תשובה לא מוצלחת מסיימת את הזרימה כחריגה שניתן להציג למשתמש.
                    throw new Error(data.message || 'קוד האימות שגוי.');
                }

                // לאחר הצלחה עוצרים את הטיימר ומוחקים פרטי הרשמה זמניים מה-session.
                clearInterval(countdownInterval);
                sessionStorage.removeItem('pendingUser');

                showMessage('🎉 נרשמת בהצלחה למערכת! מעביר לדף ההתחברות...', false);

                /**
                 * מעביר למסך ההתחברות אחרי הצגת הודעת הצלחה.
                 * @returns {void} משנה את כתובת העמוד.
                 */
                // משאירים את הודעת ההצלחה לזמן קצר ואז מעבירים להתחברות.
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1800);

            } catch (err) {
                // מציגים סיבת כישלון ומאפשרים ניסיון אימות נוסף.
                showMessage(`❌ ${err.message}`, true);
                if (verifyBtn) {
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'אמת קוד והשלם הרשמה';
                }
            }
        });
    }

    // מאפשרים בקשת קוד חלופי אם כפתור השליחה החוזרת קיים בדף.
    if (resendCodeBtn) {
        /**
         * מבקש קוד אימות חדש עבור פרטי ההרשמה ששמורים בדפדפן.
         * @returns {Promise<void>} שולח שוב קוד ומאתחל את הטיימר.
         */
        resendCodeBtn.addEventListener('click', async () => {
            // מנקים שגיאה קודמת ומשביתים זמנית בקשות כפולות.
            clearMessage();
            resendCodeBtn.disabled = true;
            resendCodeBtn.textContent = 'שולח קוד חדש...';

            try {
                // מבקשים מהשרת קוד חדש עבור האימייל ושם המשתמש של ההרשמה.
                const response = await ApiService.request('/api/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userData.email, username: userData.username })
                });

                // קוראים הודעת שגיאה אפשרית לפני טיפול בתוצאה.
                const data = await response.json();

                if (!response.ok) {
                    // מעבירים את הודעת השרת לטיפול אחיד ב-catch.
                    throw new Error(data.message || 'שגיאה בשליחת קוד חדש.');
                }

                // מנקים קוד ישן, מחדשים את חלון התוקף ומאשרים את השליחה.
                const otpInput = document.getElementById('otpCode');
                if (otpInput) otpInput.value = '';
                startTimer();
                showMessage('✉️ קוד אימות חדש נשלח לתיבת המייל שלך!', false);

            } catch (err) {
                // מציגים למשתמש את סיבת הכישלון בבקשת קוד חדש.
                showMessage(err.message, true);
            } finally {
                // מחזירים את הכפתור למצב פעיל גם אחרי שגיאה.
                resendCodeBtn.disabled = false;
                resendCodeBtn.textContent = '🔄 שלח לי קוד חדש למייל';
            }
        });
    }

    // מאפשרים חזרה לטופס הפרטים אם כפתור העריכה נמצא במסך.
    if (editDetailsBtn) {
        /**
         * מחזיר את המשתמש לעריכת פרטי ההרשמה.
         * @returns {void} מנווט בחזרה לטופס ההרשמה.
         */
        editDetailsBtn.addEventListener('click', () => {
            // חוזרים לטופס ההרשמה כדי לאפשר תיקון פרטים לפני בקשת קוד נוסף.
            window.location.href = '/register.html';
        });
    }
});
import { ApiService } from '../services/api-service.js';
