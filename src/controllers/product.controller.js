const productModel = require('../models/product.model');
const { buildMessageResponse } = require('../views/auth.view');
const {
  buildCategoriesResponse,
  buildProductMessageResponse,
  buildProductResponse,
  buildProductsResponse,
} = require('../views/product.view');

function validateProductInput({ nombre, categoria, cantidad, precio }) {
  if (!nombre || !categoria || cantidad === undefined || precio === undefined) {
    return 'Nombre, categoria, cantidad y precio son obligatorios';
  }

  if (Number.isNaN(Number(cantidad)) || Number(cantidad) < 0) {
    return 'La cantidad debe ser un numero igual o mayor a 0';
  }

  if (Number.isNaN(Number(precio)) || Number(precio) < 0) {
    return 'El precio debe ser un numero igual o mayor a 0';
  }

  return null;
}

async function listProducts(req, res, next) {
  try {
    const products = await productModel.listProducts(req.query.search || '', req.query.category || '');
    return res.status(200).json(buildProductsResponse(products));
  } catch (error) {
    next(error);
  }
}

async function listCategories(_req, res, next) {
  try {
    const categories = await productModel.listCategories();
    return res.status(200).json(buildCategoriesResponse(categories));
  } catch (error) {
    next(error);
  }
}

async function getProductById(req, res, next) {
  try {
    const product = await productModel.findById(Number(req.params.id));

    if (!product) {
      return res.status(404).json(buildMessageResponse('Producto no encontrado'));
    }

    return res.status(200).json(buildProductResponse(product, 'Producto obtenido correctamente'));
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const validationError = validateProductInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const product = await productModel.createProduct({
      nombre: req.body.nombre.trim(),
      categoria: req.body.categoria.trim(),
      codigoBarras: req.body.codigoBarras?.trim() || '',
      cantidad: Number(req.body.cantidad),
      precio: Number(req.body.precio),
      detalle: req.body.detalle?.trim() || '',
      imageUrl: req.body.imageUrl?.trim() || '',
    });

    return res.status(201).json(buildProductResponse(product, 'Producto creado correctamente'));
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json(buildMessageResponse('Ya existe un producto con ese codigo de barras'));
    }

    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const validationError = validateProductInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const product = await productModel.updateProduct(Number(req.params.id), {
      nombre: req.body.nombre.trim(),
      categoria: req.body.categoria.trim(),
      codigoBarras: req.body.codigoBarras?.trim() || '',
      cantidad: Number(req.body.cantidad),
      precio: Number(req.body.precio),
      detalle: req.body.detalle?.trim() || '',
      imageUrl: req.body.imageUrl?.trim() || '',
    });

    if (!product) {
      return res.status(404).json(buildMessageResponse('Producto no encontrado'));
    }

    return res.status(200).json(buildProductResponse(product, 'Producto actualizado correctamente'));
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json(buildMessageResponse('Ya existe un producto con ese codigo de barras'));
    }

    next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const deleted = await productModel.deleteProduct(Number(req.params.id));

    if (!deleted) {
      return res.status(404).json(buildMessageResponse('Producto no encontrado'));
    }

    return res.status(200).json(buildProductMessageResponse('Producto eliminado correctamente'));
  } catch (error) {
    next(error);
  }
}

async function adjustPricesByCategory(req, res, next) {
  try {
    const { categoria, porcentaje } = req.body;

    if (!categoria || !categoria.trim()) {
      return res.status(400).json(buildMessageResponse('La categoria es obligatoria'));
    }

    if (porcentaje === undefined || Number.isNaN(Number(porcentaje))) {
      return res.status(400).json(buildMessageResponse('El porcentaje debe ser un numero valido'));
    }

    const updatedProducts = await productModel.adjustPricesByCategory(
      categoria.trim(),
      Number(porcentaje),
    );

    if (!updatedProducts.length) {
      return res.status(404).json(buildMessageResponse('No hay productos para actualizar en esa categoria'));
    }

    return res.status(200).json({
      ok: true,
      message: `Se actualizaron ${updatedProducts.length} producto${updatedProducts.length === 1 ? '' : 's'} de la categoria ${categoria.trim()}`,
      products: updatedProducts,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCategories,
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustPricesByCategory,
  deleteProduct,
};
