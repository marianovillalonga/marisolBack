const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Resend } = require('resend');

const { MAIL_FROM, RESEND_API_KEY } = require('../config/env');
const logger = require('../utils/logger.util');

const DEFAULT_MAIL_FROM = 'noreply@mariovillalonga.website';
const DEFAULT_MAIL_FROM_DOMAIN = 'mariovillalonga.website';
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

function extractEmailAddress(value) {
  const normalizedValue = String(value || '').trim();
  const match = normalizedValue.match(/<([^>]+)>/);
  return (match ? match[1] : normalizedValue).trim().toLowerCase();
}

function getMailFrom() {
  const configuredFrom = String(MAIL_FROM || '').trim();

  if (!configuredFrom) {
    return DEFAULT_MAIL_FROM;
  }

  const extractedAddress = extractEmailAddress(configuredFrom);

  if (extractedAddress && extractedAddress.endsWith(`@${DEFAULT_MAIL_FROM_DOMAIN}`)) {
    return configuredFrom;
  }

  logger.warn('mail_from_not_verified_domain', {
    configuredFrom,
    fallbackFrom: DEFAULT_MAIL_FROM,
  });

  return DEFAULT_MAIL_FROM;
}

function hasResendConfig() {
  return Boolean(String(RESEND_API_KEY || '').trim());
}

function isMailDeliveryAvailable() {
  return hasResendConfig() || !isProduction;
}

function assertEmailPayload({ to, subject, html, text }) {
  if (!String(to || '').trim()) {
    throw new MailDeliveryError('MAIL_INVALID_PAYLOAD', 'El destinatario del email es obligatorio.');
  }

  if (!String(subject || '').trim()) {
    throw new MailDeliveryError('MAIL_INVALID_PAYLOAD', 'El asunto del email es obligatorio.');
  }

  if (!String(html || '').trim() && !String(text || '').trim()) {
    throw new MailDeliveryError(
      'MAIL_INVALID_PAYLOAD',
      'Debes enviar contenido html o text para el email.',
    );
  }
}

function buildPasswordResetEmail({ email, resetUrl }) {
  return {
    to: email,
    subject: 'Recuperar contrase\u00f1a',
    text: [
      'Recibimos una solicitud para recuperar tu contrase\u00f1a.',
      '',
      'Abri este enlace para continuar:',
      resetUrl,
      '',
      'Si no solicitaste este cambio, ignora este correo.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
        <h2 style="margin:0 0 16px">Recuperar contrase\u00f1a</h2>
        <p>Recibimos una solicitud para recuperar tu contrase\u00f1a.</p>
        <p style="margin:24px 0">
          <a
            href="${resetUrl}"
            style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600"
          >
            Restablecer contrase\u00f1a
          </a>
        </p>
        <p>Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Si no solicitaste este cambio, ignora este correo.</p>
      </div>
    `,
  };
}

async function sendEmail({ to, subject, html, text, from = getMailFrom(), requestId = null }) {
  assertEmailPayload({ to, subject, html, text });

  const payload = {
    from,
    to,
    subject,
    html: String(html || '').trim() || undefined,
    text: String(text || '').trim() || undefined,
  };

  if (!hasResendConfig()) {
    if (isProduction) {
      logger.error('email_delivery_not_configured', {
        requestId,
        to,
        subject,
      });
      throw new MailDeliveryError(
        'MAIL_DELIVERY_NOT_CONFIGURED',
        'El envio de emails no esta disponible porque falta RESEND_API_KEY.',
      );
    }

    ensurePreviewDirectory();
    const previewFileName = `${Date.now()}-${crypto.randomUUID()}.json`;
    const previewPath = path.join(previewDirectory, previewFileName);
    fs.writeFileSync(previewPath, JSON.stringify(payload, null, 2), 'utf8');

    logger.info('email_preview_saved', {
      requestId,
      provider: 'file',
      previewFileName,
      to,
      subject,
    });

    return {
      deliveryMode: 'file',
      previewFileName,
    };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const result = await resend.emails.send(payload);
    const resendError = result?.error || null;
    const emailId = result?.data?.id || null;

    if (resendError || !emailId) {
      const errorMessage =
        resendError?.message ||
        resendError?.name ||
        'Resend no confirmo el envio del email.';

      logger.error('email_delivery_failed', {
        requestId,
        provider: 'resend',
        to,
        subject,
        from,
        resendError: resendError || 'missing_email_id',
      });

      throw new MailDeliveryError('MAIL_DELIVERY_FAILED', errorMessage);
    }

    logger.info('email_sent', {
      requestId,
      provider: 'resend',
      emailId,
      to,
      subject,
      from,
    });

    return {
      deliveryMode: 'resend',
      emailId,
    };
  } catch (error) {
    logger.error('email_delivery_failed', {
      requestId,
      provider: 'resend',
      to,
      subject,
      from,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new MailDeliveryError(
      'MAIL_DELIVERY_FAILED',
      error instanceof Error ? error.message : 'No se pudo enviar el email.',
    );
  }
}

async function sendPasswordResetEmail(email, resetUrl, options = {}) {
  const passwordResetEmail = buildPasswordResetEmail({ email, resetUrl });
  return sendEmail({
    ...passwordResetEmail,
    ...options,
  });
}

module.exports = {
  DEFAULT_MAIL_FROM,
  MailDeliveryError,
  buildPasswordResetEmail,
  getMailFrom,
  hasResendConfig,
  isMailDeliveryAvailable,
  sendEmail,
  sendPasswordResetEmail,
};
