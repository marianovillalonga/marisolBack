const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const logsDirectory = path.resolve(__dirname, '../../logs');
const appLogPath = path.join(logsDirectory, 'app.log');
const errorLogPath = path.join(logsDirectory, 'error.log');
let appLogStream = null;
let errorLogStream = null;
const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const configuredLogLevel = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const activeLogLevel = LOG_LEVELS[configuredLogLevel] || LOG_LEVELS.info;

function ensureLogsDirectory() {
  fs.mkdirSync(logsDirectory, { recursive: true });
}

function getLogStream(filePath) {
  ensureLogsDirectory();

  if (filePath === appLogPath) {
    appLogStream ||= fs.createWriteStream(appLogPath, { flags: 'a', encoding: 'utf8' });
    return appLogStream;
  }

  errorLogStream ||= fs.createWriteStream(errorLogPath, { flags: 'a', encoding: 'utf8' });
  return errorLogStream;
}

function writeLog(filePath, payload) {
  getLogStream(filePath).write(`${JSON.stringify(payload)}\n`);
}

function buildBaseLog(level, message, meta = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
}

function shouldLog(level) {
  return LOG_LEVELS[level] >= activeLogLevel;
}

function writeConsole(level, payload) {
  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

function log(level, message, meta = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = buildBaseLog(level, message, meta);
  writeLog(level === 'error' ? errorLogPath : appLogPath, payload);
  writeConsole(level, payload);
}

function debug(message, meta = {}) {
  log('debug', message, meta);
}

function info(message, meta = {}) {
  log('info', message, meta);
}

function warn(message, meta = {}) {
  log('warn', message, meta);
}

function error(message, meta = {}) {
  log('error', message, meta);
}

function sanitizeRequestId(rawValue) {
  if (typeof rawValue !== 'string') {
    return null;
  }

  const trimmed = rawValue.trim();

  if (!trimmed || trimmed.length > 100) {
    return null;
  }

  return /^[A-Za-z0-9-_.]+$/.test(trimmed) ? trimmed : null;
}

function createRequestLogger() {
  return (req, res, next) => {
    const startedAt = Date.now();
    const requestId = sanitizeRequestId(req.headers['x-request-id']) || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

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
  debug,
  error,
  info,
  warn,
};
