const orderModel = require('../models/order.model');
const { registerAudit } = require('../utils/audit.util');
const { validateCustomerOrderUpdateInput, validateOrderInput } = require('../utils/document-validation.util');
const { parsePaginationParams } = require('../utils/validation.util');
const { buildMessageResponse } = require('../views/auth.view');
const {
  buildOrderResponse,
  buildOrdersResponse,
} = require('../views/order.view');

async function listOrders(req, res, next) {
  try {
    const pagination = parsePaginationParams(req.query);
    const result = await orderModel.listOrders(req.query.search || '', pagination);
    return res
      .status(200)
      .json(buildOrdersResponse(result.orders, { ...pagination, total: result.total }));
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

    const tipo = req.body.tipo === 'cliente' ? 'cliente' : 'proveedor';
    const result = await orderModel.createOrder({
      userId: req.user.id,
      tipo,
      fechaPedido: req.body.fechaPedido,
      fechaEvento: req.body.fechaEvento || null,
      fechaEntrega: req.body.fechaEntrega || null,
      clienteNombre: req.body.clienteNombre?.trim?.() || '',
      clienteTelefono: req.body.clienteTelefono?.trim?.() || '',
      agasajadoNombre: req.body.agasajadoNombre?.trim?.() || '',
      edadAgasajado:
        req.body.edadAgasajado === undefined || req.body.edadAgasajado === null || req.body.edadAgasajado === ''
          ? null
          : Number(req.body.edadAgasajado),
      tematica: req.body.tematica?.trim?.() || '',
      montoEntregado: Number(req.body.montoEntregado || 0),
      notas: req.body.notas?.trim?.() || '',
      items: req.body.items.map((item) => ({
        productoId: item.productoId ? Number(item.productoId) : null,
        productoNombre: item.productoNombre?.trim?.() || '',
        cantidad: Number(item.cantidad),
        costoUnitario: Number(item.costoUnitario),
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
      action: tipo === 'cliente' ? 'pedido_cliente_creado' : 'pedido_creado',
      entity: 'pedido',
      entityId: result.orderId,
      details: {
        tipo,
        estado: order?.estado || null,
        items: req.body.items.length,
        cantidadTotal: req.body.items.reduce(
          (accumulator, item) => accumulator + Number(item.cantidad || 0),
          0,
        ),
        montoTotal: req.body.items.reduce(
          (accumulator, item) =>
            accumulator + Number(item.cantidad || 0) * Number(item.costoUnitario || 0),
          0,
        ),
      },
    });

    return res.status(201).json(buildOrderResponse(order, 'Pedido registrado correctamente'));
  } catch (error) {
    next(error);
  }
}

async function saveDraftOrder(req, res, next) {
  try {
    const validationError = validateOrderInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const tipo = req.body.tipo === 'cliente' ? 'cliente' : 'proveedor';
    const result = await orderModel.saveDraftOrder({
      orderId: req.body.orderId ? Number(req.body.orderId) : null,
      userId: req.user.id,
      tipo,
      fechaPedido: req.body.fechaPedido,
      fechaEvento: req.body.fechaEvento || null,
      fechaEntrega: req.body.fechaEntrega || null,
      clienteNombre: req.body.clienteNombre?.trim?.() || '',
      clienteTelefono: req.body.clienteTelefono?.trim?.() || '',
      agasajadoNombre: req.body.agasajadoNombre?.trim?.() || '',
      edadAgasajado:
        req.body.edadAgasajado === undefined || req.body.edadAgasajado === null || req.body.edadAgasajado === ''
          ? null
          : Number(req.body.edadAgasajado),
      tematica: req.body.tematica?.trim?.() || '',
      montoEntregado: Number(req.body.montoEntregado || 0),
      notas: req.body.notas?.trim?.() || '',
      items: req.body.items.map((item) => ({
        productoId: item.productoId ? Number(item.productoId) : null,
        productoNombre: item.productoNombre?.trim?.() || '',
        cantidad: Number(item.cantidad),
        costoUnitario: Number(item.costoUnitario),
      })),
    });

    if (result.error === 'USER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario no encontrado'));
    }

    if (result.error === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Uno de los productos no existe'));
    }

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Borrador de pedido no encontrado'));
    }

    if (result.error === 'INVALID_STATE') {
      return res.status(409).json(buildMessageResponse('Solo se pueden editar pedidos en progreso'));
    }

    const order = await orderModel.findById(result.orderId);

    await registerAudit(req, {
      action: req.body.orderId ? 'pedido_borrador_actualizado' : 'pedido_borrador_creado',
      entity: 'pedido',
      entityId: result.orderId,
      details: {
        tipo,
        estado: order?.estado || null,
        items: req.body.items.length,
      },
    });

    return res.status(req.body.orderId ? 200 : 201).json(buildOrderResponse(order, 'Borrador guardado correctamente'));
  } catch (error) {
    next(error);
  }
}

