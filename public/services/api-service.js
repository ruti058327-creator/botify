window.ApiService = Object.freeze({
  request(path, options = {}) {
    if (!window.API_BASE_URL) {
      return Promise.reject(new Error('כתובת השרת לא הוגדרה'));
    }

    return fetch(new URL(path, `${window.API_BASE_URL}/`), options);
  }
});