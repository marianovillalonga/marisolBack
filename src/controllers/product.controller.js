const productModel = require('../models/product.model');
const categoryModel = require('../models/category.model');
const auditModel = require('../models/audit.model');
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

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

    const result = await productModel.listProducts(
      search,
      req.query.category || '',
      req.query.subcategory || '',
      pagination,
      sanitizeBarcode(req.query.barcode || ''),
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
    const categoryId = Number(req.body.categoryId ?? req.body.categoriaId);
    const rawSubcategoryId = req.body.subcategoryId ?? req.body.subcategoriaId;
    const subcategoryId =
      rawSubcategoryId === undefined || rawSubcategoryId === null || rawSubcategoryId === ''
        ? null
        : Number(rawSubcategoryId);
    const porcentaje = Number(req.body.porcentaje);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json(buildMessageResponse('La categoria es obligatoria y debe ser valida'));
    }

    if (!Number.isFinite(porcentaje)) {
      return res.status(400).json(buildMessageResponse('El porcentaje debe ser un numero valido'));
    }

    const category = await categoryModel.findCategoryById(categoryId);

    if (!category) {
      return res.status(404).json(buildMessageResponse('La categoria seleccionada no existe'));
    }

    let subcategory = null;

    if (subcategoryId !== null) {
      if (!Number.isInteger(subcategoryId) || subcategoryId <= 0) {
        return res.status(400).json(buildMessageResponse('La subcategoria debe ser valida'));
      }

      subcategory = await categoryModel.findSubcategoryById(subcategoryId);

      if (!subcategory) {
        return res.status(404).json(buildMessageResponse('La subcategoria seleccionada no existe'));
      }

      if (Number(subcategory.categoriaId) !== Number(categoryId)) {
        return res.status(400).json(buildMessageResponse('La subcategoria no pertenece a la categoria seleccionada'));
      }
    }

    const result = await productModel.adjustPricesByCategory({
      categoryId,
      subcategoryId,
      percentage: porcentaje,
    });

    if (!result.updatedCount) {
      return res.status(404).json(buildMessageResponse('No hay productos para actualizar en esa categoria'));
    }

    await registerAudit(req, {
      action: 'precios_ajustados_por_categoria',
      entity: 'categoria',
      entityId: categoryId,
      details: {
        categoriaId: categoryId,
        categoria: category.nombre,
        subcategoriaId: subcategoryId,
        subcategoria: subcategory?.nombre || null,
        porcentaje,
        productosActualizados: result.updatedCount,
        productos: result.products.map((product) => ({
          id: product.id,
          nombre: product.nombre,
          categoria: product.categoria,
          subcategoria: product.subcategoria,
          precioAnterior: product.precioAnterior,
          precioNuevo: product.precioNuevo,
        })),
      },
    });

    return res.status(200).json({
      ok: true,
      message: `Se actualizaron ${result.updatedCount} producto${result.updatedCount === 1 ? '' : 's'}${
        subcategory ? ` de la categoria ${category.nombre} / ${subcategory.nombre}` : ` de la categoria ${category.nombre}`
      }`,
      updatedCount: result.updatedCount,
      products: result.products,
    });
  } catch (error) {
    next(error);
  }
}

async function listPriceAdjustments(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const history = await auditModel.listPriceAdjustments(limit);

    return res.status(200).json({
      ok: true,
      history,
    });
  } catch (error) {
    next(error);
  }
}

async function downloadPriceAdjustmentDetail(req, res, next) {
  try {
    const historyId = Number(req.params.id);
    const historyItem = await auditModel.findPriceAdjustmentById(historyId);

    if (!historyItem) {
      return res.status(404).json(buildMessageResponse('No se encontro el ajuste solicitado'));
    }

    const details = historyItem.details || {};
    const products = Array.isArray(details.productos) ? details.productos : [];
    const percentage = Number(details.porcentaje || 0);
    const categoryName = details.categoria || 'Sin categoria';
    const subcategoryName = details.subcategoria || '';
    const filename = `ajuste-precio-${historyId}.xls`;

    const rowsHtml = products
      .map(
        (product) => `
          <tr>
            <td>${escapeHtml(product.nombre || '')}</td>
            <td>${formatPrice(product.precioAnterior)}</td>
            <td>${formatPrice(product.precioNuevo)}</td>
            <td>${formatDateTime(historyItem.createdAt)}</td>
            <td>${escapeHtml(`${percentage}%`)}</td>
          </tr>
        `,
      )
      .join('');

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
        </head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Precio viejo</th>
                <th>Precio nuevo</th>
                <th>Fecha</th>
                <th>% aumento</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="5">Sin productos</td></tr>'}
            </tbody>
          </table>
          <table border="1" style="margin-top:16px">
            <tr><th>Categoria</th><td>${escapeHtml(categoryName)}</td></tr>
            <tr><th>Subcategoria</th><td>${escapeHtml(subcategoryName || 'Todas')}</td></tr>
            <tr><th>Fecha</th><td>${escapeHtml(formatDateTime(historyItem.createdAt))}</td></tr>
            <tr><th>% aumento</th><td>${escapeHtml(`${percentage}%`)}</td></tr>
          </table>
        </body>
      </html>`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(html);
  } catch (error) {
    next(error);
  }
}

async function revertLastPriceAdjustment(req, res, next) {
  try {
    const historyId = Number(req.params.id);
    const latestHistory = await auditModel.findLatestPriceAdjustment();

    if (!latestHistory) {
      return res.status(404).json(buildMessageResponse('No hay ajustes de precio para anular'));
    }

    if (Number(latestHistory.id) !== historyId) {
      return res.status(400).json(buildMessageResponse('Solo se puede anular el ultimo ajuste de precio'));
    }

    if (!latestHistory.canRevert) {
      return res.status(400).json(buildMessageResponse('Este ajuste ya fue anulado'));
    }

    const details = latestHistory.details || {};
    const products = Array.isArray(details.productos) ? details.productos : [];

    if (!products.length) {
      return res.status(400).json(buildMessageResponse('El ajuste no contiene productos para revertir'));
    }

    const result = await productModel.revertPriceAdjustment(products);

    if (!result.updatedCount) {
      return res.status(404).json(buildMessageResponse('No se pudieron revertir los productos del ajuste'));
    }

    await registerAudit(req, {
      action: 'precios_ajuste_anulado',
      entity: 'categoria',
      entityId: details.categoriaId || null,
      details: {
        ajusteAnuladoId: latestHistory.id,
        productosRestaurados: result.updatedCount,
      },
    });

    return res.status(200).json({
      ok: true,
      message: 'Ultimo ajuste de precio anulado correctamente',
      updatedCount: result.updatedCount,
      products: result.products,
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
  listPriceAdjustments,
  downloadPriceAdjustmentDetail,
  revertLastPriceAdjustment,
  deleteProduct,
};
