import { ApiService } from '../services/api-service.js';

/**
 * מאתחל את טופס ההרשמה, שלבי האימות, ההודעות והטיימר.
 * @returns {void} מגדיר אירועי משתמש ומכין את מסכי ההרשמה.
 */
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPage = urlParams.get('redirect');

    if (redirectPage) {
        const loginUrl = `login.html?redirect=${encodeURIComponent(redirectPage)}`;
        const loginLinkElem = document.getElementById('login-link');
        const loginBottomElem = document.getElementById('login-bottom-link');
        if (loginLinkElem) loginLinkElem.href = loginUrl;
        if (loginBottomElem) loginBottomElem.href = loginUrl;
    }

    document.getElementById('registration-form').addEventListener('submit', event => {
        event.preventDefault();
        handleSendOtp();
    });
    document.getElementById('verification-form').addEventListener('submit', event => {
        event.preventDefault();
        handleVerifyAndRegister();
    });
});

let cachedUserData = null;
let countdownTimer = null;
let timeLeft = 5 * 60;

const statusMessage = document.getElementById('statusMessage');
const step1Container = document.getElementById('step1Container');
const step2Container = document.getElementById('step2Container');
const timerDisplay = document.getElementById('timerDisplay');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const verifyBtn = document.getElementById('verifyBtn');

/**
 * מציג הודעת מצב בטופס ההרשמה.
 * @param {string} text טקסט ההודעה.
 * @param {boolean} [isError=true] האם להציג את ההודעה כשגיאה.
 * @returns {void} מעדכן את הודעת המצב ואת העיצוב שלה.
 */
function showStatus(text, isError = true) {
    statusMessage.style.display = 'block';
    statusMessage.textContent = text;
    statusMessage.style.backgroundColor = isError ? '#fee2e2' : '#dcfce7';
    statusMessage.style.color = isError ? '#dc2626' : '#15803d';
    statusMessage.style.border = isError ? '1px solid #f87171' : '1px solid #86efac';
}

/**
 * מסתיר ומנקה את הודעת המצב הנוכחית.
 * @returns {void} מאפס את רכיב ההודעה.
 */
function clearStatus() {
    statusMessage.style.display = 'none';
    statusMessage.textContent = '';
}

/**
 * מתחיל מחדש טיימר בן חמש דקות לקוד אימות ההרשמה.
 * @returns {void} מעדכן את תצוגת הזמן ומודיע כשהקוד פג.
 */
function startTimer() {
    clearInterval(countdownTimer);
    timeLeft = 5 * 60;
    verifyBtn.disabled = false;

    /**
     * מציג את הזמן שנותר ומשבית אימות לאחר פקיעת הקוד.
     * @returns {void} מעדכן טיימר ומצב אימות.
     */
    countdownTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `זמן שנותר להזנת הקוד: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(countdownTimer);
            timerDisplay.textContent = 'פג תוקף הקוד! לחץ על שליחת קוד חדש.';
            verifyBtn.disabled = true;
            showStatus('פג תוקף קוד האימות. לחץ על "שלח לי קוד חדש למייל".', true);
        }
        timeLeft--;
    }, 1000);
}

/**
 * בודק את פרטי המשתמש ושולח בקשה לקבלת קוד אימות בדוא״ל.
 * @returns {Promise<void>} עובר לשלב האימות או מציג שגיאת שליחה.
 */
async function handleSendOtp() {
    clearStatus();

    const fullName = document.getElementById('fullName').value.trim();
    const idNumber = document.getElementById('idNumber').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const businessName = document.getElementById('businessName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const terms = document.getElementById('terms').checked;

    if (!fullName) return showStatus('נא להזין שם מלא');
    if (!idNumber) return showStatus('נא להזין מספר תעודת זהות');
    if (!email || !email.includes('@')) return showStatus('נא להזין כתובת אימייל תקינה');
    if (!phone) return showStatus('נא להזין מספר טלפון');
    if (!businessName) return showStatus('נא להזין שם עסק');
    if (!username) return showStatus('נא להזין שם משתמש');
    if (password.length < 8) return showStatus('הסיסמה חייבת להכיל לפחות 8 תווים');
    if (password !== confirmPassword) return showStatus('הסיסמאות אינן תואמות');
    if (!terms) return showStatus('יש לאשר את תנאי השימוש');

    cachedUserData = { fullName, idNumber, email, phone, businessName, username, password };

    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = '⏳ שולח קוד אימות למייל...';

    try {
        const response = await ApiService.request('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cachedUserData.email, username: cachedUserData.username })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'שגיאה בשליחת קוד האימות.');
        }

        document.getElementById('displayEmail').textContent = email;
        step1Container.style.display = 'none';
        step2Container.style.display = 'block';

        startTimer();
        showStatus('✉️ קוד אימות נשלח לתיבת המייל שלך!', false);

    } catch (err) {
        showStatus(err.message, true);
    } finally {
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = 'המשך לקבלת קוד אימות ←';
    }
}

/**
 * מאמת את קוד ה-OTP ומשלים יצירת חשבון משתמש.
 * @returns {Promise<void>} מציג הצלחה ומנווט להתחברות או מאפשר ניסיון נוסף.
 */
async function handleVerifyAndRegister() {
    clearStatus();
    const otpCode = document.getElementById('otpCode').value.trim();

    if (!otpCode || otpCode.length !== 6) {
        return showStatus('נא להזין קוד אימות מלא בן 6 ספרות');
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'מאמת ויוצר חשבון...';

    try {
        const response = await ApiService.request('/api/register-verify', {
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

        /**
         * מעביר לעמוד ההתחברות לאחר הצגת הודעת ההצלחה.
         * @returns {void} משנה את כתובת העמוד.
         */
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);

    } catch (err) {
        showStatus(`❌ ${err.message}`, true);
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'אמת קוד והשלם הרשמה';
    }
}

/**
 * מבקש שליחה חוזרת של קוד האימות לפרטי ההרשמה ששמורים.
 * @returns {Promise<void>} שולח קוד חדש ומאתחל את הטיימר.
 */
async function handleResendCode() {
    clearStatus();
    const resendBtn = document.getElementById('resendBtn');
    resendBtn.disabled = true;
    resendBtn.textContent = 'שולח קוד חדש...';

    try {
        const response = await ApiService.request('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cachedUserData.email, username: cachedUserData.username })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'שגיאה בשליחה');

        document.getElementById('otpCode').value = '';
        startTimer();
        showStatus('✉️ קוד אימות חדש נשלח למייל!', false);
    } catch (err) {
        showStatus(err.message, true);
    } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = '🔄 שלח לי קוד חדש למייל';
    }
}

/**
 * מחזיר את המשתמש לעריכת הפרטים לפני השלמת אימות ההרשמה.
 * @returns {void} עוצר את טיימר האימות ומציג מחדש את שלב הפרטים.
 */
function handleBackToEdit() {
    clearStatus();
    clearInterval(countdownTimer);
    step2Container.style.display = 'none';
    step1Container.style.display = 'block';
}

window.handleResendCode = handleResendCode;
window.handleBackToEdit = handleBackToEdit;
