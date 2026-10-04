window.ApiService = Object.freeze({
  /**
   * שולח בקשת fetch יחסית לכתובת הבסיס שהוגדרה עבור השרת.
   * @param {string} path נתיב ה-API או כתובת יחסית.
   * @param {RequestInit} [options={}] אפשרויות fetch, לרבות כותרות ושיטת HTTP.
   * @returns {Promise<Response>} תגובת הרשת; ה-Promise נדחה אם כתובת השרת לא הוגדרה.
   */
  request(path, options = {}) {
    if (!window.API_BASE_URL) {
      return Promise.reject(new Error('כתובת השרת לא הוגדרה'));
    }

    return fetch(new URL(path, `${window.API_BASE_URL}/`), options);
  }
});