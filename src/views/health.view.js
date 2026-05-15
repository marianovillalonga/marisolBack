function buildHealthResponse() {
  return {
    ok: true,
    message: 'Backend operativo',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  };
}

module.exports = {
  buildHealthResponse,
};
