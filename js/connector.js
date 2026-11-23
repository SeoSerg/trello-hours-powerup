/* global TrelloPowerUp, HOURS_KEY, fmtHours */
var ICON = new URL('./icon.svg', window.location.href).href;

function openEditor(t) {
  return t.popup({ title: 'Часы', url: './hours.html', height: 150 });
}

TrelloPowerUp.initialize({
  'card-badges': function (t) {
    return t.get('card', 'shared', HOURS_KEY).then(function (h) {
      if (typeof h !== 'number') return [];
      return [{ text: '⏳ ' + fmtHours(h) + 'h' }];
    });
  },
  'card-detail-badges': function (t) {
    return t.get('card', 'shared', HOURS_KEY).then(function (h) {
      var has = typeof h === 'number';
      return [{ title: 'Часы', text: has ? fmtHours(h) + 'h' : 'Добавить', color: has ? null : 'light-gray', callback: openEditor }];
    });
  },
  'board-buttons': function () {
    return [
      { icon: { dark: ICON, light: ICON }, text: 'Часы: итог', condition: 'always',
        callback: function (t) { return t.modal({ title: 'Часы: итог', url: './summary.html', fullscreen: false, height: 600 }); } },
      { icon: { dark: ICON, light: ICON }, text: 'Импорт часов', condition: 'edit',
        callback: function (t) { return t.modal({ title: 'Импорт часов', url: './import.html', height: 560 }); } }
    ];
  }
});
