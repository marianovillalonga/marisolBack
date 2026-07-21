function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOrderHonoreeVisibility(tipo, mostrarDatosAgasajado) {
  return tipo === 'cliente' && Boolean(mostrarDatosAgasajado);
}

function inferHistoricalOrderHonoreeVisibility(order) {
  return (
    order?.tipo === 'cliente' &&
    (
      hasText(order.agasajadoNombre) ||
      (order.edadAgasajado !== null && order.edadAgasajado !== undefined) ||
      hasText(order.tematica) ||
      Boolean(order.fechaEvento)
    )
  );
}

module.exports = {
  inferHistoricalOrderHonoreeVisibility,
  normalizeOrderHonoreeVisibility,
};
