require('dotenv').config();

const auditModel = require('../src/models/audit.model');
const budgetModel = require('../src/models/budget.model');
const categoryModel = require('../src/models/category.model');
const clientModel = require('../src/models/client.model');
const orderModel = require('../src/models/order.model');
const pool = require('../src/config/db');
const productModel = require('../src/models/product.model');
const saleModel = require('../src/models/sale.model');
const sessionModel = require('../src/models/session.model');
const userModel = require('../src/models/user.model');

async function bootstrapSchema() {
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

async function main() {
  await bootstrapSchema();
}

if (require.main === module) {
  main()
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end().catch(() => {});
    });
}

module.exports = {
  bootstrapSchema,
};
