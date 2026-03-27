function buildHealthResponse() {
  return {
    ok: true,
    message: 'Backend operativo',
  };
}

module.exports = {
  buildHealthResponse,
};
