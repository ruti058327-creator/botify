document.addEventListener('DOMContentLoaded', () => {
    // בדיקת שני המזהים האפשריים בסרגל
    const authContainer = document.getElementById('nav-auth-container') || document.getElementById('auth-buttons-container');
    if (!authContainer) return;

    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (storedUser || token) {
        try {
            const userData = storedUser ? JSON.parse(storedUser) : {};
            const username = userData.username || userData.fullName || userData.name || 'משתמש';

            // החלפה מוחלטת של תוכן ה-container (מסיר את התחברות והרשמה)
            authContainer.innerHTML = `
                <div class="user-greeting" style="display: flex; align-items: center; gap: 8px; font-weight: bold; margin-left: 10px;">
                    <span>👤</span>
                    <span>${username}</span>
                </div>
                <button id="global-logout-btn" class="btn-secondary" style="background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">התנתקות</button>
            `;

            // טיפול בלחיצה על התנתקות
            document.getElementById('global-logout-btn')?.addEventListener('click', () => {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                window.location.href = '../index.html';
            });

            // עדכון קישורי הבית כך שיפנו לדשבורד
            document.querySelectorAll('.nav-links a, .navbar .logo').forEach(link => {
                const text = link.textContent.trim();
                const href = link.getAttribute('href') || '';
                if (text === 'בית' || href.includes('index.html')) {
                    link.setAttribute('href', 'dashboard.html');
                }
            });

        } catch (e) {
            console.error('Error updating navbar session:', e);
        }
    }
});