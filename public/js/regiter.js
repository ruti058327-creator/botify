document.addEventListener('DOMContentLoaded', () => {
    let cachedUserData = null;
    let countdownTimer = null;
    let timeLeft = 5 * 60;
    const statusMessage = document.getElementById('statusMessage');
    const step1Container = document.getElementById('step1Container');
    const step2Container = document.getElementById('step2Container');
    const timerDisplay = document.getElementById('timerDisplay');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendBtn = document.getElementById('resendBtn');
    const backToEditBtn = document.getElementById('backToEditBtn');

    function showStatus(text, isError = true) {
        if (!statusMessage) return;
        statusMessage.style.display = 'block';
        statusMessage.textContent = text;
        statusMessage.style.backgroundColor = isError ? '#fee2e2' : '#dcfce7';
        statusMessage.style.color = isError ? '#dc2626' : '#15803d';
        statusMessage.style.border = isError ? '1px solid #f87171' : '1px solid #86efac';
        statusMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function clearStatus() {
        if (statusMessage) {
            statusMessage.style.display = 'none';
            statusMessage.textContent = '';
        }
    }

    function startTimer() {
        clearInterval(countdownTimer);
        timeLeft = 5 * 60;
        if (verifyBtn) verifyBtn.disabled = false;
        countdownTimer = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            if (timerDisplay) {
                timerDisplay.textContent = `זמן שנותר להזנת הקוד: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            if (timeLeft <= 0) {
                clearInterval(countdownTimer);
                if (timerDisplay) timerDisplay.textContent = 'פג תוקף הקוד! לחץ על שליחת קוד חדש.';
                if (verifyBtn) verifyBtn.disabled = true;
                showStatus('פג תוקף קוד האימות. לחץ על "שלח לי קוד חדש למייל".', true);
            }
            timeLeft--;
        }, 1000);
    }

    // 1. שלב א': שליחת קוד אימות למייל ומעבר למסך אימות
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', async () => {
            clearStatus();
            const fullName = (document.getElementById('fullName')?.value || '').trim();
            const idNumber = (document.getElementById('idNumber')?.value || '').trim();
            const email = (document.getElementById('email')?.value || '').trim();
            const phone = (document.getElementById('phone')?.value || '').trim();
            const businessName = (document.getElementById('businessName')?.value || '').trim();
            const username = (document.getElementById('username')?.value || '').trim();
            const password = document.getElementById('password')?.value || '';
            const confirmPassword = document.getElementById('confirmPassword')?.value || '';
            const terms = document.getElementById('terms')?.checked;

            if (!fullName) return showStatus('נא להזין שם מלא');
            if (!idNumber) return showStatus('נא להזין מספר תעודת זהות');
            if (!email || !email.includes('@')) return showStatus('נא להזין כתובת אימייל תקינה');
            if (!phone) return showStatus('נא להזין מספר טלפון');
            if (!businessName) return showStatus('נא להזין שם עסק');
            if (!username) return showStatus('נא להזין שם משתמש');
            if (password.length < 6) return showStatus('הסיסמה חייבת להכיל לפחות 6 תווים');
            if (password !== confirmPassword) return showStatus('הסיסמאות אינן תואמות');
            if (!terms) return showStatus('יש לאשר את תנאי השימוש והמדיניות');

            cachedUserData = { fullName, idNumber, email, phone, businessName, username, password };
            sendOtpBtn.disabled = true;
            sendOtpBtn.textContent = '⏳ שולח קוד אימות למייל...';

            try {
                const response = await fetch('/api/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: cachedUserData.email, username: cachedUserData.username })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'שגיאה בשליחת קוד האימות.');
                }

                // מעבר ויזואלי לשלב 2
                const displayEmail = document.getElementById('displayEmail');
                if (displayEmail) displayEmail.textContent = email;
                if (step1Container) step1Container.style.display = 'none';
                if (step2Container) step2Container.style.display = 'block';
                startTimer();
                showStatus('✉️ קוד אימות נשלח לתיבת המייל שלך!', false);
            } catch (err) {
                showStatus(err.message, true);
            } finally {
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = 'המשך לקבלת קוד אימות ←';
            }
        });
    }

    // 2. שלב ב': אימות הקוד והשלמת ההרשמה
    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            clearStatus();
            const otpCode = (document.getElementById('otpCode')?.value || '').trim();
            if (!otpCode || otpCode.length !== 6) {
                return showStatus('נא להזין קוד אימות מלא בן 6 ספרות');
            }
            verifyBtn.disabled = true;
            verifyBtn.textContent = 'מאמת ויוצר חשבון...';
            try {
                const response = await fetch('/api/register-verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...cachedUserData, otpCode })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'קוד אימות שגוי');
                }
                clearInterval(countdownTimer);
                showStatus('🎉 נרשמת בהצלחה! מעביר אותך לדף ההתחברות...', false);
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1500);
            } catch (err) {
                showStatus(`❌ ${err.message}`, true);
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'אמת קוד והשלם הרשמה';
            }
        });
    }

    // 3. שליחה חוזרת של הקוד למייל
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            clearStatus();
            resendBtn.disabled = true;
            resendBtn.textContent = 'שולח קוד חדש...';
            try {
                const response = await fetch('/api/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: cachedUserData.email, username: cachedUserData.username })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'שגיאה בשליחה חוזרת');
                const otpInput = document.getElementById('otpCode');
                if (otpInput) otpInput.value = '';
                startTimer();
                showStatus('✉️ קוד אימות חדש נשלח למייל!', false);
            } catch (err) {
                showStatus(err.message, true);
            } finally {
                resendBtn.disabled = false;
                resendBtn.textContent = '🔄 שלח לי קוד חדש למייל';
            }
        });
    }

    // 4. חזרה לעריכת הפרטים (שומר על מה שמולא)
    if (backToEditBtn) {
        backToEditBtn.addEventListener('click', () => {
            clearStatus();
            clearInterval(countdownTimer);
            if (step2Container) step2Container.style.display = 'none';
            if (step1Container) step1Container.style.display = 'block';
        });
    }
});