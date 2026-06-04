require('dotenv').config();

const pool = require('../src/config/db');
const productModel = require('../src/models/product.model');

async function run() {
  await productModel.ensureProductsTable();
  const updatedProducts = await productModel.roundExistingProductPrices();

  console.log(`Productos actualizados: ${updatedProducts.length}`);

  for (const product of updatedProducts) {
    console.log(
      `${product.id} - ${product.nombre}: ${product.precioAnterior} -> ${product.precioActual}`,
    );
  }
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
