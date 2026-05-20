function buildHealthResponse({
  ok,
  mode = 'readiness',
  configOk,
  databaseOk,
  mailOk,
  configError = null,
  databaseError = null,
  databaseLatencyMs = null,
  requestId = null,
}) {
  return {
    ok,
    mode,
    message:
      mode === 'liveness'
        ? 'Backend vivo'
        : ok
          ? 'Backend operativo'
          : 'Backend degradado',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    requestId,
    checks: {
      config:
        mode === 'liveness'
          ? 'skipped'
          : {
              status: configOk ? 'ok' : 'error',
              error: configError,
            },
      database:
        mode === 'liveness'
          ? 'skipped'
          : {
              status: databaseOk ? 'ok' : 'error',
              latencyMs: databaseLatencyMs,
              error: databaseError,
            },
      mail: mailOk ? 'ok' : 'warning',
    },
  };
}

module.exports = {
  buildHealthResponse,
};
