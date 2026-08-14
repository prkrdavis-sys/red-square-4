#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/public/assets/vendor"
TILES="$ROOT/public/assets/tiles"
BG="$ROOT/public/assets/bg"
AUDIO="$ROOT/public/assets/audio"
MANIFEST="$ROOT/public/assets/manifest.json"

mkdir -p "$VENDOR" "$TILES" "$BG" "$AUDIO"

download() {
  local url="$1"
  local out="$2"
  echo "GET $url"
  if curl -fsSL --retry 2 --retry-delay 1 -A "RedSquare4AssetFetch/1.0" "$url" -o "$out"; then
    return 0
  fi
  return 1
}

scrape_zip() {
  local page="$1"
  curl -fsSL -A "RedSquare4AssetFetch/1.0" "$page" | grep -oE 'https?://[^" ]+\.zip' | head -n 1 || true
}

try_page_zip() {
  local page="$1"
  local dest="$2"
  local zip_url
  zip_url="$(scrape_zip "$page")"
  if [[ -n "$zip_url" ]]; then
    download "$zip_url" "$dest" || true
  fi
}

echo "Fetching Kenney / OpenGameArt / ansimuz packs..."

# Direct OpenGameArt-style filenames (best-effort; some hosts require cookies)
OGA_CANDIDATES=(
  "https://opengameart.org/sites/default/files/platformerGraphicsDeluxe_Updated.zip"
  "https://opengameart.org/sites/default/files/archive/platformerGraphicsDeluxe_Updated.zip"
  "https://opengameart.org/sites/default/files/jingleSounds_Kenney.zip"
  "https://opengameart.org/sites/default/files/kenney_backgroundElements.zip"
  "https://opengameart.org/sites/default/files/kenney_new-platformer-pack-1.0.zip"
  "https://opengameart.org/sites/default/files/underwater-diving-files.zip"
  "https://opengameart.org/sites/default/files/game_dev_assets/underwater-diving-files.zip"
)

i=0
for url in "${OGA_CANDIDATES[@]}"; do
  i=$((i + 1))
  download "$url" "$VENDOR/pack-$i.zip" || rm -f "$VENDOR/pack-$i.zip"
done

try_page_zip "https://opengameart.org/content/platformer-art-deluxe" "$VENDOR/deluxe.zip"
try_page_zip "https://opengameart.org/content/85-short-music-jingles" "$VENDOR/jingles.zip"
try_page_zip "https://opengameart.org/content/background-elements" "$VENDOR/backgrounds.zip"
try_page_zip "https://opengameart.org/content/underwater-diving-pack" "$VENDOR/ocean.zip"
try_page_zip "https://opengameart.org/content/new-platformer-pack" "$VENDOR/new-platformer.zip"
try_page_zip "https://opengameart.org/content/platformer-art-extended-tilesets" "$VENDOR/extended.zip"
try_page_zip "https://kenney.nl/assets/new-platformer-pack" "$VENDOR/kenney-npp.zip"
try_page_zip "https://kenney.nl/assets/music-jingles" "$VENDOR/kenney-jingles.zip"
try_page_zip "https://kenney.nl/assets/background-elements" "$VENDOR/kenney-bg.zip"
try_page_zip "https://kenney.nl/assets/digital-audio" "$VENDOR/kenney-digital.zip"
download "https://github.com/KenneyNL/Pixel-Platformer/archive/refs/heads/main.zip" "$VENDOR/pixel-platformer.zip" || true
download "https://github.com/ansimuz/underwater-diving/archive/refs/heads/master.zip" "$VENDOR/ansimuz-ocean.zip" || true

# Individual Kenney jingles (gamesounds.xyz mirror, CC0)
download "https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Music%20Jingles/Audio%20%28Retro%29/jingles_RETRO15.ogg" "$AUDIO/victory.ogg" || true
download "https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Digital%20Audio/Audio/phaseJump1.ogg" "$AUDIO/jump.ogg" || true

