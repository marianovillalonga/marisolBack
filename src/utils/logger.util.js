const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const logsDirectory = path.resolve(__dirname, '../../logs');
const appLogPath = path.join(logsDirectory, 'app.log');
const errorLogPath = path.join(logsDirectory, 'error.log');

function ensureLogsDirectory() {
  fs.mkdirSync(logsDirectory, { recursive: true });
}

function writeLog(filePath, payload) {
  ensureLogsDirectory();
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
}

function buildBaseLog(level, message, meta = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
}

function info(message, meta = {}) {
  const payload = buildBaseLog('info', message, meta);
  writeLog(appLogPath, payload);
  console.log(JSON.stringify(payload));
}

function error(message, meta = {}) {
  const payload = buildBaseLog('error', message, meta);
  writeLog(errorLogPath, payload);
  console.error(JSON.stringify(payload));
}

function createRequestLogger() {
  return (req, res, next) => {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    req.requestId = requestId;

    res.on('finish', () => {
      info('http_request', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        ip: req.ip,
        userId: req.user?.id || null,
      });
    });

    next();
  };
}

module.exports = {
  createRequestLogger,
  error,
  info,
};
