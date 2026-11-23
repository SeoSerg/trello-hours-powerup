/* global TrelloPowerUp, HOURS_KEY, fmtHoursRu */
var t = TrelloPowerUp.iframe();
var $ = function (id) { return document.getElementById(id); };
var plan = null;

$('file').onchange = function () {
  var f = this.files[0]; if (!f) return;
  f.text().then(function (s) { $('json').value = s; });
};

function parseInput() {
  var data;
  try { data = JSON.parse($('json').value); } catch (e) { throw new Error('Это не JSON: ' + e.message); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Ожидается объект {"idКарточки": часы}.');
  var out = {}, bad = [];
  Object.keys(data).forEach(function (id) {
    var v = data[id];
    if (!/^[0-9a-f]{24}$/.test(id) || typeof v !== 'number' || !isFinite(v) || v < 0) bad.push(id); else out[id] = Math.round(v * 100) / 100;
  });
  if (bad.length) throw new Error('Неверные записи (' + bad.length + '): ' + bad.slice(0, 5).join(', ') + (bad.length > 5 ? '…' : ''));
  if (!Object.keys(out).length) throw new Error('Пусто.');
  return out;
}

function readAll(ids) {
  var res = {}, i = 0;
  function next() {
    var chunk = ids.slice(i, i + 50); i += 50;
    if (!chunk.length) return Promise.resolve(res);
    return Promise.all(chunk.map(function (id) {
      return t.get(id, 'shared', HOURS_KEY).then(function (h) { res[id] = typeof h === 'number' ? h : null; });
    })).then(next);
  }
  return next();
}

$('check').onclick = function () {
  $('err1').textContent = '';
  var input;
  try { input = parseInput(); } catch (e) { $('err1').textContent = e.message; return; }
  $('check').disabled = true;
  t.cards('id', 'name').then(function (cards) {
    var names = {}; cards.forEach(function (c) { names[c.id] = c.name; });
    var boardIds = cards.map(function (c) { return c.id; });
    return readAll(boardIds).then(function (current) {
      plan = { add: [], same: [], conflict: [], missing: [], names: names };
      Object.keys(input).forEach(function (id) {
        if (!(id in names)) plan.missing.push(id);
        else if (current[id] == null) plan.add.push({ id: id, v: input[id] });
        else if (current[id] === input[id]) plan.same.push(id);
        else plan.conflict.push({ id: id, v: input[id], old: current[id] });
      });
      var backup = {}; Object.keys(current).forEach(function (id) { if (current[id] != null) backup[id] = current[id]; });
      $('backup').value = JSON.stringify(backup, null, 1);
      showPlan();
    });
  }).catch(function (e) { $('err1').textContent = 'Ошибка: ' + (e && e.message || e); })
    .then(function () { $('check').disabled = false; });
};

function showPlan() {
  $('plan').innerHTML = '';
  var lines = [
    ['Новые часы (на карточке пусто)', plan.add.length],
    ['Уже совпадают — пропуск', plan.same.length],
    ['На карточке другие часы', plan.conflict.length],
    ['Нет среди открытых карточек этой доски (архив или другая доска) — пропуск', plan.missing.length]
  ];
  lines.forEach(function (l) { var d = document.createElement('div'); d.textContent = l[0] + ': ' + l[1]; $('plan').appendChild(d); });
  $('overwriteWrap').hidden = !plan.conflict.length;
  $('overwrite').checked = false;
  var c = $('conflicts'); c.innerHTML = '';
  if (plan.conflict.length) {
    var tbl = document.createElement('table');
    tbl.innerHTML = '<thead><tr><th>Карточка</th><th class="num">Сейчас</th><th class="num">В файле</th></tr></thead>';
    var tb = document.createElement('tbody');
    plan.conflict.forEach(function (x) {
      var tr = document.createElement('tr');
      [plan.names[x.id], fmtHoursRu(x.old), fmtHoursRu(x.v)].forEach(function (v, i) { var td = document.createElement('td'); td.textContent = v; if (i) td.className = 'num'; tr.appendChild(td); });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); c.appendChild(tbl);
  }
  updateRunLabel();
  $('step1').hidden = true; $('step2').hidden = false;
}

function toWrite() { return plan.add.concat($('overwrite').checked ? plan.conflict : []); }
function updateRunLabel() { var n = toWrite().length; $('run').textContent = 'Записать: ' + n + ' карт.'; $('run').disabled = !n; }
$('overwrite').onchange = updateRunLabel;
$('back').onclick = function () { $('step2').hidden = true; $('step1').hidden = false; };

function setWithRetry(x, attempt) {
  return t.set(x.id, 'shared', HOURS_KEY, x.v).catch(function (e) {
    if (attempt >= 4) throw e;
    return new Promise(function (r) { setTimeout(r, 1000 * Math.pow(2, attempt)); }).then(function () { return setWithRetry(x, attempt + 1); });
  });
}

$('run').onclick = function () {
  var items = toWrite(), done = 0, failed = [];
  $('step2').hidden = true; $('step3').hidden = false;
  $('prog').max = items.length;
  var i = 0;
  function worker() {
    if (i >= items.length) return Promise.resolve();
    var x = items[i++];
    return setWithRetry(x, 0).catch(function (e) { failed.push({ x: x, e: e && e.message || String(e) }); })
      .then(function () { done++; $('prog').value = done; $('progText').textContent = done + ' из ' + items.length; })
      .then(function () { return new Promise(function (r) { setTimeout(r, 150); }); })
      .then(worker);
  }
  Promise.all([worker(), worker(), worker()]).then(function () {
    var r = $('result');
    var ok = document.createElement('p'); ok.className = 'ok'; ok.textContent = 'Записано: ' + (items.length - failed.length); r.appendChild(ok);
    if (failed.length) {
      var p = document.createElement('p'); p.className = 'error';
      p.textContent = 'Не удалось: ' + failed.length + '. Запустите импорт ещё раз с тем же файлом — уже записанные карточки будут пропущены.';
      r.appendChild(p);
      var pre = document.createElement('pre'); pre.className = 'muted';
      pre.textContent = failed.slice(0, 20).map(function (f) { return (plan.names[f.x.id] || f.x.id) + ': ' + f.e; }).join('\n'); r.appendChild(pre);
    }
  });
};
