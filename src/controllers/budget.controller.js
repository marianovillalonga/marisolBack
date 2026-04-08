const budgetModel = require('../models/budget.model');
const { registerAudit } = require('../utils/audit.util');
const { validateBudgetInput } = require('../utils/document-validation.util');
const { buildMessageResponse } = require('../views/auth.view');
const { buildBudgetResponse, buildBudgetsResponse } = require('../views/budget.view');

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

async function saveDraftBudget(req, res, next) {
  try {
    const validationError = validateBudgetInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const result = await budgetModel.saveDraftBudget({
      budgetId: req.body.budgetId ? Number(req.body.budgetId) : null,
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

    if (result.error === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Uno de los productos no existe'));
    }

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Borrador de presupuesto no encontrado'));
    }

    if (result.error === 'INVALID_STATE') {
      return res.status(409).json(buildMessageResponse('Solo se pueden editar presupuestos en progreso'));
    }

    const budget = await budgetModel.findById(result.budgetId);
    await registerAudit(req, {
      action: req.body.budgetId ? 'presupuesto_borrador_actualizado' : 'presupuesto_borrador_creado',
      entity: 'presupuesto',
      entityId: result.budgetId,
      details: {
        clientId: req.body.clientId ? Number(req.body.clientId) : null,
        total: budget?.total || null,
        items: req.body.items.length,
      },
    });

    return res.status(req.body.budgetId ? 200 : 201).json(buildBudgetResponse(budget, 'Borrador guardado correctamente'));
  } catch (error) {
    next(error);
  }
}

async function confirmDraftBudget(req, res, next) {
  try {
    const result = await budgetModel.confirmDraftBudget({
      budgetId: Number(req.params.id),
      sellerId: req.user.id,
    });

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Borrador de presupuesto no encontrado'));
    }

    if (result.error === 'INVALID_STATE') {
      return res.status(409).json(buildMessageResponse('Solo se pueden confirmar presupuestos en progreso'));
    }

    if (result.error === 'SELLER_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Usuario vendedor no encontrado'));
    }

    if (result.error === 'CLIENT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Cliente no encontrado'));
    }

    const budget = await budgetModel.findById(result.budgetId);
    await registerAudit(req, {
      action: 'presupuesto_borrador_confirmado',
      entity: 'presupuesto',
      entityId: result.budgetId,
      details: {
        total: budget?.total || null,
        items: budget?.items?.length || 0,
      },
    });

    return res.status(200).json(buildBudgetResponse(budget, 'Presupuesto confirmado correctamente'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listBudgets,
  getBudgetById,
  createBudget,
  saveDraftBudget,
  confirmDraftBudget,
};
