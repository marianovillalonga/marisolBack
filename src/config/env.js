require('dotenv').config();

const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const AUTH_SECRET = process.env.AUTH_SECRET || 'desarrollo-local';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@marisol.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';

module.exports = {
  PORT,
  FRONTEND_URL,
  AUTH_SECRET,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME,
};
