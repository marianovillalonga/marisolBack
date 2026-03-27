const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;
const explicitDbSsl = process.env.DB_SSL;
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

const useSsl = shouldUseSsl(databaseUrl);

const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: useSsl
        ? {
            rejectUnauthorized: false,
          }
        : false,
    }
  : localConfig;

const pool = new Pool(poolConfig);

module.exports = pool;
