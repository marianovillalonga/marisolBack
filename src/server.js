const app = require('./app');
const categoryModel = require('./models/category.model');
const clientModel = require('./models/client.model');
const { PORT } = require('./config/env');
const productModel = require('./models/product.model');
const saleModel = require('./models/sale.model');
const sessionModel = require('./models/session.model');
const userModel = require('./models/user.model');

async function startServer() {
  await userModel.ensureProfileFields();
  await userModel.ensureBaseRoles();
  await sessionModel.ensureRevokedTokensTable();
  await productModel.ensureProductsTable();
  await categoryModel.ensureCategoriesTable();
  await clientModel.ensureClientsTables();
  await saleModel.ensureSalesTables();
  await saleModel.repairClientPurchasesFromSales();

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('No se pudo iniciar el servidor:', error);
  process.exit(1);
});
