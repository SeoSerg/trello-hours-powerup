/* global TrelloPowerUp, HOURS_KEY, fmtHoursRu */
var t = TrelloPowerUp.iframe();
var MAX_LISTS = 10;
var state = { lists: [], cards: [], selected: null };

function el(tag, text, cls) { var e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
function labelName(l) { return l.name || ('(' + (l.color || 'без цвета') + ')'); }
function memberName(m) { return m.fullName || m.username; }

function loadHours(cards) {
  var out = [], i = 0;
  function next() {
    var chunk = cards.slice(i, i + 50); i += 50;
    if (!chunk.length) return Promise.resolve(out);
    return Promise.all(chunk.map(function (c) {
      return t.get(c.id, 'shared', HOURS_KEY).then(function (own) {
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
  fillRows(document.querySelector('#lists tbody'), rows, select, state.selected);

  var sel = document.getElementById('listSel');
  if (!sel.options.length) {
    state.lists.forEach(function (l) { var o = el('option', l.name); o.value = l.id; sel.appendChild(o); });
    sel.onchange = function () { select(sel.value); };
  }
  sel.value = state.selected;

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
    var td = el('td'); td.appendChild(a); tr.appendChild(td);
    tr.appendChild(el('td', (c.labels || []).map(labelName).join(', ')));
    tr.appendChild(el('td', (c.members || []).map(memberName).join(', ')));
    tr.appendChild(el('td', fmtHoursRu(c.hours || 0), 'num'));
    tbody.appendChild(tr);
  });
  var tot = el('tr', null, 'total'); tot.appendChild(el('td', 'Итого: ' + cs.length)); tot.appendChild(el('td')); tot.appendChild(el('td')); tot.appendChild(el('td', fmtHoursRu(sum), 'num'));
  tbody.appendChild(tot);
}

function selectedCards() {
  return state.cards.filter(function (c) { return c.idList === state.selected; })
    .sort(function (a, b) { return (b.hours || 0) - (a.hours || 0); });
}

function select(id) { state.selected = id; render(); }

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
  var rows = [['Карточка', 'Метки', 'Участники', 'Часы', 'Ссылка']];
  cs.forEach(function (c) { rows.push([c.name, (c.labels || []).map(labelName).join(', '), (c.members || []).map(memberName).join(', '), fmtHoursRu(c.hours || 0), c.url]); });
  rows.push(['Итого', '', '', fmtHoursRu(cs.reduce(function (s, c) { return s + (c.hours || 0); }, 0)), '']);
  copy(toTSV(rows), 'copyCardsMsg');
};

Promise.all([t.lists('id', 'name'), t.cards('id', 'name', 'idList', 'labels', 'members', 'url', 'desc')])
  .then(function (r) {
    state.lists = r[0];
    return loadHours(r[1]).then(function (cards) { state.cards = cards; });
  })
  .then(function () {
    var withHours = listTotals().filter(function (x) { return x.count; });
    state.selected = (withHours[0] || { list: state.lists[0] || {} }).list.id;
    document.getElementById('status').hidden = true;
    document.getElementById('app').hidden = false;
    render();
    var perm = t.getContext && t.getContext().permissions; return perm && perm.board && perm.board !== 'write' ? null : saveToOwn();
  })
  .catch(function (e) { var s = document.getElementById('status'); s.textContent = 'Ошибка загрузки: ' + (e && e.message || e); s.className = 'error'; });
