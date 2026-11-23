/* global TrelloPowerUp, HOURS_KEY, fmtHours */
var ICON = new URL('./icon.svg', window.location.href).href;

function cardHours(t) {
  return Promise.all([t.get('card', 'shared', HOURS_KEY), t.card('desc')])
    .then(function (r) { return effectiveHours(r[0], r[1].desc); });
}

function openEditor(t) {
  return t.popup({ title: 'Часы', url: './hours.html', height: 150 });
}

TrelloPowerUp.initialize({
  'card-badges': function (t) {
    return cardHours(t).then(function (h) {
      if (h == null) return [];
      return [{ text: '⏳ ' + fmtHours(h) + 'h' }];
    });
  },
  'card-detail-badges': function (t) {
    return cardHours(t).then(function (h) {
      var has = h != null;
      return [{ title: 'Часы', text: has ? fmtHours(h) + 'h' : 'Добавить', color: has ? null : 'light-gray', callback: openEditor }];
    });
  },
  'board-buttons': function () {
    return [
      { icon: { dark: ICON, light: ICON }, text: 'Часы: итог', condition: 'always',
        callback: function (t) { return t.modal({ title: 'Часы: итог', url: './summary.html', fullscreen: false, height: 600 }); } }
    ];
  }
});
