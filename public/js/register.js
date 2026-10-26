// מייבאים שירות API משותף עבור בקשות ההרשמה ושליחת קודי האימות.
import { ApiService } from '../services/api-service.js';

/**
 * מאתחל את טופס ההרשמה, שלבי האימות, ההודעות והטיימר.
 * @returns {void} מגדיר אירועי משתמש ומכין את מסכי ההרשמה.
 */
// ממתינים לטעינת הטופס לפני קריאת שדותיו וחיבור אירועי שליחה.
document.addEventListener('DOMContentLoaded', () => {
    // קוראים מהכתובת את היעד שאליו יש לחזור אחרי ההרשמה.
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPage = urlParams.get('redirect');

    // אם קיים יעד חזרה, מוסיפים אותו לקישורי ההתחברות כדי לשמר את הניווט.
    if (redirectPage) {
        const loginUrl = `login.html?redirect=${encodeURIComponent(redirectPage)}`;
        const loginLinkElem = document.getElementById('login-link');
        const loginBottomElem = document.getElementById('login-bottom-link');
        // מעדכנים כל אחד מהקישורים רק אם הוא קיים בגרסת הדף הנוכחית.
        if (loginLinkElem) loginLinkElem.href = loginUrl;
        if (loginBottomElem) loginBottomElem.href = loginUrl;
    }

    // מונעים שליחה רגילה של טופס הפרטים ומתחילים בדיקת נתונים ושליחת קוד.
    document.getElementById('registration-form').addEventListener('submit', event => {
        event.preventDefault();
        handleSendOtp();
    });
    // במעבר לטופס האימות מונעים רענון ומפעילים את בדיקת קוד ההרשמה.
    document.getElementById('verification-form').addEventListener('submit', event => {
        event.preventDefault();
        handleVerifyAndRegister();
    });
});

// שומרים את פרטי ההרשמה בזיכרון בזמן אימות ואת מזהה הטיימר כדי לאתחלו.
let cachedUserData = null;
let countdownTimer = null;
let timeLeft = 5 * 60;

// מאתרים את רכיבי המצב והשלבים פעם אחת כדי שהפונקציות יוכלו לעדכן אותם.
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
    // מציגים את אזור ההודעה ומעדכנים את תוכנה.
    statusMessage.style.display = 'block';
    statusMessage.textContent = text;
    // בוחרים צבע רקע, טקסט ומסגרת כדי להבדיל חזותית בין שגיאה להצלחה.
    statusMessage.style.backgroundColor = isError ? '#fee2e2' : '#dcfce7';
    statusMessage.style.color = isError ? '#dc2626' : '#15803d';
    statusMessage.style.border = isError ? '1px solid #f87171' : '1px solid #86efac';
}

/**
 * מסתיר ומנקה את הודעת המצב הנוכחית.
 * @returns {void} מאפס את רכיב ההודעה.
 */
function clearStatus() {
    // מסתירים את ההודעה ומוחקים טקסט קודם כדי שלא יבלבל בין שלבים.
    statusMessage.style.display = 'none';
    statusMessage.textContent = '';
}

/**
 * מתחיל מחדש טיימר בן חמש דקות לקוד אימות ההרשמה.
 * @returns {void} מעדכן את תצוגת הזמן ומודיע כשהקוד פג.
 */
