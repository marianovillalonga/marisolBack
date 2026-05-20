const userModel = require('../models/user.model');
const sessionModel = require('../models/session.model');
const validationRules = require('../config/validation-rules');
const { hashPassword } = require('../utils/hash.util');
const { normalizeImageUrl } = require('../utils/image.util');
const { clearAuthCookie } = require('../utils/cookie.util');
const { registerAudit } = require('../utils/audit.util');
const { buildMessageResponse } = require('../views/auth.view');
const { isNonEmptyString, isPositiveInteger, isValidEmail } = require('../utils/validation.util');
const {
  buildCreateUserResponse,
  buildPasswordUpdatedResponse,
  buildProfileUpdatedResponse,
} = require('../views/user.view');

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= validationRules.auth.passwordMinLength;
}

async function createUser(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      role = 'vendedor',
      phone = '',
      address = '',
      avatarUrl = '',
      paymentMethodSettings = {},
    } =
      req.body;

    if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json(buildMessageResponse('Name, email y password son obligatorios'));
    }

    if (!isValidEmail(email)) {
      return res.status(400).json(buildMessageResponse('El email no es valido'));
    }

    if (!isValidPassword(password)) {
      return res
        .status(400)
        .json(
          buildMessageResponse(
            `La password debe tener al menos ${validationRules.auth.passwordMinLength} caracteres`,
          ),
        );
    }

    const normalizedAvatar = await normalizeImageUrl(String(avatarUrl || '').trim());

    if (normalizedAvatar.error) {
      return res.status(400).json(buildMessageResponse(normalizedAvatar.error));
    }

    const passwordHash = await hashPassword(password);
    const result = await userModel.createUser({
      name: name.trim(),
      email: email.trim(),
      passwordHash,
      roleName: role,
      phone: String(phone || '').trim(),
      address: String(address || '').trim(),
      avatarUrl: normalizedAvatar.imageUrl,
      paymentMethodSettings,
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
    const { name, email, phone = '', address = '', avatarUrl = '', paymentMethodSettings = {} } = req.body;

    if (!isNonEmptyString(name) || !isNonEmptyString(email)) {
      return res.status(400).json(buildMessageResponse('Nombre y email son obligatorios'));
    }

    if (!isValidEmail(email)) {
      return res.status(400).json(buildMessageResponse('El email no es valido'));
    }

    const normalizedAvatar = await normalizeImageUrl(String(avatarUrl || '').trim());

    if (normalizedAvatar.error) {
      return res.status(400).json(buildMessageResponse(normalizedAvatar.error));
    }

    const result = await userModel.updateProfile({
      userId: req.user.id,
      name: name.trim(),
      email: email.trim(),
      phone: String(phone || '').trim(),
      address: String(address || '').trim(),
      avatarUrl: normalizedAvatar.imageUrl,
      paymentMethodSettings,
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

    if (!isValidPassword(newPassword)) {
      return res
        .status(400)
        .json(
          buildMessageResponse(
            `La nueva password debe tener al menos ${validationRules.auth.passwordMinLength} caracteres`,
          ),
        );
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

    if (req.tokenPayload?.jti && req.tokenPayload?.exp) {
      await sessionModel.revokeToken({
        jti: req.tokenPayload.jti,
        userId: req.user.id,
        expiresAt: new Date(req.tokenPayload.exp * 1000),
      });
    }

    clearAuthCookie(res);
    await registerAudit(req, {
      action: 'password_changed',
      entity: 'auth',
      entityId: req.user.id,
      details: {
        email: req.user.email,
      },
    });

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

    if (!isPositiveInteger(userId)) {
      return res.status(400).json(buildMessageResponse('Usuario invalido'));
    }

    if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(role)) {
      return res.status(400).json(buildMessageResponse('Nombre, email y rol son obligatorios'));
    }

    if (!isValidEmail(email)) {
      return res.status(400).json(buildMessageResponse('El email no es valido'));
    }

    const result = await userModel.updateUserByAdmin({
      userId,
      name: name.trim(),
      email: email.trim(),
      phone: String(phone || '').trim(),
      address: String(address || '').trim(),
      roleName: role.trim(),
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

    if (!isPositiveInteger(userId)) {
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

    if (!isPositiveInteger(userId)) {
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
