const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;
const localConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres',
};

const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: isProduction
        ? {
            rejectUnauthorized: false,
          }
        : false,
    }
  : localConfig;

const pool = new Pool(poolConfig);

module.exports = pool;
