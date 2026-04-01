const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { AUTH_SECRET, AUTH_TOKEN_TTL } = require('../config/env');

function createAuthToken(payload) {
  return jwt.sign(payload, AUTH_SECRET, {
    expiresIn: AUTH_TOKEN_TTL,
    issuer: 'marisol-back',
    jwtid: crypto.randomUUID(),
  });
}

function verifyAuthToken(token) {
  return jwt.verify(token, AUTH_SECRET, {
    issuer: 'marisol-back',
  });
}

module.exports = {
  createAuthToken,
  verifyAuthToken,
};
