/* global TrelloPowerUp, HOURS_KEY, fmtHoursRu */
var t = TrelloPowerUp.iframe();
var MAX_LISTS = 10;
var state = { lists: [], cards: [], selected: [], log: [] };

function el(tag, text, cls) { var e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
function labelName(l) { return l.name || ('(' + (l.color || 'без цвета') + ')'); }
function memberName(m) { return m.fullName || m.username; }

function loadHours(cards) {
  var out = [], i = 0;
  function next() {
    var chunk = cards.slice(i, i + 50); i += 50;
    if (!chunk.length) return Promise.resolve(out);
    return Promise.all(chunk.map(function (c) {
      return t.get(c.id, 'shared').then(function (data) {
        data = data || {};
        var own = data[HOURS_KEY];
        (Array.isArray(data[LOG_KEY]) ? data[LOG_KEY] : []).forEach(function (e) { state.log.push({ e: e, card: c }); });
        c.own = typeof own === 'number' ? own : null;
        return effectiveHours(own, c.desc);
      }).then(function (h) { c.hours = h; delete c.desc; out.push(c); });
    })).then(next);
  }
  return next();
}

// Copy Planyway estimates into this Power-Up's own data (only where it has none yet), so they survive removing Planyway.
function saveToOwn() {
  var todo = state.cards.filter(function (c) { return c.own == null && c.hours != null; });
  var box = document.getElementById('saveStatus');
  if (!todo.length) { box.className = 'ok muted'; box.textContent = 'Все оценки этой доски хранятся в улучшении ✓'; return Promise.resolve(); }
  var done = 0, failed = 0, i = 0;
  box.className = 'muted';
  function show() { box.textContent = 'Сохраняю оценки Planyway в улучшение: ' + done + ' из ' + todo.length + '… Не закрывайте окно.'; }
  function setRetry(c, n) {
    return t.set(c.id, 'shared', HOURS_KEY, c.hours).catch(function (e) {
      if (n >= 4) throw e;
      return new Promise(function (r) { setTimeout(r, 1000 * Math.pow(2, n)); }).then(function () { return setRetry(c, n + 1); });
    });
  }
  function worker() {
    if (i >= todo.length) return Promise.resolve();
    var c = todo[i++];
    return setRetry(c, 0).then(function () { c.own = c.hours; }, function () { failed++; })
      .then(function () { done++; show(); return new Promise(function (r) { setTimeout(r, 150); }); }).then(worker);
  }
  show();
  return Promise.all([worker(), worker(), worker()]).then(function () {
    if (failed) { box.className = 'error muted'; box.textContent = 'Сохранено ' + (todo.length - failed) + ' из ' + todo.length + '. Откройте «Часы: итог» ещё раз — остальные допишутся.'; }
    else { box.className = 'ok muted'; box.textContent = 'Сохранено ' + todo.length + ' оценок Planyway. Все оценки этой доски хранятся в улучшении ✓'; }
  });
}

function groupSum(cards, keysOf, emptyName) {
  var m = new Map();
  cards.forEach(function (c) {
    var ks = keysOf(c); if (!ks.length) ks = [emptyName];
    ks.forEach(function (k) { m.set(k, (m.get(k) || 0) + c.hours); });
  });
  return Array.from(m.entries()).sort(function (a, b) { return b[1] - a[1]; });
}

function fillRows(tbody, rows, onClick, selectedKey) {
  tbody.textContent = '';
  rows.forEach(function (r) {
    var tr = el('tr');
    r.cells.forEach(function (c, i) { var td = el('td', c, i === r.cells.length - 1 || r.numCols && r.numCols.indexOf(i) >= 0 ? 'num' : null); tr.appendChild(td); });
    if (r.total) tr.className = 'total';
    if (onClick && r.key != null) { tr.classList.add('clickable'); if (r.key === selectedKey) tr.classList.add('selected'); tr.onclick = function () { onClick(r.key); }; }
    tbody.appendChild(tr);
  });
}

function listTotals() {
  return state.lists.map(function (l) {
    var cs = state.cards.filter(function (c) { return c.idList === l.id && c.hours != null; });
    return { list: l, count: cs.length, sum: cs.reduce(function (s, c) { return s + c.hours; }, 0) };
  });
}

function render() {
  var totals = listTotals().slice(0, MAX_LISTS);
  var allCount = 0, allSum = 0;
  var rows = totals.map(function (x) { allCount += x.count; allSum += x.sum; return { key: x.list.id, cells: [x.list.name, String(x.count), fmtHoursRu(x.sum)], numCols: [1] }; });
  fillRows(document.querySelector('#lists tbody'), rows, function (id) { select([id]); }, state.selected.length === 1 ? state.selected[0] : null);

  var box = document.getElementById('listChecks');
  if (!box.children.length) {
    state.lists.forEach(function (l) {
      var lab = el('label'), cb = el('input'); cb.type = 'checkbox'; cb.value = l.id;
      cb.onchange = function () { select(Array.prototype.filter.call(box.querySelectorAll('input'), function (x) { return x.checked; }).map(function (x) { return x.value; })); };
      lab.appendChild(cb); lab.appendChild(document.createTextNode(l.name)); box.appendChild(lab);
    });
  }
  Array.prototype.forEach.call(box.querySelectorAll('input'), function (x) { x.checked = state.selected.indexOf(x.value) >= 0; });
  var multi = state.selected.length > 1;
  document.getElementById('cards').classList.toggle('hideList', !multi);

  var cs = selectedCards();
  var rated = cs.filter(function (c) { return c.hours != null; });
  var sum = rated.reduce(function (s, c) { return s + c.hours; }, 0);
  fillRows(document.querySelector('#byLabel tbody'), groupSum(rated, function (c) { return (c.labels || []).map(labelName); }, 'Без метки')
    .map(function (e) { return { cells: [e[0], fmtHoursRu(e[1])] }; }));
  fillRows(document.querySelector('#byMember tbody'), groupSum(rated, function (c) { return (c.members || []).map(memberName); }, 'Без участника')
    .map(function (e) { return { cells: [e[0], fmtHoursRu(e[1])] }; }));

  var tbody = document.querySelector('#cards tbody'); tbody.textContent = '';
  cs.forEach(function (c) {
    var tr = el('tr'), a = el('a', c.name); a.href = c.url; a.onclick = function (e) { e.preventDefault(); t.showCard(c.id); };
    tr.appendChild(el('td', listName(c.idList), 'colList'));
    var td = el('td'); td.appendChild(a); tr.appendChild(td);
    tr.appendChild(el('td', (c.labels || []).map(labelName).join(', ')));
    tr.appendChild(el('td', (c.members || []).map(memberName).join(', ')));
    tr.appendChild(el('td', fmtHoursRu(c.hours || 0), 'num'));
    tbody.appendChild(tr);
  });
  var tot = el('tr', null, 'total'); tot.appendChild(el('td', null, 'colList')); tot.appendChild(el('td', 'Итого: ' + cs.length)); tot.appendChild(el('td')); tot.appendChild(el('td')); tot.appendChild(el('td', fmtHoursRu(sum), 'num'));
  tbody.appendChild(tot);
}

function listIndex(id) { for (var i = 0; i < state.lists.length; i++) if (state.lists[i].id === id) return i; return -1; }
function listName(id) { var i = listIndex(id); return i >= 0 ? state.lists[i].name : ''; }
function selectedCards() {
  return state.cards.filter(function (c) { return state.selected.indexOf(c.idList) >= 0; })
    .sort(function (a, b) { return listIndex(a.idList) - listIndex(b.idList) || (b.hours || 0) - (a.hours || 0); });
}

function renderLog() {
  var body = document.querySelector('#log tbody'); body.textContent = '';
  var items = state.log.slice().sort(function (a, b) { return b.e.at - a.e.at; }).slice(0, 30);
  document.getElementById('logEmpty').hidden = !!items.length;
  items.forEach(function (x) {
    var tr = el('tr');
    tr.appendChild(el('td', fmtWhen(x.e.at)));
    tr.appendChild(el('td', x.e.by || '?'));
    var a = el('a', x.card.name); a.href = x.card.url; a.onclick = function (ev) { ev.preventDefault(); t.showCard(x.card.id); };
    var td = el('td'); td.appendChild(a); tr.appendChild(td);
    tr.appendChild(el('td', fmtChange(x.e), 'num'));
    body.appendChild(tr);
  });
}

function select(ids) { state.selected = ids; render(); }
document.getElementById('checkNone').onclick = function () { select([]); };

function toTSV(rows) {
  return rows.map(function (r) { return r.map(function (v) { return String(v).replace(/[\t\n\r]+/g, ' '); }).join('\t'); }).join('\n');
}

function copy(text, msgId) {
  var msg = document.getElementById(msgId);
  function fallback() {
    var ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok ? Promise.resolve() : Promise.reject();
  }
  var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text).catch(fallback) : fallback();
  p.then(function () { msg.textContent = 'Скопировано. Вставьте в Google Таблицы или Excel.'; msg.className = 'ok muted'; },
         function () { msg.textContent = 'Браузер не дал скопировать.'; msg.className = 'error muted'; });
}

