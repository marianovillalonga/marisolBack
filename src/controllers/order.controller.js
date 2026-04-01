const orderModel = require('../models/order.model');
const { registerAudit } = require('../utils/audit.util');
const { buildMessageResponse } = require('../views/auth.view');
const {
  buildOrderResponse,
  buildOrdersResponse,
} = require('../views/order.view');

function validateOrderInput({ fechaPedido, items }) {
  if (!fechaPedido || Number.isNaN(Date.parse(fechaPedido))) {
    return 'La fecha del pedido es obligatoria';
  }

  if (!Array.isArray(items) || items.length === 0) {
    return 'Debes agregar al menos un producto al pedido';
  }

  for (const item of items) {
    if (!item.productoId || Number.isNaN(Number(item.productoId))) {
      return 'Cada item debe tener un producto valido';
    }

    if (Number.isNaN(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
      return 'La cantidad de cada item debe ser mayor a 0';
    }
  }

  return null;
}

async function listOrders(req, res, next) {
  try {
    const orders = await orderModel.listOrders(req.query.search || '');
    return res.status(200).json(buildOrdersResponse(orders));
  } catch (error) {
    next(error);
  }
}

async function getOrderById(req, res, next) {
  try {
    const order = await orderModel.findById(Number(req.params.id));

    if (!order) {
      return res.status(404).json(buildMessageResponse('Pedido no encontrado'));
    }

    return res.status(200).json(buildOrderResponse(order, 'Pedido obtenido correctamente'));
  } catch (error) {
    next(error);
  }
}

async function createOrder(req, res, next) {
  try {
    const validationError = validateOrderInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const result = await orderModel.createOrder({
      userId: req.user.id,
      fechaPedido: req.body.fechaPedido,
      notas: req.body.notas?.trim?.() || '',
      items: req.body.items.map((item) => ({
        productoId: Number(item.productoId),
        cantidad: Number(item.cantidad),
      })),
    });

    if (result.error === 'USER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario no encontrado'));
    }

    if (result.error === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Uno de los productos no existe'));
    }

    const order = await orderModel.findById(result.orderId);

    await registerAudit(req, {
      action: 'pedido_creado',
      entity: 'pedido',
      entityId: result.orderId,
      details: {
        items: req.body.items.length,
        cantidadTotal: req.body.items.reduce(
          (accumulator, item) => accumulator + Number(item.cantidad || 0),
          0,
        ),
      },
    });

    return res.status(201).json(buildOrderResponse(order, 'Pedido registrado correctamente'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listOrders,
  getOrderById,
  createOrder,
};
