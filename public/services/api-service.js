// מייבאים את כתובת הבסיס שנקבעה לפי המקור שממנו האתר נטען.
import { API_BASE_URL } from '../js/config.js';

// מקפיאים את אובייקט השירות כדי למנוע החלפה מקרית של המתודות שלו בזמן ריצה.
export const ApiService = Object.freeze({
  // שולחים בקשת HTTP לנתיב יחסי, תוך שמירה על אפשרויות fetch שהקורא סיפק.
  request(path, options = {}) {
    // מחזירים דחייה מיידית אם לא הוגדרה כתובת שרת, במקום לנסות fetch לכתובת לא תקינה.
    if (!API_BASE_URL) {
      return Promise.reject(new Error('כתובת השרת לא הוגדרה'));
    }

    // בונים כתובת מלאה מתוך הבסיס והנתיב ומעבירים לדפדפן את הגדרות הבקשה.
    return fetch(new URL(path, `${API_BASE_URL}/`), options);
  }
});

// חושפים את אותו שירות גם לסקריפטים שמשתמשים במרחב הגלובלי של הדפדפן.
window.ApiService = ApiService;

// מאפשרים גם ייבוא ברירת מחדל בקבצים אחרים.
export default ApiService;
