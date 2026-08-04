const PRICE_ROUNDING_INCREMENT = 100;

function roundToNearest100(value) {
  const safeValue = Number(value);

  if (!Number.isFinite(safeValue)) {
    return 0;
  }

  return Math.round(safeValue / PRICE_ROUNDING_INCREMENT) * PRICE_ROUNDING_INCREMENT;
}

function calculateAdjustedPrice(currentPrice, percentage) {
  const safeCurrentPrice = Number(currentPrice);
  const safePercentage = Number(percentage);

  if (!Number.isFinite(safeCurrentPrice) || !Number.isFinite(safePercentage)) {
    return 0;
  }

  return roundToNearest100(safeCurrentPrice * (1 + safePercentage / 100));
}

module.exports = {
  calculateAdjustedPrice,
  roundToNearest100,
};
