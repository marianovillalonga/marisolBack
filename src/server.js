const app = require('./app');
const auditModel = require('./models/audit.model');
const categoryModel = require('./models/category.model');
const clientModel = require('./models/client.model');
const budgetModel = require('./models/budget.model');
const { PORT } = require('./config/env');
const productModel = require('./models/product.model');
const saleModel = require('./models/sale.model');
const sessionModel = require('./models/session.model');
const userModel = require('./models/user.model');

async function startServer() {
  await userModel.ensureAuthTables();
  await userModel.ensureProfileFields();
  await userModel.ensureBaseRoles();
  await userModel.ensureAdminUser();
  await sessionModel.ensureRevokedTokensTable();
  await productModel.ensureProductsTable();
  await categoryModel.ensureCategoriesTable();
  await clientModel.ensureClientsTables();
  await saleModel.ensureSalesTables();
  await budgetModel.ensureBudgetsTables();
  await auditModel.ensureAuditTable();
  await saleModel.repairClientPurchasesFromSales();

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('No se pudo iniciar el servidor:', error);
  process.exit(1);
});
