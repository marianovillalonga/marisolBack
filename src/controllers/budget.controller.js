const budgetModel = require('../models/budget.model');
const { registerAudit } = require('../utils/audit.util');
const { buildMessageResponse } = require('../views/auth.view');
const { buildBudgetResponse, buildBudgetsResponse } = require('../views/budget.view');

function validateBudgetInput({
  clientId,
  descuento,
  ajusteMetodoPago = 0,
  metodoPago,
  fechaEmision,
  diasValidez,
  items,
}) {
  if (clientId !== null && clientId !== undefined && Number.isNaN(Number(clientId))) {
    return 'El cliente seleccionado no es valido';
  }

  if (!Array.isArray(items) || items.length === 0) {
    return 'Debes agregar al menos un producto al presupuesto';
  }

  if (Number.isNaN(Number(descuento)) || Number(descuento) < 0) {
    return 'El descuento debe ser un numero igual o mayor a 0';
  }

  if (Number.isNaN(Number(ajusteMetodoPago))) {
    return 'El ajuste por metodo de pago debe ser un numero valido';
  }

  if (!metodoPago || !metodoPago.trim()) {
    return 'El metodo de pago es obligatorio';
  }

  if (!fechaEmision || Number.isNaN(Date.parse(fechaEmision))) {
    return 'La fecha de emision es obligatoria';
  }

  if (Number.isNaN(Number(diasValidez)) || Number(diasValidez) <= 0) {
    return 'Los dias de validez deben ser mayores a 0';
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
  const total = subtotal + Number(ajusteMetodoPago) - Number(descuento);

  if (total < 0) {
    return 'El total del presupuesto no puede ser menor a 0';
  }

  return null;
}

async function listBudgets(req, res, next) {
  try {
    const budgets = await budgetModel.listBudgets(req.query.search || '', req.query.status || 'all');
    return res.status(200).json(buildBudgetsResponse(budgets));
  } catch (error) {
    next(error);
  }
}

async function getBudgetById(req, res, next) {
  try {
    const budget = await budgetModel.findById(Number(req.params.id));

    if (!budget) {
      return res.status(404).json(buildMessageResponse('Presupuesto no encontrado'));
    }

    return res.status(200).json(buildBudgetResponse(budget, 'Presupuesto obtenido correctamente'));
  } catch (error) {
    next(error);
  }
}

async function createBudget(req, res, next) {
  try {
    const validationError = validateBudgetInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const result = await budgetModel.createBudget({
      clientId: req.body.clientId ? Number(req.body.clientId) : null,
      sellerId: req.user.id,
      descuento: Number(req.body.descuento),
      ajusteMetodoPago: Number(req.body.ajusteMetodoPago || 0),
      ajusteMetodoPagoTipo: req.body.ajusteMetodoPagoTipo?.trim?.() || null,
      ajusteMetodoPagoPorcentaje: Number(req.body.ajusteMetodoPagoPorcentaje || 0),
      metodoPago: req.body.metodoPago.trim(),
      notas: req.body.notas?.trim() || '',
      fechaEmision: req.body.fechaEmision,
      diasValidez: Number(req.body.diasValidez),
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

    const budget = await budgetModel.findById(result.budgetId);
    await registerAudit(req, {
      action: 'presupuesto_creado',
      entity: 'presupuesto',
      entityId: result.budgetId,
      details: {
        clientId: req.body.clientId ? Number(req.body.clientId) : null,
        total: budget?.total || null,
        metodoPago: req.body.metodoPago.trim(),
        items: req.body.items.length,
        diasValidez: Number(req.body.diasValidez),
      },
    });
    return res.status(201).json(buildBudgetResponse(budget, 'Presupuesto creado correctamente'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listBudgets,
  getBudgetById,
  createBudget,
};
