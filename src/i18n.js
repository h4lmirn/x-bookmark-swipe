/* 言語の切り替え：navigator.language が ja で始まれば日本語、それ以外は英語。
   t(key, vars) で辞書を引く。相対時間・数の表記・所要時間もここで言語に合わせる。
   dev ページでは ?lang=ja|en で強制できる。 */
(function (G) {
  'use strict';
  var XBS = (G.XBS = G.XBS || {});

  var lang = 'en';
  try {
    var forced = G.location && /^https?:|^file:/.test(G.location.protocol) && G.location.hostname &&
      /^(localhost|127\.0\.0\.1|\[::1\])$/.test(G.location.hostname) &&
      new URLSearchParams(G.location.search).get('lang');
    var nav = forced || (G.navigator && (G.navigator.language || (G.navigator.languages && G.navigator.languages[0]))) || '';
    lang = /^ja/i.test(nav) ? 'ja' : 'en';
  } catch (e) { /* 英語のまま */ }

  var DICT = {
    ja: {
      fab: 'スワイプで整理',
      fabLabel: 'ブックマークをスワイプで整理する',
      dialog: 'ブックマークをスワイプで整理',
      bookmarks: 'ブックマーク',
      settings: '設定',
      done: 'おわり',
      doneLabel: 'おわり（Esc）',
      loading: '読み込み中',
      remaining: '残り {n} 件',
      removed: '外した',
      kept: '残した',
      foldered: 'フォルダへ',
      results: '外した {a} 件、残した {b} 件',
      removeLabel: '外す（ブックマークを解除）',
      laterLabel: 'あとで（山札の最後に回す）',
      folderLabel: 'フォルダへ入れる',
      keepLabel: '残す（確認済みにする）',
      undo: '元に戻す',
      folderTitle: 'フォルダに入れる',
      folderSheetLabel: 'フォルダを選択',
      folderHint: '数字キー 1〜9 で選択、Esc でキャンセル',
      folderChip: '{name}に入れる',
      folderChipN: '{name}に入れる（{n}）',
      showAll: '確認済みもすべて表示',
      showAllNote: 'オフのとき、「残す」「フォルダへ」にした投稿は次回から出ません。',
      resetRec: '記録をリセット（{n}件）',
      resetDone: '確認済みの記録をリセットしました',
      doneTitle: '整理完了',
      closePill: '閉じる',
      cardLabel: '{name} の投稿',
      more: '続きを読む',
      less: '閉じる',
      openX: 'Xで開く',
      openXLabel: 'Xで開く（新しいタブ）',
      reply: '返信',
      repost: 'リポスト',
      like: 'いいね',
      msgRemoved: '外しました',
      msgKept: '残しました',
      msgFolder: '「{name}」に入れました',
      msgLater: 'あとで見ます',
      msgUndone: '元に戻しました',
      msgNothingToUndo: '戻せる操作はありません',
      msgUndoFailed: '元に戻す操作を送信できませんでした',
      msgRemoveFailed: '外せませんでした',
      msgFolderFailed: 'フォルダに入れられませんでした',
      msgCardBack: 'カードを戻しました',
      likeLabel: 'いいね',
      repostLabel: 'リポスト',
      likeKey: 'いいね（Lキー）',
      repostKey: 'リポスト（Rキー）',
      msgLikeFailed: 'いいねできませんでした',
      msgUnlikeFailed: 'いいねを取り消せませんでした',
      msgRepostFailed: 'リポストできませんでした',
      msgUnrepostFailed: 'リポストを取り消せませんでした',
      needReact: 'いいね・リポストに必要な情報をXから取得できませんでした。ページを再読み込みしてください。',
      playVideo: '動画を再生',
      pauseVideo: '動画を一時停止',
      unmuteVideo: '音をオンにする',
      muteVideo: '音をオフにする',
      videoFailed: '動画を再生できませんでした。「Xで開く」で見られます。',
      noDelete: '外す機能が使えません',
      noFolders: 'フォルダがありません',
      foldersLoading: 'フォルダを読み込み中',
      needDelete: '外すために必要な情報をXから取得できませんでした。ページを再読み込みしてください。',
      needFolder: 'フォルダ操作に必要な情報を取得できませんでした。',
      noFoldersDot: 'フォルダがありません。',
      stalled: 'ブックマークを取得できませんでした。ページを再読み込みしてから、もう一度お試しください。',
      stalledToast: 'ブックマークを取得できませんでした。ページを再読み込みしてください。',
      handled: 'ブックマークを {n} 件、整理しました。',
      nothingNew: '新しく確認するブックマークはありません。（設定から確認済みも表示できます）',
      noBookmarks: 'ブックマークがありません。',
      elapsed: '所要時間 {t}',
      timeNow: 'たった今'
    },
    en: {
      fab: 'Swipe to sort',
      fabLabel: 'Sort your bookmarks by swiping',
      dialog: 'Sort bookmarks by swiping',
      bookmarks: 'Bookmarks',
      settings: 'Settings',
      done: 'Done',
      doneLabel: 'Done (Esc)',
      loading: 'Loading',
      remaining: '{n} left',
      removed: 'Removed',
      kept: 'Kept',
      foldered: 'Foldered',
      results: '{a} removed, {b} kept',
      removeLabel: 'Remove (delete the bookmark)',
      laterLabel: 'Later (send to the back of the deck)',
      folderLabel: 'Add to a folder',
      keepLabel: 'Keep (mark as reviewed)',
      undo: 'Undo',
      folderTitle: 'Add to folder',
      folderSheetLabel: 'Choose a folder',
      folderHint: 'Number keys 1 to 9 to choose, Esc to cancel',
      folderChip: 'Add to {name}',
      folderChipN: 'Add to {name} ({n})',
      showAll: 'Show reviewed bookmarks too',
      showAllNote: 'When off, bookmarks you kept or put in a folder will not show up again.',
      resetRec: 'Reset records ({n})',
      resetDone: 'Reviewed records were reset',
      doneTitle: 'All done',
      closePill: 'Close',
      cardLabel: 'Post by {name}',
      more: 'Show more',
      less: 'Show less',
      openX: 'Open on X',
      openXLabel: 'Open on X (new tab)',
      reply: 'Replies',
      repost: 'Reposts',
      like: 'Likes',
      msgRemoved: 'Removed',
      msgKept: 'Kept',
      msgFolder: 'Added to "{name}"',
      msgLater: 'Saved for later',
      msgUndone: 'Undone',
      msgNothingToUndo: 'Nothing to undo',
      msgUndoFailed: 'Could not send the undo request',
      msgRemoveFailed: 'Could not remove it',
      msgFolderFailed: 'Could not add it to the folder',
      msgCardBack: 'The card is back in the deck',
      likeLabel: 'Like',
      repostLabel: 'Repost',
      likeKey: 'Like (L key)',
      repostKey: 'Repost (R key)',
      msgLikeFailed: 'Could not like it',
      msgUnlikeFailed: 'Could not remove the like',
      msgRepostFailed: 'Could not repost it',
      msgUnrepostFailed: 'Could not undo the repost',
      needReact: 'Could not get the information needed to like or repost from X. Please reload the page.',
      playVideo: 'Play video',
      pauseVideo: 'Pause video',
      unmuteVideo: 'Turn sound on',
      muteVideo: 'Turn sound off',
      videoFailed: 'Could not play the video. You can watch it with "Open on X".',
      noDelete: 'Removing is unavailable',
      noFolders: 'No folders',
      foldersLoading: 'Loading folders',
      needDelete: 'Could not get the information needed to remove bookmarks from X. Please reload the page.',
      needFolder: 'Could not get the information needed for folders.',
      noFoldersDot: 'You have no folders.',
      stalled: 'Could not load your bookmarks. Please reload the page and try again.',
      stalledToast: 'Could not load your bookmarks. Please reload the page.',
      handled: 'You sorted {n} bookmarks.',
      nothingNew: 'No new bookmarks to review. (You can show reviewed ones in Settings.)',
      noBookmarks: 'No bookmarks.',
      elapsed: 'Time {t}',
      timeNow: 'now'
    }
  };

  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]);
    if (s == null) s = DICT.en[key];
    if (s == null) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }

  /* 数の短縮：ja は 1.3万、en は 13K */
  function fmtCount(n) {
    if (!n) return '0';
    var s;
    if (lang === 'ja') {
      if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + '万';
      return n.toLocaleString('ja-JP');
    }
    if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) {
      s = (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '');
      return s + 'K';
    }
    return n.toLocaleString('en-US');
  }

  /* 投稿日の相対表記：ja「13時間」、en「13h」。1週間より前は日付 */
  function relTime(ts) {
    if (!ts) return '';
    var s = (Date.now() - ts) / 1000;
    var ja = lang === 'ja';
    if (s < 60) return t('timeNow');
    if (s < 3600) return Math.floor(s / 60) + (ja ? '分' : 'm');
    if (s < 86400) return Math.floor(s / 3600) + (ja ? '時間' : 'h');
    if (s < 7 * 86400) return Math.floor(s / 86400) + (ja ? '日' : 'd');
    var d = new Date(ts), n = new Date(), same = d.getFullYear() === n.getFullYear();
    if (ja) return (same ? '' : d.getFullYear() + '年') + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    try {
      var o = { month: 'short', day: 'numeric' };
      if (!same) o.year = 'numeric';
      return d.toLocaleDateString('en-US', o);
    } catch (e) { return d.toDateString(); }
  }

  /* 所要時間 m:ss */
  function fmtDuration(ms) {
    var s = Math.max(1, Math.round(ms / 1000)), m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  XBS.i18n = { lang: lang, t: t, fmtCount: fmtCount, relTime: relTime, fmtDuration: fmtDuration };
})(typeof globalThis !== 'undefined' ? globalThis : this);
