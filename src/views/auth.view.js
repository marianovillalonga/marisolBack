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

function buildPasswordResetRequestedResponse() {
  return {
    ok: true,
    message: 'Si el email existe, enviaremos instrucciones para restablecer el acceso.',
  };
}

function buildPasswordResetTokenValidResponse() {
  return {
    ok: true,
    message: 'Token valido',
  };
}

function buildPasswordResetSuccessResponse() {
  return {
    ok: true,
    message: 'Password actualizada correctamente. Inicia sesion nuevamente.',
  };
}

module.exports = {
  buildMessageResponse,
  buildLoginSuccessResponse,
  buildCurrentUserResponse,
  buildLogoutResponse,
  buildPasswordResetRequestedResponse,
  buildPasswordResetSuccessResponse,
  buildPasswordResetTokenValidResponse,
};
