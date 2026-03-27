require('dotenv').config();

const pool = require('../src/config/db');
const { hashPassword, isBcryptHash } = require('../src/utils/hash.util');

async function main() {
  const { rows: users } = await pool.query('SELECT id, email, password FROM usuarios');
  let migrated = 0;

  for (const user of users) {
    if (!user.password || isBcryptHash(user.password)) {
      continue;
    }

    const passwordHash = await hashPassword(user.password);

    await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [passwordHash, user.id]);
    migrated += 1;
  }

  console.log(`Contraseñas migradas a bcrypt: ${migrated}`);
}

main()
  .catch((error) => {
    console.error('Error migrando contraseñas:', error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
