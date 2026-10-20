import '../config/env.js';
import nodemailer from 'nodemailer';
import httpError from './httpError.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export async function sendEmail({ to, subject, html, text, fromName = 'Botify Security' }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw httpError(503, 'שירות שליחת האימייל אינו זמין כרגע');
  }

  return transporter.sendMail({
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text
  });
}

export default { sendEmail };
