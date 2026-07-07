const saleModel = require('../models/sale.model');
const { registerAudit } = require('../utils/audit.util');
const { validateSaleInput } = require('../utils/document-validation.util');
const { getDateOnlyString } = require('../utils/date.util');
const { parsePaginationParams } = require('../utils/validation.util');
const { buildMessageResponse } = require('../views/auth.view');
const {
  buildSaleMessageResponse,
  buildSaleResponse,
  buildSalesResponse,
  buildSalesSummaryResponse,
} = require('../views/sale.view');

function buildProductNotFoundMessage(result) {
  if (Array.isArray(result.missingProducts) && result.missingProducts.length > 1) {
    const productReferences = result.missingProducts
      .map((product) =>
        product.productName
          ? `"${product.productName}"${product.productId ? ` (ID ${product.productId})` : ''}`
          : product.productId
            ? `ID ${product.productId}`
            : 'sin identificar',
      )
      .join(', ');

    return `Estos productos no existen: ${productReferences}`;
  }

  const productReference = result.productName
    ? `"${result.productName}"${result.productId ? ` (ID ${result.productId})` : ''}`
    : result.productId
      ? `con ID ${result.productId}`
      : 'seleccionado';

  return `El producto ${productReference} no existe`;
}

async function listSales(req, res, next) {
  try {
    const pagination = parsePaginationParams(req.query);
    const result = await saleModel.listSales(
      req.query.search || '',
      req.query.status || 'all',
      pagination,
    );
    return res
      .status(200)
      .json(buildSalesResponse(result.sales, { ...pagination, total: result.total }));
  } catch (error) {
    next(error);
  }
}

async function getSalesSummary(req, res, next) {
  try {
    const today = getDateOnlyString();
    const from = req.query.from || today;
    const to = req.query.to || from;

    if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
      return res.status(400).json(buildMessageResponse('Las fechas del resumen no son validas'));
    }

    const summary = await saleModel.getSalesSummary(from, to);
    return res.status(200).json(buildSalesSummaryResponse(summary));
  } catch (error) {
    next(error);
  }
}

async function getSaleById(req, res, next) {
  try {
    const sale = await saleModel.findById(Number(req.params.id));

    if (!sale) {
      return res.status(404).json(buildMessageResponse('Venta no encontrada'));
    }

    return res.status(200).json(buildSaleResponse(sale, 'Venta obtenida correctamente'));
  } catch (error) {
    next(error);
  }
}

async function createSale(req, res, next) {
  try {
    const validationError = validateSaleInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const normalizedPayments = Array.isArray(req.body.pagos)
      ? req.body.pagos
          .map((pago) => ({
            metodo: pago?.metodo?.trim?.() || '',
            monto: Number(pago?.monto || 0),
          }))
          .filter((pago) => pago.metodo && pago.monto > 0)
      : [];

    const result = await saleModel.createSale({
      clientId: req.body.clientId ? Number(req.body.clientId) : null,
      sellerId: req.user.id,
      descuento: Number(req.body.descuento),
      montoPagado: Number(req.body.montoPagado),
      notas: req.body.notas?.trim() || '',
      fechaVenta: req.body.fechaVenta,
      pagos: normalizedPayments,
      items: req.body.items.map((item) => ({
        productoId: item.productoId ? Number(item.productoId) : null,
        productoNombre: item.productoNombre?.trim?.() || '',
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precioUnitario),
      })),
    });

    if (result.error === 'CLIENT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Cliente no encontrado'));
    }

    if (result.error === 'SELLER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario vendedor no encontrado'));
    }

    if (result.error === 'CLIENT_REQUIRED_FOR_BALANCE') {
      return res.status(400).json(
        buildMessageResponse('Para dejar saldo pendiente debes seleccionar un cliente'),
      );
    }

    if (result.error === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse(buildProductNotFoundMessage(result)));
    }

    if (result.error === 'INSUFFICIENT_STOCK') {
      return res.status(409).json(
        buildMessageResponse(
          `Stock insuficiente para ${result.productName}. Disponible: ${result.availableStock}`,
        ),
      );
    }

    if (result.error === 'INVALID_PAYMENT_SPLIT') {
      return res.status(400).json(
        buildMessageResponse('Los pagos informados superan el total de la venta'),
      );
    }

    const sale = await saleModel.findById(result.saleId);

    await registerAudit(req, {
      action: 'venta_creada',
      entity: 'venta',
      entityId: result.saleId,
      details: {
        clientId: req.body.clientId ? Number(req.body.clientId) : null,
        total: sale?.total || null,
        metodoPago: sale?.metodoPago || null,
        pagos: normalizedPayments,
        items: req.body.items.length,
      },
    });

    return res.status(201).json(buildSaleResponse(sale, 'Venta registrada correctamente'));
  } catch (error) {
    next(error);
  }
}

