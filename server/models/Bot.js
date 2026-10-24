// Mongoose מספק סכמות ומודלים למסמכי הבוטים במסד הנתונים.
import mongoose from 'mongoose';


// כל מסמך בוט שומר את בעליו, אתר המקור, התוכן שנסרק והנחיות המענה.
const botSchema = new mongoose.Schema({
    // קישור למשתמש שיצר את הבוט; בוט מנהל עשוי להיות ללא בעלים אישי.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // כתובת האתר משמשת לזיהוי מקור התוכן ולהצגתה למשתמשים.
    websiteUrl: {
        type: String,
        trim: true
    },
    // טקסט האתר נשמר כדי לענות לשאלות בלי לסרוק את האתר מחדש בכל הודעה.
    scrapedContent: { type: String },
    // הנחיות אופציונליות מכוונות את אופן ניסוח התשובות של הבוט.
    instructions: { type: String },
    // תאריך יצירה מפורש מאפשר מיון גם בלי להסתמך על timestamps אוטומטיים.
    createdAt: { type: Date, default: Date.now }
});

// רושם את הסכמה תחת שם המודל שבו משתמשים הבקרים.
export default mongoose.model('Bot', botSchema);