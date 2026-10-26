// מייבאים שירות משותף כדי לשלוח לשרת בקשות התחברות ואיפוס סיסמה באותה דרך.
import { ApiService } from '../services/api-service.js';

    /**
     * מאתחל התחברות, שחזור סיסמה והפניה אופציונלית לאחר הכניסה.
     * @returns {void} מחבר טפסים ומעדכן את קישור ההרשמה.
     */
// ממתינים לטעינת רכיבי דף הכניסה לפני קריאת פרמטרים וחיבור טפסים.
    document.addEventListener('DOMContentLoaded', () => {
      // קוראים מהכתובת יעד חלופי שאליו המשתמש ביקש להגיע אחרי ההתחברות.
      const urlParams = new URLSearchParams(window.location.search);
      const redirectPage = urlParams.get('redirect');

      // בוחרים יעד ניווט בטוח: היעד חייב להישאר באותו מקור, ומנהל בלבד רשאי לפתוח admin.
      const getPostLoginDestination = (requestedPage, role, defaultUrl) => {
        // בהיעדר יעד מפורש משתמשים בכתובת ברירת המחדל שהשרת או הדף סיפקו.
        if (!requestedPage) return defaultUrl;
        try {
          // פותרים גם כתובות יחסיות כדי לבדוק את המקור ואת הנתיב הסופי.
          const destination = new URL(requestedPage, window.location.href);
          // חוסמים הפניה לאתר חיצוני, וכן הפניה של משתמש רגיל לעמוד ניהול.
          if (destination.origin !== window.location.origin) return defaultUrl;
          if (role !== 'admin' && /\/admin\.html$/i.test(destination.pathname)) return defaultUrl;
          // מחזירים כתובת מלאה כדי שהדפדפן יוכל לנווט אל היעד המאומת.
          return destination.href;
        } catch {
          // כתובת שלא ניתן לפענח אינה יעד בטוח, ולכן משתמשים בברירת המחדל.
          return defaultUrl;
        }
      };

      // שומרים פרמטר redirect גם בקישור הרשמה כדי לא לאבד את היעד במהלך יצירת חשבון.
      if (redirectPage) {
        document.getElementById('register-link').href = `register.html?redirect=${encodeURIComponent(redirectPage)}`;
      }

      // מאתרים את טופס הכניסה ואת רכיבי השגיאה והשליטה במצב הטפסים.
      const loginForm = document.getElementById('login-form');
      const errorDiv = document.getElementById('login-error');
      const submitBtn = document.getElementById('btn-login');
      const resetForm = document.getElementById('password-reset-form');
      const resetSubmit = document.getElementById('reset-submit');
      const resetUsername = document.getElementById('reset-username');
      const resetDescription = document.getElementById('reset-description');
      const resetConfirmationFields = document.getElementById('reset-confirmation-fields');
      // מסמנים האם תהליך איפוס הסיסמה כבר עבר מבקשת קוד לאישור קוד וסיסמה חדשה.
      let isResetConfirmationStep = false;

      /**
       * מציג או מסתיר את טופס שחזור הסיסמה וממלא שם משתמש קיים.
       * @param {MouseEvent} event אירוע הלחיצה על קישור שחזור הסיסמה.
       * @returns {void} מונע ניווט קישור ומעדכן את הטופס.
       */
      document.getElementById('forgot-password-link').addEventListener('click', (event) => {
        // מונעים מעבר לקישור ומחליפים את הנראות של טופס שחזור הסיסמה.
        event.preventDefault();
        resetForm.style.display = resetForm.style.display === 'none' ? 'block' : 'none';
        // מנקים הודעה קודמת, ואם פותחים את שלב הבקשה ממלאים שם משתמש שכבר הוזן.
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
        // שולטים בתהליך באמצעות JavaScript ומנקים עיצוב של הודעה קודמת.
        event.preventDefault();
        errorDiv.style.display = 'none';
        errorDiv.style.color = '#ef4444';

        try {
          // משביתים את הכפתור ומציגים כיתוב המתאר אם נשלח קוד או נשמרת סיסמה.
          resetSubmit.disabled = true;
          resetSubmit.textContent = isResetConfirmationStep ? 'מעדכן סיסמה...' : 'שולח קוד...';

          // שלב ראשון מבקש קוד; שלב שני מאמת קוד ושומר את הסיסמה החדשה.
          const endpoint = isResetConfirmationStep
            ? '/api/password-reset/confirm'
            : '/api/password-reset/request';
          // מרכיבים את הנתונים המתאימים לשלב הנוכחי בלי לשלוח שדות מיותרים.
          const payload = isResetConfirmationStep
            ? {
                username: resetUsername.value.trim(),
                otpCode: document.getElementById('reset-code').value.trim(),
                password: document.getElementById('new-password').value
              }
            : { username: resetUsername.value.trim() };

          // דורשים שם משתמש, ובשלב האישור גם קוד וסיסמה.
          if (!payload.username || (isResetConfirmationStep && (!payload.otpCode || !payload.password))) {
            throw new Error('נא למלא את כל השדות');
          }

          // מחילים את אורך הסיסמה המינימלי לפני שליחת הבקשה.
          if (isResetConfirmationStep && payload.password.length < 8) {
            throw new Error('הסיסמה חייבת להכיל לפחות 8 תווים');
          }

          // משווים את שתי הסיסמאות כדי למנוע שמירה של הקלדה שגויה.
          if (isResetConfirmationStep && payload.password !== document.getElementById('confirm-password').value) {
            throw new Error('הסיסמאות אינן תואמות');
          }

          // שולחים לשירות המתאים את פרטי המשתמש/האימות בפורמט JSON.
          const response = await ApiService.request(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          // קוראים את הודעת השרת כדי להציג שגיאות או הודעת שליחה כללית.
          const data = await response.json();

          if (!response.ok) {
            // מעבירים כישלון HTTP למסלול הטיפול האחיד ב-catch.
            throw new Error(data.message || 'לא ניתן להשלים את הבקשה');
          }

          if (isResetConfirmationStep) {
            // לאחר עדכון מוצלח מסתירים את הטופס ומאפסים את השדות הרגישים.
            resetForm.style.display = 'none';
            resetUsername.value = '';
            document.getElementById('reset-code').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            // מחזירים את טופס האיפוס לשלב הבקשה ומציגים הודעת הצלחה ירוקה.
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
            // לאחר בקשת הקוד עוברים לשלב אישור, נועלים שם משתמש ומציגים שדות חדשים.
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
          // מציגים שגיאת אימות/שרת באדום באזור המשוב המשותף למסך הכניסה.
          errorDiv.style.color = '#ef4444';
          errorDiv.textContent = error.message || 'שגיאת תקשורת מול השרת';
          errorDiv.style.display = 'block';
        } finally {
          // מפעילים את הכפתור מחדש ושומרים כיתוב מתאים לשלב הפעיל של האיפוס.
          resetSubmit.disabled = false;
          if (isResetConfirmationStep) {
            resetSubmit.textContent = 'שמירת סיסמה חדשה';
          } else if (resetForm.style.display !== 'none') {
            resetSubmit.textContent = 'שליחת קוד';
          }
        }
      });

      // מצב הכניסה מתחיל בהזנת סיסמה; אימייל OTP נקבע לאחר תשובת השרת.
      let isOtpStep = false;
      let pendingEmail = '';

      /**
       * מטפל בהתחברות בסיסמה או באימות OTP ומנתב לאחר הצלחה.
       * @param {SubmitEvent} e אירוע שליחת טופס ההתחברות.
       * @returns {Promise<void>} מבצע את בקשת ההתחברות או האימות.
       */
      loginForm.addEventListener('submit', async (e) => {
        // מונעים טעינה מחדש ומסתירים שגיאה מהניסיון הקודם.
        e.preventDefault();
        errorDiv.style.display = 'none';

        try {
          if (isOtpStep) {
            // ==========================================
            // שלב ב': שליחת קוד ה-OTP לאימות סופי
            // ==========================================
            // קוראים קוד אימות נקי ומציגים הודעה אם לא הוזן ערך.
            const otpCode = document.getElementById('otpCode').value.trim();

            if (!otpCode) {
              errorDiv.textContent = 'נא להזין את קוד האימות';
              errorDiv.style.display = 'block';
              return;
            }

            // מונעים שליחה חוזרת בזמן אימות הקוד.
            submitBtn.disabled = true;
            submitBtn.textContent = 'מאמת קוד...';

            // מאמתים את הקוד שנשלח לאימייל שהשרת קישר לתהליך הכניסה.
            const response = await ApiService.request('/api/login-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: pendingEmail, otpCode })
            });

            // מפענחים את המשתמש, האסימון והודעת השרת מתשובת האימות.
            const data = await response.json();

            if (response.ok && data.success) {
              // שומרים את פרטי המשתמש והאסימון להמשך שימוש באתר לאחר כניסה מוצלחת.
              localStorage.setItem('user', JSON.stringify(data.user));
              if (data.token) {
                localStorage.setItem('token', data.token);
              }

              // מנתבים אל היעד המאומת; שרת יכול לספק ברירת מחדל משלו.
              window.location.href = getPostLoginDestination(
                redirectPage,
                data.user?.role,
                data.redirectUrl || 'dashboard.html'
              );
            } else {
              // קוד שגוי או תשובת אימות לא מוצלחת מוצגים למשתמש.
              errorDiv.textContent = data.message || 'קוד האימות שגוי';
              errorDiv.style.display = 'block';
            }

          } else {
            // ==========================================
            // שלב א': שליחת שם משתמש וסיסמה
            // ==========================================
            // בשלב הראשון קוראים שם משתמש וסיסמה מתוך הטופס.
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            // עוצרים אם חסר אחד מפרטי ההתחברות הדרושים.
            if (!username || !password) {
              errorDiv.textContent = 'נא למלא את כל השדות';
              errorDiv.style.display = 'block';
              return;
            }

            // מסמנים את פעולת הכניסה כדי למנוע לחיצות כפולות.
            submitBtn.disabled = true;
            submitBtn.textContent = 'מתחבר...';

            // שולחים את פרטי ההתחברות לשרת כבקשת POST בפורמט JSON.
            const response = await ApiService.request('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
            });

            // קוראים את פרטי המשתמש, מצב OTP והודעת השגיאה שהשרת החזיר.
            const data = await response.json();

            // 1. משתמש לא קיים במערכת -> הפניה להרשמה
            if (response.status === 404) {
              // חשבון לא קיים: מודיעים למשתמש ומעבירים אותו לתהליך הרשמה.
              alert('שם המשתמש אינו קיים במערכת. מועבר לדף ההרשמה.');
              window.location.href = 'register.html';
              return;
            }

            // 2. שגיאה כללית או סיסמה שגויה
            if (!response.ok) {
              // תשובה שלילית שאינה 404 מוצגת כהודעת שגיאת התחברות.
              errorDiv.textContent = data.message || 'פרטי התחברות שגויים';
              errorDiv.style.display = 'block';
              return;
            }

            // 3. Support a successful login response that does not require OTP.
            if (data.redirectUrl && !data.requireOtp) {
              // שומרים פרטי הפעלה ומפנים מיד כאשר השרת אינו דורש שלב OTP.
              localStorage.setItem('user', JSON.stringify(data.user));
              localStorage.setItem('token', data.token);
              window.location.href = getPostLoginDestination(
                redirectPage,
                data.user?.role,
                data.redirectUrl
              );
              return;
            }

            // 4. אם השרת דורש אימות OTP
            if (data.requireOtp) {
              // שומרים את כתובת האימייל ומסמנים שהשליחה הבאה תהיה של קוד אימות.
              pendingEmail = data.email;
              isOtpStep = true;

              // הסתרת שדות שם משתמש וסיסמה והצגת שדה הקוד
              // מחליפים את שדות המשתמש והסיסמה בשדה OTP שניתן כעת למלא.
              document.getElementById('group-username').style.display = 'none';
              document.getElementById('group-password').style.display = 'none';
              document.getElementById('group-otp').style.display = 'block';
              document.getElementById('username').disabled = true;
              document.getElementById('password').disabled = true;
              const otpInput = document.getElementById('otpCode');
              otpInput.disabled = false;
              otpInput.focus();

              // מציגים הודעת הצלחה/הנחיה ומעדכנים את כיתוב הכפתור לשלב הבא.
              errorDiv.style.color = '#16a34a'; // צבע ירוק להודעת הצלחה
              errorDiv.textContent = data.message || 'קוד אימות נשלח למייל שלך';
              errorDiv.style.display = 'block';

              submitBtn.textContent = 'אמת קוד והתחבר';
            }
          }
        } catch (err) {
          // שגיאת רשת או פענוח נרשמת למסוף ומוצגת כהודעת תקשורת כללית.
          console.error('Login error:', err);
          errorDiv.style.color = '#ef4444';
          errorDiv.textContent = 'שגיאת תקשורת מול השרת';
          errorDiv.style.display = 'block';
        } finally {
          // מחזירים את הכפתור לפעילות; בשלב OTP משאירים את הכיתוב המתאים.
          submitBtn.disabled = false;
          if (!isOtpStep) {
            submitBtn.textContent = 'התחבר';
          }
        }
      });
    });
