const clientModel = require('../models/client.model');
const { buildMessageResponse } = require('../views/auth.view');
const {
  buildClientMessageResponse,
  buildClientResponse,
  buildClientsResponse,
} = require('../views/client.view');
const { isPositiveInteger, isValidEmail, parsePaginationParams } = require('../utils/validation.util');

function validateClientInput({ nombre, email, limiteCredito }) {
  if (!nombre || !nombre.trim()) {
    return 'El nombre del cliente es obligatorio';
  }

  if (nombre.trim().length < 3) {
    return 'El nombre del cliente debe tener al menos 3 caracteres';
  }

  if (email && !isValidEmail(email.trim())) {
    return 'El email del cliente no es valido';
  }

  if (limiteCredito === undefined || Number.isNaN(Number(limiteCredito)) || Number(limiteCredito) < 0) {
    return 'El limite de credito debe ser un numero igual o mayor a 0';
  }

  return null;
}

function validatePurchaseInput({ productoId, productoNombre, cantidad, precioUnitario, montoPagado, fechaCompra }) {
  if (productoId !== undefined && productoId !== null && productoId !== '' && !isPositiveInteger(productoId)) {
    return 'El producto seleccionado no es valido';
  }

  if (!productoId && (!productoNombre || !productoNombre.trim())) {
    return 'Debes indicar un producto para registrar la compra';
  }

  if (cantidad === undefined || Number.isNaN(Number(cantidad)) || Number(cantidad) <= 0) {
    return 'La cantidad debe ser un numero mayor a 0';
  }

  if (precioUnitario === undefined || Number.isNaN(Number(precioUnitario)) || Number(precioUnitario) < 0) {
    return 'El precio unitario debe ser un numero igual o mayor a 0';
  }

  if (montoPagado === undefined || Number.isNaN(Number(montoPagado)) || Number(montoPagado) < 0) {
    return 'El monto pagado debe ser un numero igual o mayor a 0';
  }

  const total = Number(cantidad) * Number(precioUnitario);

  if (Number(montoPagado) > total) {
    return 'El monto pagado no puede superar el total de la compra';
  }

  if (!fechaCompra || Number.isNaN(Date.parse(fechaCompra))) {
    return 'La fecha de compra es obligatoria';
  }

  return null;
}

async function listClients(req, res, next) {
  try {
    const pagination = parsePaginationParams(req.query);
    const result = await clientModel.listClients(
      req.query.search || '',
      req.query.debtStatus || 'all',
      pagination,
    );
    return res
      .status(200)
      .json(buildClientsResponse(result.clients, { ...pagination, total: result.total }));
  } catch (error) {
    next(error);
  }
}

async function getClientById(req, res, next) {
  try {
    const client = await clientModel.findById(Number(req.params.id));

    if (!client) {
      return res.status(404).json(buildMessageResponse('Cliente no encontrado'));
    }

    return res.status(200).json(buildClientResponse(client, 'Cliente obtenido correctamente'));
  } catch (error) {
    next(error);
  }
}

async function createClient(req, res, next) {
  try {
    const validationError = validateClientInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const client = await clientModel.createClient({
      nombre: req.body.nombre.trim(),
      telefono: req.body.telefono?.trim() || '',
      email: req.body.email?.trim() || '',
      direccion: req.body.direccion?.trim() || '',
      documento: req.body.documento?.trim() || '',
      notas: req.body.notas?.trim() || '',
      limiteCredito: Number(req.body.limiteCredito),
    });

    return res.status(201).json(buildClientResponse(client, 'Cliente creado correctamente'));
  } catch (error) {
    next(error);
  }
}

async function updateClient(req, res, next) {
  try {
    const validationError = validateClientInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const client = await clientModel.updateClient(Number(req.params.id), {
      nombre: req.body.nombre.trim(),
      telefono: req.body.telefono?.trim() || '',
      email: req.body.email?.trim() || '',
      direccion: req.body.direccion?.trim() || '',
      documento: req.body.documento?.trim() || '',
      notas: req.body.notas?.trim() || '',
      limiteCredito: Number(req.body.limiteCredito),
    });

    if (!client) {
      return res.status(404).json(buildMessageResponse('Cliente no encontrado'));
    }

    return res.status(200).json(buildClientResponse(client, 'Cliente actualizado correctamente'));
  } catch (error) {
    next(error);
  }
}

async function deleteClient(req, res, next) {
  try {
    const deleted = await clientModel.deleteClient(Number(req.params.id));

    if (!deleted) {
      return res.status(404).json(buildMessageResponse('Cliente no encontrado'));
    }

    return res.status(200).json(buildClientMessageResponse('Cliente eliminado correctamente'));
  } catch (error) {
    next(error);
  }
}

async function createPurchase(req, res, next) {
  try {
    const validationError = validatePurchaseInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const client = await clientModel.findById(Number(req.params.id));

    if (!client) {
      return res.status(404).json(buildMessageResponse('Cliente no encontrado'));
    }

    const result = await clientModel.createPurchase(Number(req.params.id), {
      productoId: req.body.productoId ? Number(req.body.productoId) : null,
      productoNombre: req.body.productoNombre?.trim() || '',
      cantidad: Number(req.body.cantidad),
      precioUnitario: Number(req.body.precioUnitario),
      montoPagado: Number(req.body.montoPagado),
      fechaCompra: req.body.fechaCompra,
      notas: req.body.notas?.trim() || '',
    });

    if (result.error === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Producto no encontrado'));
    }

    const updatedClient = await clientModel.findById(Number(req.params.id));

    return res.status(201).json(buildClientResponse(updatedClient, 'Compra registrada correctamente'));
  } catch (error) {
    next(error);
  }
}

async function updatePurchase(req, res, next) {
  try {
    const validationError = validatePurchaseInput(req.body);

    if (validationError) {
      return res.status(400).json(buildMessageResponse(validationError));
    }

    const result = await clientModel.updatePurchase(Number(req.params.id), Number(req.params.purchaseId), {
      productoId: req.body.productoId ? Number(req.body.productoId) : null,
      productoNombre: req.body.productoNombre?.trim() || '',
      cantidad: Number(req.body.cantidad),
      precioUnitario: Number(req.body.precioUnitario),
      montoPagado: Number(req.body.montoPagado),
      fechaCompra: req.body.fechaCompra,
      notas: req.body.notas?.trim() || '',
    });

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Compra no encontrada para este cliente'));
    }

    if (result.error === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Producto no encontrado'));
    }

    const updatedClient = await clientModel.findById(Number(req.params.id));

    return res.status(200).json(buildClientResponse(updatedClient, 'Compra actualizada correctamente'));
  } catch (error) {
    next(error);
  }
}

async function deletePurchase(req, res, next) {
  try {
    const deleted = await clientModel.deletePurchase(Number(req.params.id), Number(req.params.purchaseId));

    if (!deleted) {
      return res.status(404).json(buildMessageResponse('Compra no encontrada para este cliente'));
    }

    const updatedClient = await clientModel.findById(Number(req.params.id));

    return res.status(200).json(buildClientResponse(updatedClient, 'Compra eliminada correctamente'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  createPurchase,
  updatePurchase,
  deletePurchase,
};
