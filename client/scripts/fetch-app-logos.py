#!/usr/bin/env python3
"""
Fetch and resize app logos for the SignApps App Store.

Automatically downloads missing logos from DuckDuckGo/Google favicon APIs,
resizes to 32/64/128px, and updates the app-logos.ts mapping.

Usage:
    python scripts/fetch-app-logos.py                  # Fetch missing logos
    python scripts/fetch-app-logos.py --all             # Re-fetch all logos
    python scripts/fetch-app-logos.py --app nextcloud   # Fetch a specific app

Requires: Pillow (pip install Pillow)
"""

import argparse
import json
import os
import ssl
import sys
import time
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is required. Install with: pip install Pillow")
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent
LOGOS_DIR = ROOT / "public" / "app-logos"
LOGOS_TS = ROOT / "src" / "lib" / "app-logos.ts"
SIZES = [32, 64, 128]

# Domain overrides for apps whose domain isn't obvious from the name
DOMAIN_OVERRIDES = {
    "actual-server": "actualbudget.org",
    "adguard-home": "adguard.com",
    "adguardhome": "adguard.com",
    "calibre-web": "calibre-ebook.com",
    "calcom": "cal.com",
    "code-server": "coder.com",
    "firefly-iii": "firefly-iii.org",
    "home-assistant": "home-assistant.io",
    "immich-aio-alpine": "immich.app",
    "immich-kiosk": "immich.app",
    "invoice-ninja": "invoiceninja.com",
    "it-tools": "it-tools.tech",
    "lobe-chat": "lobehub.com",
    "minecraft-server": "minecraft.net",
    "nextcloud-ls": "nextcloud.com",
    "node-red": "nodered.org",
    "ollama-cpu": "ollama.ai",
    "ollama-amd": "ollama.ai",
    "ollama-nvidia": "ollama.ai",
    "open-webui": "openwebui.com",
    "paperless-ngx": "paperless-ngx.com",
    "pi-hole": "pi-hole.net",
    "pingvin-share": "github.com",
    "planka-v2": "planka.app",
    "pocket-id": "github.com",
    "pterodactyl-panel": "pterodactyl.io",
    "pterodactyl-wings": "pterodactyl.io",
    "reactive-resume": "rxresu.me",
    "rocket-chat": "rocket.chat",
    "speedtest-tracker": "github.com",
    "stalwart-mail": "stalw.art",
    "stirling-pdf": "stirlingtools.com",
    "unifi-network-application": "ui.com",
    "uptime-kuma": "uptime.kuma.pet",
    "wg-easy": "wireguard.com",
    "wg-easy-v15": "wireguard.com",
    "wiki.js": "js.wiki",
}

# SSL context for downloads
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


# ─── Functions ───────────────────────────────────────────────────────────────

def guess_domain(app_id: str) -> str:
    """Guess the website domain for an app ID."""
    if app_id in DOMAIN_OVERRIDES:
        return DOMAIN_OVERRIDES[app_id]

    # Common suffixes to try
    clean = app_id.replace("-", "").replace("_", "")
    for suffix in [".com", ".io", ".org", ".dev", ".app", ".net"]:
        return f"{clean}{suffix}"
    return f"{clean}.com"


def download_icon(domain: str) -> bytes | None:
    """Download an icon from DuckDuckGo or Google."""
    apis = [
        f"https://icons.duckduckgo.com/ip3/{domain}.ico",
        f"https://www.google.com/s2/favicons?domain={domain}&sz=128",
    ]
    for url in apis:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5, context=CTX) as resp:
                data = resp.read()
                if len(data) > 200:
                    return data
        except Exception:
            continue
    return None


def resize_logo(input_path: Path, name: str) -> bool:
    """Resize a logo to all standard sizes (32, 64, 128)."""
    try:
        img = Image.open(input_path)
        if img.mode != "RGBA":
            img = img.convert("RGBA")

        for size in SIZES:
            out_dir = LOGOS_DIR / str(size) if size != 64 else LOGOS_DIR
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{name}.png"

            resized = img.copy()
            resized.thumbnail((size, size), Image.LANCZOS)

            canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            offset_x = (size - resized.width) // 2
            offset_y = (size - resized.height) // 2
            canvas.paste(resized, (offset_x, offset_y), resized)
            canvas.save(out_path, "PNG", optimize=True)

        return True
    except Exception as e:
        print(f"  RESIZE FAILED: {e}")
        return False


