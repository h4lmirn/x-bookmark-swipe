/* MAIN ワールド：X 自身の GraphQL 通信を傍受し、書き込みもここから送る。
   拡張側（ISOLATED）とは window.postMessage で会話する。x.com 以外には何も送らない。 */
(function () {
  'use strict';
  if (window.__xbsMain) return;
  window.__xbsMain = true;

  var TAG_MAIN = 'xbs-main', TAG_ISO = 'xbs-iso';
  var GQL_RE = /\/i\/api\/graphql\/([\w-]+)\/(\w+)/;
  var WATCH = { Bookmarks: 1, BookmarkFoldersSlice: 1, BookmarkFolderTimeline: 1 };
  var WANT = ['deletebookmark', 'createbookmark', 'bookmarktweettofolder', 'removetweetfrombookmarkfolder', 'bookmarkfoldersslice'];
  var KEEP_HEADERS = ['authorization', 'x-twitter-auth-type', 'x-twitter-active-user', 'x-twitter-client-language', 'x-csrf-token'];
  var LS_KEY = 'xbs:qids:v1';

  var origFetch = window.fetch;
  var state = {
    qids: new Map(),          // 小文字の操作名 -> {id, name, src}
    headers: {},
    bearer: '',
    vars: {}, feats: {},      // 操作名 -> 直近のリクエストの variables / features
    buffer: [],               // Bookmarks のレスポンス（オーバーレイを後から開いても再生できるように）
    foldersJson: null,
    scan: null
  };

  /* ---------- 永続キャッシュ（queryId は X のデプロイで変わる） ---------- */
  try {
    var cached = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    Object.keys(cached).forEach(function (k) {
      if (cached[k] && cached[k].id && Date.now() - (cached[k].t || 0) < 7 * 864e5) {
        state.qids.set(k, { id: cached[k].id, name: cached[k].name, src: 'cache' });
      }
    });
  } catch (e) { /* ignore */ }
  function persist() {
    try {
      var o = {};
      state.qids.forEach(function (v, k) { o[k] = { id: v.id, name: v.name, t: Date.now() }; });
      localStorage.setItem(LS_KEY, JSON.stringify(o));
    } catch (e) { /* ignore */ }
  }

  function post(msg) {
    try { window.postMessage(Object.assign({ source: TAG_MAIN }, msg), location.origin); } catch (e) { /* ignore */ }
  }

  /* ---------- 傍受 ---------- */
  function headersFromArgs(input, init) {
    var h = {};
    function add(src) {
      if (!src) return;
      try {
        if (typeof Headers !== 'undefined' && src instanceof Headers) src.forEach(function (v, k) { h[k.toLowerCase()] = v; });
        else if (Array.isArray(src)) src.forEach(function (p) { h[String(p[0]).toLowerCase()] = p[1]; });
        else if (typeof src === 'object') Object.keys(src).forEach(function (k) { h[k.toLowerCase()] = src[k]; });
      } catch (e) { /* ignore */ }
    }
    if (input && typeof input === 'object' && input.headers) add(input.headers);
    add(init && init.headers);
    return h;
  }
  function noteRequest(qid, op, url, headers) {
    try {
      var key = op.toLowerCase();
      var cur = state.qids.get(key);
      if (!cur || cur.id !== qid || cur.src !== 'live') {
        state.qids.set(key, { id: qid, name: op, src: 'live' });
        if (WANT.indexOf(key) >= 0) persist();
      }
      if (headers && headers.authorization) {
        KEEP_HEADERS.forEach(function (k) { if (headers[k]) state.headers[k] = headers[k]; });
      }
      var u = new URL(url, location.origin);
      var v = u.searchParams.get('variables'), f = u.searchParams.get('features');
      if (v) state.vars[op] = JSON.parse(v);
      if (f) state.feats[op] = JSON.parse(f);
    } catch (e) { /* ignore */ }
  }
  function onData(op, data) {
    if (!data || typeof data !== 'object') return;
    if (op === 'Bookmarks') { state.buffer.push(data); if (state.buffer.length > 200) state.buffer.shift(); }
    if (op === 'BookmarkFoldersSlice') state.foldersJson = data;
    post({ type: 'data', op: op, data: data });
  }

  window.fetch = function (input, init) {
    var p = Reflect.apply(origFetch, this, arguments);
    try {
      var url = typeof input === 'string' ? input : (input && (input.url || input.href)) || '';
      var m = GQL_RE.exec(url);
      if (m) {
        noteRequest(m[1], m[2], url, headersFromArgs(input, init));
        if (WATCH[m[2]]) {
          p.then(function (r) {
            try { r.clone().json().then(function (d) { onData(m[2], d); }, function () {}); } catch (e) { /* ignore */ }
          }, function () {});
        }
      }
    } catch (e) { /* ignore */ }
    return p;
  };

  var XO = XMLHttpRequest.prototype;
  var xOpen = XO.open, xSend = XO.send, xSet = XO.setRequestHeader;
  XO.open = function (method, url) {
    try { this.__xbs = { url: String(url), headers: {} }; } catch (e) { /* ignore */ }
    return xOpen.apply(this, arguments);
  };
  XO.setRequestHeader = function (k, v) {
    try { if (this.__xbs) this.__xbs.headers[String(k).toLowerCase()] = v; } catch (e) { /* ignore */ }
    return xSet.apply(this, arguments);
  };
  XO.send = function () {
    try {
      var x = this.__xbs, m = x && GQL_RE.exec(x.url);
      if (m) {
        noteRequest(m[1], m[2], x.url, x.headers);
        if (WATCH[m[2]]) {
          var self = this;
          this.addEventListener('load', function () {
            try {
              var d = self.responseType === 'json' ? self.response : JSON.parse(self.responseText);
              onData(m[2], d);
            } catch (e) { /* ignore */ }
          });
        }
      }
    } catch (e) { /* ignore */ }
    return xSend.apply(this, arguments);
  };

  /* ---------- queryId の発見（main.*.js 他のバンドル本文を読む） ---------- */
  function allFound(names) { return names.every(function (n) { return state.qids.has(n); }); }
  function scriptUrls() {
    var set = [], seen = {};
    function add(u) {
      if (!u || seen[u]) return;
      if (!/^https:\/\/abs\.twimg\.com\/responsive-web\/client-web(-legacy)?\/.+\.js(\?.*)?$/.test(u)) return;
      seen[u] = 1; set.push(u);
    }
    Array.prototype.forEach.call(document.scripts, function (s) { add(s.src); });
    try { performance.getEntriesByType('resource').forEach(function (e) { add(e.name); }); } catch (e) { /* ignore */ }
    set.sort(function (a, b) { return (/\/main\./.test(a) ? 0 : 1) - (/\/main\./.test(b) ? 0 : 1); });
    return set;
  }
  function harvest(txt) {
    var re = /queryId:"([\w-]{8,})",operationName:"(\w+)"/g, m;
    while ((m = re.exec(txt))) {
      var key = m[2].toLowerCase();
      if (WANT.indexOf(key) >= 0 && (!state.qids.has(key) || state.qids.get(key).src === 'cache')) {
        state.qids.set(key, { id: m[1], name: m[2], src: 'scan' });
      }
    }
    if (!state.bearer) {
      var b = /"(AAAAAAAAAAAAAAAAAAAAA[\w%]{30,})"/.exec(txt);
      if (b) state.bearer = 'Bearer ' + b[1];
    }
  }
  function fetchText(u) {
    return origFetch(u, { credentials: 'omit' }).then(function (r) { return r.ok ? r.text() : ''; }, function () { return ''; });
  }
  async function scan() {
    var urls = scriptUrls(), tried = {}, extra = [], n = 0;
    for (var i = 0; i < urls.length && n < 70; i++) {
      var u = urls[i];
      if (tried[u]) continue;
      tried[u] = 1; n++;
      var txt = await fetchText(u);
      if (!txt) continue;
      harvest(txt);
      if (/\/main\./.test(u)) {
        // 遅延ロードされるバンドル名（ブックマーク関連）も拾う。形式が違えば静かに失敗する。
        var base = u.replace(/\/[^\/]*$/, '');
        var re = /"((?:bundle|shared|loader|ondemand)\.[\w~.-]*[Bb]ookmark[\w~.-]*)":"(\w+)"/g, m;
        while ((m = re.exec(txt))) extra.push(base + '/' + m[1] + '.' + m[2] + 'a.js');
      }
      if (allFound(WANT) && state.bearer) break;
    }
    for (var j = 0; j < extra.length && !allFound(WANT); j++) {
      var t2 = await fetchText(extra[j]);
      if (t2) harvest(t2);
    }
    persist();
  }
  async function ensureQids(names) {
    if (allFound(names)) return;
    if (!state.scan) state.scan = scan().catch(function () {});
    await Promise.race([state.scan, new Promise(function (r) { setTimeout(r, 20000); })]);
  }

  /* ---------- 書き込み ---------- */
  function ctToken() {
    var m = /(?:^|;\s*)ct0=([^;]+)/.exec(document.cookie);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function buildHeaders() {
    var h = {};
    Object.keys(state.headers).forEach(function (k) { h[k] = state.headers[k]; });
    if (!h.authorization && state.bearer) h.authorization = state.bearer;
    var ct = ctToken();
    if (ct) h['x-csrf-token'] = ct;
    if (!h['x-twitter-auth-type']) h['x-twitter-auth-type'] = 'OAuth2Session';
    if (!h['x-twitter-active-user']) h['x-twitter-active-user'] = 'yes';
    return h;
  }
  function err(msg, extra) { var e = new Error(msg); if (extra) Object.assign(e, extra); return e; }

  async function mutate(op, variables, opt) {
    opt = opt || {};
    var key = op.toLowerCase();
    var q = state.qids.get(key);
    if (!q) { await ensureQids([key]); q = state.qids.get(key); }
    if (!q) throw err(op + ' の queryId が見つかりません', { fatal: true });
    var h = buildHeaders();
    if (!h.authorization) await ensureQids([]);
    h = buildHeaders();
    if (!h.authorization || !h['x-csrf-token']) throw err('認証情報を取得できていません', { fatal: true });
    h['content-type'] = 'application/json';
    var res = await origFetch('/i/api/graphql/' + q.id + '/' + q.name, {
      method: 'POST', credentials: 'include', keepalive: !!opt.keepalive, headers: h,
      body: JSON.stringify({ variables: variables, queryId: q.id })
    });
    if (opt.keepalive) return true;
    if (res.status === 429) throw err('429', { status: 429, retryAfter: Number(res.headers.get('retry-after')) || 0 });
    if (!res.ok) {
      if ((res.status === 400 || res.status === 404) && q.src === 'cache' && !opt.retried) {
        state.qids.delete(key); state.scan = null; persist();
        return mutate(op, variables, Object.assign({}, opt, { retried: true }));
      }
      throw err('HTTP ' + res.status, { status: res.status, fatal: res.status >= 400 && res.status < 500 });
    }
    var j = null;
    try { j = await res.json(); } catch (e) { /* 本文なしでも ok */ }
    if (j && Array.isArray(j.errors) && j.errors.length) {
      var msg = String(j.errors[0].message || 'error');
      if (/already|duplicate/i.test(msg)) return true;
      throw err(msg);
    }
    return true;
  }

  async function fetchFolders() {
    if (state.foldersJson) return state.foldersJson;
    await ensureQids(['bookmarkfoldersslice']);
    var q = state.qids.get('bookmarkfoldersslice');
    if (!q) return null;
    var h = buildHeaders();
    if (!h.authorization) return null;
    var url = '/i/api/graphql/' + q.id + '/' + q.name + '?variables=' +
      encodeURIComponent(JSON.stringify(state.vars.BookmarkFoldersSlice || {}));
    if (state.feats.BookmarkFoldersSlice) url += '&features=' + encodeURIComponent(JSON.stringify(state.feats.BookmarkFoldersSlice));
    var res = await origFetch(url, { credentials: 'include', headers: h });
    if (!res.ok) return null;
    var j = await res.json();
    onData('BookmarkFoldersSlice', j);
    return j;
  }

  async function caps() {
    await ensureQids(WANT.slice(0, 4));
    var has = function (k) { return state.qids.has(k); };
    var auth = !!(buildHeaders().authorization);
    return {
      auth: auth,
      delete: auth && has('deletebookmark'),
      create: auth && has('createbookmark'),
      folder: auth && has('bookmarktweettofolder'),
      unfolder: auth && has('removetweetfrombookmarkfolder')
    };
  }

  var OPS = {
    DeleteBookmark: function (a) { return mutate('DeleteBookmark', { tweet_id: a.tweetId }, a); },
    CreateBookmark: function (a) { return mutate('CreateBookmark', { tweet_id: a.tweetId }, a); },
    AddToFolder: function (a) { return mutate('bookmarkTweetToFolder', { tweet_id: a.tweetId, bookmark_collection_id: a.folderId }, a); },
    RemoveFromFolder: function (a) { return mutate('RemoveTweetFromBookmarkFolder', { tweet_id: a.tweetId, bookmark_collection_id: a.folderId }, a); }
  };

  /* ---------- 拡張側との会話 ---------- */
  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.source !== TAG_ISO) return;
    var m = e.data, id = m.id;
    function ok(result) { post({ type: 'rpc', id: id, ok: true, result: result }); }
    function ng(er) {
      post({ type: 'rpc', id: id, ok: false, error: { message: String(er && er.message || er), fatal: !!(er && er.fatal), status: er && er.status, retryAfter: er && er.retryAfter } });
    }
    try {
      if (m.cmd === 'hello') {
        state.buffer.forEach(function (d) { post({ type: 'data', op: 'Bookmarks', data: d }); });
        if (state.foldersJson) post({ type: 'data', op: 'BookmarkFoldersSlice', data: state.foldersJson });
        ok(true);
      } else if (m.cmd === 'caps') {
        caps().then(ok, ng);
      } else if (m.cmd === 'folders') {
        fetchFolders().then(ok, ng);
      } else if (m.cmd === 'mutate' && OPS[m.args && m.args.op]) {
        OPS[m.args.op](m.args).then(ok, ng);
      } else ng(new Error('unknown cmd'));
    } catch (er) { ng(er); }
  });

  /* pagehide 用：CustomEvent は世界をまたいで同期で届くので、離脱の瞬間でも fetch(keepalive) を発火できる */
  window.addEventListener('xbs:flush', function (e) {
    try {
      var ops = JSON.parse(e.detail);
      ops.forEach(function (a) {
        var f = OPS[a.op];
        if (f) f(Object.assign({}, a, { keepalive: true })).catch(function () {});
      });
    } catch (er) { /* ignore */ }
  });
})();
