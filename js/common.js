// Shared helpers. Hours are stored as a number in card pluginData: scope card, visibility shared, key "hours".
var HOURS_KEY = 'hours';

function parseHours(raw) {
  var s = String(raw == null ? '' : raw).trim().replace(',', '.').replace(/\s*(h|ч|час\w*)\.?$/i, '');
  if (s === '') return null;
  var n = Number(s);
  if (!isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100) / 100;
}

function fmtHours(n) {
  return (Math.round(n * 100) / 100).toString();
}

function fmtHoursRu(n) {
  return fmtHours(n).replace('.', ',');
}
