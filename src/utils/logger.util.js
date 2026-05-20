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
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'apikey',
  'api_key',
  'reseturl',
  'resettoken',
]);

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
    ...sanitizeMeta(meta),
  };
}

function sanitizeMeta(meta) {
  if (Array.isArray(meta)) {
    return meta.map((item) => sanitizeMeta(item));
  }

  if (!meta || typeof meta !== 'object') {
    return meta;
  }

  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => {
      const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

      if (SENSITIVE_KEYS.has(normalizedKey)) {
        return [key, '[REDACTED]'];
      }

      return [key, sanitizeMeta(value)];
    }),
  );
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

function buildRequestLogMeta(req, res, durationMs) {
  return {
    requestId: req.requestId || null,
    method: req.method,
    path: req.originalUrl,
    statusCode: res.statusCode,
    durationMs,
    ip: req.ip,
    userId: req.user?.id || null,
    authPresent: Boolean(req.headers.cookie),
    userAgent: req.headers['user-agent'] || null,
    referer: req.headers.referer || null,
  };
}

function createRequestLogger() {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    const requestId = sanitizeRequestId(req.headers['x-request-id']) || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      info('http_request', {
        ...buildRequestLogMeta(req, res, Number(durationMs.toFixed(2))),
      });
    });

    next();
  };
}

module.exports = {
  createRequestLogger,
  buildRequestLogMeta,
  debug,
  error,
  info,
  sanitizeMeta,
  warn,
};
