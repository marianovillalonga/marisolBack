const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

function isLegacyPasswordHash(value) {
  return typeof value === 'string' && value.length > 0 && !isBcryptHash(value);
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || !isBcryptHash(storedHash)) {
    return false;
  }

  return bcrypt.compare(password, storedHash);
}

module.exports = {
  hashPassword,
  isBcryptHash,
  isLegacyPasswordHash,
  verifyPassword,
};
