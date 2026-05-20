const test = require('node:test');
const assert = require('node:assert/strict');

function loadMailModule() {
  delete require.cache[require.resolve('../config/env')];
  delete require.cache[require.resolve('./mail.util')];
  return require('./mail.util');
}

function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, snapshot);
}

test('sendPasswordResetEmail falla en produccion si no hay proveedor configurado', async () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = '';
  process.env.MAIL_FROM = '';

  const { MailDeliveryError, sendPasswordResetEmail } = loadMailModule();

  await assert.rejects(
    () =>
      sendPasswordResetEmail({
        to: 'test@example.com',
        resetUrl: 'https://app.example.com/reset-password?token=abc',
        expiresAt: new Date('2026-05-20T12:00:00.000Z'),
        requestId: 'test-request',
      }),
    (error) =>
      error instanceof MailDeliveryError && error.code === 'MAIL_DELIVERY_NOT_CONFIGURED',
  );

  restoreEnv(snapshot);
});

test('sendPasswordResetEmail permite preview local fuera de produccion', async () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'development';
  process.env.RESEND_API_KEY = '';
  process.env.MAIL_FROM = '';

  const { sendPasswordResetEmail } = loadMailModule();
  const result = await sendPasswordResetEmail({
    to: 'test@example.com',
    resetUrl: 'https://app.example.com/reset-password?token=abc',
    expiresAt: new Date('2026-05-20T12:00:00.000Z'),
    requestId: 'test-request',
  });

  assert.equal(result.deliveryMode, 'file');
  assert.equal(typeof result.previewFileName, 'string');

  restoreEnv(snapshot);
});
