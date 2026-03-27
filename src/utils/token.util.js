const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { AUTH_SECRET } = require('../config/env');

function createAuthToken(payload) {
  return jwt.sign(payload, AUTH_SECRET, {
    expiresIn: '8h',
    jwtid: crypto.randomUUID(),
  });
}

function verifyAuthToken(token) {
  return jwt.verify(token, AUTH_SECRET);
}

module.exports = {
  createAuthToken,
  verifyAuthToken,
};
