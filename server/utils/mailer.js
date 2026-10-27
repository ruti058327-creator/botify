import '../config/env.js';
import httpError from './httpError.js';

export async function sendEmail({ to, subject, html, text, fromName = 'Botify Security' }) {
  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_USER) {
    throw httpError(503, 'שירות שליחת האימייל אינו זמין כרגע');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { name: fromName, email: process.env.EMAIL_USER },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text
    })
  });

  if (!response.ok) {
    console.error('Brevo error:', response.status, await response.text());
    throw httpError(502, 'שליחת האימייל נכשלה');
  }

  return response.json();
}

export default { sendEmail };