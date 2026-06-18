const productModel = require('../models/product.model');
const { registerAudit } = require('../utils/audit.util');
const { buildMessageResponse } = require('../views/auth.view');
const { buildEan13, isValidEan13, sanitizeBarcode } = require('../utils/barcode.util');
const { normalizeImageUrl, validateImageUrl } = require('../utils/image.util');
const { parsePaginationParams } = require('../utils/validation.util');
const {
  buildCategoriesResponse,
  buildProductMessageResponse,
  buildProductResponse,
  buildProductsResponse,
} = require('../views/product.view');

function validateProductInput({ nombre, categoria, subcategoria, cantidad, stockMinimo, precio, imageUrl }) {
  if (!nombre || !categoria || !subcategoria || cantidad === undefined || precio === undefined) {
    return 'Nombre, categoria, subcategoria, cantidad y precio son obligatorios';
  }

  if (Number.isNaN(Number(cantidad)) || Number(cantidad) < 0) {
    return 'La cantidad debe ser un numero igual o mayor a 0';
  }

  if (Number.isNaN(Number(precio)) || Number(precio) < 0) {
    return 'El precio debe ser un numero igual o mayor a 0';
  }

  if (stockMinimo === undefined || Number.isNaN(Number(stockMinimo)) || Number(stockMinimo) < 0) {
    return 'El stock minimo debe ser un numero igual o mayor a 0';
  }

  const imageValidationError = validateImageUrl(imageUrl?.trim() || '');

  if (imageValidationError) {
    return imageValidationError;
  }

  return null;
}

function normalizeBarcodeInput(codigoBarras) {
  const sanitizedBarcode = sanitizeBarcode(codigoBarras || '');

  if (!sanitizedBarcode) {
    return '';
  }

  if (/^\d{12}$/.test(sanitizedBarcode)) {
    return buildEan13(sanitizedBarcode);
  }

  if (isValidEan13(sanitizedBarcode)) {
    return sanitizedBarcode;
  }

  return null;
}

async function listProducts(req, res, next) {
  try {
    const pagination = parsePaginationParams(req.query);
    const search = req.query.search || '';

    if (/^\d{8,}$/.test(sanitizeBarcode(search))) {
      console.info('[barcode][products:controller] received search', {
        rawSearch: search,
        sanitizedSearch: sanitizeBarcode(search),
        page: pagination.page,
        limit: pagination.limit,
        offset: pagination.offset,
      });
    }

    const result = await productModel.listProducts(
      search,
      req.query.category || '',
      req.query.subcategory || '',
      pagination,
    );
    return res
      .status(200)
      .json(buildProductsResponse(result.products, { ...pagination, total: result.total }));
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
    const normalizedImage = await normalizeImageUrl(req.body.imageUrl?.trim() || '');

    if (normalizedImage.error) {
      return res.status(400).json(buildMessageResponse(normalizedImage.error));
    }

    const validationError = validateProductInput({
      ...req.body,
      imageUrl: normalizedImage.imageUrl,
    });

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const normalizedBarcode = normalizeBarcodeInput(req.body.codigoBarras);

    if (normalizedBarcode === null) {
      return res.status(400).json(
        buildMessageResponse('El codigo de barras debe ser un EAN-13 valido de 13 digitos'),
      );
    }

    if (req.body.codigoBarras) {
      console.info('[barcode][products:controller] create normalized', {
        rawBarcode: req.body.codigoBarras,
        sanitizedBarcode: sanitizeBarcode(req.body.codigoBarras),
        normalizedBarcode,
      });
    }

    const product = await productModel.createProduct({
      nombre: req.body.nombre.trim(),
      categoria: req.body.categoria.trim(),
      subcategoria: req.body.subcategoria.trim(),
      codigoBarras: normalizedBarcode,
      cantidad: Number(req.body.cantidad),
      stockMinimo: Number(req.body.stockMinimo),
      precio: Number(req.body.precio),
      detalle: req.body.detalle?.trim() || '',
      imageUrl: normalizedImage.imageUrl,
    });

    await registerAudit(req, {
      action: 'producto_creado',
      entity: 'producto',
      entityId: product.id,
      details: {
        nombre: product.nombre,
        categoria: product.categoria,
        subcategoria: product.subcategoria,
        codigoBarras: product.codigoBarras,
      },
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
    const normalizedImage = await normalizeImageUrl(req.body.imageUrl?.trim() || '');

    if (normalizedImage.error) {
      return res.status(400).json(buildMessageResponse(normalizedImage.error));
    }

    const validationError = validateProductInput({
      ...req.body,
      imageUrl: normalizedImage.imageUrl,
    });

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const normalizedBarcode = normalizeBarcodeInput(req.body.codigoBarras);

    if (normalizedBarcode === null) {
      return res.status(400).json(
        buildMessageResponse('El codigo de barras debe ser un EAN-13 valido de 13 digitos'),
      );
    }

    if (req.body.codigoBarras) {
      console.info('[barcode][products:controller] update normalized', {
        productId: Number(req.params.id),
        rawBarcode: req.body.codigoBarras,
        sanitizedBarcode: sanitizeBarcode(req.body.codigoBarras),
        normalizedBarcode,
      });
    }

    const product = await productModel.updateProduct(Number(req.params.id), {
      nombre: req.body.nombre.trim(),
      categoria: req.body.categoria.trim(),
      subcategoria: req.body.subcategoria.trim(),
      codigoBarras: normalizedBarcode,
      cantidad: Number(req.body.cantidad),
      stockMinimo: Number(req.body.stockMinimo),
      precio: Number(req.body.precio),
      detalle: req.body.detalle?.trim() || '',
      imageUrl: normalizedImage.imageUrl,
    });

    if (!product) {
      return res.status(404).json(buildMessageResponse('Producto no encontrado'));
    }

    await registerAudit(req, {
      action: 'producto_actualizado',
      entity: 'producto',
      entityId: product.id,
      details: {
        nombre: product.nombre,
        categoria: product.categoria,
        subcategoria: product.subcategoria,
        codigoBarras: product.codigoBarras,
      },
    });

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

    await registerAudit(req, {
      action: 'producto_eliminado',
      entity: 'producto',
      entityId: Number(req.params.id),
      details: {},
    });

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

    await registerAudit(req, {
      action: 'precios_ajustados_por_categoria',
      entity: 'categoria',
      entityId: categoria.trim(),
      details: {
        categoria: categoria.trim(),
        porcentaje: Number(porcentaje),
        productosActualizados: updatedProducts.length,
      },
    });

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
