const test = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword, isBcryptHash, isLegacyPasswordHash, verifyPassword } = require('./hash.util');

test('hashPassword genera un hash bcrypt', async () => {
  const hash = await hashPassword('secreto123');

  assert.equal(isBcryptHash(hash), true);
  assert.notEqual(hash, 'secreto123');
});

test('verifyPassword valida hashes bcrypt', async () => {
  const hash = await hashPassword('secreto123');

  assert.equal(await verifyPassword('secreto123', hash), true);
  assert.equal(await verifyPassword('otro', hash), false);
});

test('verifyPassword rechaza passwords legacy que no usan bcrypt', async () => {
  assert.equal(isLegacyPasswordHash('legacy'), true);
  assert.equal(await verifyPassword('legacy', 'legacy'), false);
  assert.equal(await verifyPassword('otra', 'legacy'), false);
});
