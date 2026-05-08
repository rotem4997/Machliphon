import nodemailer from 'nodemailer';

// Lazy-init transporter so missing env vars don't crash startup
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null;  // email not configured — silently skip
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return; // silently skip when SMTP not configured
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'מחליפון <noreply@machliphon.app>',
    ...opts,
  });
}
