// טוען הגדרות סביבה לפני יצירת החיבור למסד הנתונים והפעלת השרת.
import './config/env.js';
// מייבא את אפליקציית Express שהוגדרו בה הנתיבים וה-middleware.
import app from './app.js';
// פותח את החיבור למסד הנתונים לפני שמתחילים לקבל בקשות.
import connectDB from './config/db.js';
// מודל המנהלים משמש לסנכרון רשימת המנהלים בכל אתחול.
import Administrator from './models/Administrator.js';

// ממירים פורט ממחרוזת הסביבה למספר שהשרת יקבל.
const PORT = Number(process.env.PORT);

try {
  // ממתינים למסד הנתונים כדי לא להפעיל שרת שאינו יכול לשרת בקשות.
  await connectDB();
  // קוראים את שמות המנהלים מהסביבה או משתמשים כברירת מחדל, מנקים כפילויות.
  const administratorUsernames = [
    ...new Set(
      (process.env.ADMIN_USERNAMES === undefined ? 'NOA,RUTI,RUTY,MIRYAM' : process.env.ADMIN_USERNAMES)
        .split(',')
        .map(username => username.trim().toLowerCase())
        .filter(Boolean)
    )
  ];
  // מוסיפים מנהלים חסרים בלי לדרוס מסמכים שכבר קיימים במסד.
  if (administratorUsernames.length) {
    await Administrator.bulkWrite(administratorUsernames.map(username => ({
      updateOne: {
        filter: { username },
        update: { $setOnInsert: { username } },
        upsert: true
      }
    })));
  }
  // מסירים חשבונות מנהל שאינם ברשימה המורשית שהוגדרה לאתחול זה.
  await Administrator.deleteMany({ username: { $nin: administratorUsernames } });
  // מתחילים להאזין רק לאחר שהאתחול ומסד הנתונים הושלמו.
  app.listen(PORT, () => {
    // מציגים את כתובת ההאזנה כדי שמפעיל השרת ידע היכן השירות זמין.
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
} catch (error) {
  // מדווחים על סיבת הכשל ומסמנים את התהליך ככושל בלי להסתיר את הודעת השגיאה.
  console.error('🔥 Server startup failed:', error.message);
  process.exitCode = 1;
}
