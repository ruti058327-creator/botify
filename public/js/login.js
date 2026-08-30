// משתנה גלובלי זמני לשמירת המייל בתהליך ההתחברות
let pendingLoginEmail = '';

// הגדרת המנהלות המורשות והסיסמה האחידה שלהן (57862)
const ADMIN_CREDENTIALS = {
    "NOA": "578621",
    "RUTY": "578621",
    "MIRYAM": "578621"
};

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const messageEl = document.getElementById('message');
    if (messageEl) messageEl.textContent = '';

    // בדיקה האם אנחנו כרגע בשלב ב' (הזנת קוד OTP) או בשלב א' (שם משתמש וסיסמה)
    const otpInput = document.getElementById('otpCode');
    const isOtpStep = otpInput && otpInput.style.display !== 'none';

    try {
        if (isOtpStep) {
            // ==========================================
            // שלב ב': שליחת קוד ה-OTP לאימות סופי
            // ==========================================
            const otpCode = otpInput.value.trim();

            if (!otpCode) {
                if (messageEl) messageEl.textContent = 'נא להזין את קוד האימות';
                return;
            }

            const response = await fetch('/api/login-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingLoginEmail, otpCode })
            });

            const data = await response.json();

            if (!response.ok) {
                if (messageEl) messageEl.textContent = data.message || 'שגיאה באימות הקוד';
                return;
            }

            // שמירת נתוני המשתמש בזיכרון המקומי
            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
            }

            // הצלחה - ניתוב לפי הרשאות
            const loggedUser = data.user ? (data.user.username || data.user.fullName) : '';
            
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else if (data.role === 'admin' || ADMIN_CREDENTIALS[loggedUser.toUpperCase()]) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }

        } else {
            // ==========================================
            // שלב א': שליחת שם משתמש וסיסמה
            // ==========================================
            const usernameInput = document.getElementById('username').value.trim();
            const passwordInput = document.getElementById('password').value.trim();
            const upperUsername = usernameInput.toUpperCase();

            // 1. בדיקה מיידית האם זו אחת ממנהלות המערכת המוגדרות מראש
            if (ADMIN_CREDENTIALS[upperUsername]) {
                if (ADMIN_CREDENTIALS[upperUsername] === passwordInput) {
                    const adminUser = {
                        username: upperUsername,
                        role: 'admin'
                    };
                    localStorage.setItem('user', JSON.stringify(adminUser));
                    
                    // מעבר ישיר לדף הניהול
                    window.location.href = 'admin.html';
                    return;
                } else {
                    if (messageEl) {
                        messageEl.style.color = 'red';
                        messageEl.textContent = 'סיסמת מנהל שגויה';
                    }
                    return;
                }
            }

            // 2. עבור משתמשים רגילים - שליחה לשרת
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            });

            const data = await response.json();

            // משתמש לא קיים במערכת -> הפניה להרשמה
            if (response.status === 404) {
                alert('שם המשתמש אינו קיים במערכת. מועבר לדף ההרשמה.');
                window.location.href = 'register.html';
                return;
            }

            // שגיאת סיסמה או שגיאה כללית
            if (!response.ok) {
                if (messageEl) messageEl.textContent = data.message || 'פרטי התחברות שגויים';
                return;
            }

            // שמירת נתוני המשתמש בזיכרון המקומי עבור המשך העבודה באתר
            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
            }

            // במידה ומדובר בכניסה ישירה בלי OTP
            if (data.redirectUrl && !data.requireOtp) {
                window.location.href = data.redirectUrl;
                return;
            }

            // אם השרת דורש אימות OTP
            if (data.requireOtp) {
                pendingLoginEmail = data.email; // שמירת המייל לשלב הבא
                if (messageEl) {
                    messageEl.style.color = 'green';
                    messageEl.textContent = data.message || 'קוד אימות נשלח למייל שלך';
                }

                // יצירה או הצגה של שדה קוד האימות בטופס
                let container = document.getElementById('otpContainer');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'otpContainer';
                    container.style.marginTop = '15px';
                    container.innerHTML = `
                        <label for="otpCode" style="display:block; margin-bottom:5px; font-weight:bold;">הכנס קוד אימות מהמייל:</label>
                        <input type="text" id="otpCode" placeholder="6 ספרות" maxlength="6" style="padding:8px; width:100%; box-sizing:border-box; text-align:center; font-size:18px; letter-spacing:4px;" required />
                    `;
                    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
                    document.getElementById('loginForm').insertBefore(container, submitBtn);
                    if (submitBtn) submitBtn.textContent = 'אמת קוד והתחבר';
                } else {
                    container.style.display = 'block';
                    document.getElementById('otpCode').value = '';
                }

                // הסתרת שדות השם משתמש והסיסמה המקוריים לנוחות המשתמש
                const userField = document.getElementById('username');
                if (userField && userField.closest('.input-group, div')) {
                    userField.closest('.input-group, div').style.display = 'none';
                }
                const passGroup = document.getElementById('password').closest('.input-group, div');
                if (passGroup) passGroup.style.display = 'none';
            } else {
                // התחברות רגילה ללא OTP
                if (data.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }
        }

    } catch (error) {
        if (messageEl) {
            messageEl.style.color = 'red';
            messageEl.textContent = 'שגיאה בתקשורת עם השרת';
        }
    }
});