def fetch_app(app_id: str, force: bool = False) -> bool:
    """Fetch and resize logo for a single app."""
    root_path = LOGOS_DIR / f"{app_id}.png"

    if root_path.exists() and root_path.stat().st_size > 200 and not force:
        return True  # Already exists

    domain = guess_domain(app_id)
    data = download_icon(domain)

    if not data:
        # Try variations
        for suffix in [".com", ".io", ".org", ".dev", ".app"]:
            clean = app_id.replace("-", "")
            data = download_icon(f"{clean}{suffix}")
            if data:
                break

    if not data:
        return False

    # Save raw then resize
    tmp = LOGOS_DIR / f"_tmp_{app_id}.png"
    tmp.write_bytes(data)

    success = resize_logo(tmp, app_id)
    tmp.unlink(missing_ok=True)
    return success


def update_ts_mapping():
    """Regenerate the APP_LOGO_MAP in app-logos.ts with all available logos."""
    files = sorted(
        f.stem for f in LOGOS_DIR.glob("*.png")
        if f.is_file() and not f.stem.startswith("_")
    )

    print(f"\nUpdating {LOGOS_TS} with {len(files)} logos...")

    # Read existing file
    content = LOGOS_TS.read_text(encoding="utf-8")

    # Extract everything before and after APP_LOGO_MAP
    before = content.split("const APP_LOGO_MAP")[0]
    after_match = content.split("};", 1)
    after = after_match[1] if len(after_match) > 1 else ""

    # Build new map
    entries = []
    for f in files:
        entries.append(f"  '{f}': '{f}',")

    # Add common aliases
    aliases = {
        "postgres": "postgresql", "wiki": "wikijs", "wiki.js": "wikijs",
        "pi-hole": "pihole", "code-server": "coder", "home-assistant": "homeassistant",
        "draw.io": "drawio", "rocket.chat": "rocketchat", "mongo": "mongodb",
        "adguard-home": "adguard", "adguardhome": "adguard", "uptime": "uptime-kuma",
        "uptimekuma": "uptime-kuma", "vaultwarden": "bitwarden",
        "firefly-iii": "firefly", "stirling-pdf": "stirlingpdf",
        "paperless": "paperless-ngx",
    }
    for alias, target in sorted(aliases.items()):
        if target in files and alias not in files:
            entries.append(f"  '{alias}': '{target}',")

    new_map = "const APP_LOGO_MAP: Record<string, string> = {\n" + "\n".join(entries) + "\n};"

    new_content = before + new_map + after
    LOGOS_TS.write_text(new_content, encoding="utf-8")
    print(f"  Updated with {len(entries)} entries")


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fetch and resize app logos")
    parser.add_argument("--all", action="store_true", help="Re-fetch all logos")
    parser.add_argument("--app", type=str, help="Fetch a specific app by ID")
    parser.add_argument("--no-update-ts", action="store_true", help="Skip updating app-logos.ts")
    args = parser.parse_args()

    LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    for size in [32, 128]:
        (LOGOS_DIR / str(size)).mkdir(exist_ok=True)

    if args.app:
        print(f"Fetching logo for: {args.app}")
        if fetch_app(args.app, force=True):
            print(f"  OK")
        else:
            print(f"  FAILED")
        if not args.no_update_ts:
            update_ts_mapping()
        return

    # Try to get the app list from the store API
    apps_to_fetch = set()

    try:
        # Login
        login_data = json.dumps({"username": "admin", "password": "admin"}).encode()
        req = urllib.request.Request(
            "http://localhost:3001/api/v1/auth/login",
            data=login_data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            token = json.loads(resp.read())["access_token"]

        # Get apps
        req = urllib.request.Request(
            "http://localhost:3002/api/v1/store/apps",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            store_apps = json.loads(resp.read())

        for app in store_apps:
            app_id = (app.get("id") or app.get("name", "")).lower().strip()
            if app_id:
                apps_to_fetch.add(app_id)

        print(f"Found {len(apps_to_fetch)} apps in store")
    except Exception as e:
        print(f"Could not fetch store apps: {e}")
        print("Using existing logo filenames only")

    # Check which need fetching
    existing = {f.stem for f in LOGOS_DIR.glob("*.png") if f.is_file()}
    missing = apps_to_fetch - existing if apps_to_fetch else set()

    if args.all:
        to_fetch = apps_to_fetch or existing
    else:
        to_fetch = missing

    print(f"Existing: {len(existing)}, Missing: {len(missing)}, To fetch: {len(to_fetch)}")

    ok = 0
    fail = 0
    for app_id in sorted(to_fetch):
        print(f"  {app_id}...", end=" ", flush=True)
        if fetch_app(app_id, force=args.all):
            print("OK")
            ok += 1
        else:
            print("FAILED")
            fail += 1
        time.sleep(0.05)

    print(f"\nResult: {ok} OK, {fail} failed")

    if not args.no_update_ts:
        update_ts_mapping()

    print("Done!")


if __name__ == "__main__":
    main()
