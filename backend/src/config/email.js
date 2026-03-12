/**
 * config/email.js
 * Nodemailer SMTP transporter configuration.
 *
 * GDPR NOTE:
 *  - We do NOT embed tracking pixels.
 *  - We do NOT log email body content in audit logs (only metadata).
 *  - Recipient addresses are stored only to fulfill the document request workflow.
 */
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * sendEmail — wraps transporter.sendMail with basic validation.
 * @param {Object} options - { to, subject, text, html }
 * @returns {Promise<Object>} nodemailer info object
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to || !subject) throw new Error('Email recipient and subject are required');

  const info = await transporter.sendMail({
    from:    process.env.SMTP_FROM || '"CGI Tool" <noreply@example.com>',
    to,
    subject,
    text,   // plain-text fallback (accessibility + GDPR friendly)
    html,   // NO tracking pixel — clean HTML only
  });

  return info;
}

module.exports = { sendEmail };