async function confirmDraftOrder(req, res, next) {
  try {
    const result = await orderModel.confirmDraftOrder({
      orderId: Number(req.params.id),
      userId: req.user.id,
    });

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Borrador de pedido no encontrado'));
    }

    if (result.error === 'INVALID_STATE') {
      return res.status(409).json(buildMessageResponse('Solo se pueden confirmar pedidos en progreso'));
    }

    if (result.error === 'USER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario no encontrado'));
    }

    if (result.error === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Uno de los productos no existe'));
    }

    const order = await orderModel.findById(result.orderId);

    await registerAudit(req, {
      action: 'pedido_borrador_confirmado',
      entity: 'pedido',
      entityId: result.orderId,
      details: {
        tipo: order?.tipo || null,
        estado: order?.estado || null,
      },
    });

    return res.status(200).json(buildOrderResponse(order, 'Pedido confirmado correctamente'));
  } catch (error) {
    next(error);
  }
}

async function updateCustomerOrder(req, res, next) {
  try {
    const validationError = validateCustomerOrderUpdateInput({
      estado: req.body.estado,
      montoEntregado: req.body.montoEntregado,
      metodoPago: req.body.metodoPago,
    });

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const result = await orderModel.updateCustomerOrder({
      orderId: Number(req.params.id),
      userId: req.user.id,
      estado: req.body.estado?.trim?.() || null,
      montoEntregado: req.body.montoEntregado,
      metodoPago: req.body.metodoPago?.trim?.() || null,
    });

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Pedido no encontrado'));
    }

    if (result.error === 'INVALID_TYPE') {
      return res.status(400).json(buildMessageResponse('Solo los pedidos de clientes se pueden actualizar desde este flujo'));
    }

    if (result.error === 'BALANCE_PENDING') {
      return res.status(400).json(buildMessageResponse('Falta completar la entrega antes de marcar como entregado'));
    }

    if (result.error === 'EXCESS_DELIVERY_AMOUNT') {
      return res.status(400).json(buildMessageResponse('El monto entregado no puede superar el total del pedido'));
    }

    if (result.error === 'INVALID_STATUS_TRANSITION') {
      return res.status(400).json(buildMessageResponse('No se puede realizar ese cambio de estado en el pedido'));
    }

    if (result.error === 'ALREADY_DELIVERED') {
      return res.status(409).json(buildMessageResponse('El pedido ya fue entregado y no admite una segunda confirmacion'));
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

    if (result.error === 'INVALID_PAYMENT_SPLIT') {
      return res.status(400).json(buildMessageResponse('No se pudo registrar la entrega con la forma de pago informada'));
    }

    const order = await orderModel.findById(result.orderId);

    await registerAudit(req, {
      action: 'pedido_cliente_actualizado',
      entity: 'pedido',
      entityId: result.orderId,
      details: {
        estado: order?.estado || null,
        montoEntregado: order?.montoEntregado || null,
        saldoPendiente: order?.saldoPendiente || null,
        ventaId: order?.ventaId || null,
      },
    });

    return res.status(200).json(buildOrderResponse(order, 'Pedido actualizado correctamente'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listOrders,
  getOrderById,
  createOrder,
  saveDraftOrder,
  confirmDraftOrder,
  updateCustomerOrder,
};