document.getElementById('copyLists').onclick = function () {
  var rows = [['Колонка', 'Карточек с часами', 'Часы']];
  var c = 0, s = 0;
  listTotals().slice(0, MAX_LISTS).forEach(function (x) { c += x.count; s += x.sum; rows.push([x.list.name, x.count, fmtHoursRu(x.sum)]); });
  copy(toTSV(rows), 'copyListsMsg');
};
document.getElementById('copyCards').onclick = function () {
  var cs = selectedCards();
  var multi = state.selected.length > 1;
  var rows = [(multi ? ['Колонка'] : []).concat(['Карточка', 'Метки', 'Участники', 'Часы', 'Ссылка'])];
  cs.forEach(function (c) { rows.push((multi ? [listName(c.idList)] : []).concat([c.name, (c.labels || []).map(labelName).join(', '), (c.members || []).map(memberName).join(', '), fmtHoursRu(c.hours || 0), c.url])); });
  rows.push((multi ? [''] : []).concat(['Итого', '', '', fmtHoursRu(cs.reduce(function (s, c) { return s + (c.hours || 0); }, 0)), '']));
  copy(toTSV(rows), 'copyCardsMsg');
};

Promise.all([t.lists('id', 'name'), t.cards('id', 'name', 'idList', 'labels', 'members', 'url', 'desc')])
  .then(function (r) {
    state.lists = r[0];
    return loadHours(r[1]).then(function (cards) { state.cards = cards; });
  })
  .then(function () {
    var withHours = listTotals().filter(function (x) { return x.count; });
    state.selected = [(withHours[0] || { list: state.lists[0] || {} }).list.id];
    document.getElementById('status').hidden = true;
    document.getElementById('app').hidden = false;
    render();
    renderLog();
    var perm = t.getContext && t.getContext().permissions; return perm && perm.board && perm.board !== 'write' ? null : saveToOwn();
  })
  .catch(function (e) { var s = document.getElementById('status'); s.textContent = 'Ошибка загрузки: ' + (e && e.message || e); s.className = 'error'; });
