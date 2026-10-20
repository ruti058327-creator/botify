/**
 * Reads the role claim supplied in the signed authentication token.
 * The server remains responsible for verifying authorization.
 * @param {string} token JWT from the current session.
 * @returns {string|null} Token role, if readable.
 */
function getTokenRole(token) {
    try {
        const encodedPayload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(encodedPayload)).role || null;
    } catch (error) {
        console.error('Could not read the current session role:', error);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('nav-auth-container')
        || document.getElementById('auth-buttons-container');
    if (!authContainer) return;

    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token && !storedUser) return;

    let userData = {};
    try {
        userData = storedUser ? JSON.parse(storedUser) : {};
    } catch (error) {
        console.error('Could not read the saved user profile:', error);
    }

    const role = token ? getTokenRole(token) : null;
    const username = userData.username || userData.fullName || userData.name || 'משתמש';
    const isPagesDirectory = window.location.pathname.includes('/pages/');
    const dashboardUrl = `${isPagesDirectory ? '' : './pages/'}${role === 'admin' ? 'admin.html' : 'dashboard.html'}`;

    const greeting = document.createElement('span');
    greeting.className = 'user-greeting';
    greeting.textContent = `👤 ${username}`;

    const logoutButton = document.createElement('button');
    logoutButton.id = 'global-logout-btn';
    logoutButton.className = 'btn-secondary';
    logoutButton.textContent = 'התנתקות';
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = isPagesDirectory ? '../index.html' : './index.html';
    });

    authContainer.replaceChildren(greeting, logoutButton);

    const navLinks = document.querySelector('.nav-links');
    if (navLinks && role) {
        const roleLink = document.createElement('a');
        roleLink.href = dashboardUrl;
        roleLink.dataset.roleMenu = 'true';
        roleLink.textContent = role === 'admin' ? 'ניהול מערכת' : 'האזור האישי';
        const listItem = document.createElement('li');
        listItem.append(roleLink);
        navLinks.append(listItem);
    }

    document.querySelectorAll('.nav-links a, .navbar .logo').forEach(link => {
        const text = link.textContent.trim();
        const href = link.getAttribute('href') || '';
        if (text === 'בית' || href.includes('index.html')) {
            link.setAttribute('href', dashboardUrl);
        }
    });
});
