function roundToNearest50(value) {
  const safeValue = Number(value);

  if (!Number.isFinite(safeValue)) {
    return 0;
  }

  return Math.round(safeValue / 50) * 50;
}

function calculateAdjustedPrice(currentPrice, percentage) {
  const safeCurrentPrice = Number(currentPrice);
  const safePercentage = Number(percentage);

  if (!Number.isFinite(safeCurrentPrice) || !Number.isFinite(safePercentage)) {
    return 0;
  }

  return roundToNearest50(safeCurrentPrice * (1 + safePercentage / 100));
}

module.exports = {
  calculateAdjustedPrice,
  roundToNearest50,
};