function startTimer() {
    // עוצרים טיימר קודם ומחזירים את משך התוקף לחמש דקות.
    clearInterval(countdownTimer);
    timeLeft = 5 * 60;
    // מאפשרים שוב אימות כאשר נשלח קוד חדש.
    verifyBtn.disabled = false;

    /**
     * מציג את הזמן שנותר ומשבית אימות לאחר פקיעת הקוד.
     * @returns {void} מעדכן טיימר ומצב אימות.
     */
    countdownTimer = setInterval(() => {
        // ממירים את השניות שנותרו לדקות ושניות ומציגים אותן בפורמט קבוע.
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `זמן שנותר להזנת הקוד: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (timeLeft <= 0) {
            // בתום חמש הדקות עוצרים ספירה, משביתים אימות ומציגים הנחיה לקוד חדש.
            clearInterval(countdownTimer);
            timerDisplay.textContent = 'פג תוקף הקוד! לחץ על שליחת קוד חדש.';
            verifyBtn.disabled = true;
            showStatus('פג תוקף קוד האימות. לחץ על "שלח לי קוד חדש למייל".', true);
        }
        // מקדמים את הספירה לאחור בשנייה לקראת פעולת המרווח הבאה.
        timeLeft--;
    }, 1000);
}

/**
 * בודק את פרטי המשתמש ושולח בקשה לקבלת קוד אימות בדוא״ל.
 * @returns {Promise<void>} עובר לשלב האימות או מציג שגיאת שליחה.
 */
async function handleSendOtp() {
    // מסירים הודעה ישנה לפני בדיקת הטופס.
    clearStatus();

    // קוראים את הערכים מכל שדות ההרשמה; טקסט נחתך ואילו סיסמה נשמרת בדיוק.
    // אוספים את פרטי הזהות והחשבון; שדות טקסט עוברים trim להסרת רווחי קצה.
    const fullName = document.getElementById('fullName').value.trim();
    const idNumber = document.getElementById('idNumber').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const businessName = document.getElementById('businessName').value.trim();
    const username = document.getElementById('username').value.trim();
    // משאירים את הסיסמה ללא trim כדי לא לשנות תווים שהמשתמש בחר במכוון.
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const terms = document.getElementById('terms').checked;

    // מאמתים את שדות החובה לפי הסדר ומפסיקים ברגע שמתגלה נתון חסר או שגוי.
    // כל בדיקה עוצרת מיד עם הודעה ממוקדת, כדי שלא תישלח בקשת OTP עם נתונים חלקיים.
    if (!fullName) return showStatus('נא להזין שם מלא');
    if (!idNumber) return showStatus('נא להזין מספר תעודת זהות');
    if (!email || !email.includes('@')) return showStatus('נא להזין כתובת אימייל תקינה');
    if (!phone) return showStatus('נא להזין מספר טלפון');
    if (!businessName) return showStatus('נא להזין שם עסק');
    if (!username) return showStatus('נא להזין שם משתמש');
    if (password.length < 8) return showStatus('הסיסמה חייבת להכיל לפחות 8 תווים');
    if (password !== confirmPassword) return showStatus('הסיסמאות אינן תואמות');
    if (!terms) return showStatus('יש לאשר את תנאי השימוש');

    // שומרים את הערכים בזיכרון לשימוש בבקשת יצירת החשבון לאחר אימות הקוד.
    cachedUserData = { fullName, idNumber, email, phone, businessName, username, password };

    // משביתים את הכפתור ומציגים התקדמות עד לקבלת תשובת שרת.
    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = '⏳ שולח קוד אימות למייל...';

    try {
        // מבקשים לשלוח OTP לאימייל ומעבירים גם שם משתמש לזיהוי ההרשמה.
        const response = await ApiService.request('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cachedUserData.email, username: cachedUserData.username })
        });

        // מפענחים JSON כדי לבדוק את הודעת השגיאה האפשרית של השרת.
        const data = await response.json();

        if (!response.ok) {
            // בקשת HTTP שנכשלה תטופל ב-catch עם הודעה מפורטת.
            throw new Error(data.message || 'שגיאה בשליחת קוד האימות.');
        }

        // מציגים לאיזו כתובת נשלח הקוד ומחליפים את מסך הפרטים במסך האימות.
        document.getElementById('displayEmail').textContent = email;
        step1Container.style.display = 'none';
        step2Container.style.display = 'block';

        // מפעילים מחדש את זמן התוקף ומציגים הודעת הצלחה.
        startTimer();
        showStatus('✉️ קוד אימות נשלח לתיבת המייל שלך!', false);

    } catch (err) {
        // שגיאת שרת או רשת מוצגת למשתמש בלי להחליף את שלב ההרשמה.
        showStatus(err.message, true);
    } finally {
        // מחזירים את כפתור בקשת הקוד למצבו המקורי גם במקרה של כישלון.
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = 'המשך לקבלת קוד אימות ←';
    }
}

/**
 * מאמת את קוד ה-OTP ומשלים יצירת חשבון משתמש.
 * @returns {Promise<void>} מציג הצלחה ומנווט להתחברות או מאפשר ניסיון נוסף.
 */
async function handleVerifyAndRegister() {
    // מנקים תוצאה קודמת וקוראים את קוד האימות שהמשתמש הזין.
    clearStatus();
    // קוראים את הקוד ומסירים רווחים שנוספו בטעות לפני או אחרי הספרות.
    const otpCode = document.getElementById('otpCode').value.trim();

    // הקוד חייב להכיל בדיוק שישה תווים לפני שליחתו לשרת.
    if (!otpCode || otpCode.length !== 6) {
        return showStatus('נא להזין קוד אימות מלא בן 6 ספרות');
    }

    // משביתים את הכפתור ומסמנים שהשרת משלים כעת את יצירת החשבון.
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'מאמת ויוצר חשבון...';

    try {
        // שולחים את כל פרטי ההרשמה השמורים יחד עם קוד האימות שהוזן.
        const response = await ApiService.request('/api/register-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...cachedUserData, otpCode })
        });

        // קוראים את תשובת השרת כדי לקבל הודעת שגיאה אם האימות נדחה.
        const data = await response.json();

        if (!response.ok) {
            // הופכים כישלון לחריגה כדי להציגו במסלול catch המשותף.
            throw new Error(data.message || 'קוד אימות שגוי');
        }

        // אחרי הרשמה מוצלחת אין עוד צורך בטיימר; מציגים הצלחה לפני הניווט.
        clearInterval(countdownTimer);
        showStatus('🎉 נרשמת בהצלחה! מעביר אותך לדף ההתחברות...', false);

        /**
         * מעביר לעמוד ההתחברות לאחר הצגת הודעת ההצלחה.
         * @returns {void} משנה את כתובת העמוד.
         */
        // ממתינים מעט כדי שהמשתמש יספיק לקרוא את ההודעה ואז פותחים התחברות.
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);

    } catch (err) {
        // במקרה של קוד שגוי או תקלה מאפשרים ניסיון חוזר ומציגים את הסיבה.
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
    // מנקים הודעה ישנה וקובעים הפניה לכפתור כדי להציג מצב שליחה.
    clearStatus();
    // מאתרים ומשביתים את כפתור השליחה החוזרת כדי למנוע בקשות מקבילות.
    const resendBtn = document.getElementById('resendBtn');
    resendBtn.disabled = true;
    resendBtn.textContent = 'שולח קוד חדש...';

    try {
        // מבקשים OTP חדש עבור פרטי ההרשמה שעדיין שמורים בזיכרון.
        const response = await ApiService.request('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cachedUserData.email, username: cachedUserData.username })
        });

        // בודקים את תשובת השרת לפני איפוס קוד קודם או חידוש הטיימר.
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'שגיאה בשליחה');

        // קוד קודם אינו תקף עוד: מנקים אותו, מתחילים טיימר חדש ומאשרים שליחה.
        document.getElementById('otpCode').value = '';
        startTimer();
        showStatus('✉️ קוד אימות חדש נשלח למייל!', false);
    } catch (err) {
        // מציגים את סיבת הכישלון אם לא ניתן היה לשלוח קוד חדש.
        showStatus(err.message, true);
    } finally {
        // משיבים את כפתור השליחה החוזרת למצב זמין עם הכיתוב הרגיל.
        resendBtn.disabled = false;
        resendBtn.textContent = '🔄 שלח לי קוד חדש למייל';
    }
}

/**
 * מחזיר את המשתמש לעריכת הפרטים לפני השלמת אימות ההרשמה.
 * @returns {void} עוצר את טיימר האימות ומציג מחדש את שלב הפרטים.
 */
function handleBackToEdit() {
    // מנקים משוב ועוצרים את שעון הקוד לפני החזרה לשלב עריכת הפרטים.
    clearStatus();
    clearInterval(countdownTimer);
    // מסתירים את מסך האימות ומציגים מחדש את מסך פרטי ההרשמה.
    step2Container.style.display = 'none';
    step1Container.style.display = 'block';
}

// חושפים את הפונקציות כדי שהכפתורים המחוברים מתוך HTML יוכלו להפעילן.
window.handleResendCode = handleResendCode;
window.handleBackToEdit = handleBackToEdit;
