document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const messageEl = document.getElementById('message');

    messageEl.textContent = '';

    try {
        const response = await fetch('/api/login', {
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

        // 2. שגיאת סיסמה או שגיאה כללית
        if (!response.ok) {
            messageEl.textContent = data.message || 'פרטי התחברות שגויים';
            return;
        }

        // 3. ניתוב לפי סוג המשתמש (מנהל או משתמש רגיל)
        if (data.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }

    } catch (error) {
        messageEl.textContent = 'שגיאה בתקשורת עם השרת';
    }
});