/* 小さなアニメーションエンジン：tween と spring。transform/opacity 用の数値だけを動かす。 */
(function (G) {
  'use strict';
  var XBS = (G.XBS = G.XBS || {});
  var active = new Set();
  var raf = 0;
  var last = 0;
  var EPS = { x: 0.08, y: 0.08, r: 0.05 };
  function epsOf(k) { return EPS[k] || 0.002; }

  function tick(now) {
    raf = 0;
    var dt = Math.min(34, Math.max(1, now - last));
    last = now;
    Array.from(active).forEach(function (a) {
      if (a.running && a.step(dt)) a.complete();
    });
    if (active.size) raf = requestAnimationFrame(tick);
  }
  function run(a) {
    active.add(a);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  function Anim(obj, to, o) {
    this.obj = obj; this.to = to; this.o = o || {}; this.running = true;
  }
  Anim.prototype.finish = function () {
    if (!this.running) return;
    this.running = false; active.delete(this);
    for (var k in this.to) this.obj[k] = this.to[k];
    if (this.o.onUpdate) this.o.onUpdate();
    if (this.o.onDone) this.o.onDone(true);
  };
  Anim.prototype.cancel = function () {
    if (!this.running) return;
    this.running = false; active.delete(this);
  };
  Anim.prototype.complete = function () {
    this.running = false; active.delete(this);
    for (var k in this.to) this.obj[k] = this.to[k];
    if (this.o.onUpdate) this.o.onUpdate();
    if (this.o.onDone) this.o.onDone(false);
  };

  var ease = {
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    in: function (t) { return t * t * t; }
  };

  function tween(obj, to, o) {
    o = o || {};
    var a = new Anim(obj, to, o);
    var from = {}; for (var k in to) from[k] = obj[k];
    var dur = o.duration || 260, fn = o.ease || ease.out, el = 0;
    a.step = function (dt) {
      el += dt;
      var t = Math.min(1, el / dur), e = fn(t);
      for (var k in to) obj[k] = from[k] + (to[k] - from[k]) * e;
      if (o.onUpdate) o.onUpdate();
      return t >= 1;
    };
    run(a);
    return a;
  }

  /* 減衰ばね。vel は 1秒あたりの速度。stiffness 400 / damping 28 / mass 1 が既定（ζ≈0.7）。 */
  function spring(obj, to, o) {
    o = o || {};
    var a = new Anim(obj, to, o);
    var K = o.stiffness || 400, C = o.damping || 28, M = o.mass || 1;
    var v = {}; for (var k in to) v[k] = (o.vel && o.vel[k]) || 0;
    a.step = function (dt) {
      var rest = true, left = dt / 1000, h = 0.004;
      while (left > 1e-6) {
        var s = Math.min(h, left); left -= s;
        for (var k in to) {
          var acc = (-K * (obj[k] - to[k]) - C * v[k]) / M;
          v[k] += acc * s;
          obj[k] += v[k] * s;
        }
      }
      for (var k2 in to) {
        var e = epsOf(k2);
        if (Math.abs(obj[k2] - to[k2]) > e || Math.abs(v[k2]) > e * 8) rest = false;
      }
      if (o.onUpdate) o.onUpdate();
      return rest;
    };
    run(a);
    return a;
  }

  var mq = G.matchMedia ? G.matchMedia('(prefers-reduced-motion: reduce)') : null;
  XBS.physics = { tween: tween, spring: spring, ease: ease, reduced: function () { return !!(mq && mq.matches); } };
})(typeof globalThis !== 'undefined' ? globalThis : window);
