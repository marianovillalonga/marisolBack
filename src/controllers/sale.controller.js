const saleModel = require('../models/sale.model');
const { registerAudit } = require('../utils/audit.util');
const { buildMessageResponse } = require('../views/auth.view');
const {
  buildSaleMessageResponse,
  buildSaleResponse,
  buildSalesResponse,
  buildSalesSummaryResponse,
} = require('../views/sale.view');

function validateSaleInput({
  clientId,
  descuento,
  montoPagado,
  pagos = [],
  fechaVenta,
  items,
}) {
  if (clientId !== null && clientId !== undefined && Number.isNaN(Number(clientId))) {
    return 'El cliente seleccionado no es valido';
  }

  if (!Array.isArray(items) || items.length === 0) {
    return 'Debes agregar al menos un producto a la venta';
  }

  if (Number.isNaN(Number(descuento)) || Number(descuento) < 0) {
    return 'El descuento debe ser un numero igual o mayor a 0';
  }

  if (Number.isNaN(Number(montoPagado)) || Number(montoPagado) < 0) {
    return 'El monto pagado debe ser un numero igual o mayor a 0';
  }

  if (!Array.isArray(pagos)) {
    return 'Los pagos informados no son validos';
  }

  for (const pago of pagos) {
    if (!pago?.metodo || !pago.metodo.trim()) {
      return 'Cada pago debe tener un metodo valido';
    }

    if (Number.isNaN(Number(pago.monto)) || Number(pago.monto) <= 0) {
      return 'Cada pago debe tener un monto mayor a 0';
    }
  }

  if (!fechaVenta || Number.isNaN(Date.parse(fechaVenta))) {
    return 'La fecha de venta es obligatoria';
  }

  for (const item of items) {
    const hasProduct = item.productoId && !Number.isNaN(Number(item.productoId));
    const hasManualName = item.productoNombre && item.productoNombre.trim();

    if (!hasProduct && !hasManualName) {
      return 'Cada item debe tener un producto o un nombre manual';
    }

    if (Number.isNaN(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
      return 'La cantidad de cada item debe ser mayor a 0';
    }

    if (Number.isNaN(Number(item.precioUnitario)) || Number(item.precioUnitario) < 0) {
      return 'El precio unitario de cada item debe ser igual o mayor a 0';
    }
  }

  const subtotal = items.reduce(
    (accumulator, item) => accumulator + Number(item.cantidad) * Number(item.precioUnitario),
    0,
  );
  const totalPagos = pagos.reduce((accumulator, pago) => accumulator + Number(pago.monto || 0), 0);

  if (Math.abs(totalPagos - Number(montoPagado)) > 0.01) {
    return 'La suma de los pagos debe coincidir con el monto pagado';
  }

  if (subtotal - Number(descuento) < 0) {
    return 'El total de la venta no puede ser menor a 0';
  }

  return null;
}

async function listSales(req, res, next) {
  try {
    const sales = await saleModel.listSales(req.query.search || '', req.query.status || 'all');
    return res.status(200).json(buildSalesResponse(sales));
  } catch (error) {
    next(error);
  }
}

async function getSalesSummary(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
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
      return res.status(404).json(buildMessageResponse('Uno de los productos no existe'));
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
        buildMessageResponse('Los pagos informados superan el subtotal cubierto de la venta'),
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
  cancelSale,
};
