function sanitizeBarcode(value = '') {
  return String(value).replace(/\D/g, '');
}

function calculateEan13CheckDigit(base12) {
  const sanitized = sanitizeBarcode(base12);

  if (!/^\d{12}$/.test(sanitized)) {
    throw new Error('EAN13_BASE_MUST_HAVE_12_DIGITS');
  }

  const total = sanitized.split('').reduce((sum, digit, index) => {
    const factor = index % 2 === 0 ? 1 : 3;
    return sum + Number(digit) * factor;
  }, 0);

  return String((10 - (total % 10)) % 10);
}

function buildEan13(base12) {
  const sanitized = sanitizeBarcode(base12);
  return `${sanitized}${calculateEan13CheckDigit(sanitized)}`;
}

function isValidEan13(value) {
  const sanitized = sanitizeBarcode(value);

  if (!/^\d{13}$/.test(sanitized)) {
    return false;
  }

  return buildEan13(sanitized.slice(0, 12)) === sanitized;
}

module.exports = {
  buildEan13,
  calculateEan13CheckDigit,
  isValidEan13,
  sanitizeBarcode,
};
