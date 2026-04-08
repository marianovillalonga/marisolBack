const app = require('./app');
const auditModel = require('./models/audit.model');
const categoryModel = require('./models/category.model');
const clientModel = require('./models/client.model');
const budgetModel = require('./models/budget.model');
const { PORT, validateRuntimeConfig } = require('./config/env');
const orderModel = require('./models/order.model');
const productModel = require('./models/product.model');
const saleModel = require('./models/sale.model');
const sessionModel = require('./models/session.model');
const userModel = require('./models/user.model');

const STARTUP_DB_RETRIES = Number(process.env.DB_STARTUP_RETRIES) || 6;
const STARTUP_DB_RETRY_DELAY_MS = Number(process.env.DB_STARTUP_RETRY_DELAY_MS) || 5000;

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

async function initializeDatabase() {
  await userModel.ensureAuthTables();
  await userModel.ensureProfileFields();
  await userModel.ensureBaseRoles();
  await userModel.ensureAdminUser();
  await sessionModel.ensureRevokedTokensTable();
  await productModel.ensureProductsTable();
  await categoryModel.ensureCategoriesTable();
  await clientModel.ensureClientsTables();
  await saleModel.ensureSalesTables();
  await orderModel.ensureOrdersTables();
  await budgetModel.ensureBudgetsTables();
  await auditModel.ensureAuditTable();
  await saleModel.repairClientPurchasesFromSales();
}

async function startServer() {
  validateRuntimeConfig();

  for (let attempt = 1; attempt <= STARTUP_DB_RETRIES; attempt += 1) {
    try {
      await initializeDatabase();
      break;
    } catch (error) {
      const canRetry = isRetryableDatabaseStartupError(error) && attempt < STARTUP_DB_RETRIES;

      if (!canRetry) {
        throw error;
      }

      console.warn(
        `No se pudo conectar a la base en el intento ${attempt}/${STARTUP_DB_RETRIES}. Reintentando en ${Math.round(
          STARTUP_DB_RETRY_DELAY_MS / 1000,
        )}s...`,
      );
      await sleep(STARTUP_DB_RETRY_DELAY_MS);
    }
  }

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('No se pudo iniciar el servidor:', error);
  process.exit(1);
});
