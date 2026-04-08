const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;
const explicitDbSsl = process.env.DB_SSL;
const explicitDbSslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED;
const explicitDbCaCert = process.env.DB_CA_CERT;
const connectionTimeoutMillis = Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 10000;
const idleTimeoutMillis = Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000;
const maxConnections = Number(process.env.DB_POOL_MAX) || 10;
const localConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres',
};

function parseBoolean(value) {
  if (value === undefined) {
    return undefined;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function shouldUseSsl(connectionString) {
  const configuredValue = parseBoolean(explicitDbSsl);

  if (configuredValue !== undefined) {
    return configuredValue;
  }

  if (!isProduction || !connectionString) {
    return false;
  }

  try {
    const hostname = new URL(connectionString).hostname;
    return !['localhost', '127.0.0.1'].includes(hostname);
  } catch {
    return isProduction;
  }
}

function buildSslConfig() {
  if (!useSsl) {
    return false;
  }

  const rejectUnauthorized = parseBoolean(explicitDbSslRejectUnauthorized);

  return {
    rejectUnauthorized: rejectUnauthorized !== false,
    ca: explicitDbCaCert || undefined,
  };
}

const useSsl = shouldUseSsl(databaseUrl);
const sslConfig = buildSslConfig();

const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: sslConfig,
      connectionTimeoutMillis,
      idleTimeoutMillis,
      max: maxConnections,
      keepAlive: true,
    }
  : {
      ...localConfig,
      connectionTimeoutMillis,
      idleTimeoutMillis,
      max: maxConnections,
      keepAlive: true,
    };

const pool = new Pool(poolConfig);

module.exports = pool;
