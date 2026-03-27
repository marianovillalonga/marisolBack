function buildClientsResponse(clients) {
  return {
    ok: true,
    clients,
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
