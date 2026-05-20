const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const {
  MAIL_FROM,
  RESEND_API_KEY,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
} = require('../config/env');
const logger = require('./logger.util');

const previewDirectory = path.resolve(__dirname, '../../tmp/mail');
const isProduction = process.env.NODE_ENV === 'production';

class MailDeliveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MailDeliveryError';
    this.code = code;
  }
}

function ensurePreviewDirectory() {
  fs.mkdirSync(previewDirectory, { recursive: true });
}

function hasSmtpConfig() {
  return [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS].every((value) => String(value || '').trim());
}

function buildPasswordResetMail({ resetUrl, expiresAt, to }) {
  const formattedExpiry = new Date(expiresAt).toLocaleString('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return {
    to,
    from: MAIL_FROM || 'Sistema <no-reply@marisol.local>',
    subject: 'Restablecer contrasena',
    text: [
      'Recibimos una solicitud para restablecer tu contrasena.',
      '',
      'Abre este enlace para continuar:',
      resetUrl,
      '',
      `El enlace vence el ${formattedExpiry}.`,
      'Si no solicitaste este cambio, ignora este correo.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
        <h2 style="margin:0 0 16px">Restablecer contrasena</h2>
        <p>Recibimos una solicitud para restablecer tu contrasena.</p>
        <p style="margin:24px 0">
          <a
            href="${resetUrl}"
            style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600"
          >
            Cambiar contrasena
          </a>
        </p>
        <p>Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>El enlace vence el ${formattedExpiry}.</p>
        <p>Si no solicitaste este cambio, ignora este correo.</p>
      </div>
    `,
  };
}

function isMailDeliveryAvailable() {
  return Boolean(RESEND_API_KEY) || hasSmtpConfig() || !isProduction;
}

async function sendPasswordResetEmail({ to, resetUrl, expiresAt, requestId = null }) {
  const emailPayload = buildPasswordResetMail({ to, resetUrl, expiresAt });

  if (hasSmtpConfig()) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      const result = await transporter.sendMail(emailPayload);

      logger.info('password_reset_email_sent', {
        requestId,
        provider: 'smtp',
        messageId: result.messageId || null,
      });

      return {
        deliveryMode: 'smtp',
        messageId: result.messageId || null,
      };
    } catch (error) {
      throw new MailDeliveryError(
        'MAIL_DELIVERY_FAILED',
        error instanceof Error ? error.message : 'No se pudo enviar el email de recuperacion por SMTP.',
      );
    }
  }

  if (RESEND_API_KEY) {
    try {
      const resend = new Resend(RESEND_API_KEY);
      const result = await resend.emails.send(emailPayload);

      logger.info('password_reset_email_sent', {
        requestId,
        provider: 'resend',
        emailId: result.data?.id || null,
      });

      return {
        deliveryMode: 'resend',
        emailId: result.data?.id || null,
      };
    } catch (error) {
      throw new MailDeliveryError(
        'MAIL_DELIVERY_FAILED',
        error instanceof Error ? error.message : 'No se pudo enviar el email de recuperacion.',
      );
    }
  }

  if (isProduction) {
    throw new MailDeliveryError(
      'MAIL_DELIVERY_NOT_CONFIGURED',
      'La recuperacion de password no esta disponible porque falta configurar el proveedor de email.',
    );
  }

  ensurePreviewDirectory();
  const previewFileName = `${Date.now()}-${crypto.randomUUID()}.json`;
  const previewPath = path.join(previewDirectory, previewFileName);
  fs.writeFileSync(
    previewPath,
    JSON.stringify(
      {
        ...emailPayload,
        resetUrl,
        expiresAt: new Date(expiresAt).toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );

  logger.info('password_reset_email_preview_saved', {
    requestId,
    provider: 'file',
    previewFileName,
  });

  return {
    deliveryMode: 'file',
    previewFileName,
  };
}

module.exports = {
  MailDeliveryError,
  buildPasswordResetMail,
  hasSmtpConfig,
  isMailDeliveryAvailable,
  sendPasswordResetEmail,
};
