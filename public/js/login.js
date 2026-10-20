    /**
     * מאתחל התחברות, שחזור סיסמה והפניה אופציונלית לאחר הכניסה.
     * @returns {void} מחבר טפסים ומעדכן את קישור ההרשמה.
     */
    document.addEventListener('DOMContentLoaded', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectPage = urlParams.get('redirect');

      const getPostLoginDestination = (requestedPage, role, defaultUrl) => {
        if (!requestedPage) return defaultUrl;
        try {
          const destination = new URL(requestedPage, window.location.href);
          if (destination.origin !== window.location.origin) return defaultUrl;
          if (role !== 'admin' && /\/admin\.html$/i.test(destination.pathname)) return defaultUrl;
          return destination.href;
        } catch {
          return defaultUrl;
        }
      };

      if (redirectPage) {
        document.getElementById('register-link').href = `register.html?redirect=${encodeURIComponent(redirectPage)}`;
      }

      const loginForm = document.getElementById('login-form');
      const errorDiv = document.getElementById('login-error');
      const submitBtn = document.getElementById('btn-login');
      const resetForm = document.getElementById('password-reset-form');
      const resetSubmit = document.getElementById('reset-submit');
      const resetUsername = document.getElementById('reset-username');
      const resetDescription = document.getElementById('reset-description');
      const resetConfirmationFields = document.getElementById('reset-confirmation-fields');
      let isResetConfirmationStep = false;

      /**
       * מציג או מסתיר את טופס שחזור הסיסמה וממלא שם משתמש קיים.
       * @param {MouseEvent} event אירוע הלחיצה על קישור שחזור הסיסמה.
       * @returns {void} מונע ניווט קישור ומעדכן את הטופס.
       */
      document.getElementById('forgot-password-link').addEventListener('click', (event) => {
        event.preventDefault();
        resetForm.style.display = resetForm.style.display === 'none' ? 'block' : 'none';
        errorDiv.style.display = 'none';
        if (resetForm.style.display === 'block' && !isResetConfirmationStep) {
          resetUsername.value = document.getElementById('username').value.trim();
          resetUsername.focus();
        }
      });

      /**
       * מנהל בקשת קוד איפוס או אישור סיסמה חדשה בשלב המתאים.
       * @param {SubmitEvent} event אירוע שליחת טופס איפוס הסיסמה.
       * @returns {Promise<void>} מעדכן את מצב הטופס לפי תוצאת השרת.
       */
      resetForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorDiv.style.display = 'none';
        errorDiv.style.color = '#ef4444';

        try {
          resetSubmit.disabled = true;
          resetSubmit.textContent = isResetConfirmationStep ? 'מעדכן סיסמה...' : 'שולח קוד...';

          const endpoint = isResetConfirmationStep
            ? '/api/password-reset/confirm'
            : '/api/password-reset/request';
          const payload = isResetConfirmationStep
            ? {
                username: resetUsername.value.trim(),
                otpCode: document.getElementById('reset-code').value.trim(),
                password: document.getElementById('new-password').value
              }
            : { username: resetUsername.value.trim() };

          if (!payload.username || (isResetConfirmationStep && (!payload.otpCode || !payload.password))) {
            throw new Error('נא למלא את כל השדות');
          }

          if (isResetConfirmationStep && payload.password.length < 8) {
            throw new Error('הסיסמה חייבת להכיל לפחות 8 תווים');
          }

          if (isResetConfirmationStep && payload.password !== document.getElementById('confirm-password').value) {
            throw new Error('הסיסמאות אינן תואמות');
          }

          const response = await window.ApiService.request(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'לא ניתן להשלים את הבקשה');
          }

          if (isResetConfirmationStep) {
            resetForm.style.display = 'none';
            resetUsername.value = '';
            document.getElementById('reset-code').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            isResetConfirmationStep = false;
            resetConfirmationFields.style.display = 'none';
            document.getElementById('reset-username-group').style.display = 'block';
            resetUsername.readOnly = false;
            resetDescription.textContent = 'אם שם המשתמש קיים, יישלח קוד לכתובת האימייל המשויכת לחשבון.';
            resetSubmit.textContent = 'שליחת קוד';
            errorDiv.style.color = '#16a34a';
            errorDiv.textContent = 'הסיסמה עודכנה. אפשר להתחבר כעת.';
            errorDiv.style.display = 'block';
          } else {
            isResetConfirmationStep = true;
            resetUsername.readOnly = true;
            document.getElementById('reset-username-group').style.display = 'none';
            resetConfirmationFields.style.display = 'block';
            resetDescription.textContent = 'הזינו את הקוד שנשלח אליכם ואת הסיסמה החדשה.';
            resetSubmit.textContent = 'שמירת סיסמה חדשה';
            errorDiv.style.color = '#16a34a';
            errorDiv.textContent = data.message || 'אם האימייל משויך לחשבון, נשלח אליו קוד איפוס.';
            errorDiv.style.display = 'block';
          }
        } catch (error) {
          errorDiv.style.color = '#ef4444';
          errorDiv.textContent = error.message || 'שגיאת תקשורת מול השרת';
          errorDiv.style.display = 'block';
        } finally {
          resetSubmit.disabled = false;
          if (isResetConfirmationStep) {
            resetSubmit.textContent = 'שמירת סיסמה חדשה';
          } else if (resetForm.style.display !== 'none') {
            resetSubmit.textContent = 'שליחת קוד';
          }
        }
      });

      let isOtpStep = false;
      let pendingEmail = '';

      /**
       * מטפל בהתחברות בסיסמה או באימות OTP ומנתב לאחר הצלחה.
       * @param {SubmitEvent} e אירוע שליחת טופס ההתחברות.
       * @returns {Promise<void>} מבצע את בקשת ההתחברות או האימות.
       */
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.style.display = 'none';

        try {
          if (isOtpStep) {
            // ==========================================
            // שלב ב': שליחת קוד ה-OTP לאימות סופי
            // ==========================================
            const otpCode = document.getElementById('otpCode').value.trim();

            if (!otpCode) {
              errorDiv.textContent = 'נא להזין את קוד האימות';
              errorDiv.style.display = 'block';
              return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'מאמת קוד...';

            const response = await window.ApiService.request('/api/login-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: pendingEmail, otpCode })
            });

            const data = await response.json();

            if (response.ok && data.success) {
              localStorage.setItem('user', JSON.stringify(data.user));
              if (data.token) {
                localStorage.setItem('token', data.token);
              }

              window.location.href = getPostLoginDestination(
                redirectPage,
                data.user?.role,
                data.redirectUrl || 'dashboard.html'
              );
            } else {
              errorDiv.textContent = data.message || 'קוד האימות שגוי';
              errorDiv.style.display = 'block';
            }

          } else {
            // ==========================================
            // שלב א': שליחת שם משתמש וסיסמה
            // ==========================================
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            if (!username || !password) {
              errorDiv.textContent = 'נא למלא את כל השדות';
              errorDiv.style.display = 'block';
              return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'מתחבר...';

            const response = await window.ApiService.request('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            // 1. משתמש לא קיים במערכת -> הפניה להרשמה
            if (response.status === 404) {
              alert('שם המשתמש אינו קיים במערכת. מועבר לדף ההרשמה.');
              window.location.href = 'register.html';
              return;
            }

            // 2. שגיאה כללית או סיסמה שגויה
            if (!response.ok) {
              errorDiv.textContent = data.message || 'פרטי התחברות שגויים';
              errorDiv.style.display = 'block';
              return;
            }

            // 3. Support a successful login response that does not require OTP.
            if (data.redirectUrl && !data.requireOtp) {
              localStorage.setItem('user', JSON.stringify(data.user));
              localStorage.setItem('token', data.token);
              window.location.href = data.redirectUrl;
              return;
            }

            // 4. אם השרת דורש אימות OTP
            if (data.requireOtp) {
              pendingEmail = data.email;
              isOtpStep = true;

              // הסתרת שדות שם משתמש וסיסמה והצגת שדה הקוד
              document.getElementById('group-username').style.display = 'none';
              document.getElementById('group-password').style.display = 'none';
              document.getElementById('group-otp').style.display = 'block';
              document.getElementById('username').disabled = true;
              document.getElementById('password').disabled = true;
              const otpInput = document.getElementById('otpCode');
              otpInput.disabled = false;
              otpInput.focus();

              errorDiv.style.color = '#16a34a'; // צבע ירוק להודעת הצלחה
              errorDiv.textContent = data.message || 'קוד אימות נשלח למייל שלך';
              errorDiv.style.display = 'block';

              submitBtn.textContent = 'אמת קוד והתחבר';
            }
          }
        } catch (err) {
          console.error('Login error:', err);
          errorDiv.style.color = '#ef4444';
          errorDiv.textContent = 'שגיאת תקשורת מול השרת';
          errorDiv.style.display = 'block';
        } finally {
          submitBtn.disabled = false;
          if (!isOtpStep) {
            submitBtn.textContent = 'התחבר';
          }
        }
      });
    });