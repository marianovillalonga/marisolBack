const pool = require('../config/db');
const { validateRuntimeConfig } = require('../config/env');
const { isMailDeliveryAvailable } = require('../utils/mail.util');

async function getDependencyHealth() {
  let configOk = true;
  let databaseOk = false;

  try {
    validateRuntimeConfig();
  } catch (_error) {
    configOk = false;
  }

  try {
    await pool.query('SELECT 1');
    databaseOk = true;
  } catch (_error) {
    databaseOk = false;
  }

  const mailOk = isMailDeliveryAvailable();
  const ok = configOk && databaseOk;

  return {
    ok,
    configOk,
    databaseOk,
    mailOk,
  };
}

module.exports = {
  getDependencyHealth,
};
