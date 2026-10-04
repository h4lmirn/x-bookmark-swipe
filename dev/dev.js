/* dev 用 adapter：fixture.json を本物のパーサに通して流し込み、書き込みはモックにする。 */
(function () {
  'use strict';
  var XBS = window.XBS;
  var qs = new URLSearchParams(location.search);
  var failRate = Number(qs.get('fail') || 0);
  var batch = Number(qs.get('batch') || 0);
  var noFolders = qs.get('folders') === '0';
  var noDelete = qs.get('nodelete') === '1';
  var noReact = qs.get('noreact') === '1';
  var empty = qs.get('empty') === '1';
  var theme = qs.get('theme') || 'auto';
  var logEl = document.getElementById('log');
  window.__writes = [];
  function log(s) { window.__writes.push(s); logEl.textContent = window.__writes.slice(-12).join('\n'); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var data = null;
  var ready = Promise.all([
    fetch('fixture.json').then(function (r) { return r.json(); }),
    fetch('folders.json').then(function (r) { return r.json(); })
  ]).then(function (r) { data = { items: XBS.parse.bookmarks(r[0]).items, folders: XBS.parse.folders(r[1]) }; });

  var reviewed = JSON.parse(localStorage.getItem('xbs_dev_reviewed') || '{}');
  var settings = JSON.parse(localStorage.getItem('xbs_dev_settings') || '{}');
  var pos = 0, loading = false;

  var adapter = {
    getReviewed: function () { return Promise.resolve(Object.keys(reviewed)); },
    setReviewed: function (id, on) { if (on) reviewed[id] = Date.now(); else delete reviewed[id]; localStorage.setItem('xbs_dev_reviewed', JSON.stringify(reviewed)); log((on ? 'reviewed+ ' : 'reviewed- ') + id); },
    clearReviewed: function () { reviewed = {}; localStorage.removeItem('xbs_dev_reviewed'); log('reviewed cleared'); },
    getSettings: function () { return Promise.resolve(settings); },
    setSettings: function (s) { settings = s; localStorage.setItem('xbs_dev_settings', JSON.stringify(s)); },
    getCaps: function () { return sleep(300).then(function () { return { auth: true, delete: !noDelete, create: true, folder: true, unfolder: true, favorite: !noReact, repost: !noReact }; }); },
    getFolders: function () { return ready.then(function () { return sleep(200); }).then(function () { return noFolders ? [] : data.folders; }); },
    start: function (sink) {
      var stopped = false;
      adapter._sink = sink;
      ready.then(function () {
        if (stopped) return;
        if (empty) { sink.onDone(); return; }
        deliver(sink, batch || 10);
      });
      return function () { stopped = true; adapter._sink = null; };
    },
    loadMore: function () {
      var sink = adapter._sink;
      if (!data || !sink || loading || pos >= data.items.length) return;
      loading = true;
      sleep(1500).then(function () { loading = false; if (adapter._sink === sink) deliver(sink, 10); });
    },
    commit: function (op) {
      var nm = op.kind === 'like' ? (op.on ? 'FavoriteTweet' : 'UnfavoriteTweet') : op.kind === 'repost' ? (op.on ? 'CreateRetweet' : 'DeleteRetweet') : op.kind;
      return sleep(150 + Math.random() * 200).then(function () {
        if (failRate && Math.random() < failRate) { log('FAIL ' + nm + ' ' + op.tweetId); throw new Error('mock failure'); }
        log('OK   ' + nm + ' ' + op.tweetId + (op.folderName ? ' -> ' + op.folderName : ''));
        return true;
      });
    },
    flushSync: function (ops) { ops.forEach(function (o) { log('FLUSH ' + o.kind + (o.on != null ? (o.on ? '+' : '-') : '') + ' ' + o.tweetId); }); }
  };
  function deliver(sink, n) {
    var slice = data.items.slice(pos, pos + n); pos += slice.length;
    sink.onItems(slice);
    if (pos >= data.items.length) sink.onDone();
  }

  var ctrl = null;
  function open() {
    if (ctrl && ctrl.isOpen()) return;
    pos = 0; loading = false;
    ctrl = XBS.overlay.mount({ adapter: adapter, theme: theme, onClose: function () { ctrl = null; } });
    window.__ctrl = ctrl;
  }
  document.getElementById('reopen').addEventListener('click', open);
  window.addEventListener('keydown', function (e) {
    if (e.shiftKey && (e.key === 'T') && ctrl) { theme = document.querySelector('#xbs-overlay-host').shadowRoot.querySelector('.root').dataset.theme === 'dark' ? 'light' : 'dark'; ctrl.setTheme(theme); }
  }, true);
  open();

  // ストア用スクリーンショットの状態を作る（?shot=keep|remove|folder|done）
  var shot = qs.get('shot');
  if (shot) setTimeout(function () {
    var root = document.querySelector('#xbs-overlay-host').shadowRoot;
    var key = function (k) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); };
    if (shot === 'keep' || shot === 'remove') {
      var d = shot === 'keep' ? 'right' : 'left', sx = shot === 'keep' ? 1 : -1;
      var cards = [].slice.call(root.querySelectorAll('.card')).sort(function (a, b) { return b.style.zIndex - a.style.zIndex; });
      cards[0].style.setProperty('transform', 'translate(' + (90 * sx) + 'px,-14px) rotate(' + (6 * sx) + 'deg) scale(1.02)', 'important');
      cards[0].querySelector('.stamp[data-d=' + d + ']').style.opacity = 1;
      root.querySelector('.tint[data-d=' + d + ']') && (root.querySelector('.tint[data-d=' + d + ']').style.opacity = .12);
    } else if (shot === 'folder') key('ArrowUp');
    else if (shot === 'done') { for (var i = 0; i < 40; i++) setTimeout(function () { key(Math.random() < .4 ? 'ArrowLeft' : 'ArrowRight'); }, i * 30); }
  }, 2500);
})();
