const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  if (!isBcryptHash(storedHash)) {
    return password === storedHash;
  }

  return bcrypt.compare(password, storedHash);
}

module.exports = {
  hashPassword,
  isBcryptHash,
  verifyPassword,
};
