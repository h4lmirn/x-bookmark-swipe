/* Bookmark Swipe オーバーレイ本体。Shadow DOM の中に描画する。
   拡張でも dev/index.html でも同じコードを使い、データと書き込みは adapter 越しに受け渡す。 */
(function (G) {
  'use strict';
  var XBS = (G.XBS = G.XBS || {});
  var tween = XBS.physics.tween, spring = XBS.physics.spring, ease = XBS.physics.ease;
  var I18N = XBS.i18n, t = I18N.t, fmtCount = I18N.fmtCount, relTime = I18N.relTime, fmtDuration = I18N.fmtDuration;

  /* ------------------------------------------------------------------ icons */
  function ic(p, w) {
    return '<svg viewBox="0 0 24 24" width="' + (w || 24) + '" height="' + (w || 24) + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  // 線の終わりを「すき間 → 点」にする筆致（参照イラストに合わせる）。d はストロークごとに分けて渡す
  function dot(ds, w) {
    return ic(ds.map(function (d) {
      return '<path d="' + d + '" pathLength="100" stroke-dasharray="80 8 0 12"/>';
    }).join(''), w).replace('stroke-width="1.5"', 'stroke-width="1.9"');
  }
  var ICON = {
    close: dot(['M5.5 5.5l13 13', 'M18.5 5.5l-13 13']),
    remove: dot(['M4.5 7h15', 'M7 7l1 12.5h8L17 7', 'M10 4.5h4']),
    keep: dot(['M4.5 12.5l5 5L20 6.5']),
    later: dot(['M12 3.5a8.5 8.5 0 108.5 8.5A8.5 8.5 0 0012 3.5', 'M12 7.5v5l3.5 2']),
    folder: dot(['M3.5 17.5v-10A1.5 1.5 0 015 6h4l2 2h8a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0119 19H5']),
    undo: dot(['M9 14L4 9l5-5', 'M4 9h10.5a5.5 5.5 0 010 11H10']),
    bookmark: dot(['M8 4.5h8a1 1 0 011 1v14l-5-3.5-5 3.5V5.5A1 1 0 018 4.5'], 24),
    stack: dot(['M5 18.5v-9A1.5 1.5 0 016.5 8h11A1.5 1.5 0 0119 9.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 18.5', 'M8 4.5h8'], 20),
    gear: ic('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
    reply: ic('<path d="M20 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1120 12z"/>', 16),
    repost: ic('<path d="M17 4l3 3-3 3M20 7H8a4 4 0 00-4 4v1M7 20l-3-3 3-3M4 17h12a4 4 0 004-4v-1"/>', 16),
    like: ic('<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>', 16),
    ext: ic('<path d="M8 16L16 8M9 8h7v7"/>', 14),
    play: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M9 6.5v11l9-5.5z"/></svg>',
    check: '<svg viewBox="0 0 64 64" width="96" height="96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle class="ring" cx="32" cy="32" r="28"/><path class="tick" d="M19 33l9 9 17-19"/></svg>'
  };

  /* -------------------------------------------------------------------- css */
  var NOISE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box}',
    '.root{--desk:#FBF9FE;--card:#fff;--ink:#4A4A4A;--sub:#8C8C8C;--line:rgba(140,140,140,.2);--remove:#EE88C8;--keep:#3FC6DA;--folder:#B48AF0;--later:#A8A8A8;--accent:#FBA94D;--toast-bg:#5E5E5E;--toast-ink:#fff;--sh1:rgba(110,80,150,.05);--sh2:rgba(110,80,150,.09);--sh3:rgba(110,80,150,.11);--shh:rgba(110,80,150,.22);--chip:rgba(214,179,252,.18)}',
    '.root[data-theme=dark]{--desk:#18171C;--card:#232228;--ink:#ECECEC;--sub:#9A9A9A;--line:rgba(255,255,255,.12);--remove:#FDB9E5;--keep:#84F0FC;--folder:#D6B3FC;--later:#B8B8B8;--toast-bg:#ECECEC;--toast-ink:#333;--sh1:rgba(0,0,0,.3);--sh2:rgba(0,0,0,.4);--sh3:rgba(0,0,0,.5);--shh:rgba(0,0,0,.8);--chip:rgba(255,255,255,.07)}',
    '.root{position:fixed;inset:0;display:flex;flex-direction:column;background:var(--desk);color:var(--ink);font:400 17px/1.6 -apple-system,"SF Pro Text","Hiragino Sans","Noto Sans JP",system-ui,sans-serif;overflow:hidden;outline:none;overscroll-behavior:contain;-webkit-font-smoothing:antialiased}',
    '.root.grabbing,.root.grabbing *{cursor:grabbing!important}',
    '.noise{position:absolute;inset:0;opacity:.03;pointer-events:none;background-image:' + NOISE + '}',
    '.root[data-theme=dark] .noise{opacity:.05;filter:invert(1)}',
    '.tint{position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .18s linear}',
    '.tint[data-d=left]{background:var(--remove)}.tint[data-d=right]{background:var(--keep)}.tint[data-d=up]{background:var(--folder)}.tint[data-d=down]{background:var(--later)}',
    'button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    ':focus-visible{outline:2px solid var(--folder);outline-offset:3px;border-radius:10px}',
    /* header */
    '.head{position:relative;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:12px 20px 14px;z-index:5}',
    '.h-left{display:flex;align-items:center;color:var(--sub)}',
    '.h-mid{text-align:center;line-height:1}',
    '.count{display:inline-grid;font-size:56px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.05;overflow:hidden;padding:0 4px;height:1.1em}',
    '.count>span{grid-area:1/1;text-align:center;will-change:transform,opacity}',
    '.count-wrap{display:inline-flex;align-items:flex-start;gap:2px}',
    '.plus{font-size:20px;color:var(--sub);font-weight:600;margin-top:10px}',
    '.cap{display:flex;justify-content:center;color:var(--sub);margin-top:4px}',
    '.h-right{display:flex;justify-content:flex-end;align-items:center;gap:6px;font-size:13px;color:var(--sub);font-variant-numeric:tabular-nums}',
    '.results{margin-right:8px;white-space:nowrap;font-family:-apple-system,"SF Pro Text",system-ui,sans-serif}.results b{color:var(--ink);font-weight:600}.results .em{margin-right:3px;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}.results .gap{display:inline-block;width:.7em}',
    '.ibtn{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:var(--sub);transition:transform .15s,opacity .15s}',
    '.ibtn:hover{color:var(--ink)}.ibtn:active{transform:scale(.9)}',
    '.endbtn{width:auto;display:inline-flex;align-items:center;gap:4px;padding:0 12px 0 8px;border-radius:999px;font-size:13px;font-weight:600;letter-spacing:.06em}.endbtn svg{width:18px;height:18px}.endbtn:hover{background:var(--chip)}',
    '.bar{position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--line)}',
    '.bar>i{position:absolute;inset:0;background:var(--accent);transform:scaleX(0);transform-origin:left;transition:transform .45s cubic-bezier(.2,.9,.3,1)}',
    /* stage + cards */
    '.stage{position:relative;flex:1;min-height:0;z-index:2;touch-action:none;-webkit-user-select:none;user-select:none}',
    '.card{position:absolute;inset:58px 0 10px;margin:auto;width:min(440px,92vw);height:min(600px,calc(100% - 68px));display:flex;flex-direction:column;border-radius:20px;background:var(--card);box-shadow:0 1px 1px var(--sh1),0 8px 24px var(--sh2),0 24px 64px var(--sh3);will-change:transform,opacity;touch-action:none;cursor:grab;transform-origin:50% 100%}',
    '.root[data-theme=dark] .card{outline:1px solid var(--line)}',
    '.lift{position:absolute;inset:0;border-radius:20px;box-shadow:0 14px 36px var(--shh),0 36px 90px var(--shh);opacity:0;z-index:-1;pointer-events:none}',
    '.face{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;padding:18px 20px 12px}',
    '.melt{position:absolute;inset:0;background:var(--remove);opacity:0;pointer-events:none;z-index:3}',
    '.veil{position:absolute;inset:0;border-radius:20px;background:var(--desk);opacity:0;pointer-events:none;z-index:6}',
    '.stamp{position:absolute;z-index:4;opacity:0;pointer-events:none;width:104px;height:104px;border-radius:50%;border:3px solid currentColor;display:grid;place-items:center;background:color-mix(in srgb,var(--card) 90%,transparent);box-shadow:0 2px 10px rgba(110,80,150,.12)}',
    '.stamp::before{content:"";position:absolute;inset:4px;border-radius:50%;border:1.5px solid currentColor}',
    '.stamp .em{position:relative;font-size:56px;line-height:1;opacity:.92;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}',
    '.stamp[data-d=left]{color:var(--remove);top:64px;right:18px;transform:rotate(12deg)}',
    '.stamp[data-d=right]{color:var(--keep);top:64px;left:18px;transform:rotate(-12deg)}',
    '.stamp[data-d=up]{color:var(--folder);bottom:46px;left:50%;margin-left:-52px;transform:rotate(-4deg)}',
    '.stamp[data-d=down]{color:var(--later);top:64px;left:50%;margin-left:-52px;transform:rotate(4deg)}',
    '.author{display:flex;align-items:center;gap:10px;flex:none;margin-bottom:10px}',
    '.av{width:36px;height:36px;border-radius:50%;background:var(--chip);object-fit:cover;flex:none}',
    '.who{min-width:0;line-height:1.3}',
    '.who b{display:block;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.who span{font-size:13px;color:var(--sub);white-space:nowrap}',
    '.body{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:12px}',
    '.body.expanded{overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain}',
    '.text{margin:0;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;flex:none}',
    '.text.clamp{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:10;overflow:hidden}',
    '.text .tag{color:color-mix(in srgb,var(--folder) 82%,var(--ink))}',
    '.text a{color:color-mix(in srgb,var(--folder) 82%,var(--ink));text-decoration:none;word-break:break-all}',
    '.text a:hover{text-decoration:underline}',
    '.more{align-self:flex-start;font-size:14px;color:var(--folder);padding:2px 0;flex:none}',
    '.media{position:relative;display:grid;gap:2px;border-radius:14px;overflow:hidden;flex:none;background:var(--chip)}',
    '.media img{display:block;width:100%;height:100%;object-fit:cover;background:var(--chip)}',
    '.media.n1{grid-template-columns:1fr;max-height:420px}',
    '.media.n2{grid-template-columns:1fr 1fr;aspect-ratio:16/10}',
    '.media.n3{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;aspect-ratio:16/10}.media.n3>:first-child{grid-row:1/3}',
    '.media.n4{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;aspect-ratio:16/10}',
    '.media>div{position:relative;overflow:hidden;min-height:0}',
    '.play{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}',
    '.play i{width:52px;height:52px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;display:grid;place-items:center;backdrop-filter:blur(6px)}',
    '.gif{position:absolute;left:10px;bottom:10px;font-size:11px;font-weight:700;letter-spacing:.06em;color:#fff;background:rgba(0,0,0,.6);padding:2px 7px;border-radius:6px}',
    '.hero .media.n1{max-height:480px}',
    '.media.fill{flex:1 1 0;min-height:140px;max-height:none;aspect-ratio:auto!important}',
    '.body.solo{justify-content:center;padding-bottom:24px}',
    '.body.solo .text{font-size:var(--solo-fs,17px);line-height:1.55;letter-spacing:.01em}',
    '.quote{flex:none;border:1px solid var(--line);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;min-height:0}',
    '.quote .q-head{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--sub);white-space:nowrap}',
    '.quote .q-head b{color:var(--ink);font-weight:700;overflow:hidden;text-overflow:ellipsis}',
    '.quote .av{width:20px;height:20px}',
    '.quote .text{font-size:15px;line-height:1.5}.quote .text.clamp{-webkit-line-clamp:4}',
    '.quote .media{border-radius:10px;max-height:180px}',
    '.foot{flex:none;display:flex;align-items:center;gap:16px;padding-top:12px;margin-top:auto;font-size:13px;color:var(--sub);font-variant-numeric:tabular-nums}',
    '.foot .m{display:inline-flex;align-items:center;gap:5px}',
    '.foot .open{margin-left:auto;display:inline-flex;align-items:center;gap:3px;color:var(--sub);text-decoration:none;padding:4px 2px}',
    '.foot .open:hover{color:var(--ink)}',
    /* skeleton */
    '.skeleton{position:absolute;inset:0;margin:auto;width:min(440px,92vw);height:300px;border-radius:20px;background:var(--card);box-shadow:0 1px 1px var(--sh1),0 8px 24px var(--sh2);padding:20px;display:flex;flex-direction:column;gap:12px;animation:pulse 1.4s ease-in-out infinite}',
    '.skeleton[hidden]{display:none}',
    '.sk{background:var(--chip);border-radius:8px}',
    '@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}',
    /* actions */
    '.actions{position:relative;z-index:5;display:flex;justify-content:center;align-items:flex-start;gap:clamp(14px,4vw,28px);padding:6px 16px calc(14px + env(safe-area-inset-bottom,0px))}',
    '.act{display:flex;flex-direction:column;align-items:center;gap:6px;width:64px}',
    '.act .hint{font-size:11px;color:var(--sub);letter-spacing:.04em;white-space:nowrap}',
    '.cbtn{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:var(--card);box-shadow:0 1px 1px var(--sh1),0 6px 16px var(--sh2);border:1px solid var(--line);transition:transform .16s cubic-bezier(.2,.9,.3,1.3),opacity .2s}',
    '.cbtn:hover{transform:scale(1.07)}.cbtn:active{transform:scale(.92)}',
    '.cbtn[data-k=remove]{color:var(--remove)}.cbtn[data-k=keep]{color:var(--keep)}.cbtn[data-k=folder]{color:var(--folder)}.cbtn[data-k=later]{color:var(--later)}',
    '.cbtn.small{width:44px;height:44px;margin-top:8px;color:var(--sub)}',
    '.cbtn[aria-disabled=true]{opacity:.32;cursor:not-allowed}.cbtn[aria-disabled=true]:hover{transform:none}',
    /* toast */
    '.toast{position:absolute;z-index:20;top:106px;left:0;right:0;margin:0 auto;width:fit-content;max-width:calc(100vw - 24px);display:flex;align-items:center;gap:14px;padding:9px 10px 9px 18px;border-radius:999px;background:var(--toast-bg);color:var(--toast-ink);font-size:14px;font-weight:500;line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,.25);opacity:0;transform:translateY(-14px) scale(.92);pointer-events:none;transition:opacity .2s,transform .32s cubic-bezier(.2,1.1,.3,1)}',
    '.toast.show{opacity:1;transform:none;pointer-events:auto}',
    '.toast button{display:inline-flex;align-items:center;gap:5px;font-weight:700;font-size:13px;padding:5px 12px 5px 9px;border-radius:999px;background:color-mix(in srgb,var(--toast-ink) 16%,transparent)}',
    '.toast .t-text{display:inline-flex;align-items:center;gap:6px}.toast .t-em{font-size:22px;line-height:1;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}',
    '.toast button[hidden]{display:none}',
    '.toast .t-text{padding-right:2px}',
    '.toast.pulse{animation:none}',
    /* folder sheet */
    '.scrim{position:absolute;inset:0;z-index:30;background:rgba(0,0,0,.18);opacity:0;pointer-events:none;transition:opacity .22s}',
    '.scrim.show{opacity:1;pointer-events:auto}',
    '.sheet{position:absolute;z-index:31;left:0;right:0;bottom:0;margin:0 auto;width:min(560px,100%);padding:18px 18px calc(20px + env(safe-area-inset-bottom,0px));background:var(--card);border-radius:24px 24px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.18);transform:translateY(calc(100% + 60px));transition:transform .34s cubic-bezier(.2,.9,.3,1)}',
    '.sheet.show{transform:none}',
    '.sheet h2{margin:0 0 12px;font-size:14px;font-weight:600;color:var(--sub);letter-spacing:.04em;display:flex;align-items:center;gap:8px}.sheet h2 svg{color:var(--folder)}',
    '.chips{display:flex;flex-wrap:wrap;gap:8px;max-height:30vh;overflow-y:auto}',
    '.chip{display:inline-flex;align-items:center;gap:8px;padding:10px 12px 10px 12px;border-radius:14px;background:var(--chip);color:var(--ink);font-size:15px;font-weight:500;transition:transform .15s}',
    '.chip svg{color:var(--folder)}.chip:active{transform:scale(.95)}',
    '.chip kbd{font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--sub);border:1px solid var(--line);border-radius:5px;padding:3px 5px}',
    '.sheet .esc{margin-top:12px;font-size:12px;color:var(--sub);letter-spacing:.06em}',
    /* settings */
    '.settings{position:absolute;z-index:40;top:60px;right:14px;width:min(320px,calc(100vw - 28px));background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:0 12px 40px rgba(0,0,0,.2);font-size:14px;line-height:1.5;opacity:0;transform:translateY(-6px) scale(.97);transform-origin:top right;pointer-events:none;transition:opacity .16s,transform .2s cubic-bezier(.2,.9,.3,1)}',
    '.settings.show{opacity:1;transform:none;pointer-events:auto}',
    '.settings label{display:flex;gap:10px;align-items:center;cursor:pointer;padding:4px 0}',
    '.settings input{accent-color:var(--folder);width:18px;height:18px}',
    '.settings .reset{margin-top:8px;color:var(--remove);font-size:13px;padding:6px 0}',
    '.settings .note{color:var(--sub);font-size:12px;margin-top:4px}',
    /* done */
    '.done{position:absolute;inset:0;z-index:25;background:var(--desk);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:24px;opacity:0;pointer-events:none;transition:opacity .35s}',
    '.done.show{opacity:1;pointer-events:auto}',
    '.done .chk{color:var(--keep)}.done .tick{stroke:var(--accent)}',
    '.done .ring{stroke-dasharray:176;stroke-dashoffset:176;opacity:.25}',
    '.done .tick{stroke-dasharray:50;stroke-dashoffset:50;stroke-width:4}',
    '.done.show .ring{animation:draw .7s .1s cubic-bezier(.3,.7,.2,1) forwards}',
    '.done.show .tick{animation:draw .45s .55s cubic-bezier(.3,.7,.2,1) forwards}',
    '@keyframes draw{to{stroke-dashoffset:0}}',
    '.done h1{margin:8px 0 0;font-size:32px;font-weight:700;letter-spacing:.02em}',
    '.done p{margin:0;color:var(--sub);font-size:15px;font-variant-numeric:tabular-nums}',
    '.done .stats{display:flex;gap:26px;margin:14px 0 6px;font-variant-numeric:tabular-nums}',
    '.done .stats div{display:flex;align-items:center;gap:8px}',
    '.done .stats b{font-size:34px;font-weight:700;line-height:1.1;color:var(--ink)}',
    '.done .stats .em{font-size:30px;line-height:1;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}',
    '.done .btns{display:flex;gap:10px;margin-top:18px}',
    '.pill{padding:11px 22px;border-radius:999px;background:var(--ink);color:var(--desk);font-size:15px;font-weight:600}',
    '.pill.ghost{background:var(--chip);color:var(--ink)}',
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.endbtn{white-space:nowrap}',
    '@media (max-width:560px){.head{grid-template-columns:auto 1fr auto;padding:10px 10px 12px 14px;gap:6px}.count{font-size:44px}.h-right{gap:2px}.results{margin-right:2px;font-size:12px}.endbtn{padding:0 8px 0 4px}.actions{gap:10px}.act{width:56px}.cbtn{width:54px;height:54px}}',
    '@media (pointer:coarse){.act .hint{display:none}.cbtn.small{margin-top:5px}}',
    '@media (max-height:560px){.count{font-size:40px}.act .hint{display:none}.cbtn{width:50px;height:50px}.toast{top:84px}}',
    '@media (prefers-reduced-motion:reduce){.tint,.bar>i,.toast,.sheet,.scrim,.settings,.done,.cbtn,.ibtn,.chip{transition-duration:.01ms!important}.skeleton{animation:none}.done .ring,.done .tick{animation-duration:.01ms!important}}'
  ].join('\n');

  function template() { return [
    '<div class="root" tabindex="-1" role="dialog" aria-modal="true" aria-label="' + t('dialog') + '" lang="' + I18N.lang + '">',
    '<div class="noise"></div>',
    '<i class="tint" data-d="left"></i><i class="tint" data-d="right"></i><i class="tint" data-d="up"></i><i class="tint" data-d="down"></i>',
    '<header class="head">',
    '<div class="h-left" role="img" aria-label="' + t('bookmarks') + '">' + ICON.bookmark + '</div>',
    '<div class="h-mid"><div class="count-wrap"><div class="count" aria-hidden="true"></div><span class="plus" hidden>+</span></div><span class="cap" aria-hidden="true">' + ICON.stack + '</span><span class="sr count-sr" aria-live="off"></span></div>',
    '<div class="h-right"><span class="results"></span>',
    '<button class="ibtn" data-b="settings" aria-label="' + t('settings') + '" aria-haspopup="dialog">' + ICON.gear + '</button>',
    '<button class="ibtn endbtn" data-b="close" aria-label="' + t('doneLabel') + '">' + ICON.close + '<span>' + t('done') + '</span></button></div>',
    '<div class="bar"><i></i></div>',
    '</header>',
    '<main class="stage"><div class="skeleton" hidden aria-label="' + t('loading') + '" role="status"><div class="sk" style="height:36px;width:55%"></div><div class="sk" style="height:16px"></div><div class="sk" style="height:16px;width:90%"></div><div class="sk" style="height:16px;width:70%"></div><div class="sk" style="flex:1"></div></div></main>',
    '<div class="toast" role="status" aria-live="polite"><span class="t-text"></span><button type="button" class="t-undo" aria-label="' + t('undo') + '">' + ICON.undo.replace('width="24" height="24"', 'width="14" height="14"') + '<span>' + t('undo') + '</span></button></div>',
    '<footer class="actions">',
    '<div class="act"><button class="cbtn" data-k="remove" aria-label="' + t('removeLabel') + '">' + ICON.remove + '</button><span class="hint">← / D</span></div>',
    '<div class="act"><button class="cbtn" data-k="later" aria-label="' + t('laterLabel') + '">' + ICON.later + '</button><span class="hint">↓ / S</span></div>',
    '<div class="act"><button class="cbtn" data-k="folder" aria-label="' + t('folderLabel') + '">' + ICON.folder + '</button><span class="hint">↑ / F</span></div>',
    '<div class="act"><button class="cbtn" data-k="keep" aria-label="' + t('keepLabel') + '">' + ICON.keep + '</button><span class="hint">→ / K</span></div>',
    '<div class="act"><button class="cbtn small" data-k="undo" aria-label="' + t('undo') + '">' + ICON.undo + '</button><span class="hint">Z</span></div>',
    '</footer>',
    '<div class="scrim"></div>',
    '<div class="sheet" role="dialog" aria-label="' + t('folderSheetLabel') + '" aria-hidden="true"><h2>' + ICON.folder.replace('width="24" height="24"', 'width="20" height="20"') + '<span>' + t('folderTitle') + '</span></h2><div class="chips"></div><div class="esc" aria-label="' + t('folderHint') + '">1\u20139 \u00b7 Esc</div></div>',
    '<div class="settings" role="dialog" aria-label="' + t('settings') + '" aria-hidden="true"><label><input type="checkbox" class="s-all"> ' + t('showAll') + '</label><div class="note">' + t('showAllNote') + '</div><button class="reset" type="button">' + t('resetRec', { n: '<span class="s-n">0</span>' }) + '</button></div>',
    '<section class="done" role="status" aria-live="polite" aria-hidden="true"><div class="chk">' + ICON.check + '</div><h1>' + t('doneTitle') + '</h1><p class="d-sub"></p><div class="stats"></div><p class="d-time"></p><div class="btns"><button class="pill ghost" data-b="undo2">' + t('undo') + '</button><button class="pill" data-b="close">' + t('closePill') + '</button></div></section>',
    '</div>'
  ].join(''); }

  /* --------------------------------------------------------------- helpers */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var TOKEN = /(https?:\/\/[^\s]+)|(@[A-Za-z0-9_]{1,15})|(#[\p{L}\p{N}_]+)/gu;
  function shortUrl(u) {
    var t = u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    return t.length > 28 ? t.slice(0, 27) + '…' : t;
  }
  function richText(container, text) {
    var last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text))) {
      if (m.index > last) container.appendChild(document.createTextNode(text.slice(last, m.index)));
      var raw = m[0], trail = '';
      if (m[1]) { var t = /[)\].,、。!?！？」』）]+$/.exec(raw); if (t) { trail = t[0]; raw = raw.slice(0, -trail.length); } }
      if (m[1]) {
        var a = el('a', '', shortUrl(raw)); a.href = raw; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = raw;
        container.appendChild(a);
      } else container.appendChild(el('span', 'tag', raw));
      if (trail) container.appendChild(document.createTextNode(trail));
      last = m.index + m[0].length;
    }
    if (last < text.length) container.appendChild(document.createTextNode(text.slice(last)));
  }

  var DIRS = {
    left: { emoji: '\uD83D\uDC4B', kind: 'remove' },
    right: { emoji: '\uD83E\uDD1D', kind: 'keep' },
    up: { emoji: '\uD83D\uDCC1', kind: 'folder' },
    down: { emoji: '\u23F3', kind: 'later' }
  };
  var KIND_DIR = { remove: 'left', keep: 'right', folder: 'up', later: 'down' };
  var STAMP_ROT = { left: 12, right: -12, up: -4, down: 4 };
  
  /* ------------------------------------------------------------------ mount */
  function mount(opts) {
    var adapter = opts.adapter;
    var host = document.createElement('div');
    host.id = 'xbs-overlay-host';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
    var sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = '<style>' + CSS + '</style>' + template();
    (opts.container || document.body).appendChild(host);

    function $(s) { return sh.querySelector(s); }
    var root = $('.root'), stage = $('.stage'), toastEl = $('.toast'), toastText = $('.t-text'), toastUndo = $('.t-undo');
    var countEl = $('.count'), plusEl = $('.plus'), countSr = $('.count-sr'), resultsEl = $('.results'), barEl = $('.bar>i');
    var sheet = $('.sheet'), chipsEl = $('.chips'), scrim = $('.scrim'), settingsEl = $('.settings');
    var doneEl = $('.done'), skeleton = $('.skeleton');
    var tints = {}; sh.querySelectorAll('.tint').forEach(function (t) { tints[t.dataset.d] = t; });
    var btn = {}; sh.querySelectorAll('.cbtn').forEach(function (b) { btn[b.dataset.k] = b; });

    var theme = opts.theme || 'auto';
    function applyTheme() {
      var t = theme === 'auto' ? (G.matchMedia && G.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
      root.dataset.theme = t;
    }
    applyTheme();
    var mqDark = G.matchMedia ? G.matchMedia('(prefers-color-scheme: dark)') : null;
    if (mqDark && mqDark.addEventListener) mqDark.addEventListener('change', applyTheme);
    var reduced = XBS.physics.reduced;

    /* ---- state ---- */
    var destroyed = false;
    var all = [], byId = new Map();
    var deck = [];
    var sessionDone = new Set();
    var reviewed = new Set();
    var settings = { showAll: false };
    var counts = { removed: 0, kept: 0, foldered: 0, later: 0 };
    var history = [];
    var finished = false, stalled = false;
    var caps = { delete: true, create: true, folder: true, unfolder: true, auth: true };
    var folders = [], foldersReady = false;
    var ui = { modal: null, done: false };
    var cards = new Map();           // id -> card（山札の上位3枚）
    var leaving = new Set();
    var t0 = Date.now();
    var toastTimer = 0, tintTimer = 0;
    var dragging = null;
    var stageW = 800, stageH = 600;

    var queue = new XBS.CommitQueue({
      send: function (op, o) { return adapter.commit(op, o || {}); },
      sendUrgent: function (ops) { adapter.flushSync(ops); },
      onFail: onCommitFail
    });

    /* ------------------------------------------------------------ card DOM */
    function mediaBlock(list, hero) {
      var n = Math.min(list.length, 4);
      var box = el('div', 'media n' + n);
      if (n === 1 && list[0].w && list[0].h) {
        box.style.aspectRatio = String(clamp(list[0].w / list[0].h, 0.8, 1.9));
      } else if (n === 1) box.style.aspectRatio = '16/10';
      for (var i = 0; i < n; i++) {
        var m = list[i], cell = el('div');
        var img = el('img'); img.src = m.url; img.alt = ''; img.draggable = false; img.decoding = 'async';
        cell.appendChild(img);
        if (m.type !== 'photo') {
          var pl = el('div', 'play'); pl.innerHTML = '<i>' + ICON.play + '</i>'; cell.appendChild(pl);
          if (m.type === 'gif') cell.appendChild(el('span', 'gif', 'GIF'));
        }
        box.appendChild(cell);
      }
      return box;
    }
    function textBlock(text, cls) {
      var p = el('p', 'text ' + (cls || 'clamp'));
      richText(p, text);
      return p;
    }
    function buildCard(item) {
      var c = el('div', 'card');
      c.setAttribute('role', 'group');
      c.setAttribute('aria-label', t('cardLabel', { name: item.name }));
      var lift = el('div', 'lift'); c.appendChild(lift);
      var face = el('div', 'face'); c.appendChild(face);
      var melt = el('div', 'melt'); face.appendChild(melt);
      var veil = el('div', 'veil'); c.appendChild(veil);
      var stamps = {};
      Object.keys(DIRS).forEach(function (d) {
        var s = el('div', 'stamp'); s.setAttribute('aria-hidden', 'true'); s.appendChild(el('span', 'em', DIRS[d].emoji)); s.dataset.d = d; face.appendChild(s); stamps[d] = s;
      });
      var au = el('div', 'author');
      var av = el('img', 'av'); av.src = item.avatar || ''; av.alt = ''; av.draggable = false;
      au.appendChild(av);
      var who = el('div', 'who');
      who.appendChild(el('b', '', item.name || item.screen));
      who.appendChild(el('span', '', '@' + item.screen + (item.createdAt ? ' ・ ' + relTime(item.createdAt) : '')));
      au.appendChild(who);
      face.appendChild(au);

      var hero = !item.text && item.media.length;
      var body = el('div', 'body' + (hero ? ' hero' : ''));
      var textEl = null, more = null;
      if (item.text) {
        textEl = textBlock(item.text, 'clamp');
        body.appendChild(textEl);
        more = el('button', 'more', t('more')); more.type = 'button'; more.hidden = true; more.dataset.nodrag = '1';
        more.setAttribute('aria-expanded', 'false');
        body.appendChild(more);
      }
      if (item.media.length) { var mb = mediaBlock(item.media, hero); mb.classList.add('fill'); body.appendChild(mb); }
      else if (!item.quote && item.text && item.text.length <= 220) {
        var len = item.text.length;
        body.classList.add('solo');
        body.style.setProperty('--solo-fs', (len <= 50 ? 26 : len <= 120 ? 22 : 19) + 'px');
      }
      if (item.quote) {
        var q = item.quote, qb = el('div', 'quote');
        var qh = el('div', 'q-head');
        var qa = el('img', 'av'); qa.src = q.avatar || ''; qa.alt = ''; qa.draggable = false;
        qh.appendChild(qa); qh.appendChild(el('b', '', q.name || q.screen)); qh.appendChild(el('span', '', '@' + q.screen));
        qb.appendChild(qh);
        if (q.text) qb.appendChild(textBlock(q.text, 'clamp'));
        if (q.media.length) qb.appendChild(mediaBlock(q.media.slice(0, 1)));
        body.appendChild(qb);
      }
      face.appendChild(body);

      var foot = el('div', 'foot');
      [['reply', item.counts.reply], ['repost', item.counts.repost], ['like', item.counts.like]].forEach(function (x) {
        var m = el('span', 'm'); m.innerHTML = ICON[x[0]]; m.appendChild(el('span', '', fmtCount(x[1])));
        m.setAttribute('aria-label', t(x[0]) + ' ' + x[1]);
        foot.appendChild(m);
      });
      var open = el('a', 'open'); open.href = item.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
      open.dataset.nodrag = '1'; open.setAttribute('aria-label', t('openXLabel'));
      open.innerHTML = t('openX') + ' ' + ICON.ext; foot.appendChild(open);
      face.appendChild(foot);

      var card = {
        id: item.id, item: item, el: c, lift: lift, melt: melt, veil: veil, stamps: stamps, body: body,
        p: { x: 0, y: 0, r: 0, s: 1, o: 1, m: 0 }, d: 3,
        crossed: {}, stampVal: {}, locked: false, w: 440, h: 500, anim: null, depthAnim: null, flyHandle: null
      };
      if (more) {
        more.addEventListener('click', function () {
          var ex = body.classList.toggle('expanded');
          textEl.classList.toggle('clamp', !ex);
          more.textContent = ex ? t('less') : t('more');
          more.setAttribute('aria-expanded', String(ex));
        });
        card.measure = function () {
          if (textEl.scrollHeight > textEl.clientHeight + 2) more.hidden = false;
        };
      }
      return card;
    }

    function render(card) {
      var p = card.p, d = card.d;
      var sc = p.s * (1 - 0.05 * d), ty = p.y + 10 * d;
      var st = card.el.style;
      st.transform = 'translate3d(' + p.x.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) rotate(' + p.r.toFixed(3) + 'deg) scale(' + sc.toFixed(4) + ')';
      st.opacity = clamp(p.o, 0, 1).toFixed(3);
      var vl = clamp(0.14 * d, 0, 0.6);
      if (card.lastVeil !== vl) { card.veil.style.opacity = vl.toFixed(3); card.lastVeil = vl; }
      var lf = card.dragging ? 1 : clamp(Math.hypot(p.x, p.y) / 80, 0, 1);
      if (card.lastLift !== lf) { card.lift.style.opacity = lf; card.lastLift = lf; }
      if (card.lastMelt !== p.m) { card.melt.style.opacity = clamp(p.m, 0, 0.85); card.lastMelt = p.m; }
      if (!card.locked && deck[0] === card.item) updateStamps(card);
    }

    /* ------------------------------------------------------------- stamps */
    function folderEnabled() { return caps.folder && foldersReady && folders.length > 0; }
    function updateStamps(card) {
      var x = card.p.x, y = card.p.y, w = card.w, h = card.h;
      var ax = Math.abs(x), ay = Math.abs(y);
      var pr = { left: 0, right: 0, up: 0, down: 0 };
      if (ax >= ay) pr[x < 0 ? 'left' : 'right'] = ax / (w * 0.28);
      else if (y < 0) pr.up = folderEnabled() ? -y / (h * 0.22) : 0;
      else pr.down = y / (h * 0.22);
      Object.keys(pr).forEach(function (d) {
        var v = clamp((pr[d] - 0.2) / 0.8, 0, 1);
        if (card.stampVal[d] !== v) {
          card.stampVal[d] = v;
          card.stamps[d].style.opacity = v;
          if (tints[d]) tints[d].style.opacity = (v * 0.10).toFixed(3);
        }
        var cr = pr[d] >= 1;
        if (cr && !card.crossed[d]) { popStamp(card, d); try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* ignore */ } }
        card.crossed[d] = cr;
      });
    }
    function popStamp(card, d) {
      if (reduced()) return;
      var s = card.stamps[d], r = STAMP_ROT[d];
      try {
        s.animate([{ transform: 'rotate(' + r + 'deg) scale(1)' }, { transform: 'rotate(' + r + 'deg) scale(1.08)', offset: 0.45 }, { transform: 'rotate(' + r + 'deg) scale(1)' }], { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
      } catch (e) { /* ignore */ }
    }
    function clearTints(delay) {
      clearTimeout(tintTimer);
      tintTimer = setTimeout(function () { Object.keys(tints).forEach(function (d) { tints[d].style.opacity = 0; }); }, delay || 0);
    }

    /* ------------------------------------------------------- deck + stack */
    function eligible(it) {
      return !sessionDone.has(it.id) && (settings.showAll || !reviewed.has(it.id));
    }
    /* 山札の先頭3枚は引いた後は固定。それ以降（未引きの池）のランダムな位置に差し込む＝次に引くカードは池から一様ランダム */
    function insertRandom(it) {
      var lo = Math.min(3, deck.length);
      deck.splice(lo + Math.floor(Math.random() * (deck.length - lo + 1)), 0, it);
    }
    function addItems(items) {
      var added = 0, fresh = [];
      items.forEach(function (it) {
        if (!it || byId.has(it.id)) return;
        byId.set(it.id, it); all.push(it); added++;
        if (eligible(it)) fresh.push(it);
      });
      while (fresh.length) {   // 空いている先頭枠は到着分から無作為に引く。残りは池へ
        var pick = fresh.splice(Math.floor(Math.random() * fresh.length), 1)[0];
        if (deck.length < 3) deck.push(pick); else insertRandom(pick);
      }
      if (added) { ui.done && hideDone(); sync(); }
    }
    function rebuildDeck() {
      cards.forEach(function (c) { c.el.remove(); });
      cards.clear();
      deck = all.filter(eligible);
      for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
      sync();
    }
    function topCard() { return deck[0] ? cards.get(deck[0].id) : null; }

    function sync() {
      if (destroyed) return;
      var keep = new Set();
      for (var i = 0; i < Math.min(3, deck.length); i++) {
        var it = deck[i], c = cards.get(it.id);
        if (!c) {
          c = buildCard(it); cards.set(it.id, c);
          stage.appendChild(c.el);
          c.d = i + (reduced() ? 0 : 1);
          if (c.measure) requestAnimationFrame(c.measure);
          render(c);
        }
        keep.add(it.id);
        c.el.style.zIndex = String(10 - i);
        c.el.style.pointerEvents = i === 0 ? '' : 'none';
        c.el.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
        if (i > 0) c.el.setAttribute('inert', ''); else c.el.removeAttribute('inert');
        if (c.d !== i) {
          if (c.depthAnim) c.depthAnim.cancel();
          if (reduced()) { c.d = i; render(c); }
          else c.depthAnim = spring(c, { d: i }, { stiffness: 300, damping: 26, onUpdate: (function (cc) { return function () { render(cc); }; })(c) });
        }
      }
      cards.forEach(function (c, id) {
        if (!keep.has(id)) {
          if (c.anim) c.anim.cancel();
          if (c.depthAnim) c.depthAnim.cancel();
          c.el.remove(); cards.delete(id);
        }
      });
      // 先読み：次の数枚の画像
      for (var j = 0; j < Math.min(6, deck.length); j++) {
        var d = deck[j], urls = d.media.slice(0, 4).map(function (m) { return m.url; }).concat([d.avatar]);
        for (var k = 0; k < urls.length; k++) preload(urls[k]);
      }
      updateChrome();
      if (!finished) adapter.loadMore();   // 山札の量に関係なく、全件読み終えるまでバックグラウンドで読み込む
    }
    var preloaded = new Set();
    function preload(u) {
      if (!u || preloaded.has(u)) return;
      preloaded.add(u);
      var im = new Image(); im.decoding = 'async'; im.src = u;
    }

    /* ---------------------------------------------------- header / chrome */
    var curCount = null;
    function setCount(n, dir) {
      var txt = String(n);
      if (curCount === txt) return;
      var old = countEl.lastElementChild, span = el('span', '', txt);
      countEl.appendChild(span);
      countSr.textContent = t('remaining', { n: txt });
      if (old && !reduced() && curCount !== null) {
        var up = dir !== 'down';
        Array.prototype.slice.call(countEl.children).forEach(function (c) { if (c !== old && c !== span) c.remove(); });
        try {
          old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(' + (up ? -55 : 55) + '%)', opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.3,.9,.3,1)', fill: 'forwards' }).onfinish = function () { old.remove(); };
          span.animate([{ transform: 'translateY(' + (up ? 55 : -55) + '%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1)' });
        } catch (e) { old.remove(); }
      } else {
        while (countEl.firstChild !== span) countEl.removeChild(countEl.firstChild);
      }
      curCount = txt;
    }
    var lastRemaining = null;
    function updateChrome() {
      var remaining = deck.length;
      setCount(remaining, lastRemaining != null && remaining > lastRemaining ? 'down' : 'up');
      lastRemaining = remaining;
      plusEl.hidden = finished;
      var handled = counts.removed + counts.kept + counts.foldered;
      var kk = counts.kept + counts.foldered;
      resultsEl.innerHTML = '<span aria-hidden="true"><span class="em">' + DIRS.left.emoji + '</span><b>' + counts.removed + '</b><span class="gap"></span><span class="em">' + DIRS.right.emoji + '</span><b>' + kk + '</b></span><span class="sr">' + t('results', { a: counts.removed, b: kk }) + '</span>';
      var tot = handled + remaining;
      barEl.style.transform = 'scaleX(' + (tot ? handled / tot : 0).toFixed(4) + ')';
      setDisabled(btn.remove, !caps.delete, t('noDelete'));
      setDisabled(btn.folder, !folderEnabled(), foldersReady ? (folders.length ? '' : t('noFolders')) : t('foldersLoading'));
      setDisabled(btn.undo, history.length === 0);
      setDisabled(btn.keep, false); setDisabled(btn.later, false);
      toastUndo.disabled = history.length === 0;
      var empty = deck.length === 0 && leaving.size === 0;
      skeleton.hidden = !(empty && !finished);
      if (empty && finished && !ui.done) showDone();
    }
    function setDisabled(b, dis) {
      b.setAttribute('aria-disabled', dis ? 'true' : 'false');
    }

    /* -------------------------------------------------------------- toast */
    function toast(text, o) {
      o = o || {};
      toastText.textContent = '';
      if (o.emoji || o.icon) {
        var vis = el('span', 't-em'); vis.setAttribute('aria-hidden', 'true');
        if (o.icon) vis.innerHTML = o.icon; else vis.textContent = o.emoji;
        toastText.appendChild(vis);
        if (o.label) { var lb = el('span', '', o.label); lb.setAttribute('aria-hidden', 'true'); toastText.appendChild(lb); }
        toastText.appendChild(el('span', 'sr', text));
      } else toastText.textContent = text;
      toastUndo.hidden = !o.undo;
      toastEl.classList.add('show');
      toastEl.setAttribute('aria-hidden', 'false');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(hideToast, o.ms || 4000);
      if (!reduced() && o.pop !== false) {
        try { toastEl.animate([{ scale: '0.96' }, { scale: '1' }], { duration: 180, easing: 'ease-out' }); } catch (e) { /* ignore */ }
      }
    }
    function hideToast() { toastEl.classList.remove('show'); toastEl.setAttribute('aria-hidden', 'true'); }

    /* ------------------------------------------------------- fly + spring */
    function bake(card) {
      // 山札の奥行きによる見た目を p に取り込み、d を 0 にする
      var d = card.d;
      if (d) {
        card.p.y += 10 * d; card.p.s *= (1 - 0.05 * d); card.d = 0;
      }
    }
    function settle(card) {
      if (card.anim) { card.anim.cancel(); card.anim = null; }
      if (card.depthAnim) { card.depthAnim.cancel(); card.depthAnim = null; }
      card.dragging = false;
    }
    function springBack(card, vx, vy, thenFn) {
      if (card.anim) card.anim.cancel();
      card.dragging = false;
      root.classList.remove('grabbing');
      if (reduced()) {
        card.p.x = 0; card.p.y = 0; card.p.r = 0; card.p.s = 1; render(card);
        if (thenFn) thenFn(); return;
      }
      card.anim = spring(card.p, { x: 0, y: 0, r: 0, s: 1 }, {
        stiffness: 400, damping: 28, vel: { x: clamp(vx, -3500, 3500), y: clamp(vy, -3500, 3500) },
        onUpdate: function () { render(card); },
        onDone: function () { card.anim = null; card.el.style.transformOrigin = ''; if (thenFn) thenFn(); }
      });
    }
    function nudge(card) {
      if (reduced()) return;
      springBack(card, 700, 0);
    }

    function flyTarget(card, kind, o) {
      var p = card.p, cw = card.el.offsetWidth || 440, ch = card.el.offsetHeight || 500;
      var out = { x: p.x, y: p.y, r: p.r, s: p.s, o: 0, m: 0 };
      var exitX = stageW / 2 + cw / 2 + 80, exitY = stageH / 2 + ch / 2 + 80;
      var vx = (o && o.vx) || 0, vy = (o && o.vy) || 0;
      var dur = 260;
      if (kind === 'remove') {
        out.x = -exitX; out.y = p.y + 50 + clamp(vy * 120, -140, 140); out.r = p.r - 8; out.s = 0.9; out.m = 1;
      } else if (kind === 'keep') {
        out.x = exitX; out.y = p.y - 90 + clamp(vy * 120, -140, 140); out.r = p.r + 14; out.s = 0.96;
      } else if (kind === 'later') {
        out.y = exitY; out.x = p.x + clamp(vx * 120, -140, 140); out.r = p.r + (vx > 0 ? 4 : -4); out.s = 0.96; dur = 240;
      } else if (kind === 'folder' && o && o.chipRect) {
        var r = card.el.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var tx = o.chipRect.left + o.chipRect.width / 2, ty = o.chipRect.top + o.chipRect.height / 2;
        out.x = p.x + (tx - cx); out.y = p.y + (ty - cy); out.s = 0.06; out.r = 0; dur = 360;
      }
      if (o && (Math.abs(vx) > 0.6 || Math.abs(vy) > 0.6) && kind !== 'folder') {
        var dist = Math.hypot(out.x - p.x, out.y - p.y), sp = Math.hypot(vx, vy);
        dur = clamp(3 * dist / Math.max(sp, 0.01), 170, 280);
      }
      return { to: out, dur: dur };
    }

    function fly(card, kind, o) {
      card.locked = true;
      var d = KIND_DIR[kind];
      if (kind !== 'folder') {
        card.stamps[d].style.opacity = 1; card.stampVal[d] = 1;
        if (!card.crossed[d]) { card.crossed[d] = true; popStamp(card, d); }
        tints[d].style.opacity = '0.10';
        clearTints(260);
      }
      leaving.add(card);
      var done = function () { leaving.delete(card); card.el.remove(); card.flyHandle = null; updateChrome(); };
      var pose;
      if (reduced()) {
        pose = { x: 0, y: 0, r: 0, s: 1, o: 0, m: 0 };
        card.flyHandle = tween(card.p, { o: 0 }, { duration: 140, ease: ease.out, onUpdate: function () { render(card); }, onDone: done });
        return pose;
      }
      var t = flyTarget(card, kind, o);
      pose = Object.assign({}, t.to);
      card.flyHandle = tween(card.p, t.to, {
        duration: t.dur, ease: kind === 'folder' ? ease.inOut : ease.out,
        onUpdate: function () { render(card); }, onDone: done
      });
      return pose;
    }
    function finishLeaving() {
      Array.from(leaving).forEach(function (c) { if (c.flyHandle) c.flyHandle.finish(); else { leaving.delete(c); c.el.remove(); } });
    }

    /* ----------------------------------------------------------- actions */
    function reason(what) {
      if (what === 'delete') return t('needDelete');
      if (what === 'folder') return folders.length || !foldersReady ? t('needFolder') : t('noFoldersDot');
      return '';
    }
    function act(kind, o) {
      if (destroyed || ui.modal) return false;
      finishLeaving();
      var item = deck[0], card = topCard();
      if (!item || !card) return false;
      if (kind === 'remove' && !caps.delete) { nudge(card); toast(reason('delete'), { ms: 5000 }); return false; }
      if (kind === 'folder') {
        if (!folderEnabled()) { springBack(card, 0, 0); toast(reason('folder'), { ms: 3500 }); return false; }
        openSheet(card, o);
        return true;
      }
      commit(kind, card, o || {});
      return true;
    }

    function commit(kind, card, o) {
      var item = card.item;
      settle(card); bake(card);
      deck.shift();
      cards.delete(item.id);
      var entry = { kind: kind, item: item, op: null, pose: null, folder: o.folder || null };
      var msg, em, lab;
      if (kind === 'remove') {
        counts.removed++; sessionDone.add(item.id);
        entry.op = queue.add({ kind: 'remove', tweetId: item.id });
        msg = t('msgRemoved'); em = DIRS.left.emoji;
      } else if (kind === 'keep') {
        counts.kept++; sessionDone.add(item.id); reviewed.add(item.id); adapter.setReviewed(item.id, true);
        msg = t('msgKept'); em = DIRS.right.emoji;
      } else if (kind === 'folder') {
        counts.foldered++; sessionDone.add(item.id); reviewed.add(item.id); adapter.setReviewed(item.id, true);
        entry.op = queue.add({ kind: 'folder', tweetId: item.id, folderId: o.folder.id, folderName: o.folder.name });
        msg = t('msgFolder', { name: o.folder.name }); em = DIRS.up.emoji; lab = o.folder.name;
      } else {
        counts.later++;
        insertRandom(item);   // 池のランダムな位置に戻す
        msg = t('msgLater'); em = DIRS.down.emoji;
      }
      history.push(entry); if (history.length > 300) history.shift();
      entry.pose = fly(card, kind, o);
      sync();
      toast(msg, { undo: true, emoji: em, label: lab });
    }

    function undo() {
      if (destroyed || ui.modal === 'folder') return false;
      var e = history.pop();
      if (!e) { toast(t('msgNothingToUndo'), { ms: 1800, icon: ICON.undo.replace('width="24" height="24"', 'width="20" height="20"') }); return false; }
      finishLeaving();
      var item = e.item;
      if (e.kind === 'remove') {
        counts.removed--; sessionDone.delete(item.id);
        if (!queue.cancel(e.op)) enqueueInverse({ kind: 'restore', tweetId: item.id });
      } else if (e.kind === 'keep') {
        counts.kept--; sessionDone.delete(item.id); reviewed.delete(item.id); adapter.setReviewed(item.id, false);
      } else if (e.kind === 'folder') {
        counts.foldered--; sessionDone.delete(item.id); reviewed.delete(item.id); adapter.setReviewed(item.id, false);
        if (!queue.cancel(e.op)) enqueueInverse({ kind: 'unfolder', tweetId: item.id, folderId: e.folder.id, folderName: e.folder.name });
      } else {
        counts.later--;
        var ix = deck.lastIndexOf(item); if (ix >= 0) deck.splice(ix, 1);
      }
      if (ui.done) hideDone();
      bringBack(item, e.pose);
      toast(t('msgUndone'), { undo: history.length > 0, icon: ICON.undo.replace('width="24" height="24"', 'width="20" height="20"') });
      return true;
    }
    function enqueueInverse(op) {
      op.inverse = true;
      queue.add(op, { delay: 0 });
    }
    /* 逆再生：退場した位置から、ばねで中央へ戻ってくる */
    function bringBack(item, pose) {
      var old = cards.get(item.id);
      if (old) { old.el.remove(); cards.delete(item.id); }
      deck.unshift(item);
      sync();
      var card = cards.get(item.id);
      if (!card) return;
      settle(card);
      card.d = 0; card.depthAnim = null;
      if (reduced() || !pose) {
        card.p.o = 0; render(card);
        card.anim = tween(card.p, { o: 1 }, { duration: 160, onUpdate: function () { render(card); }, onDone: function () { card.anim = null; } });
        return;
      }
      card.p.x = pose.x; card.p.y = pose.y; card.p.r = pose.r; card.p.s = pose.s; card.p.o = 0; card.p.m = pose.m || 0;
      render(card);
      card.locked = true;
      card.anim = spring(card.p, { x: 0, y: 0, r: 0, s: 1, o: 1, m: 0 }, {
        stiffness: 260, damping: 25,
        onUpdate: function () { render(card); },
        onDone: function () { card.anim = null; card.locked = false; }
      });
    }
    function onCommitFail(op, err) {
      if (destroyed) return;
      if (op.inverse) { toast(t('msgUndoFailed'), { ms: 4500 }); return; }
      var ix = -1;
      for (var i = history.length - 1; i >= 0; i--) if (history[i].op === op) { ix = i; break; }
      if (ix < 0) return;
      var e = history.splice(ix, 1)[0], item = e.item;
      if (e.kind === 'remove') { counts.removed--; }
      else if (e.kind === 'folder') { counts.foldered--; reviewed.delete(item.id); adapter.setReviewed(item.id, false); }
      sessionDone.delete(item.id);
      finishLeaving();
      bringBack(item, e.pose);
      toast((e.kind === 'remove' ? t('msgRemoveFailed') : t('msgFolderFailed')) + (I18N.lang === 'ja' ? '。' : '. ') + t('msgCardBack') + (err && err.message ? (I18N.lang === 'ja' ? '（' + err.message + '）' : ' (' + err.message + ')') : ''), { ms: 6000 });
    }

    /* ------------------------------------------------------ folder sheet */
    var chipBtns = [];
    function openSheet(card, o) {
      ui.modal = 'folder';
      chipsEl.textContent = '';
      chipBtns = folders.map(function (f, i) {
        var b = el('button', 'chip'); b.type = 'button';
        b.innerHTML = ICON.folder.replace('width="24" height="24"', 'width="20" height="20"');
        b.appendChild(el('span', '', f.name));
        if (i < 9) b.appendChild(el('kbd', '', String(i + 1)));
        b.setAttribute('aria-label', i < 9 ? t('folderChipN', { name: f.name, n: i + 1 }) : t('folderChip', { name: f.name }));
        b.addEventListener('click', function () { chooseFolder(i); });
        chipsEl.appendChild(b); return b;
      });
      sheet.classList.add('show'); sheet.setAttribute('aria-hidden', 'false'); scrim.classList.add('show');
      settle(card); card.locked = true;
      var vx = (o && o.vx || 0) * 1000, vy = (o && o.vy || 0) * 1000;
      if (reduced()) { card.p.x = 0; card.p.y = -40; card.p.r = 0; card.p.s = 0.97; render(card); }
      else card.anim = spring(card.p, { x: 0, y: -40, r: 0, s: 0.97 }, { stiffness: 300, damping: 26, vel: { x: clamp(vx, -3000, 3000), y: clamp(vy, -3000, 3000) }, onUpdate: function () { render(card); }, onDone: function () { card.anim = null; } });
      var s = card.stamps.up; s.style.opacity = 1;
      setTimeout(function () { if (chipBtns[0]) chipBtns[0].focus({ preventScroll: true }); }, 60);
    }
    function closeSheet() {
      sheet.classList.remove('show'); sheet.setAttribute('aria-hidden', 'true'); scrim.classList.remove('show');
      ui.modal = null;
    }
    function cancelSheet() {
      if (ui.modal !== 'folder') return;
      var card = topCard();
      closeSheet();
      root.focus({ preventScroll: true });
      if (card) {
        card.stamps.up.style.opacity = 0; card.stampVal.up = 0; card.crossed = {};
        card.locked = false;
        springBack(card, 0, 0);
      }
      clearTints(0);
    }
    function chooseFolder(i) {
      if (ui.modal !== 'folder' || !folders[i]) return;
      var card = topCard(); if (!card) return;
      var chip = chipBtns[i], rect = chip.getBoundingClientRect();
      var f = folders[i];
      closeSheet();
      root.focus({ preventScroll: true });
      clearTints(0);
      finishLeaving();
      commit('folder', card, { folder: f, chipRect: rect });
      if (!reduced()) try { chip.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 300, delay: 280 }); } catch (e) { /* ignore */ }
    }

    /* --------------------------------------------------------------- done */
    function showDone() {
      ui.done = true;
      var handled = counts.removed + counts.kept + counts.foldered;
      doneEl.querySelector('.d-sub').textContent = stalled && !all.length
        ? t('stalled')
        : handled ? t('handled', { n: handled })
          : all.length ? t('nothingNew') : t('noBookmarks');
      var st = doneEl.querySelector('.stats'); st.textContent = '';
      [['left', counts.removed, 'removed'], ['right', counts.kept, 'kept'], ['up', counts.foldered, 'foldered']].forEach(function (x) {
        var d = el('div'); d.title = t(x[2]);
        var e = el('span', 'em', DIRS[x[0]].emoji); e.setAttribute('aria-hidden', 'true'); d.appendChild(e);
        d.appendChild(el('b', '', String(x[1]))); d.appendChild(el('span', 'sr', t(x[2]))); st.appendChild(d);
      });
      doneEl.querySelector('.d-time').setAttribute('aria-label', t('elapsed', { t: fmtDuration(Date.now() - t0) }));
      doneEl.querySelector('.d-time').textContent = handled ? '\u23F1 ' + fmtDuration(Date.now() - t0) : '';
      doneEl.querySelector('[data-b=undo2]').hidden = history.length === 0;
      doneEl.classList.add('show'); doneEl.setAttribute('aria-hidden', 'false');
      hideToast();
      setTimeout(function () { var p = doneEl.querySelector('.pill:not(.ghost)'); if (ui.done && p) p.focus({ preventScroll: true }); }, 400);
    }
    function hideDone() {
      ui.done = false;
      doneEl.classList.remove('show'); doneEl.setAttribute('aria-hidden', 'true');
      root.focus({ preventScroll: true });
    }

    /* ----------------------------------------------------------- settings */
    function toggleSettings(force) {
      var show = force != null ? force : !settingsEl.classList.contains('show');
      settingsEl.classList.toggle('show', show);
      settingsEl.setAttribute('aria-hidden', String(!show));
      ui.modal = show ? 'settings' : (ui.modal === 'settings' ? null : ui.modal);
      if (show) { sh.querySelector('.s-all').checked = !!settings.showAll; sh.querySelector('.s-n').textContent = String(reviewed.size); sh.querySelector('.s-all').focus({ preventScroll: true }); }
      else root.focus({ preventScroll: true });
    }
    sh.querySelector('.s-all').addEventListener('change', function (e) {
      settings.showAll = e.target.checked; adapter.setSettings(settings); rebuildDeck();
      if (ui.done && deck.length) hideDone();
    });
    sh.querySelector('.reset').addEventListener('click', function () {
      reviewed.clear(); adapter.clearReviewed(); sh.querySelector('.s-n').textContent = '0';
      rebuildDeck(); toast(t('resetDone'), { ms: 2500 });
    });

    /* ---------------------------------------------------------- pointer */
    function measureStage() { stageW = stage.clientWidth; stageH = stage.clientHeight; }
    measureStage();
    var ro = G.ResizeObserver ? new G.ResizeObserver(measureStage) : null;
    if (ro) ro.observe(stage);

    stage.addEventListener('pointerdown', function (e) {
      if (ui.modal || ui.done || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var card = topCard();
      if (!card || !card.el.contains(e.target) && !e.composedPath().includes(card.el)) return;
      var path = e.composedPath();
      for (var i = 0; i < path.length && path[i] !== card.el; i++) {
        var n = path[i];
        if (n.dataset && n.dataset.nodrag) return;
        if (n.tagName === 'A' || n.tagName === 'BUTTON') return;
      }
      if (card.anim) { card.anim.cancel(); card.anim = null; }
      card.w = card.el.offsetWidth; card.h = card.el.offsetHeight;
      var r = card.el.getBoundingClientRect();
      dragging = {
        id: e.pointerId, card: card, sx: e.clientX, sy: e.clientY, ox: card.p.x, oy: card.p.y,
        started: false, samples: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }],
        sign: (e.clientY - r.top) < r.height / 2 ? 1 : -1
      };
      try { card.el.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    });
    stage.addEventListener('pointermove', function (e) {
      var D = dragging; if (!D || e.pointerId !== D.id) return;
      var card = D.card, dx = e.clientX - D.sx, dy = e.clientY - D.sy;
      if (!D.started) {
        if (Math.hypot(dx, dy) < 4) return;
        D.started = true; card.dragging = true;
        if (Math.abs(card.p.r) < 0.3) card.el.style.transformOrigin = D.sign > 0 ? '50% 88%' : '50% 12%';
        root.classList.add('grabbing');
        if (reduced()) card.p.s = 1; else card.anim = spring(card.p, { s: 1.02 }, { stiffness: 500, damping: 30, onUpdate: function () { render(card); }, onDone: function () { card.anim = null; } });
      }
      var y = D.oy + dy;
      if (y < D.oy && !folderEnabled()) y = D.oy + dy * 0.3;   // 無効な方向は抵抗を感じる
      card.p.x = D.ox + dx; card.p.y = y;
      card.p.r = reduced() ? 0 : clamp(card.p.x * 0.06 * D.sign, -18, 18);
      render(card);
      D.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
      while (D.samples.length > 2 && e.timeStamp - D.samples[0].t > 100) D.samples.shift();
    });
    function endDrag(e, cancelled) {
      var D = dragging; if (!D || e.pointerId !== D.id) return;
      dragging = null;
      var card = D.card;
      try { card.el.releasePointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      root.classList.remove('grabbing');
      if (!D.started) return;
      var s = D.samples, a = s[0], b = s[s.length - 1], vx = 0, vy = 0;
      if (!cancelled && s.length > 1 && e.timeStamp - b.t < 80 && b.t > a.t) {
        vx = (b.x - a.x) / (b.t - a.t); vy = (b.y - a.y) / (b.t - a.t);
      }
      var dir = cancelled ? null : decide(card.p.x, card.p.y - D.oy, vx, vy, card.w, card.h);
      if (!dir) { springBack(card, vx * 1000, vy * 1000); return; }
      var kind = DIRS[dir].kind;
      if (kind === 'remove' && !caps.delete) { springBack(card, vx * 1000, vy * 1000); toast(reason('delete'), { ms: 5000 }); return; }
      if (kind === 'folder' && !folderEnabled()) { springBack(card, vx * 1000, vy * 1000); toast(reason('folder'), { ms: 3500 }); return; }
      finishLeaving();
      if (kind === 'folder') openSheet(card, { vx: vx, vy: vy });
      else commit(kind, card, { vx: vx, vy: vy });
    }
    stage.addEventListener('pointerup', function (e) { endDrag(e, false); });
    stage.addEventListener('pointercancel', function (e) { endDrag(e, true); });
    stage.addEventListener('lostpointercapture', function (e) { if (dragging && e.pointerId === dragging.id) endDrag(e, false); });

    function decide(dx, dy, vx, vy, w, h) {
      var ax = Math.abs(dx), ay = Math.abs(dy), avx = Math.abs(vx), avy = Math.abs(vy);
      if (Math.max(avx, avy) > 0.6) {
        // フリックでも最低 56px は動かし、動かした向きと一致したときだけ確定（誤操作防止）
        if (avx >= avy && ax > 56 && vx * dx > 0) return vx < 0 ? 'left' : 'right';
        if (avy > avx && ay > 56 && vy * dy > 0) return vy < 0 ? 'up' : 'down';
      }
      if (ax >= ay) { if (ax > w * 0.28) return dx < 0 ? 'left' : 'right'; }
      else if (ay > h * 0.22) return dy < 0 ? 'up' : 'down';
      return null;
    }

    root.addEventListener('wheel', function (e) {
      var p = e.composedPath();
      for (var i = 0; i < p.length; i++) if (p[i].classList && p[i].classList.contains('expanded')) return;
      e.preventDefault();
    }, { passive: false });

    /* ---------------------------------------------------------- buttons */
    root.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button') : null;
      if (!t) { if (ui.modal === 'settings' && !e.target.closest('.settings')) toggleSettings(false); return; }
      if (t.dataset.k) {
        if (t.getAttribute('aria-disabled') === 'true' && t.dataset.k !== 'undo') {
          if (t.dataset.k === 'folder') toast(reason('folder'), { ms: 3500 });
          if (t.dataset.k === 'remove') toast(reason('delete'), { ms: 5000 });
          return;
        }
        if (t.dataset.k === 'undo') undo(); else act(t.dataset.k);
      } else if (t.dataset.b === 'close') close();
      else if (t.dataset.b === 'settings') toggleSettings();
      else if (t.dataset.b === 'undo2') undo();
    });
    toastUndo.addEventListener('click', function () { undo(); });
    scrim.addEventListener('click', cancelSheet);

    /* --------------------------------------------------------- keyboard */
    function onKey(e) {
      if (destroyed) return;
      var k = e.key, handled = true;
      if ((e.ctrlKey || e.altKey) && !(e.metaKey && (k === 'z' || k === 'Z'))) return;
      if (e.metaKey && !(k === 'z' || k === 'Z')) return;
      if (k === 'Escape') {
        if (ui.modal === 'folder') cancelSheet();
        else if (ui.modal === 'settings') toggleSettings(false);
        else close();
      } else if (e.metaKey || k === 'z' || k === 'Z') {
        if (k !== 'z' && k !== 'Z') handled = false; else if (!e.repeat) undo();
      } else if (ui.modal === 'folder') {
        if (/^[1-9]$/.test(k)) chooseFolder(Number(k) - 1);
        else if (k === 'Tab' || k === 'Enter' || k === ' ') handled = false;   // チップのフォーカス操作はそのまま
      } else if (ui.modal === 'settings') {
        handled = false;
      } else if (ui.done) {
        handled = false;
      } else if (k === 'ArrowLeft' || k === 'd' || k === 'D') { if (!e.repeat) act('remove'); }
      else if (k === 'ArrowRight' || k === 'k' || k === 'K') { if (!e.repeat) act('keep'); }
      else if (k === 'ArrowUp' || k === 'f' || k === 'F') { if (!e.repeat) act('folder'); }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { if (!e.repeat) act('later'); }
      else if (k === ' ' || k === 'o' || k === 'O') {
        if (!e.repeat && deck[0]) G.open(deck[0].url, '_blank', 'noopener,noreferrer');
      } else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
      else if (k.length === 1 || k.indexOf('Arrow') === 0) e.stopPropagation();   // X のショートカット（j/k など）に渡さない
    }
    function onKeyUp(e) { if (e.key === ' ' && !ui.modal) { e.preventDefault(); e.stopPropagation(); } }
    function onPageHide() { queue.flush(); }
    G.addEventListener('keydown', onKey, true);
    G.addEventListener('keyup', onKeyUp, true);
    G.addEventListener('pagehide', onPageHide);
    G.addEventListener('beforeunload', onPageHide);

    /* ---------------------------------------------------------- lifecycle */
    function close() {
      if (destroyed) return;
      queue.flush();
      destroy();
      if (opts.onClose) opts.onClose();
    }
    function destroy() {
      destroyed = true;
      G.removeEventListener('keydown', onKey, true);
      G.removeEventListener('keyup', onKeyUp, true);
      G.removeEventListener('pagehide', onPageHide);
      G.removeEventListener('beforeunload', onPageHide);
      if (mqDark && mqDark.removeEventListener) mqDark.removeEventListener('change', applyTheme);
      if (ro) ro.disconnect();
      clearTimeout(toastTimer); clearTimeout(tintTimer);
      if (stopFeed) stopFeed();
      queue.destroy();
      host.remove();
    }

    var stopFeed = null;
    Promise.all([adapter.getReviewed(), adapter.getSettings()]).then(function (r) {
      if (destroyed) return;
      reviewed = new Set(r[0] || []); settings = Object.assign(settings, r[1] || {});
      stopFeed = adapter.start({
        onItems: addItems,
        onDone: function (info) {
          finished = true; stalled = !!(info && info.stalled);
          if (info && info.stalled) toast(t('stalledToast'), { ms: 6000 });
          updateChrome();
        }
      });
      updateChrome();
    });
    Promise.resolve(adapter.getCaps ? adapter.getCaps() : null).then(function (c) {
      if (destroyed || !c) return;
      caps = Object.assign(caps, c); updateChrome();
    }, function () { /* 不明のまま：実行時に判明 */ });
    Promise.resolve(adapter.getFolders ? adapter.getFolders() : []).then(function (f) {
      if (destroyed) return;
      folders = f || []; foldersReady = true; updateChrome();
    }, function () { if (!destroyed) { foldersReady = true; folders = []; updateChrome(); } });

    updateChrome();
    root.focus({ preventScroll: true });

    return {
      close: close, flush: function () { queue.flush(); },
      setTheme: function (t) { theme = t; applyTheme(); },
      act: act, undo: undo,
      isOpen: function () { return !destroyed; },
      _state: function () { return { deck: deck.length, counts: counts, history: history.length, caps: caps, folders: folders, pending: queue.pending() }; }
    };
  }

  XBS.overlay = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
