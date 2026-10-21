import './config/env.js';
import { sendEmail } from './utils/mailer.js';


console.log('בודק משתני סביבה:');
console.log('EMAIL_USER מוגדר?', Boolean(process.env.EMAIL_USER));
console.log('EMAIL_PASS קיים?', Boolean(process.env.EMAIL_PASS));

/**
 * שולח הודעת בדיקה לחשבון הדוא״ל שהוגדר במשתני הסביבה.
 * @returns {Promise<void>} מדווח ביומן על הצלחה או על כשל בשליחה.
 */
async function sendTest() {
  try {
    console.log('\nמנסה לשלוח מייל בדיקה...');
    const info = await sendEmail({
      to: process.env.EMAIL_USER, // שולח מייל לעצמך לבדיקה
      subject: 'בדיקת שליחת מייל מ-Botify',
      text: 'שלום! אם קיבלת מייל זה, מנגנון השליחה מחובר ועובד מצוין!',
      fromName: 'Botify Test'
    });
    console.log('✅ המייל נשלח בהצלחה! מזהה הודעה:', info.messageId);
  } catch (error) {
    console.error('❌ שגיאה בשליחת המייל:', error.message);
  }
}

sendTest();