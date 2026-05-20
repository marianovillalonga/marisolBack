function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function getDateOnlyString(value = new Date()) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);

  return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`;
}

function addDaysToDateOnly(dateString, days) {
  const baseDate = new Date(`${getDateOnlyString(dateString)}T00:00:00.000Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + Number(days));
  return getDateOnlyString(baseDate);
}

module.exports = {
  addDaysToDateOnly,
  getDateOnlyString,
};
