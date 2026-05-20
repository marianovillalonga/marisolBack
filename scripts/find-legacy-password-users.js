require('dotenv').config();

const pool = require('../src/config/db');

async function main() {
  const { rows } = await pool.query(`
    SELECT id, nombre, email, activo, fecha_actualizacion
    FROM usuarios
    WHERE password IS NOT NULL
      AND password <> ''
      AND password !~ '^\\$2[aby]\\$[0-9]{2}\\$'
    ORDER BY activo DESC, id ASC
  `);

  const summary = {
    totalLegacyUsers: rows.length,
    users: rows,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
