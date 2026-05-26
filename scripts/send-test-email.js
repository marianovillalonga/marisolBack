require('dotenv').config();

const { validateRuntimeConfig } = require('../src/config/env');
const { sendEmail } = require('../src/services/email.service');

async function main() {
  validateRuntimeConfig();

  const to = String(process.argv[2] || process.env.TEST_EMAIL_TO || '').trim();

  if (!to) {
    throw new Error('Debes indicar el destinatario: npm run email:test -- correo@destino.com');
  }

  const result = await sendEmail({
    to,
    subject: 'Email de prueba',
    text: 'Este es un email de prueba enviado con Resend.',
    html: `
      <div style="font-family:Arial,sans-serif">
        <h2>Email de prueba</h2>
        <p>Este es un email de prueba enviado con Resend.</p>
      </div>
    `,
    requestId: 'email-test-script',
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
        to,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
