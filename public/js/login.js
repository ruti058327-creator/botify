let pendingLoginEmail = '';

const ADMIN_CREDENTIALS = {
    "NOA": "578621",
    "RUTY": "578621",
    "MIRYAM": "578621"
};

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const messageEl = document.getElementById('message');
    if (messageEl) messageEl.textContent = '';

    const otpInput = document.getElementById('otpCode');
    const isOtpStep = otpInput && otpInput.style.display !== 'none';

    try {
        if (isOtpStep) {
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

            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            localStorage.setItem('token', data.token || 'botify_session_active');

            const loggedUser = data.user ? (data.user.username || data.user.fullName) : '';
            
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else if (data.role === 'admin' || ADMIN_CREDENTIALS[loggedUser.toUpperCase()]) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }

        } else {
            const usernameInput = document.getElementById('username').value.trim();
            const passwordInput = document.getElementById('password').value.trim();
            const upperUsername = usernameInput.toUpperCase();

            // מנהלות
            if (ADMIN_CREDENTIALS[upperUsername]) {
                if (ADMIN_CREDENTIALS[upperUsername] === passwordInput) {
                    const adminUser = {
                        username: upperUsername,
                        role: 'admin'
                    };
                    localStorage.setItem('user', JSON.stringify(adminUser));
                    localStorage.setItem('token', 'botify_admin_session_active');
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

            // משתמשים רגילים
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            });

            const data = await response.json();

            if (response.status === 404) {
                alert('שם המשתמש אינו קיים במערכת. מועבר לדף ההרשמה.');
                window.location.href = 'register.html';
                return;
            }

            if (!response.ok) {
                if (messageEl) messageEl.textContent = data.message || 'פרטי התחברות שגויים';
                return;
            }

            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            localStorage.setItem('token', data.token || 'botify_session_active');

            if (data.redirectUrl && !data.requireOtp) {
                window.location.href = data.redirectUrl;
                return;
            }

            if (data.requireOtp) {
                pendingLoginEmail = data.email;
                if (messageEl) {
                    messageEl.style.color = 'green';
                    messageEl.textContent = data.message || 'קוד אימות נשלח למייל שלך';
                }

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

                const userField = document.getElementById('username');
                if (userField && userField.closest('.input-group, div')) {
                    userField.closest('.input-group, div').style.display = 'none';
                }
                const passGroup = document.getElementById('password').closest('.input-group, div');
                if (passGroup) passGroup.style.display = 'none';
            } else {
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