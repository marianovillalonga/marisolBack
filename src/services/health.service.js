const pool = require('../config/db');
const { validateRuntimeConfig } = require('../config/env');
const { isMailDeliveryAvailable } = require('../utils/mail.util');

async function getDependencyHealth() {
  let configOk = true;
  let databaseOk = false;
  let configError = null;
  let databaseError = null;
  const databaseStartedAt = process.hrtime.bigint();

  try {
    validateRuntimeConfig();
  } catch (error) {
    configOk = false;
    configError = error instanceof Error ? error.message : String(error);
  }

  try {
    await pool.query('SELECT 1');
    databaseOk = true;
  } catch (error) {
    databaseOk = false;
    databaseError = error instanceof Error ? error.message : String(error);
  }

  const mailOk = isMailDeliveryAvailable();
  const ok = configOk && databaseOk;
  const databaseLatencyMs = Number(
    (Number(process.hrtime.bigint() - databaseStartedAt) / 1_000_000).toFixed(2),
  );

  return {
    ok,
    configOk,
    databaseOk,
    mailOk,
    mode: 'readiness',
    configError,
    databaseError,
    databaseLatencyMs,
  };
}

function getLivenessHealth() {
  return {
    ok: true,
    mode: 'liveness',
  };
}

module.exports = {
  getDependencyHealth,
  getLivenessHealth,
};
