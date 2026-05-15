const { buildPaginationMeta } = require('./pagination.view');

function buildClientsResponse(clients, pagination) {
  return {
    ok: true,
    clients,
    pagination: buildPaginationMeta(pagination),
  };
}

function buildClientResponse(client, message) {
  return {
    ok: true,
    message,
    client,
  };
}

function buildClientMessageResponse(message) {
  return {
    ok: true,
    message,
  };
}

module.exports = {
  buildClientsResponse,
  buildClientResponse,
  buildClientMessageResponse,
};
