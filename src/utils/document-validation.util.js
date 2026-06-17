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

function isNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0;
}

function toTimestamp(value) {
  return new Date(value).getTime();
}

function hasMinLength(value, length) {
  return isNonEmptyString(value) && value.trim().length >= length;
}

function hasMaxLength(value, length) {
  return value === undefined || value === null || String(value).trim().length <= length;
}

function isValidPhone(value) {
  return /^[0-9+\-() ]{8,20}$/.test(String(value || '').trim());
}

const allowedPaymentMethods = [
  'debito',
  'efectivo',
  'transferencia',
  'tarjeta',
  'cuenta_corriente',
  'pendiente',
  'mixto',
];

function validateDocumentItems(
  items,
  { emptyMessage, missingProductMessage, quantityMessage, priceMessage, manualNameMinLengthMessage, manualNameMaxLengthMessage },
) {
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

    if (!hasProduct && hasManualName && !hasMinLength(item?.productoNombre, 3)) {
      return manualNameMinLengthMessage || 'La descripcion manual debe tener al menos 3 caracteres';
    }

    if (hasManualName && !hasMaxLength(item?.productoNombre, 250)) {
      return manualNameMaxLengthMessage || 'La descripcion manual no puede superar los 250 caracteres';
    }

    if (!hasMaxLength(item?.descripcion, 500)) {
      return 'La descripcion adicional del item no puede superar los 500 caracteres';
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

function validateSaleInput({ clientId, descuento, montoPagado, pagos = [], fechaVenta, notas, items }) {
  const clientError = validateClientId(clientId);

  if (clientError) {
    return clientError;
  }

  const itemsError = validateDocumentItems(items, {
    emptyMessage: 'Debes agregar al menos un producto a la venta',
    missingProductMessage: 'Cada item debe tener un producto o un nombre manual',
    quantityMessage: 'La cantidad de cada item debe ser mayor a 0',
    priceMessage: 'El precio unitario de cada item debe ser igual o mayor a 0',
    manualNameMinLengthMessage: 'La descripcion manual debe tener al menos 3 caracteres',
    manualNameMaxLengthMessage: 'La descripcion manual no puede superar los 250 caracteres',
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

    if (!allowedPaymentMethods.includes(String(pago.metodo).trim().toLowerCase())) {
      return 'Uno de los metodos de pago informados no es valido';
    }

    if (!isPositiveNumber(pago?.monto)) {
      return 'Cada pago debe tener un monto mayor a 0';
    }
  }

  if (!isValidDate(fechaVenta)) {
    return 'La fecha de venta es obligatoria';
  }

  if (!hasMaxLength(clientId, 20)) {
    return 'El identificador del cliente no es valido';
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

  if (!hasMaxLength(notas, 1000)) {
    return 'Las notas no pueden superar los 1000 caracteres';
  }

  return null;
}

function validateBudgetInput({
  clientId,
  descuento,
  ajusteMetodoPago = 0,
  metodoPago,
  notas,
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
    manualNameMinLengthMessage: 'La descripcion manual debe tener al menos 3 caracteres',
    manualNameMaxLengthMessage: 'La descripcion manual no puede superar los 250 caracteres',
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

  if (!allowedPaymentMethods.includes(String(metodoPago).trim().toLowerCase())) {
    return 'El metodo de pago informado no es valido';
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

  if (!hasMaxLength(notas, 1000)) {
    return 'Las notas no pueden superar los 1000 caracteres';
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
    manualNameMinLengthMessage: 'La descripcion manual debe tener al menos 3 caracteres',
    manualNameMaxLengthMessage: 'La descripcion manual no puede superar los 250 caracteres',
  });
}

function validateCustomerOrderInput({
  clientId,
  fechaPedido,
  fechaEvento,
  fechaEntrega,
  clienteNombre,
  clienteTelefono,
  agasajadoNombre,
  edadAgasajado,
  tematica,
  montoEntregado = 0,
  notas,
  items,
}) {
  const clientError = validateClientId(clientId);

  if (clientError) {
    return clientError;
  }

  if (!isValidDate(fechaPedido)) {
    return 'La fecha del pedido es obligatoria';
  }

  if (!isValidDate(fechaEvento)) {
    return 'La fecha del evento es obligatoria';
  }

  if (!isValidDate(fechaEntrega)) {
    return 'La fecha de entrega es obligatoria';
  }

  if (toTimestamp(fechaPedido) > toTimestamp(fechaEvento)) {
    return 'La fecha del pedido no puede ser posterior a la fecha del evento';
  }

  if (toTimestamp(fechaPedido) > toTimestamp(fechaEntrega)) {
    return 'La fecha del pedido no puede ser posterior a la fecha de entrega';
  }

  if (toTimestamp(fechaEntrega) > toTimestamp(fechaEvento)) {
    return 'La fecha de entrega no puede ser posterior a la fecha del evento';
  }

  if (!isNonEmptyString(clienteNombre)) {
    return 'El nombre del cliente es obligatorio';
  }

  if (!hasMaxLength(clienteNombre, 150)) {
    return 'El nombre del cliente no puede superar los 150 caracteres';
  }

  if (!isNonEmptyString(agasajadoNombre)) {
    return 'El nombre del agasajado es obligatorio';
  }

  if (!hasMaxLength(agasajadoNombre, 150)) {
    return 'El nombre del agasajado no puede superar los 150 caracteres';
  }

  if (!isNonEmptyString(clienteTelefono)) {
    return 'El telefono del cliente es obligatorio';
  }

  if (!isValidPhone(clienteTelefono)) {
    return 'El telefono del cliente no es valido';
  }

  if (
    edadAgasajado !== undefined &&
    edadAgasajado !== null &&
    edadAgasajado !== '' &&
    !isNonNegativeInteger(edadAgasajado)
  ) {
    return 'La edad del agasajado debe ser un numero entero mayor o igual a 0';
  }

  const itemsError = validateDocumentItems(items, {
    emptyMessage: 'Debes agregar al menos un producto al pedido',
    missingProductMessage: 'Cada item del pedido debe tener un producto o una descripcion',
    quantityMessage: 'La cantidad de cada item debe ser mayor a 0',
    priceMessage: 'El precio de cada item debe ser mayor o igual a 0',
    manualNameMinLengthMessage: 'La descripcion manual debe tener al menos 3 caracteres',
    manualNameMaxLengthMessage: 'La descripcion manual no puede superar los 250 caracteres',
  });

  if (itemsError) {
    return itemsError;
  }

  if (!isNonNegativeNumber(montoEntregado)) {
    return 'El monto entregado debe ser mayor o igual a 0';
  }

  const totalPedido = items.reduce(
    (accumulator, item) => accumulator + Number(item.cantidad) * Number(item.costoUnitario),
    0,
  );

  if (Number(montoEntregado) - totalPedido > 0.01) {
    return 'El monto entregado no puede superar el total del pedido';
  }

  if (!hasMaxLength(tematica, 150)) {
    return 'La tematica no puede superar los 150 caracteres';
  }

  if (!hasMaxLength(notas, 1000)) {
    return 'Las notas no pueden superar los 1000 caracteres';
  }

  return null;
}

function validateCustomerOrderUpdateInput({ estado, montoEntregado, metodoPago }) {
  const normalizedEstado = estado === undefined || estado === null ? '' : String(estado).trim().toLowerCase();

  if (
    normalizedEstado &&
    !['pendiente', 'hecho', 'entregado'].includes(normalizedEstado)
  ) {
    return 'El estado informado no es valido';
  }

  if (
    montoEntregado !== undefined &&
    montoEntregado !== null &&
    montoEntregado !== '' &&
    !isNonNegativeNumber(montoEntregado)
  ) {
    return 'El monto entregado debe ser mayor o igual a 0';
  }

  if (normalizedEstado === 'entregado' && !isNonEmptyString(metodoPago)) {
    return 'Debes indicar la forma de pago para marcar el pedido como entregado';
  }

  if (isNonEmptyString(metodoPago) && !hasMaxLength(metodoPago, 50)) {
    return 'La forma de pago informada no es valida';
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
  validateCustomerOrderUpdateInput,
  validateDocumentItems,
  validateOrderInput,
  validateProviderOrderInput,
  validateSaleInput,
};
