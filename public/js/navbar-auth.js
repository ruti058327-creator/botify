// מפענחים את גוף ה-JWT, שהוא החלק השני של האסימון המקודד.
export function parseJwtPayload(token) {
  try {
    // ממירים תווי Base64Url לתווי Base64 רגילים ומוסיפים ריפוד נדרש לפענוח.
    const encodedPayload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');
    // atob מחזיר מחרוזת בתים; ממירים אותה למערך בתים ולבסוף לטקסט UTF-8.
    const binaryPayload = atob(paddedPayload);
    const bytes = Uint8Array.from(binaryPayload, character => character.charCodeAt(0));
    // מפענחים את הטקסט כמבנה JSON ומחזירים את פרטי המשתמש שבאסימון.
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    // אסימון פגום אינו ניתן לשימוש, ולכן מדווחים ומחזירים null לקורא.
    console.error('Could not read the current session token:', error);
    return null;
  }
}

// ממתינים ל-DOM לפני איתור רכיבי הניווט והוספת פרטי החשבון.
document.addEventListener('DOMContentLoaded', () => {
  // תומכים בכמה שמות/מבנים של רכיב הכפתורים כדי שהקוד יתאים לעמודים שונים.
  const authContainer = document.getElementById('nav-auth-container')
    || document.getElementById('auth-buttons-container')
    || document.querySelector('.auth-buttons');
  // אם אין אזור ניווט או שאין אסימון, לא נדרשת התאמה של תפריט משתמש מחובר.
  if (!authContainer) return;

  // האסימון קובע אם יש משתמש מחובר שהניווט צריך לייצג.
  const token = localStorage.getItem('token');
  if (!token) return;

  // מפענחים את האסימון; במקרה של מידע לא תקין מוחקים פרטי התחברות מיושנים.
  const payload = parseJwtPayload(token);
  if (!payload) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return;
  }

  // קוראים גם פרופיל מקומי, שעשוי להכיל פרטים שאינם נכללים באסימון.
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (error) {
    console.error('Could not read the saved user profile:', error);
  }

  // מעדיפים תפקיד ושם מתוך האסימון, ומשתמשים בפרופיל המקומי כגיבוי.
  const role = payload.role || user.role || 'user';
  const username = payload.username || user.username || user.fullName || 'משתמש';
  // הנתיב היחסי לקישורים משתנה אם הדף נמצא בתוך תיקיית pages.
  const isPagesDirectory = window.location.pathname.includes('/pages/');

  // יוצרים רכיב טקסט לברכת המשתמש ומציגים תפקיד בעברית.
  const greeting = document.createElement('span');
  greeting.className = 'user-greeting';
  greeting.textContent = `👤 ${username} (${role === 'admin' ? 'מנהל' : 'לקוח'})`;

  // יוצרים כפתור התנתקות ומגדירים את המראה והכיתוב שלו.
  const logoutButton = document.createElement('button');
  logoutButton.id = 'global-logout-btn';
  logoutButton.className = 'btn-secondary';
  logoutButton.textContent = 'התנתקות';
  // בעת התנתקות מוחקים את כל נתוני ההפעלה המקומיים וחוזרים לדף הבית.
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('currentChatId');
    window.location.href = isPagesDirectory ? '../index.html' : './index.html';
  });
  // מחליפים את כפתורי האימות הישנים בברכה ובכפתור ההתנתקות.
  authContainer.replaceChildren(greeting, logoutButton);

  // מוסיפים קישור לאזור המתאים רק אם התפריט קיים ועדיין לא נוסף בו קישור תפקיד.
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks || navLinks.querySelector('[data-role-menu="true"]')) return;

  // בונים קישור לממשק מנהל או לאזור האישי לפי התפקיד של המשתמש.
  const roleLink = document.createElement('a');
  roleLink.href = `${isPagesDirectory ? '' : './pages/'}${role === 'admin' ? 'admin.html' : 'dashboard.html'}`;
  roleLink.dataset.roleMenu = 'true';
  roleLink.textContent = role === 'admin' ? 'ניהול מערכת' : 'האזור האישי';
  // מסמנים את הקישור כפעיל כאשר הוא מוביל לעמוד הפתוח כעת.
  const activePage = role === 'admin' ? 'admin.html' : 'dashboard.html';
  if (window.location.pathname.endsWith(activePage)) roleLink.classList.add('active');

  // עוטפים את הקישור בפריט רשימה ומצרפים אותו לתפריט הניווט.
  const listItem = document.createElement('li');
  listItem.append(roleLink);
  navLinks.append(listItem);
});