shopt -s nullglob
for zip in "$VENDOR"/*.zip; do
  echo "Unzip $zip"
  unzip -o -q "$zip" -d "${zip%.zip}" || true
done

copy_first() {
  local dest="$1"
  shift
  local found
  for pattern in "$@"; do
    found="$(find "$VENDOR" -iname "$pattern" -type f ! -path '*__MACOSX*' ! -name 'Preview*' 2>/dev/null | head -n 1 || true)"
    if [[ -n "$found" ]]; then
      mkdir -p "$(dirname "$dest")"
      cp "$found" "$dest"
      echo "copied $(basename "$found") -> $dest"
      return 0
    fi
  done
  echo "skip (not in packs) $(basename "$dest")"
  return 0
}

copy_first "$TILES/grass-mid.png" "grassMid.png" "grass_mid.png" "tile_grass.png" "terrain_grass_block.png"
copy_first "$TILES/grass-half.png" "grassHalf.png" "grass_half.png" "terrain_grass_horizontal.png"
copy_first "$TILES/snow-mid.png" "snowMid.png" "snow_mid.png" "tile_snow.png" "terrain_snow_block.png"
copy_first "$TILES/snow-half.png" "snowHalf.png" "snow_half.png" "terrain_snow_horizontal.png"
copy_first "$TILES/sand-mid.png" "sandMid.png" "sand_mid.png" "tile_sand.png" "terrain_sand_block.png"
copy_first "$TILES/sand-half.png" "sandHalf.png" "sand_half.png" "terrain_sand_horizontal.png"
copy_first "$TILES/castle-mid.png" "castleMid.png" "castle_mid.png" "tile_castle.png" "terrain_stone_block.png"
copy_first "$TILES/castle-half.png" "castleHalf.png" "castle_half.png" "terrain_stone_horizontal.png"
copy_first "$TILES/ocean-mid.png" "terrain_stone_block.png" "tile_0072.png" "tile_0073.png"
copy_first "$TILES/ocean-half.png" "terrain_stone_horizontal_middle.png" "terrain_sand_horizontal.png" "tile_0071.png"

copy_first "$BG/grass.png" "colored_grass.png" "blue_grass.png" "hills1.png" "background_color_hills.png" "grass1.png" "bg.png"
copy_first "$BG/snow.png" "blue_land.png" "pointy_mountains.png" "mountain1.png"
copy_first "$BG/sand.png" "blue_desert.png" "colored_desert.png" "piramid.png" "hills1.png"
copy_first "$BG/castle.png" "bg_castle.png" "uncolored_castle.png" "colored_castle.png" "castle.png"
copy_first "$BG/ocean.png" "*/environment/background.png" "background.png"
copy_first "$BG/ocean-midground.png" "*/environment/midground.png" "midground.png"

copy_first "$AUDIO/victory.ogg" "jingles_STEEL15.ogg" "jingles_RETRO15.ogg" "jingles_SAX15.ogg"
copy_first "$AUDIO/jump.ogg" "phaseJump1.ogg" "*jump*.ogg"
copy_first "$AUDIO/stomp.ogg" "pepSound1.ogg" "*impact*.ogg" "*hit*.ogg"
copy_first "$AUDIO/hurt.ogg" "lowDown.ogg" "*hurt*.ogg" "*damage*.ogg"
copy_first "$AUDIO/poof.ogg" "spaceTrash4.ogg" "*explosion*.ogg" "*puff*.ogg"
copy_first "$AUDIO/select.ogg" "twoTone1.ogg" "*select*.ogg" "*confirm*.ogg"
copy_first "$AUDIO/map.ogg" "pepSound4.ogg" "*blip*.ogg" "*tap*.ogg"

python3 - "$ROOT" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
images = {}
audio = {}
mapping = {
    "tiles/grass-mid.png": "kenney-grass-solid",
    "tiles/grass-half.png": "kenney-grass-oneway",
    "tiles/snow-mid.png": "kenney-snow-solid",
    "tiles/snow-half.png": "kenney-snow-oneway",
    "tiles/sand-mid.png": "kenney-desert-solid",
    "tiles/sand-half.png": "kenney-desert-oneway",
    "tiles/castle-mid.png": "kenney-castle-solid",
    "tiles/castle-half.png": "kenney-castle-oneway",
    "tiles/ocean-mid.png": "kenney-ocean-solid",
    "tiles/ocean-half.png": "kenney-ocean-oneway",
    "bg/grass.png": "bg-grass",
    "bg/snow.png": "bg-snow",
    "bg/sand.png": "bg-desert",
    "bg/ocean.png": "bg-ocean",
    "bg/ocean-midground.png": "bg-ocean-midground",
    "bg/castle.png": "bg-castle",
}
audio_map = {
    "audio/victory.ogg": "sfx-victory",
    "audio/jump.ogg": "sfx-jump",
    "audio/stomp.ogg": "sfx-stomp",
    "audio/hurt.ogg": "sfx-hurt",
    "audio/poof.ogg": "sfx-poof",
    "audio/select.ogg": "sfx-select",
    "audio/map.ogg": "sfx-map",
}
assets = root / "public" / "assets"
for rel, key in mapping.items():
    path = assets / rel
    if path.exists() and path.stat().st_size > 32:
        images[key] = f"assets/{rel}"
for rel, key in audio_map.items():
    path = assets / rel
    if path.exists() and path.stat().st_size > 32:
        audio[key] = f"assets/{rel}"
(assets / "manifest.json").write_text(json.dumps({"images": images, "audio": audio}, indent=2) + "\n")
print(f"manifest: {len(images)} images, {len(audio)} audio")
PY

echo "Done. Library assets are optional; the game always has generated fallbacks."
