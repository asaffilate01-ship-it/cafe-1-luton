#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
output_dir="$project_dir/public/blog"
food_image="$project_dir/src/assets/cafe1-hero.webp"
breakfast_image="$project_dir/public/blog/halal-breakfast.jpg"
coffee_image="$project_dir/public/blog/italian-coffee.jpg"
logo_image="$project_dir/src/assets/cafe1-logo.webp"

mkdir -p "$output_dir"

make_card() {
  local output_name="$1"
  local source_image="$2"
  local eyebrow="$3"
  local headline="$4"
  local detail="$5"

  convert "$source_image" \
    -auto-orient \
    -resize '1200x630^' \
    -gravity center \
    -extent 1200x630 \
    -blur 0x1.2 \
    -fill 'rgba(10,7,5,0.73)' \
    -draw 'rectangle 0,0 1200,630' \
    \( "$logo_image" -resize '170x170>' \) \
    -gravity northwest \
    -geometry +70+54 \
    -composite \
    -font DejaVu-Sans-Bold \
    -fill '#f6b21a' \
    -pointsize 25 \
    -gravity northwest \
    -annotate +70+245 "$eyebrow" \
    -fill white \
    -pointsize 54 \
    -interline-spacing -2 \
    -annotate +70+292 "$headline" \
    -font DejaVu-Sans \
    -fill '#f4eee7' \
    -pointsize 25 \
    -annotate +70+475 "$detail" \
    -fill '#f6b21a' \
    -draw 'roundrectangle 70,548 1130,553 3,3' \
    -quality 88 \
    "$output_dir/$output_name"
}

make_card 'cafe1-luton.jpg' "$food_image" 'CAFE 1 LUTON' $'Two Luton cafes.\nOne warm welcome.' 'Crown Court + Futures House, Marsh Farm'
make_card 'futures-house-marsh-farm.jpg' "$coffee_image" 'CAFE 1 FUTURES HOUSE' $'Breakfast and lunch\nin Marsh Farm' 'The Moakes, Luton LU3 3QB'
make_card 'luton-crown-court.jpg' "$food_image" 'CAFE 1 LUTON CROWN COURT' $'Good food in the\nheart of Luton' '7–11 Manchester Street, Luton LU1 2AA'
make_card 'breakfast-in-luton.jpg' "$breakfast_image" 'BREAKFAST IN LUTON' $'Start the day\nthe Cafe 1 way' 'Dine in or order ahead for takeaway'
make_card 'halal-breakfast-in-luton.jpg' "$breakfast_image" '100% HALAL' $'Halal breakfast\nin Luton' 'Crown Court + Futures House, Marsh Farm'
make_card 'cheese-flan-luton.jpg' "$food_image" 'A CAFE 1 FAVOURITE' $'Our famous\ncheese flan' 'A comforting Luton lunchtime classic'
make_card 'friday-roast-special-luton.jpg' "$food_image" 'FRIDAY SPECIAL' $'Make Friday\nroast day' 'Freshly prepared while portions last'
make_card 'chicken-pie-luton.jpg' "$food_image" 'CAFE 1 CLASSICS' $'Chicken pie\nfor lunch' 'Comforting, filling and made for lunchtime'
make_card 'lunch-in-luton.jpg' "$food_image" 'LUNCH IN LUTON' $'A better Luton\nlunch break' 'Dine in or takeaway at either branch'
