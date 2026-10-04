/**
 * מאתחל אימות הרשמה תלוי-שלבים ומוודא שקיימים פרטי הרשמה ממתינים.
 * @returns {void} מציג את הדוא״ל, מפעיל טיימר ומחבר את פעולות האימות.
 */
document.addEventListener('DOMContentLoaded', () => {
    const pendingData = sessionStorage.getItem('pendingUser');

    // אם המשתמש נכנס ישירות לדף בלי למלא פרטים, העברה להרשמה
    if (!pendingData) {
        window.location.href = '/register.html';
        return;
    }

    const userData = JSON.parse(pendingData);
    const sentEmailDisplay = document.getElementById('sentEmailDisplay');
    if (sentEmailDisplay) {
        sentEmailDisplay.textContent = userData.email;
    }

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
        if (!messageDiv) return;
        messageDiv.style.display = 'block';
        messageDiv.textContent = text;
        messageDiv.className = isError ? 'error-msg' : 'success-msg';
    }

    /**
     * מסתיר ומנקה את הודעת האימות הנוכחית.
     * @returns {void} מאפס את רכיב ההודעה אם הוא קיים.
     */
    function clearMessage() {
        if (!messageDiv) return;
        messageDiv.style.display = 'none';
        messageDiv.textContent = '';
    }

    // ניהול טיימר של 5 דקות
    let timeLeft = 5 * 60;
    let countdownInterval = null;

    /**
     * מתחיל מחדש ספירה לאחור של חמש דקות לתוקף קוד האימות.
     * @returns {void} מאפשר אימות ומעדכן את תצוגת הזמן.
     */
    function startTimer() {
        clearInterval(countdownInterval);
        timeLeft = 5 * 60;
        if (verifyBtn) verifyBtn.disabled = false;

        /**
         * מציג את הזמן שנותר ומשבית את כפתור האימות עם פקיעת הקוד.
         * @returns {void} מעדכן את התצוגה ומטפל בפקיעת הקוד.
         */
        countdownInterval = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            
            if (timerDisplay) {
                timerDisplay.textContent = `זמן שנותר להזנת הקוד: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                if (timerDisplay) timerDisplay.textContent = 'פג תוקף הקוד! לחץ על שליחת קוד חדש.';
                if (verifyBtn) verifyBtn.disabled = true;
                showMessage('פג תוקף קוד האימות (עברו 5 דקות). באפשרותך לבקש קוד חדש.', true);
            }
            timeLeft--;
        }, 1000);
    }

    startTimer();

    // אימות הקוד ויצירת המשתמש
    if (verifyForm) {
        /**
         * שולח את קוד האימות ופרטי המשתמש ליצירת חשבון.
         * @param {SubmitEvent} e אירוע שליחת טופס האימות.
         * @returns {Promise<void>} משלים הרשמה או מציג שגיאת אימות.
         */
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage();

            const otpCode = document.getElementById('otpCode').value.trim();
            if (!otpCode || otpCode.length !== 6) {
                showMessage('נא להזין קוד אימות מלא בן 6 ספרות.', true);
                return;
            }

            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.textContent = 'מאמת ויוצר חשבון...';
            }

            try {
                const response = await ApiService.request('/api/register-verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...userData, otpCode })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'קוד האימות שגוי.');
                }

                // הצלחה: ניקוי הנתונים מהזיכרון ומעבר להתחברות
                clearInterval(countdownInterval);
                sessionStorage.removeItem('pendingUser');

                showMessage('🎉 נרשמת בהצלחה למערכת! מעביר לדף ההתחברות...', false);

                /**
                 * מעביר למסך ההתחברות אחרי הצגת הודעת הצלחה.
                 * @returns {void} משנה את כתובת העמוד.
                 */
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1800);

            } catch (err) {
                showMessage(`❌ ${err.message}`, true);
                if (verifyBtn) {
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'אמת קוד והשלם הרשמה';
                }
            }
        });
    }

    // שליחת קוד אימות חדש
    if (resendCodeBtn) {
        /**
         * מבקש קוד אימות חדש עבור פרטי ההרשמה ששמורים בדפדפן.
         * @returns {Promise<void>} שולח שוב קוד ומאתחל את הטיימר.
         */
        resendCodeBtn.addEventListener('click', async () => {
            clearMessage();
            resendCodeBtn.disabled = true;
            resendCodeBtn.textContent = 'שולח קוד חדש...';

            try {
                const response = await ApiService.request('/api/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userData.email, username: userData.username })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'שגיאה בשליחת קוד חדש.');
                }

                const otpInput = document.getElementById('otpCode');
                if (otpInput) otpInput.value = '';
                startTimer();
                showMessage('✉️ קוד אימות חדש נשלח לתיבת המייל שלך!', false);

            } catch (err) {
                showMessage(err.message, true);
            } finally {
                resendCodeBtn.disabled = false;
                resendCodeBtn.textContent = '🔄 שלח לי קוד חדש למייל';
            }
        });
    }

    // חזרה לעריכת פרטים בהרשמה
    if (editDetailsBtn) {
        /**
         * מחזיר את המשתמש לעריכת פרטי ההרשמה.
         * @returns {void} מנווט בחזרה לטופס ההרשמה.
         */
        editDetailsBtn.addEventListener('click', () => {
            window.location.href = '/register.html';
        });
    }
});