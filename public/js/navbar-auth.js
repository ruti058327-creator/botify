export function parseJwtPayload(token) {
  try {
    const encodedPayload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');
    const binaryPayload = atob(paddedPayload);
    const bytes = Uint8Array.from(binaryPayload, character => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    console.error('Could not read the current session token:', error);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('nav-auth-container')
    || document.getElementById('auth-buttons-container')
    || document.querySelector('.auth-buttons');
  if (!authContainer) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  const payload = parseJwtPayload(token);
  if (!payload) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return;
  }

  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (error) {
    console.error('Could not read the saved user profile:', error);
  }

  const role = payload.role || user.role || 'user';
  const username = payload.username || user.username || user.fullName || 'משתמש';
  const isPagesDirectory = window.location.pathname.includes('/pages/');

  const greeting = document.createElement('span');
  greeting.className = 'user-greeting';
  greeting.textContent = `👤 ${username} (${role === 'admin' ? 'מנהל' : 'לקוח'})`;

  const logoutButton = document.createElement('button');
  logoutButton.id = 'global-logout-btn';
  logoutButton.className = 'btn-secondary';
  logoutButton.textContent = 'התנתקות';
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('currentChatId');
    window.location.href = isPagesDirectory ? '../index.html' : './index.html';
  });
  authContainer.replaceChildren(greeting, logoutButton);

  const navLinks = document.querySelector('.nav-links');
  if (!navLinks || navLinks.querySelector('[data-role-menu="true"]')) return;

  const roleLink = document.createElement('a');
  roleLink.href = `${isPagesDirectory ? '' : './pages/'}${role === 'admin' ? 'admin.html' : 'dashboard.html'}`;
  roleLink.dataset.roleMenu = 'true';
  roleLink.textContent = role === 'admin' ? 'ניהול מערכת' : 'האזור האישי';
  const activePage = role === 'admin' ? 'admin.html' : 'dashboard.html';
  if (window.location.pathname.endsWith(activePage)) roleLink.classList.add('active');

  const listItem = document.createElement('li');
  listItem.append(roleLink);
  navLinks.append(listItem);
});
