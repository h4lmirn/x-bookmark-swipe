# Bookmark Swipe

[日本語](README.md) | English

A Chrome extension (Manifest V3) that lets you sort your X (Twitter) bookmarks one card at a time by swiping.

## Installation
1. Open `chrome://extensions` and turn on "Developer mode" (top right)
2. Click "Load unpacked" and choose this folder (`x-bookmark-swipe`)
3. Open `https://x.com/i/history`

## Usage
Press the "Swipe to sort" button at the bottom center of the bookmarks page to start in full screen. Cards come up in shuffled order. The controls are shown with pictures and symbols, and the text switches between Japanese and English to match your browser language.
As you move a card, a round stamp for that direction (remove 👋, keep 🤝, folder 📁, later ⏳) fades in.

| Action | Drag | Key | Result |
|---|---|---|---|
| Remove | Left | ← / D | Deletes the bookmark (with a 4-second grace period) |
| Keep | Right | → / K | Records it as reviewed (it will not appear next time) |
| Folder | Up | ↑ / F | Choose a folder (number keys 1–9, Esc to go back) |
| Later | Down | ↓ / S | Puts it back at a random position in the deck |
| Undo | Toast / bottom button | Z / ⌘Z | As many times as you like |
| Open on X | Link on the card | Space / O | New tab |
| Done | "× Done" at the top right | Esc | Pending actions are sent right away when you close |

- The top right shows your results as `👋 24  🤝 51` (removed count, kept count).
- The `+` in the remaining count, such as "132+", means the bookmarks are still loading (the page is auto-scrolled in the background to load them).
- In Settings (the slider icon at the top right) you can show reviewed bookmarks again and reset your records.
- A "Remove" can be undone without any network request within the grace period. Undoing after it was sent re-bookmarks the post (its position in your bookmark list moves to the top).

## Dev page (no login needed)
```
cd dev
python3 -m http.server 8765
# open http://localhost:8765/
```
It runs `fixture.json` (30 posts) through the real parser and loads them lazily in 3 pages. Writes are mocked. Query parameters: `?theme=dark|light`, `?lang=ja|en`, `?folders=0`, `?fail=0.4`, `?batch=30`, `?nodelete=1`, `?empty=1`. `dev/src` is a symlink to `../src`.

## Notes
This depends on X's **private web API** (GraphQL). It may stop working without notice when X changes things. The extension talks to nothing other than x.com (and fetches X's official scripts from `abs.twimg.com` to find query IDs). Use at your own risk.

## License
[MIT License](LICENSE)
