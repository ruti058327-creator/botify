document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // מניעת רענון עמוד

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const messageDiv = document.getElementById('message');

    // איפוס והסתרה של הודעת שגיאה קודמת
    messageDiv.style.display = 'none';
    messageDiv.textContent = '';

    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'שגיאה במהלך ההרשמה');
        }

        // אם ההרשמה הצליחה - המשתמש נשמר ב-DB!
        alert('ההרשמה בוצעה בהצלחה! מעבר לדף ההתחברות...');
        window.location.href = 'login.html';

    } catch (err) {
        // הצגת הודעת השגיאה בתוך אלמנט ה-error-msg שבעיצוב
        messageDiv.style.display = 'block';
        messageDiv.textContent = err.message;
    }
});