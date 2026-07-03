function roundToTwo(value) {
  return Number(Number(value).toFixed(2));
}

function roundCurrencyAmount(value) {
  const safeValue = Number(value);

  if (!Number.isFinite(safeValue)) {
    return 0;
  }

  return Math.round(safeValue);
}

function distributeAmountAcrossItems(amount, bases) {
  const safeAmount = roundToTwo(amount);
  const totalBase = bases.reduce((accumulator, value) => accumulator + value, 0);

  if (totalBase <= 0) {
    return bases.map(() => 0);
  }

  const distributed = bases.map((base) => roundToTwo((safeAmount * base) / totalBase));
  const assigned = roundToTwo(distributed.reduce((accumulator, value) => accumulator + value, 0));
  const difference = roundToTwo(safeAmount - assigned);

  if (difference !== 0 && distributed.length) {
    distributed[distributed.length - 1] = roundToTwo(distributed[distributed.length - 1] + difference);
  }

  return distributed;
}

function groupSaleItemsByProduct(items) {
  const groupedItems = new Map();

  for (const item of items) {
    const productId = Number(item.productoId);
    const quantity = Number(item.cantidad);

    if (!groupedItems.has(productId)) {
      groupedItems.set(productId, {
        productoId: productId,
        productoNombre: item.productoNombre || '',
        cantidadTotal: quantity,
      });
      continue;
    }

    groupedItems.get(productId).cantidadTotal += quantity;
  }

  return [...groupedItems.values()];
}

module.exports = {
  distributeAmountAcrossItems,
  groupSaleItemsByProduct,
  roundCurrencyAmount,
  roundToTwo,
};
