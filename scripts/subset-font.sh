#!/usr/bin/env bash
set -euo pipefail

# 生成 NotoSansSC 的 GB2312 子集字体（供 PDF 导出嵌入）。
# 全量字体 17M -> 子集 3.6M。需要 python3 + fonttools。
# 用法: bash scripts/subset-font.sh
cd "$(dirname "$0")/.."

SRC="assets/fonts/NotoSansSC.ttf"
OUT="assets/fonts/NotoSansSC-subset.ttf"
VENV="${VENV_PYTHON:-python3}"

if ! "$VENV" -c "import fontTools" 2>/dev/null; then
  echo "缺少 fonttools，请先安装: pip install fonttools brotli"
  exit 1
fi

echo '[font] 生成 GB2312 字集'
"$VENV" -c "
chars = set()
for lo in range(0x20, 0x7F):
    chars.add(chr(lo))
chars.update('，。！？；：、（）《》【】「」『』·—…“”‘’％￥＃＆＊＋－＝／＼｜＠＾～｀＜＞｛｝［］＿')
for q in range(16, 88):
    for w in range(1, 95):
        try: chars.add(bytes([0xA0+q, 0xA0+w]).decode('gb2312'))
        except Exception: pass
with open('/tmp/gb2312-chars.txt', 'w') as f:
    f.write(''.join(sorted(chars)))
print('字符数:', len(chars))
"

echo "[font] 子集化 $SRC -> $OUT"
"$VENV" -m fontTools.subset "$SRC" \
  --text-file=/tmp/gb2312-chars.txt \
  --output-file="$OUT" \
  --layout-features='*' --glyph-names --symbol-cmap --legacy-cmap \
  --notdef-glyph --notdef-outline --recommended-glyphs

ls -lh "$OUT"
echo '[font] 完成'
