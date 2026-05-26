const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
const PASSWORD_RESET_SUBJECT = 'Recuperar contrase\u00f1a';
const PASSWORD_RESET_CTA = 'Restablecer contrase\u00f1a';
const PASSWORD_RESET_COPY = /recuperar tu contrase\u00f1a/i;

function loadMailModule() {
  delete require.cache[require.resolve('../config/env')];
  delete require.cache[require.resolve('../services/email.service')];
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

test('sendEmail usa Resend cuando RESEND_API_KEY esta configurada', async () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.MAIL_FROM = 'noreply@mariovillalonga.website';

  Module._load = function mockModuleLoader(request, parent, isMain) {
    if (request === 'resend') {
      return {
        Resend: class MockResend {
          constructor(apiKey) {
            assert.equal(apiKey, 're_test_key');
          }

          get emails() {
            return {
              send: async (payload) => {
                assert.equal(payload.from, 'noreply@mariovillalonga.website');
                assert.equal(payload.to, 'test@example.com');
                assert.equal(payload.subject, 'Asunto');
                assert.equal(payload.html, '<p>Hola</p>');
                assert.equal(payload.text, 'Hola');
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

  const { sendEmail } = loadMailModule();
  const result = await sendEmail({
    to: 'test@example.com',
    subject: 'Asunto',
    html: '<p>Hola</p>',
    text: 'Hola',
    requestId: 'test-request',
  });

  assert.equal(result.deliveryMode, 'resend');
  assert.equal(result.emailId, 're_email_id');

  restoreEnv(snapshot);
});

test('sendPasswordResetEmail arma el email esperado con Resend', async () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.MAIL_FROM = 'noreply@mariovillalonga.website';

  Module._load = function mockModuleLoader(request, parent, isMain) {
    if (request === 'resend') {
      return {
        Resend: class MockResend {
          get emails() {
            return {
              send: async (payload) => {
                assert.equal(payload.to, 'test@example.com');
                assert.equal(payload.subject, PASSWORD_RESET_SUBJECT);
                assert.match(payload.html, /https:\/\/app\.example\.com\/reset-password\?token=abc/);
                assert.match(payload.html, new RegExp(PASSWORD_RESET_CTA));
                assert.match(payload.text, PASSWORD_RESET_COPY);
                return {
                  data: {
                    id: 'reset_email_id',
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
  const result = await sendPasswordResetEmail(
    'test@example.com',
    'https://app.example.com/reset-password?token=abc',
    {
      requestId: 'test-request',
    },
  );

  assert.equal(result.deliveryMode, 'resend');
  assert.equal(result.emailId, 'reset_email_id');

  restoreEnv(snapshot);
});

test('sendEmail falla en produccion si falta RESEND_API_KEY', async () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = '';
  process.env.MAIL_FROM = 'noreply@mariovillalonga.website';

  const { MailDeliveryError, sendEmail } = loadMailModule();

  await assert.rejects(
    () =>
      sendEmail({
        to: 'test@example.com',
        subject: 'Asunto',
        text: 'Hola',
      }),
    (error) =>
      error instanceof MailDeliveryError && error.code === 'MAIL_DELIVERY_NOT_CONFIGURED',
  );

  restoreEnv(snapshot);
});

test('sendEmail permite preview local fuera de produccion', async () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'development';
  process.env.RESEND_API_KEY = '';
  process.env.MAIL_FROM = 'noreply@mariovillalonga.website';

  const { sendEmail } = loadMailModule();
  const result = await sendEmail({
    to: 'test@example.com',
    subject: 'Asunto',
    text: 'Hola',
  });

  assert.equal(result.deliveryMode, 'file');
  assert.equal(typeof result.previewFileName, 'string');

  restoreEnv(snapshot);
});
