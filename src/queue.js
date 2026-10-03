/* 猶予つきコミットキュー：猶予内の取り消しは通信なし。送信は直列・間隔つき・指数バックオフ。 */
(function (G) {
  'use strict';
  var XBS = (G.XBS = G.XBS || {});
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function CommitQueue(o) {
    this.send = o.send;                 // (op) => Promise
    this.sendUrgent = o.sendUrgent;     // (ops) => void  pagehide 用・同期発火
    this.delay = o.delay != null ? o.delay : 4000;
    this.gap = o.gap != null ? o.gap : 700;
    this.retries = o.retries != null ? o.retries : 3;
    this.backoff = o.backoff != null ? o.backoff : 1000;
    this.onFail = o.onFail || function () {};
    this.onSent = o.onSent || function () {};
    this.ops = [];
    this.timer = 0;
    this.running = false;
    this.nextAllowed = 0;
    this.closed = false;
  }
  CommitQueue.prototype.add = function (op, o) {
    var d = o && o.delay != null ? o.delay : this.delay;
    op.state = 'pending'; op.dueAt = Date.now() + d; op.tries = 0;
    this.ops.push(op);
    this._schedule();
    return op;
  };
  /* 通信なしで取り消せたら true。送信済み／送信中なら false（呼び出し側が逆操作を積む）。 */
  CommitQueue.prototype.cancel = function (op) {
    if (!op || op.state !== 'pending') return false;
    op.state = 'cancelled';
    this.ops = this.ops.filter(function (x) { return x !== op; });
    return true;
  };
  CommitQueue.prototype.pending = function () {
    return this.ops.filter(function (o) { return o.state === 'pending'; }).length;
  };
  CommitQueue.prototype._schedule = function () {
    var self = this;
    clearTimeout(this.timer);
    if (this.running || this.closed) return;
    var next = null;
    this.ops.forEach(function (o) { if (o.state === 'pending' && (!next || o.dueAt < next.dueAt)) next = o; });
    if (!next) return;
    var wait = Math.max(0, next.dueAt - Date.now(), this.nextAllowed - Date.now());
    this.timer = setTimeout(function () { self._run(); }, wait);
  };
  CommitQueue.prototype._run = async function () {
    this.running = true;
    try {
      for (;;) {
        var now = Date.now(), next = null;
        for (var i = 0; i < this.ops.length; i++) {
          var o = this.ops[i];
          if (o.state === 'pending' && o.dueAt <= now) { next = o; break; }
        }
        if (!next) break;
        var w = this.nextAllowed - Date.now();
        if (w > 0) await sleep(w);
        if (next.state !== 'pending') continue;
        await this._sendOne(next);
        this.nextAllowed = Date.now() + this.gap;
      }
    } finally {
      this.running = false;
      this._schedule();
    }
  };
  CommitQueue.prototype._sendOne = async function (op) {
    op.state = 'sending';
    for (var attempt = 0; ; attempt++) {
      try {
        await this.send(op);
        op.state = 'done';
        this.ops = this.ops.filter(function (x) { return x !== op; });
        this.onSent(op);
        return;
      } catch (e) {
        if (e && e.fatal || attempt >= this.retries) {
          op.state = 'failed';
          this.ops = this.ops.filter(function (x) { return x !== op; });
          this.onFail(op, e);
          return;
        }
        var wait = (e && e.retryAfter) ? e.retryAfter * 1000 : this.backoff * Math.pow(2, attempt);
        await sleep(Math.min(wait, 30000));
      }
    }
  };
  /* 閉じる／pagehide：猶予を待たず未送信を全部送る */
  CommitQueue.prototype.flush = function () {
    var list = this.ops.filter(function (o) { return o.state === 'pending'; });
    if (!list.length) return;
    list.forEach(function (o) { o.state = 'sending'; });
    this.ops = this.ops.filter(function (o) { return list.indexOf(o) < 0; });
    if (this.sendUrgent) this.sendUrgent(list);
    else { var s = this.send; list.forEach(function (o) { s(o, { keepalive: true }).catch(function () {}); }); }
  };
  CommitQueue.prototype.destroy = function () { this.closed = true; clearTimeout(this.timer); };

  XBS.CommitQueue = CommitQueue;
})(typeof globalThis !== 'undefined' ? globalThis : window);
