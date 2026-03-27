const saleModel = require('../models/sale.model');
const { buildMessageResponse } = require('../views/auth.view');
const {
  buildSaleMessageResponse,
  buildSaleResponse,
  buildSalesResponse,
  buildSalesSummaryResponse,
} = require('../views/sale.view');

function validateSaleInput({ clientId, descuento, montoPagado, metodoPago, fechaVenta, items }) {
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

  if (!metodoPago || !metodoPago.trim()) {
    return 'El metodo de pago es obligatorio';
  }

  if (!fechaVenta || Number.isNaN(Date.parse(fechaVenta))) {
    return 'La fecha de venta es obligatoria';
  }

  for (const item of items) {
    if (!item.productoId || Number.isNaN(Number(item.productoId))) {
      return 'Cada item debe tener un producto valido';
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
  const total = subtotal - Number(descuento);

  if (total < 0) {
    return 'El descuento no puede superar el subtotal';
  }

  if (Number(montoPagado) > total) {
    return 'El monto pagado no puede superar el total';
  }

  if (total > Number(montoPagado) && !clientId) {
    return 'Para dejar saldo pendiente debes seleccionar un cliente';
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

    const result = await saleModel.createSale({
      clientId: req.body.clientId ? Number(req.body.clientId) : null,
      sellerId: req.user.id,
      descuento: Number(req.body.descuento),
      montoPagado: Number(req.body.montoPagado),
      metodoPago: req.body.metodoPago.trim(),
      notas: req.body.notas?.trim() || '',
      fechaVenta: req.body.fechaVenta,
      items: req.body.items.map((item) => ({
        productoId: Number(item.productoId),
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

    const sale = await saleModel.findById(result.saleId);

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