async function saveDraftSale(req, res, next) {
  try {
    const validationError = validateSaleInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const normalizedPayments = Array.isArray(req.body.pagos)
      ? req.body.pagos
          .map((pago) => ({
            metodo: pago?.metodo?.trim?.() || '',
            monto: Number(pago?.monto || 0),
          }))
          .filter((pago) => pago.metodo && pago.monto > 0)
      : [];

    const result = await saleModel.saveDraftSale({
      saleId: req.body.saleId ? Number(req.body.saleId) : null,
      clientId: req.body.clientId ? Number(req.body.clientId) : null,
      sellerId: req.user.id,
      descuento: Number(req.body.descuento),
      montoPagado: Number(req.body.montoPagado),
      notas: req.body.notas?.trim() || '',
      fechaVenta: req.body.fechaVenta,
      pagos: normalizedPayments,
      items: req.body.items.map((item) => ({
        productoId: item.productoId ? Number(item.productoId) : null,
        productoNombre: item.productoNombre?.trim?.() || '',
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precioUnitario),
      })),
    });

    if (result.error === 'CLIENT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Cliente no encontrado'));
    }

    if (result.error === 'SELLER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario vendedor no encontrado'));
    }

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Borrador de venta no encontrado'));
    }

    if (result.error === 'INVALID_STATE') {
      return res.status(409).json(buildMessageResponse('Solo se pueden editar ventas en progreso'));
    }

    const sale = await saleModel.findById(result.saleId);

    await registerAudit(req, {
      action: req.body.saleId ? 'venta_borrador_actualizada' : 'venta_borrador_creada',
      entity: 'venta',
      entityId: result.saleId,
      details: {
        clientId: req.body.clientId ? Number(req.body.clientId) : null,
        total: sale?.total || null,
        items: req.body.items.length,
      },
    });

    return res.status(req.body.saleId ? 200 : 201).json(buildSaleResponse(sale, 'Borrador guardado correctamente'));
  } catch (error) {
    next(error);
  }
}

async function confirmDraftSale(req, res, next) {
  try {
    const result = await saleModel.confirmDraftSale({
      saleId: Number(req.params.id),
      sellerId: req.user.id,
    });

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Borrador de venta no encontrado'));
    }

    if (result.error === 'INVALID_STATE') {
      return res.status(409).json(buildMessageResponse('Solo se pueden confirmar ventas en progreso'));
    }

    if (result.error === 'SELLER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario vendedor no encontrado'));
    }

    if (result.error === 'CLIENT_REQUIRED_FOR_BALANCE') {
      return res.status(400).json(
        buildMessageResponse('Para dejar saldo pendiente debes seleccionar un cliente'),
      );
    }

    if (result.error === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse(buildProductNotFoundMessage(result)));
    }

    if (result.error === 'INSUFFICIENT_STOCK') {
      return res.status(409).json(
        buildMessageResponse(
          `Stock insuficiente para ${result.productName}. Disponible: ${result.availableStock}`,
        ),
      );
    }

    if (result.error === 'INVALID_PAYMENT_SPLIT') {
      return res.status(400).json(
        buildMessageResponse('Los pagos informados superan el total de la venta'),
      );
    }

    const sale = await saleModel.findById(result.saleId);

    await registerAudit(req, {
      action: 'venta_borrador_confirmada',
      entity: 'venta',
      entityId: result.saleId,
      details: {
        total: sale?.total || null,
        metodoPago: sale?.metodoPago || null,
        items: sale?.items?.length || 0,
      },
    });

    return res.status(200).json(buildSaleResponse(sale, 'Venta confirmada correctamente'));
  } catch (error) {
    next(error);
  }
}

async function cancelSale(req, res, next) {
  try {
    const result = await saleModel.cancelSale(Number(req.params.id));

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Venta no encontrada'));
    }

    if (result.error === 'ALREADY_CANCELLED') {
      return res.status(409).json(buildMessageResponse('La venta ya estaba anulada'));
    }

    await registerAudit(req, {
      action: 'venta_anulada',
      entity: 'venta',
      entityId: Number(req.params.id),
      details: {},
    });

    return res.status(200).json(buildSaleMessageResponse('Venta anulada correctamente'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listSales,
  getSalesSummary,
  getSaleById,
  createSale,
  saveDraftSale,
  confirmDraftSale,
  cancelSale,
};
