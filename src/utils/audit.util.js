const auditModel = require('../models/audit.model');
const logger = require('./logger.util');

async function registerAudit(req, { action, entity, entityId = null, details = {} }) {
  try {
    await auditModel.logAction({
      userId: req.user?.id || null,
      action,
      entity,
      entityId,
      details,
      ip: req.ip,
      requestId: req.requestId || null,
    });
  } catch (error) {
    logger.error('audit_log_failed', {
      requestId: req.requestId || null,
      action,
      entity,
      entityId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

module.exports = {
  registerAudit,
};
