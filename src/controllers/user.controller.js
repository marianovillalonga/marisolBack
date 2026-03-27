const userModel = require('../models/user.model');
const { hashPassword } = require('../utils/hash.util');
const { buildMessageResponse } = require('../views/auth.view');
const {
  buildCreateUserResponse,
  buildPasswordUpdatedResponse,
  buildProfileUpdatedResponse,
} = require('../views/user.view');

async function createUser(req, res, next) {
  try {
    const { name, email, password, role = 'vendedor', phone = '', address = '', avatarUrl = '' } =
      req.body;

    if (!name || !email || !password) {
      return res.status(400).json(buildMessageResponse('Name, email y password son obligatorios'));
    }

    const passwordHash = await hashPassword(password);
    const result = await userModel.createUser({
      name,
      email,
      passwordHash,
      roleName: role,
      phone,
      address,
      avatarUrl,
    });

    if (result.error === 'EMAIL_EXISTS') {
      return res.status(409).json(buildMessageResponse('Ya existe un usuario con ese email'));
    }

    if (result.error === 'ROLE_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('El rol indicado no existe'));
    }

    return res.status(201).json(buildCreateUserResponse(result.user));
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, email, phone = '', address = '', avatarUrl = '' } = req.body;

    if (!name || !email) {
      return res.status(400).json(buildMessageResponse('Nombre y email son obligatorios'));
    }

    const result = await userModel.updateProfile({
      userId: req.user.id,
      name,
      email,
      phone,
      address,
      avatarUrl,
    });

    if (result.error === 'EMAIL_EXISTS') {
      return res.status(409).json(buildMessageResponse('Ya existe un usuario con ese email'));
    }

    if (result.error === 'USER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario no encontrado'));
    }

    return res.status(200).json(buildProfileUpdatedResponse(result.user));
  } catch (error) {
    next(error);
  }
}

async function updatePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json(buildMessageResponse('Todos los campos de password son obligatorios'));
    }

    if (newPassword.length < 6) {
      return res.status(400).json(buildMessageResponse('La nueva password debe tener al menos 6 caracteres'));
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json(buildMessageResponse('La confirmacion no coincide con la nueva password'));
    }

    const newPasswordHash = await hashPassword(newPassword);
    const result = await userModel.changePassword({
      userId: req.user.id,
      currentPassword,
      newPasswordHash,
    });

    if (result.error === 'CURRENT_PASSWORD_INVALID') {
      return res.status(400).json(buildMessageResponse('La password actual es incorrecta'));
    }

    if (result.error === 'USER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario no encontrado'));
    }

    return res.status(200).json(buildPasswordUpdatedResponse());
  } catch (error) {
    next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await userModel.listUsers();
    return res.status(200).json({
      ok: true,
      users,
    });
  } catch (error) {
    next(error);
  }
}

async function updateUserByAdmin(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const { name, email, phone = '', address = '', role, active = true } = req.body;

    if (!userId) {
      return res.status(400).json(buildMessageResponse('Usuario invalido'));
    }

    if (!name || !email || !role) {
      return res.status(400).json(buildMessageResponse('Nombre, email y rol son obligatorios'));
    }

    const result = await userModel.updateUserByAdmin({
      userId,
      name,
      email,
      phone,
      address,
      roleName: role,
      active: Boolean(active),
    });

    if (result.error === 'EMAIL_EXISTS') {
      return res.status(409).json(buildMessageResponse('Ya existe un usuario con ese email'));
    }

    if (result.error === 'ROLE_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('El rol indicado no existe'));
    }

    if (result.error === 'USER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario no encontrado'));
    }

    return res.status(200).json({
      ok: true,
      message: 'Usuario actualizado correctamente',
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

async function blockUser(req, res, next) {
  try {
    const userId = Number(req.params.id);

    if (!userId) {
      return res.status(400).json(buildMessageResponse('Usuario invalido'));
    }

    if (req.user.id === userId) {
      return res.status(400).json(buildMessageResponse('No podes bloquear tu propia cuenta'));
    }

    const result = await userModel.setUserActiveStatus({
      userId,
      active: false,
    });

    if (result.error === 'USER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario no encontrado'));
    }

    return res.status(200).json({
      ok: true,
      message: 'Usuario bloqueado correctamente',
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

async function unblockUser(req, res, next) {
  try {
    const userId = Number(req.params.id);

    if (!userId) {
      return res.status(400).json(buildMessageResponse('Usuario invalido'));
    }

    const result = await userModel.setUserActiveStatus({
      userId,
      active: true,
    });

    if (result.error === 'USER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario no encontrado'));
    }

    return res.status(200).json({
      ok: true,
      message: 'Usuario desbloqueado correctamente',
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createUser,
  blockUser,
  listUsers,
  unblockUser,
  updatePassword,
  updateProfile,
  updateUserByAdmin,
};
