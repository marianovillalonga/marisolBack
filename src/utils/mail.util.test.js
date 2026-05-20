const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;

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

test.afterEach(() => {
  Module._load = originalLoad;
});

test('sendPasswordResetEmail usa SMTP con nodemailer cuando hay configuracion SMTP', async () => {
  const snapshot = { ...process.env };
  let capturedPayload = null;

  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = '';
  process.env.MAIL_FROM = 'Sistema <no-reply@example.com>';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_FAMILY = '4';
  process.env.SMTP_USER = 'smtp-user';
  process.env.SMTP_PASS = 'smtp-pass';
  process.env.SMTP_CONNECTION_TIMEOUT_MS = '1234';
  process.env.SMTP_GREETING_TIMEOUT_MS = '2345';
  process.env.SMTP_SOCKET_TIMEOUT_MS = '3456';

  Module._load = function mockModuleLoader(request, parent, isMain) {
    if (request === 'nodemailer') {
      return {
        createTransport(config) {
          assert.equal(config.host, 'smtp.example.com');
          assert.equal(config.port, 587);
          assert.equal(config.secure, false);
          assert.equal(config.family, 4);
          assert.equal(typeof config.lookup, 'function');
          assert.deepEqual(config.auth, {
            user: 'smtp-user',
            pass: 'smtp-pass',
          });
          assert.equal(config.connectionTimeout, 1234);
          assert.equal(config.greetingTimeout, 2345);
          assert.equal(config.socketTimeout, 3456);

          return {
            async sendMail(payload) {
              capturedPayload = payload;
              return {
                messageId: 'smtp-message-id',
              };
            },
          };
        },
      };
    }

    return originalLoad(request, parent, isMain);
  };

  const { sendPasswordResetEmail } = loadMailModule();
  const result = await sendPasswordResetEmail({
    to: 'test@example.com',
    resetUrl: 'https://app.example.com/reset-password?token=abc',
    expiresAt: new Date('2026-05-20T12:00:00.000Z'),
    requestId: 'test-request',
  });

  assert.equal(result.deliveryMode, 'smtp');
  assert.equal(result.messageId, 'smtp-message-id');
  assert.equal(capturedPayload.to, 'test@example.com');
  assert.match(capturedPayload.text, /restablecer tu contrasena/i);

  restoreEnv(snapshot);
});

test('sendPasswordResetEmail prioriza Resend sobre SMTP si ambos estan configurados', async () => {
  const snapshot = { ...process.env };
  let smtpUsed = false;

  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.MAIL_FROM = 'Sistema <no-reply@example.com>';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_FAMILY = '4';
  process.env.SMTP_USER = 'smtp-user';
  process.env.SMTP_PASS = 'smtp-pass';

  Module._load = function mockModuleLoader(request, parent, isMain) {
    if (request === 'nodemailer') {
      return {
        createTransport() {
          smtpUsed = true;
          return {
            async sendMail() {
              return { messageId: 'smtp-message-id' };
            },
          };
        },
      };
    }

    if (request === 'resend') {
      return {
        Resend: class MockResend {
          constructor(apiKey) {
            assert.equal(apiKey, 're_test_key');
          }

          get emails() {
            return {
              send: async (payload) => {
                assert.equal(payload.to, 'test@example.com');
                return {
                  data: {
                    id: 're_email_id',
                  },
                };
              },
            };
          }
        },
      };
    }

    return originalLoad(request, parent, isMain);
  };

  const { sendPasswordResetEmail } = loadMailModule();
  const result = await sendPasswordResetEmail({
    to: 'test@example.com',
    resetUrl: 'https://app.example.com/reset-password?token=abc',
    expiresAt: new Date('2026-05-20T12:00:00.000Z'),
    requestId: 'test-request',
  });

  assert.equal(result.deliveryMode, 'resend');
  assert.equal(result.emailId, 're_email_id');
  assert.equal(smtpUsed, false);

  restoreEnv(snapshot);
});

test('sendPasswordResetEmail falla en produccion si no hay proveedor configurado', async () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = '';
  process.env.MAIL_FROM = '';
  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';
  process.env.SMTP_SECURE = '';
  process.env.SMTP_FAMILY = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';
  process.env.SMTP_CONNECTION_TIMEOUT_MS = '';
  process.env.SMTP_GREETING_TIMEOUT_MS = '';
  process.env.SMTP_SOCKET_TIMEOUT_MS = '';

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
  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';
  process.env.SMTP_SECURE = '';
  process.env.SMTP_FAMILY = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';
  process.env.SMTP_CONNECTION_TIMEOUT_MS = '';
  process.env.SMTP_GREETING_TIMEOUT_MS = '';
  process.env.SMTP_SOCKET_TIMEOUT_MS = '';

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
