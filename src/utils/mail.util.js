const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MAIL_DELIVERY_MODE, MAIL_FROM } = require('../config/env');
const logger = require('./logger.util');

const previewDirectory = path.resolve(__dirname, '../../tmp/mail');

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

function buildPasswordResetMail({ resetUrl, expiresAt, to }) {
  return {
    to,
    from: MAIL_FROM || 'no-reply@marisol.local',
    subject: 'Recuperacion de acceso',
    text: [
      'Recibimos una solicitud para restablecer tu password.',
      '',
      `Abre este enlace para continuar: ${resetUrl}`,
      '',
      `El enlace vence el ${new Date(expiresAt).toISOString()}.`,
      'Si no solicitaste este cambio, puedes ignorar este mensaje.',
    ].join('\n'),
  };
}

function isMailDeliveryAvailable() {
  return MAIL_DELIVERY_MODE !== 'disabled';
}

async function sendPasswordResetEmail({ to, resetUrl, expiresAt, requestId = null }) {
  const emailPayload = buildPasswordResetMail({ to, resetUrl, expiresAt });

  if (MAIL_DELIVERY_MODE === 'disabled') {
    throw new MailDeliveryError(
      'MAIL_NOT_CONFIGURED',
      'La recuperacion de password no esta disponible temporalmente.',
    );
  }

  if (MAIL_DELIVERY_MODE === 'file') {
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
      deliveryMode: MAIL_DELIVERY_MODE,
      previewFileName,
    });

    return {
      deliveryMode: MAIL_DELIVERY_MODE,
      previewFileName,
    };
  }

  throw new MailDeliveryError(
    'MAIL_NOT_SUPPORTED',
    `MAIL_DELIVERY_MODE invalido: ${MAIL_DELIVERY_MODE}`,
  );
}

module.exports = {
  MailDeliveryError,
  isMailDeliveryAvailable,
  sendPasswordResetEmail,
};
