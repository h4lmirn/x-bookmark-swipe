# Chrome ウェブストア掲載用メモ

デベロッパーダッシュボードの各欄に、そのまま貼れる文面をまとめています。

## 提出物

| 項目 | ファイル |
|---|---|
| パッケージ | `store/build.sh` を実行してできる `store/bookmark-swipe-<version>.zip` |
| アイコン 128×128 | zip 内の `icons/icon128.png`（自動で使われる） |
| スクリーンショット 1280×800 | 日本語：`images/ja-keep.png` `ja-remove.png` `ja-folder.png` `ja-done.png`／英語：`images/en-*.png` |
| 小さいプロモタイル 440×280 | `images/promo-tile.png` |
| プライバシーポリシー URL | https://github.com/h4lmirn/x-bookmark-swipe/blob/main/PRIVACY.md |
| ホームページ／サポート URL | https://github.com/h4lmirn/x-bookmark-swipe |
| カテゴリ | 仕事効率化（Productivity / Tools） |
| 言語 | 既定 English、追加で日本語 |

## ストア掲載情報

### 概要（English, 132 文字以内）
Sort your X (Twitter) bookmarks one card at a time. Swipe to remove, keep, file into folders, or save for later.

### 概要（日本語）
X（Twitter）のブックマークを、カードを1枚ずつスワイプして整理。外す・残す・フォルダへ・あとで、を指先ひとつで。

### 説明（English）
Bookmarks pile up. Bookmark Swipe turns them into a deck of cards so you can clear them quickly — like sorting photos.

• Swipe left (👋) to remove the bookmark, right (🤝) to keep it
• Swipe up (📁) to file it into a bookmark folder, down (⏳) to decide later
• Cards come in shuffled order, so old bookmarks resurface too
• Every action can be undone. Removals wait a few seconds before they are sent
• Keyboard shortcuts: ← → ↑ ↓, Z to undo, Space to open the post
• Works in light and dark mode, in English and Japanese

How to use: open your bookmarks on x.com (x.com/i/bookmarks or the History page) and press "Swipe to sort" at the bottom of the screen.

Privacy: no data leaves your browser except to X itself. No analytics, no tracking. Posts you keep are remembered only on your device.

Note: this extension is not affiliated with X Corp. It relies on the X website's internal behaviour and may stop working when X changes its site.

### 説明（日本語）
たまり続けるブックマークを、写真整理アプリのようにカードで次々と片づけられる拡張機能です。

• 左へ（👋）でブックマークを外す、右へ（🤝）で残す
• 上へ（📁）でフォルダに振り分け、下へ（⏳）であとで判断
• カードはシャッフルされて出てくるので、昔のブックマークにも出会えます
• どの操作も元に戻せます。「外す」は数秒待ってから反映されます
• キーボード操作：← → ↑ ↓、Z で元に戻す、Space で投稿を開く
• ライト／ダークモード、日本語／英語に対応

使い方：x.com でブックマーク（x.com/i/bookmarks または「履歴」ページ）を開き、画面下の「スワイプで整理」を押します。

プライバシー：データは X 以外へ一切送りません。アクセス解析や追跡もありません。「残す」にした投稿の記録は、お使いの端末の中にだけ保存されます。

注意：本拡張は X Corp とは関係ありません。X の Web サイトの内部の仕組みを使っているため、X の変更で動かなくなることがあります。

## プライバシーへの取り組み（Privacy practices タブ）

### 単一の目的（Single purpose）
Lets users review and sort their own X (Twitter) bookmarks with a swipe-card interface (remove, keep, move to folder, or postpone).

### 権限の理由（Permission justification）
- **storage**: Remembers, on the user's device only, which posts the user chose to keep (so they are not shown again) and the user's settings.
- **Host permission `https://x.com/*`, `https://twitter.com/*`**: The extension runs only on X. It reads the bookmark data the X website loads and, when the user swipes, removes the bookmark or moves it to a folder using the user's existing X session.
- **Remote code**: No. All code is bundled in the package. (The extension reads X's own public script file only as text, to find the request ID X uses for bookmark actions; it never executes it.)

### データの使用（Data usage）
チェックするもの：
- **Authentication information**：X へのリクエストに、ブラウザにある X のログイン状態（CSRF トークンなど）をそのまま使うため
- **Website content**：ブックマークした投稿の本文・画像を表示するため

上記の3つの宣誓（販売しない／目的外に使わない／信用判断に使わない）にすべてチェック。

## 提出の流れ（ご本人の作業）
1. https://chrome.google.com/webstore/devconsole でデベロッパー登録（登録料 5 米ドル、一度だけ）
2. 「新しいアイテム」から zip をアップロード
3. 上の文面と画像を各欄に入れる（「ストアの掲載情報」で言語に日本語を追加して、日本語の文面と画像も入れる）
4. 公開範囲を「公開」にして審査に提出（通常は数日）
