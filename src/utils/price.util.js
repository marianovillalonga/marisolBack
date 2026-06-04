function roundPriceToHundreds(value) {
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

module.exports = {
  roundPriceToHundreds,
};
