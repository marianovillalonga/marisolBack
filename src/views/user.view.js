function buildCreateUserResponse(user) {
  return {
    ok: true,
    message: 'Usuario creado correctamente',
    user,
  };
}

function buildProfileUpdatedResponse(user) {
  return {
    ok: true,
    message: 'Perfil actualizado correctamente',
    user,
  };
}

function buildPasswordUpdatedResponse() {
  return {
    ok: true,
    message: 'Password actualizada correctamente',
  };
}

module.exports = {
  buildCreateUserResponse,
  buildPasswordUpdatedResponse,
  buildProfileUpdatedResponse,
};
