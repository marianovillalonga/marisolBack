const app = require('./app');
const pool = require('./config/db');
const { PORT, validateRuntimeConfig } = require('./config/env');
const logger = require('./utils/logger.util');

const STARTUP_DB_RETRIES = Number(process.env.DB_STARTUP_RETRIES) || 6;
const STARTUP_DB_RETRY_DELAY_MS = Number(process.env.DB_STARTUP_RETRY_DELAY_MS) || 5000;

function serializeError(error) {
  if (!error) {
    return {
      message: 'Unknown startup error',
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message || 'Unknown error',
      stack: error.stack || null,
      code: error.code || null,
      errno: error.errno || null,
      syscall: error.syscall || null,
      address: error.address || null,
      port: error.port || null,
      detail: error.detail || null,
      hint: error.hint || null,
      severity: error.severity || null,
    };
  }

  if (typeof error === 'object') {
    return {
      message: JSON.stringify(error),
    };
  }

  return {
    message: String(error),
  };
}

function isRetryableDatabaseStartupError(error) {
  if (!error) {
    return false;
  }

  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();

  return (
    code === 'XX000' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    message.includes('control plane request failed') ||
    message.includes('connection terminated due to connection timeout') ||
    message.includes('timeout expired') ||
    message.includes('the database system is starting up')
  );
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function verifyDatabaseConnection() {
  await pool.query('SELECT 1');
}

async function startServer() {
  validateRuntimeConfig();

  for (let attempt = 1; attempt <= STARTUP_DB_RETRIES; attempt += 1) {
    try {
      await verifyDatabaseConnection();
      break;
    } catch (error) {
      const canRetry = isRetryableDatabaseStartupError(error) && attempt < STARTUP_DB_RETRIES;

      if (!canRetry) {
        throw error;
      }

      logger.warn('database_startup_retry', {
        attempt,
        maxAttempts: STARTUP_DB_RETRIES,
        retryDelayMs: STARTUP_DB_RETRY_DELAY_MS,
        db: typeof pool.getConnectionDebugInfo === 'function' ? pool.getConnectionDebugInfo() : null,
        error: serializeError(error),
      });
      await sleep(STARTUP_DB_RETRY_DELAY_MS);
    }
  }

  const server = app.listen(PORT, () => {
    logger.info('server_started', {
      port: PORT,
    });
  });

  const shutdown = (signal) => {
    logger.warn('server_shutdown_requested', { signal });
    server.close((error) => {
      if (error) {
        logger.error('server_shutdown_failed', {
          signal,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null,
        });
        process.exit(1);
        return;
      }

      logger.info('server_shutdown_completed', { signal });
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : null,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  });
  process.exit(1);
});

startServer().catch((error) => {
  logger.error('server_start_failed', {
    db: typeof pool.getConnectionDebugInfo === 'function' ? pool.getConnectionDebugInfo() : null,
    error: serializeError(error),
  });
  process.exit(1);
});
