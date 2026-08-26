#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
logo="$project_root/src/assets/cafe1-logo.webp"
hero="$project_root/src/assets/cafe1-hero.webp"
output="$project_root/public"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

# Browser icons use the exact Café 1 logo on a clean white square.
for size in 16 32 48 256; do
  convert "$logo" -background white -alpha remove -alpha off -resize "${size}x${size}" \
    "$work_dir/favicon-${size}.png"
done
cp "$work_dir/favicon-16.png" "$output/favicon-16x16.png"
cp "$work_dir/favicon-32.png" "$output/favicon-32x32.png"
cp "$work_dir/favicon-256.png" "$output/favicon.png"
convert "$work_dir/favicon-16.png" "$work_dir/favicon-32.png" "$work_dir/favicon-48.png" \
  "$output/favicon.ico"

# A 1200×630 JPEG is widely supported by Facebook, Instagram, WhatsApp, X and LinkedIn previews.
convert "$hero" -resize '1200x630^' -gravity center -extent 1200x630 \
  -fill 'rgba(0,0,0,0.62)' -draw 'rectangle 0,0 1200,630' "$work_dir/base.png"
convert "$logo" -resize 190x190 "$work_dir/logo.png"
convert "$work_dir/base.png" "$work_dir/logo.png" -gravity northwest -geometry +70+52 -composite \
  -font DejaVu-Sans-Bold -fill '#ffffff' -pointsize 56 -annotate +300+110 'CAFÉ 1 LUTON' \
  -font DejaVu-Sans -fill '#fca5a5' -pointsize 25 \
  -annotate +303+158 'HALAL BREAKFAST • LUNCH • COFFEE' \
  -font DejaVu-Sans-Bold -fill '#ffffff' -pointsize 48 \
  -annotate +70+335 'Two Luton cafés. One great menu.' \
  -font DejaVu-Sans -fill '#ffffff' -pointsize 25 \
  -annotate +72+394 'Luton Crown Court • Futures House, Marsh Farm' \
  -fill '#dc2626' -draw 'roundrectangle 70,462 515,526 32,32' \
  -fill '#ffffff' -font DejaVu-Sans-Bold -pointsize 23 \
  -annotate +103+503 'OPEN TO THE PUBLIC' \
  -fill '#fbbf24' -font DejaVu-Sans-Bold -pointsize 25 \
  -annotate +70+585 'cafe1luton.co.uk' -quality 88 "$output/og-cafe1-luton.jpg"
