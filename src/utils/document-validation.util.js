const { isNonEmptyString, isPositiveInteger } = require('./validation.util');

function isValidDate(value) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isNonNegativeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0;
}

function isPositiveNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0;
}

function validateDocumentItems(items, { emptyMessage, missingProductMessage, quantityMessage, priceMessage }) {
  if (!Array.isArray(items) || items.length === 0) {
    return emptyMessage;
  }

  for (const item of items) {
    const hasProduct =
      item?.productoId !== undefined &&
      item?.productoId !== null &&
      item?.productoId !== '' &&
      isPositiveInteger(item.productoId);
    const hasManualName = isNonEmptyString(item?.productoNombre);

    if (!hasProduct && !hasManualName) {
      return missingProductMessage;
    }

    if (!isPositiveNumber(item?.cantidad)) {
      return quantityMessage;
    }

    if (!isNonNegativeNumber(item?.precioUnitario ?? item?.costoUnitario)) {
      return priceMessage;
    }
  }

  return null;
}

function validateClientId(clientId) {
  if (
    clientId !== null &&
    clientId !== undefined &&
    clientId !== '' &&
    !isPositiveInteger(clientId)
  ) {
    return 'El cliente seleccionado no es valido';
  }

  return null;
}

function validateSaleInput({ clientId, descuento, montoPagado, pagos = [], fechaVenta, items }) {
  const clientError = validateClientId(clientId);

  if (clientError) {
    return clientError;
  }

  const itemsError = validateDocumentItems(items, {
    emptyMessage: 'Debes agregar al menos un producto a la venta',
    missingProductMessage: 'Cada item debe tener un producto o un nombre manual',
    quantityMessage: 'La cantidad de cada item debe ser mayor a 0',
    priceMessage: 'El precio unitario de cada item debe ser igual o mayor a 0',
  });

  if (itemsError) {
    return itemsError;
  }

  if (!isNonNegativeNumber(descuento)) {
    return 'El descuento debe ser un numero igual o mayor a 0';
  }

  if (!isNonNegativeNumber(montoPagado)) {
    return 'El monto pagado debe ser un numero igual o mayor a 0';
  }

  if (!Array.isArray(pagos)) {
    return 'Los pagos informados no son validos';
  }

  for (const pago of pagos) {
    if (!isNonEmptyString(pago?.metodo)) {
      return 'Cada pago debe tener un metodo valido';
    }

    if (!isPositiveNumber(pago?.monto)) {
      return 'Cada pago debe tener un monto mayor a 0';
    }
  }

  if (!isValidDate(fechaVenta)) {
    return 'La fecha de venta es obligatoria';
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

function validateBudgetInput({
  clientId,
  descuento,
  ajusteMetodoPago = 0,
  metodoPago,
  fechaEmision,
  diasValidez,
  items,
}) {
  const clientError = validateClientId(clientId);

  if (clientError) {
    return clientError;
  }

  const itemsError = validateDocumentItems(items, {
    emptyMessage: 'Debes agregar al menos un producto al presupuesto',
    missingProductMessage: 'Cada item debe tener un producto o un nombre manual',
    quantityMessage: 'La cantidad de cada item debe ser mayor a 0',
    priceMessage: 'El precio unitario de cada item debe ser igual o mayor a 0',
  });

  if (itemsError) {
    return itemsError;
  }

  if (!isNonNegativeNumber(descuento)) {
    return 'El descuento debe ser un numero igual o mayor a 0';
  }

  if (!Number.isFinite(Number(ajusteMetodoPago))) {
    return 'El ajuste por metodo de pago debe ser un numero valido';
  }

  if (!isNonEmptyString(metodoPago)) {
    return 'El metodo de pago es obligatorio';
  }

  if (!isValidDate(fechaEmision)) {
    return 'La fecha de emision es obligatoria';
  }

  if (!isPositiveInteger(diasValidez)) {
    return 'Los dias de validez deben ser mayores a 0';
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

function validateProviderOrderInput({ fechaPedido, items }) {
  if (!isValidDate(fechaPedido)) {
    return 'La fecha del pedido es obligatoria';
  }

  return validateDocumentItems(items, {
    emptyMessage: 'Debes agregar al menos un producto al pedido',
    missingProductMessage: 'Cada item debe tener un producto o una descripcion',
    quantityMessage: 'La cantidad de cada item debe ser mayor a 0',
    priceMessage: 'El costo de cada item debe ser mayor o igual a 0',
  });
}

function validateCustomerOrderInput({
  fechaPedido,
  fechaEvento,
  fechaEntrega,
  clienteNombre,
  agasajadoNombre,
  edadAgasajado,
  montoEntregado = 0,
  items,
}) {
  if (!isValidDate(fechaPedido)) {
    return 'La fecha del pedido es obligatoria';
  }

  if (!isValidDate(fechaEvento)) {
    return 'La fecha del evento es obligatoria';
  }

  if (!isValidDate(fechaEntrega)) {
    return 'La fecha de entrega es obligatoria';
  }

  if (!isNonEmptyString(clienteNombre)) {
    return 'El nombre del cliente es obligatorio';
  }

  if (!isNonEmptyString(agasajadoNombre)) {
    return 'El nombre del agasajado es obligatorio';
  }

  if (
    edadAgasajado !== undefined &&
    edadAgasajado !== null &&
    edadAgasajado !== '' &&
    !isNonNegativeNumber(edadAgasajado)
  ) {
    return 'La edad del agasajado no es valida';
  }

  const itemsError = validateDocumentItems(items, {
    emptyMessage: 'Debes agregar al menos un producto al pedido',
    missingProductMessage: 'Cada item del pedido debe tener un producto o una descripcion',
    quantityMessage: 'La cantidad de cada item debe ser mayor a 0',
    priceMessage: 'El precio de cada item debe ser mayor o igual a 0',
  });

  if (itemsError) {
    return itemsError;
  }

  if (!isNonNegativeNumber(montoEntregado)) {
    return 'El monto entregado debe ser mayor o igual a 0';
  }

  return null;
}

function validateOrderInput(body) {
  return body.tipo === 'cliente'
    ? validateCustomerOrderInput(body)
    : validateProviderOrderInput(body);
}

module.exports = {
  validateBudgetInput,
  validateCustomerOrderInput,
  validateDocumentItems,
  validateOrderInput,
  validateProviderOrderInput,
  validateSaleInput,
};
