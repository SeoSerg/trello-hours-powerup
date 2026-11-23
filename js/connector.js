/* global TrelloPowerUp, HOURS_KEY, fmtHours */
var ICON = new URL('./icon.svg', window.location.href).href;

function withTimeout(p, ms, label) {
  return Promise.race([Promise.resolve(p), new Promise(function (_, rej) { setTimeout(function () { rej(new Error('завис: ' + label)); }, ms); })]);
}

function cardHours(t) {
  if (typeof effectiveHours !== 'function') return Promise.reject(new Error('старая версия файлов, обновите страницу'));
  return withTimeout(t.get('card', 'shared', HOURS_KEY), 4000, 't.get').then(function (own) {
    if (typeof own === 'number') return own > 0 ? own : null;
    return withTimeout(t.card('desc'), 4000, 't.card').then(function (c) {
      return withTimeout(planywayHours(c && c.desc), 4000, 'decode');
    });
  });
}

function openEditor(t) {
  return t.popup({ title: 'Часы', url: './hours.html', height: 150 });
}

TrelloPowerUp.initialize({
  'card-badges': function (t) {
    return cardHours(t).then(function (h) {
      if (h == null) return [];
      return [{ icon: ICON, text: fmtHours(h) + 'h' }];
    }, function () { return []; });
  },
  'card-detail-badges': function (t) {
    return cardHours(t).then(function (h) {
      var has = h != null;
      var b = { title: 'Часы', text: has ? fmtHours(h) + 'h' : 'Добавить', callback: openEditor };
      if (!has) b.color = 'light-gray';
      return [b];
    }, function (e) {
      return [{ title: 'Часы', text: 'ошибка: ' + String(e && e.message || e).slice(0, 80), color: 'red', callback: openEditor }];
    });
  },
  'board-buttons': function () {
    return [
      { icon: { dark: ICON, light: ICON }, text: 'Часы: итог', condition: 'always',
        callback: function (t) { return t.modal({ title: 'Часы: итог', url: './summary.html', fullscreen: false, height: 600 }); } }
    ];
  }
});
