import json
import os
import re
import shutil
from pathlib import Path

ASSETS = (
    "index.html",
    "styles.css",
    "game.js",
    "game-art.svg",
    "cloud-save.js",
    "player-groups.js",
    "cloud-config.js",
    "tavern-model.js",
    "gold-economy-model.js",
    "expeditions-model.js",
    "homestead-model.js",
    "soul-crafting-model.js",
    "rune-model.js",
    "attribute-model.js",
    "player-progress-model.js",
    "dungeon-model.js",
    "pvp-client.js",
    "guild-client.js",
    "class-model.js",
    "city-model.js",
)
SCRIPT_ASSETS = tuple(asset for asset in ASSETS if asset.endswith(".js") and asset != "game-art.svg")
DEPLOY_SHA = os.environ.get("DEPLOY_SHA", "local")

dist = Path("dist")
dist.mkdir(exist_ok=True)
for asset in ASSETS:
    shutil.copy2(asset, dist / asset)

url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_ANON_KEY", "")
if bool(url) != bool(key):
    raise SystemExit("Set both SUPABASE_URL and SUPABASE_ANON_KEY, or neither.")
if url and key:
    config = {"supabaseUrl": url, "supabaseAnonKey": key}
    (dist / "cloud-config.js").write_text(
        "window.WELL_CLOUD_CONFIG = " + json.dumps(config, ensure_ascii=True) + ";\n",
        encoding="utf-8",
    )

html_path = dist / "index.html"
html = html_path.read_text(encoding="utf-8")
replacements = [("href=\"styles.css\"", f"href=\"styles.css?v={DEPLOY_SHA}\"")]
replacements.extend(
    (f"src=\"{asset}\"", f"src=\"{asset}?v={DEPLOY_SHA}\"")
    for asset in SCRIPT_ASSETS
)
for old, new in replacements:
    if html.count(old) != 1:
        raise SystemExit(f"Expected exactly one {old!r} in the Pages index.")
    html = html.replace(old, new)
html_path.write_text(html, encoding="utf-8")

game_path = dist / "game.js"
game = game_path.read_text(encoding="utf-8")
old_art = 'const GAME_ART_URL = "game-art.svg";'
if game.count(old_art) != 1:
    raise SystemExit(f"Expected exactly one {old_art!r} in the Pages game script.")
game_path.write_text(
    game.replace(old_art, f'const GAME_ART_URL = "game-art.svg?v={DEPLOY_SHA}";'),
    encoding="utf-8",
)

for source in re.findall(r'<script\b[^>]*\bsrc="([^"]+)"', html):
    asset_path = source.split("?", 1)[0]
    if "://" not in asset_path and not (dist / asset_path).is_file():
        raise SystemExit(f"Pages artifact is missing local script {asset_path!r}.")
