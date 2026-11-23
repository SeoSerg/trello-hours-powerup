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

// Planyway keeps its estimate in a link in the card description (zlib + base64 JSON, customData.estimationHours).
// We only READ it. Cached by description text.
var _pwCache = new Map();
function planywayHours(desc) {
  var m = (desc || '').match(/planyway\.com\/?\?cardData=([A-Za-z0-9+/=_%-]+)/);
  if (!m) return Promise.resolve(null);
  if (_pwCache.has(m[1])) return _pwCache.get(m[1]);
  var p;
  try {
    var b64 = decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    p = new Response(stream).text().then(function (s) {
      var h = JSON.parse(s).customData.estimationHours;
      return typeof h === 'number' && isFinite(h) && h > 0 ? Math.round(h * 100) / 100 : null;
    }).catch(function () { return null; });
  } catch (e) { p = Promise.resolve(null); }
  _pwCache.set(m[1], p);
  return p;
}

// Effective hours: own value if set (0 = explicitly cleared), otherwise Planyway estimate.
function effectiveHours(own, desc) {
  if (typeof own === 'number') return Promise.resolve(own > 0 ? own : null);
  return planywayHours(desc);
}
