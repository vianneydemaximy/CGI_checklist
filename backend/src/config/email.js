/**
 * config/email.js
 * Nodemailer SMTP transporter avec support Gmail et Outlook.
 *
 * ─────────────────────────────────────────────────────────────
 * CHOISIR SON FOURNISSEUR — variable SMTP_PROVIDER dans .env :
 *
 *   gmail             → smtp.gmail.com:587
 *                       Nécessite un "App Password" Google
 *                       (compte Google > Sécurité > Mots de passe d'application)
 *                       NE PAS utiliser le mot de passe Gmail normal.
 *
 *   outlook_personal  → smtp-mail.outlook.com:587
 *                       Compte Outlook/Hotmail personnel
 *
 *   outlook_365       → smtp.office365.com:587
 *                       Compte Microsoft 365 professionnel (CGI, client…)
 *                       Si le compte est géré par un admin, il peut nécessiter
 *                       une activation SMTP dans l'interface d'administration M365.
 *
 *   custom            → Utilise SMTP_HOST / SMTP_PORT / SMTP_SECURE du .env
 *                       Pour tout autre serveur (Mailgun, SendGrid, serveur interne…)
 *
 * ─────────────────────────────────────────────────────────────
 * CONSEIL PRODUCTION :
 *   Ne pas utiliser un compte personnel de consultant pour envoyer.
 *   Créer un compte de service dédié (ex: cgi-missions@gmail.com) ou
 *   utiliser un relais SMTP d'entreprise.
 *   Le champ "De :" peut afficher le nom du consultant via SMTP_FROM,
 *   même si l'envoi passe par le compte de service.
 *   Ex: SMTP_FROM="Alice Dupont - CGI <cgi-missions@gmail.com>"
 *
 * GDPR : aucun pixel de tracking dans les emails générés.
 * ─────────────────────────────────────────────────────────────
 */
const nodemailer = require('nodemailer');
require('dotenv').config();

// ── Configuration par fournisseur ────────────────────────────
const PROVIDER_CONFIGS = {
  gmail: {
    host:   'smtp.gmail.com',
    port:   587,
    secure: false,   // STARTTLS
  },
  outlook_personal: {
    host:   'smtp-mail.outlook.com',
    port:   587,
    secure: false,
  },
  outlook_365: {
    host:   'smtp.office365.com',
    port:   587,
    secure: false,
  },
  custom: {
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
  },
};

const provider = process.env.SMTP_PROVIDER || 'gmail';
const smtpConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.custom;

if (!PROVIDER_CONFIGS[provider]) {
  console.warn(`[EMAIL] Unknown SMTP_PROVIDER "${provider}", falling back to "custom".`);
}

const transporter = nodemailer.createTransport({
  ...smtpConfig,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Vérification de la connexion SMTP au démarrage ───────────
// Ce message apparaît dans le terminal backend.
// Si vous voyez "SMTP connection OK", l'envoi d'emails fonctionnera.
transporter.verify()
  .then(() => console.log(`✅ SMTP connection OK (provider: ${provider}, host: ${smtpConfig.host})`))
  .catch(err => {
    console.error(`❌ SMTP connection FAILED (provider: ${provider}):`, err.message);
    console.error('   → Vérifiez SMTP_USER, SMTP_PASS et SMTP_PROVIDER dans .env');
    if (provider === 'gmail') {
      console.error('   → Pour Gmail, utilisez un "App Password" (pas votre mot de passe Gmail).');
      console.error('   → Lien : https://myaccount.google.com/apppasswords');
    }
  });

/**
 * sendEmail — envoie un email via le transporteur configuré.
 * @param {Object} options
 * @param {string} options.to      - Adresse destinataire
 * @param {string} options.subject - Objet de l'email
 * @param {string} options.text    - Corps en texte brut (obligatoire pour accessibilité)
 * @param {string} [options.html]  - Corps HTML optionnel (sans pixel de tracking)
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to)      throw new Error('Recipient email (to) is required');
  if (!subject) throw new Error('Email subject is required');

  const info = await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"CGI Tool" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html: html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
  });

  return info;
}

module.exports = { sendEmail };