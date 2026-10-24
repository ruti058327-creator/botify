// משתמשים במקור הנוכחי של הדף ככתובת הבסיס, כך שהקוד יעבוד בכל סביבה שאליה האתר נפרס.
export const API_BASE_URL = window.location.origin;

// חושפים את הכתובת גם כמאפיין גלובלי כדי שקוד ישן יותר יוכל להשתמש בה.
window.API_BASE_URL = API_BASE_URL;

// מאפשרים לקבצים אחרים לייבא את הערך כברירת מחדל.
export default API_BASE_URL;
