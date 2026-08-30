require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('בודק משתני סביבה:');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS קיים?', Boolean(process.env.EMAIL_PASS));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendTest() {
  try {
    console.log('\nמנסה לשלוח מייל בדיקה...');
    const info = await transporter.sendMail({
      from: `"Botify Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // שולח מייל לעצמך לבדיקה
      subject: 'בדיקת שליחת מייל מ-Botify',
      text: 'שלום! אם קיבלת מייל זה, מנגנון השליחה מחובר ועובד מצוין!'
    });
    console.log('✅ המייל נשלח בהצלחה! מזהה הודעה:', info.messageId);
  } catch (error) {
    console.error('❌ שגיאה בשליחת המייל:', error.message);
  }
}

sendTest();