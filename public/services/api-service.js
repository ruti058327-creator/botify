import { API_BASE_URL } from '../js/config.js';

export const ApiService = Object.freeze({
  request(path, options = {}) {
    if (!API_BASE_URL) {
      return Promise.reject(new Error('כתובת השרת לא הוגדרה'));
    }

    return fetch(new URL(path, `${API_BASE_URL}/`), options);
  }
});

window.ApiService = ApiService;

export default ApiService;
