function buildHealthResponse({ ok, configOk, databaseOk, mailOk }) {
  return {
    ok,
    message: ok ? 'Backend operativo' : 'Backend degradado',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      config: configOk ? 'ok' : 'error',
      database: databaseOk ? 'ok' : 'error',
      mail: mailOk ? 'ok' : 'warning',
    },
  };
}

module.exports = {
  buildHealthResponse,
};
