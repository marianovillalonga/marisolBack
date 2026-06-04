function roundToTwo(value) {
  return Number(Number(value).toFixed(2));
}

function roundAmountToHundreds(value) {
  const safeValue = Number(value);

  if (!Number.isFinite(safeValue)) {
    return 0;
  }

  const sign = safeValue < 0 ? -1 : 1;
  const normalizedValue = Math.round(Math.abs(safeValue));
  const lastTwoDigits = normalizedValue % 100;
  const roundedValue =
    lastTwoDigits <= 50
      ? normalizedValue - lastTwoDigits
      : normalizedValue + (100 - lastTwoDigits);

  return roundedValue * sign;
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
  roundAmountToHundreds,
  roundToTwo,
};
