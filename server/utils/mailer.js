// טוען את פרטי החשבון לפני יצירת חיבור לספק הדוא"ל.
import '../config/env.js';
import nodemailer from 'nodemailer';
import httpError from './httpError.js';

// מגדיר את Nodemailer לשליחה דרך Gmail עם פרטי החשבון מהסביבה.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export async function sendEmail({ to, subject, html, text, fromName = 'Botify Security' }) {
  // מדווחים על שירות לא זמין במקום לנסות לשלוח עם פרטי התחברות חסרים.
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw httpError(503, 'שירות שליחת האימייל אינו זמין כרגע');
  }

  // מעבירים לספק את הנמען, הכותרת וגוף הטקסט או ה-HTML כפי שסופקו.
  return transporter.sendMail({
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text
  });
}

export default { sendEmail };
