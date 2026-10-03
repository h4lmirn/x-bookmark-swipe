/* ISOLATED ワールド：ボタン、オーバーレイの起動、MAIN との橋渡し、データの受け口（adapter）。 */
(function () {
  'use strict';
  if (window.__xbsContent) return;
  window.__xbsContent = true;
  var XBS = globalThis.XBS;
  var TAG_MAIN = 'xbs-main', TAG_ISO = 'xbs-iso';

  /* ---------------- MAIN との RPC ---------------- */
  var pending = new Map(), seq = 0, subs = new Set();
  function rpc(cmd, args, timeout) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      var t = setTimeout(function () { pending.delete(id); reject(new Error('timeout')); }, timeout || 30000);
      pending.set(id, { resolve: resolve, reject: reject, t: t });
      window.postMessage({ source: TAG_ISO, id: id, cmd: cmd, args: args }, location.origin);
    });
  }
  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.source !== TAG_MAIN) return;
    var m = e.data;
    if (m.type === 'rpc') {
      var p = pending.get(m.id); if (!p) return;
      pending.delete(m.id); clearTimeout(p.t);
      if (m.ok) p.resolve(m.result);
      else { var er = new Error(m.error && m.error.message || 'error'); Object.assign(er, m.error || {}); p.reject(er); }
    } else if (m.type === 'data') {
      handleData(m);
    }
  });

  /* ---------------- 取得データ ---------------- */
  var store = { items: [], ids: new Set(), folders: null, reachedEnd: false, count: 0 };
  var sink = null;
  function handleData(m) {
    if (m.op === 'Bookmarks') {
      var r = XBS.parse.bookmarks(m.data);
      var fresh = r.items.filter(function (it) { return !store.ids.has(it.id); });
      fresh.forEach(function (it) { store.ids.add(it.id); store.items.push(it); });
      store.count = store.items.length;
      if (!r.items.length && store.count) store.reachedEnd = true;
      if (fresh.length && sink) sink.onItems(fresh);
      if (store.reachedEnd && sink && sink.onDone) { sink.onDone(); }
    } else if (m.op === 'BookmarkFoldersSlice') {
      var f = XBS.parse.folders(m.data);
      if (f.length) store.folders = f;
    }
  }
  rpc('hello').catch(function () {});

  /* ---------------- 保存 ---------------- */
  var KEY_R = 'xbs_reviewed', KEY_S = 'xbs_settings';
  var reviewedMap = null, saveT = 0;
  function storageGet(k) {
    return new Promise(function (res) {
      try { chrome.storage.local.get(k, function (o) { res((o && o[k]) || null); }); } catch (e) { res(null); }
    });
  }
  function storageSet(k, v) { try { var o = {}; o[k] = v; chrome.storage.local.set(o); } catch (e) { /* ignore */ } }
  function loadReviewed() {
    return reviewedMap ? Promise.resolve(reviewedMap) : storageGet(KEY_R).then(function (m) { reviewedMap = m || {}; return reviewedMap; });
  }
  function scheduleSave() {
    clearTimeout(saveT);
    saveT = setTimeout(function () { storageSet(KEY_R, reviewedMap); }, 250);
  }
  window.addEventListener('pagehide', function () { if (reviewedMap) storageSet(KEY_R, reviewedMap); });

  /* ---------------- adapter ---------------- */
  var loading = false;
  var adapter = {
    getReviewed: function () { return loadReviewed().then(function (m) { return Object.keys(m); }); },
    setReviewed: function (id, on) {
      loadReviewed().then(function (m) { if (on) m[id] = Date.now(); else delete m[id]; scheduleSave(); });
    },
    clearReviewed: function () { reviewedMap = {}; storageSet(KEY_R, {}); },
    getSettings: function () { return storageGet(KEY_S).then(function (s) { return s || {}; }); },
    setSettings: function (s) { storageSet(KEY_S, s); },
    getCaps: function () { return rpc('caps', null, 30000); },
    getFolders: function () {
      if (store.folders) return Promise.resolve(store.folders);
      return rpc('folders', null, 20000).then(function (j) {
        if (j) { var f = XBS.parse.folders(j); if (f.length) store.folders = f; }
        return store.folders || [];
      }, function () { return []; });
    },
    start: function (s) {
      sink = s;
      if (store.items.length) s.onItems(store.items.slice());
      if (store.reachedEnd) setTimeout(function () { s.onDone(); }, 0);
      return function () { if (sink === s) sink = null; };
    },
    /* 続きの読み込み：ページ自身を自動スクロールして X に取りに行かせ、通信を傍受する */
    loadMore: function () {
      if (loading || store.reachedEnd || !sink) return;
      loading = true;
      var before = store.count, tries = 0, s = sink;
      (function tick() {
        if (sink !== s) { loading = false; return; }
        if (store.count > before) { loading = false; return; }
        if (store.reachedEnd) { loading = false; s.onDone(); return; }
        if (tries++ >= 16) {
          loading = false; store.reachedEnd = true; s.onDone({ stalled: store.count === 0 }); return;
        }
        window.scrollTo(0, document.documentElement.scrollHeight);
        setTimeout(tick, 500);
      })();
    },
    commit: function (op, o) {
      var map = { remove: 'DeleteBookmark', restore: 'CreateBookmark', folder: 'AddToFolder', unfolder: 'RemoveFromFolder' };
      return rpc('mutate', { op: map[op.kind], tweetId: op.tweetId, folderId: op.folderId }, 45000).then(function () { return true; });
    },
    flushSync: function (ops) {
      var map = { remove: 'DeleteBookmark', restore: 'CreateBookmark', folder: 'AddToFolder', unfolder: 'RemoveFromFolder' };
      var list = ops.map(function (o) { return { op: map[o.kind], tweetId: o.tweetId, folderId: o.folderId }; });
      try { window.dispatchEvent(new CustomEvent('xbs:flush', { detail: JSON.stringify(list) })); } catch (e) { /* ignore */ }
    }
  };

  /* ---------------- 起動とボタン ---------------- */
  var ctrl = null, savedScroll = 0;
  function xTheme() {
    try {
      var c = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
      if (c) return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) < 140 ? 'dark' : 'light';
    } catch (e) { /* ignore */ }
    return 'auto';
  }
  function open() {
    if (ctrl && ctrl.isOpen()) return;
    savedScroll = window.scrollY;
    fab.hidden(true);
    ctrl = XBS.overlay.mount({
      adapter: adapter, theme: xTheme(),
      onClose: function () { ctrl = null; try { window.scrollTo(0, savedScroll); } catch (e) { /* ignore */ } fab.hidden(!isBookmarks()); }
    });
  }
  // 2026年5月以降、/i/bookmarks は「履歴」(/i/history…) へ移ることがある。
  // 履歴ページではパスで判定できないので、ブックマークの通信を実際に受け取ったかで判断する。
  function isBookmarks() {
    var p = location.pathname;
    if (/^\/i\/bookmarks\/?$/.test(p)) return true;
    return /^\/i\/history(\/|$)/.test(p) && store.items.length > 0;
  }
  var AUTO = 'xbs-autoopen';
  function wantAutoOpen() {
    try { var t = +sessionStorage.getItem(AUTO); return t && Date.now() - t < 30000; } catch (e) { return false; }
  }
  function setAutoOpen(on) {
    try { if (on) sessionStorage.setItem(AUTO, String(Date.now())); else sessionStorage.removeItem(AUTO); } catch (e) { /* ignore */ }
  }

  var fab = (function () {
    var host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;';
    var sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = '<style>button{all:initial;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;cursor:pointer;font:600 14px/1 -apple-system,"Hiragino Sans","Noto Sans JP",system-ui,sans-serif;color:#fff;background:#5E5E5E;padding:13px 20px 13px 16px;border-radius:999px;box-shadow:0 6px 24px rgba(0,0,0,.3);transition:transform .15s cubic-bezier(.2,.9,.3,1.3)}button:hover{transform:scale(1.05)}button:active{transform:scale(.95)}button:focus-visible{outline:2px solid #3E63DD;outline-offset:3px}@media (prefers-color-scheme:dark){button{background:#ECECEC;color:#333}}</style><button type="button" aria-label="ブックマークをスワイプで整理する"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h9a3 3 0 013 3v10a3 3 0 01-3 3H8a3 3 0 01-3-3V7a3 3 0 013-3" stroke="#D6B3FC" pathLength="100" stroke-dasharray="78 8 0 14"/><path d="M9.5 9.5h5" stroke="#84F0FC"/><path d="M9.5 13.5h3" stroke="#FDB9E5"/><circle cx="16.5" cy="13.5" r="1.3" fill="#FBA94D" stroke="none"/></svg>スワイプで整理</button>';
    sh.querySelector('button').addEventListener('click', open);
    var mounted = false;
    return {
      hidden: function (h) {
        if (h) { host.remove(); mounted = false; }
        else if (!mounted && document.body) { document.body.appendChild(host); mounted = true; }
      }
    };
  })();

  function watch() {
    var on = isBookmarks();
    if (on && !(ctrl && ctrl.isOpen())) {
      if (wantAutoOpen()) { setAutoOpen(false); open(); } else fab.hidden(false);
    }
    if (!on) { fab.hidden(true); if (ctrl && ctrl.isOpen()) ctrl.close(); }
  }
  setInterval(watch, 400);
  window.addEventListener('popstate', watch);
  watch();

  try {
    chrome.runtime.onMessage.addListener(function (m) {
      if (!m || m.type !== 'xbs-open') return;
      if (isBookmarks()) open();
      else { setAutoOpen(true); location.href = '/i/bookmarks'; }
    });
  } catch (e) { /* ignore */ }

  // #swipe 付きで来たら、リダイレクト先でブックマークが読めた時点で開く（watch が拾う）
  if (location.hash === '#swipe') {
    setAutoOpen(true);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  }
})();
