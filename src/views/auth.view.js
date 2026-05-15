function buildMessageResponse(message) {
  return {
    ok: false,
    message,
  };
}

function buildLoginSuccessResponse(user) {
  return {
    ok: true,
    message: 'Login correcto',
    user,
  };
}

function buildCurrentUserResponse(user) {
  return {
    ok: true,
    user,
  };
}

function buildLogoutResponse() {
  return {
    ok: true,
    message: 'Sesion cerrada correctamente',
  };
}

module.exports = {
  buildMessageResponse,
  buildLoginSuccessResponse,
  buildCurrentUserResponse,
  buildLogoutResponse,
};
