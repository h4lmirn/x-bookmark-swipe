#!/bin/sh
# Chrome ウェブストアに上げる zip を作る（開発用ファイルは含めない）
set -e
cd "$(dirname "$0")/.."
V=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="store/bookmark-swipe-$V.zip"
rm -f "$OUT"
zip -qr "$OUT" manifest.json _locales src icons -x "icons/src/*" "*.DS_Store"
echo "$OUT"
