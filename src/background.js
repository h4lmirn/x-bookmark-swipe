/* ツールバーアイコン：ブックマークページを開いて（開いていればそのまま）オーバーレイを起動する */
const BOOKMARKS = 'https://x.com/i/bookmarks';

chrome.action.onClicked.addListener(async (tab) => {
  try {
    const u = tab && tab.url ? new URL(tab.url) : null;
    const onX = u && (u.hostname === 'x.com' || u.hostname === 'twitter.com');
    if (onX) {
      // 判定はページ側に任せる（ブックマークが履歴ページへ移っていても対応できるように）
      await chrome.tabs.sendMessage(tab.id, { type: 'xbs-open' });
    } else {
      await chrome.tabs.create({ url: BOOKMARKS + '#swipe' });
    }
  } catch (e) {
    // コンテンツスクリプト未注入（拡張を入れた直後のタブなど）：ページを読み込み直す
    try { await chrome.tabs.update(tab.id, { url: BOOKMARKS + '#swipe' }); } catch (e2) { /* ignore */ }
  }
});
