#!/usr/bin/env python3
"""Remeasure all 4/9/16 sheets into sprite-manifest + foot anchors. No PNG rewrite."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / ".cursor" / "skills" / "castle-parkour-art" / "scripts"))
# also allow import from skill path relative to repo
SKILL = Path(r"e:/Users/lin/Desktop/Home/XRK-AGT/.cursor/skills/castle-parkour-art/scripts")
sys.path.insert(0, str(SKILL))

from measure_run_sheet import measure_sheet  # noqa: E402
from measure_sprites import foot_anchor_x, measure as measure_single  # noqa: E402
import sys as _sys
_sys.path.insert(0, str(ROOT))
from asset_layout import find_asset  # noqa: E402

ASSETS = ROOT.parent / "www" / "castle-parkour" / "assets"
ALPHA = 12

SHEETS = [
    ("mage-run-sheet.png", 3, 3),
    ("warrior-run-sheet.png", 3, 3),
    ("mage-jump-sheet.png", 3, 3),
    ("warrior-jump-sheet.png", 3, 3),
    ("mage-fly-sheet.png", 2, 2),
    ("warrior-fly-sheet.png", 2, 2),
    ("mage-atk-sheet.png", 3, 3),
    ("warrior-atk-sheet.png", 3, 3),
    ("mage-roll-sheet.png", 3, 3),
    ("warrior-roll-sheet.png", 3, 3),
    ("bat-sheet.png", 2, 2),
    ("flyer-sheet.png", 2, 2),
    ("giant-sheet.png", 2, 2),
    ("monster-idle-sheet.png", 2, 2),
]


def enrich_frames(path: Path, data: dict) -> dict:
    im = Image.open(path).convert("RGBA")
    for fr in data["frames"]:
        x0, y0 = fr["cellX"], fr["cellY"]
        cw, ch = fr["cellW"], fr["cellH"]
        cell = im.crop((x0, y0, x0 + cw, y0 + ch))
        loc = fr.get("local") or {}
        l = int(loc.get("left", 0))
        t = int(loc.get("top", 0))
        w = int(loc.get("w", cw))
        h = int(loc.get("h", ch))
        r, b = l + w, t + h
        # 脚锚：踝带去米色尘，避免 jump/land 尘把 footX 拉飞
        arr = np.array(cell)
        ch_c = max(1, b - t)
        y0b = t + int(ch_c * 0.72)
        y1b = t + int(ch_c * 0.93)
        y0b = max(t, min(y0b, b - 1))
        y1b = max(y0b + 1, min(y1b, b))
        band = arr[y0b:y1b, l:r]
        al = band[:, :, 3] > ALPHA
        rr = band[:, :, 0].astype(int)
        gg = band[:, :, 1].astype(int)
        bb = band[:, :, 2].astype(int)
        dust = (rr > 145) & (gg > 115) & (bb < 198) & (np.abs(rr - gg) < 55) & (rr > bb + 8)
        boot = al & ~dust
        if not boot.any():
            boot = al
        if boot.any():
            _, xs = np.where(boot)
            hist = np.bincount(xs, minlength=max(1, r - l))
            smooth = (
                np.convolve(hist.astype(float), np.ones(5), mode="same")
                if hist.size >= 5
                else hist.astype(float)
            )
            peak = int(np.argmax(smooth))
            lo = max(0, peak - 6)
            hi = min(hist.size, peak + 7)
            local = xs[(xs >= lo) & (xs < hi)]
            fx = float(l + np.median(local if local.size else xs))
        else:
            fx = foot_anchor_x(cell, l, t, r, b)
        fr.setdefault("anchor", {})
        fr["anchor"]["footXInContent"] = round(fx - l, 1)
        fr["plant"] = fr.get("footGap", 99) <= 16
    name = path.name
    if name.startswith(("mage-", "warrior-")) and name.endswith("-sheet.png"):
        data["refH"] = 296
    return data


def run_foot_stats(data: dict) -> tuple[float, float]:
    """Median foot local X + lockW from plant frames."""
    locals_x = []
    halves = []
    for fr in data["frames"]:
        cell_x = fr["cellX"]
        foot_abs = (fr["left"] + fr["right"]) * 0.5
        local = foot_abs - cell_x
        if fr.get("plant"):
            locals_x.append(local)
        half = max(foot_abs - fr["left"], fr["right"] - foot_abs)
        halves.append(half)
    if not locals_x:
        locals_x = [((f["left"] + f["right"]) * 0.5 - f["cellX"]) for f in data["frames"]]
    locals_x.sort()
    foot = locals_x[len(locals_x) // 2]
    lock = max(8, int(np.ceil(max(halves) * 2) + 2))
    return float(foot), float(lock)


def main() -> None:
    man_path = ASSETS / "sprite-manifest.json"
    man = json.loads(man_path.read_text(encoding="utf-8")) if man_path.exists() else {}
    sheets = dict(man.get("sheets") or {})
    sprites = dict(man.get("sprites") or {})

    run_meta: dict[str, tuple[float, float]] = {}

    for name, cols, rows in SHEETS:
        path = find_asset(name)
        if not path.exists():
            print("MISSING", name)
            continue
        data = enrich_frames(path, measure_sheet(path, cols, rows))
        sheets[name] = data
        char = None
        if name.startswith("mage"):
            char = "mage"
        elif name.startswith("warrior"):
            char = "warrior"
        role = "sheet"
        if "-run-sheet" in name:
            role = "run-sheet"
        elif "-jump-sheet" in name:
            role = "jump-sheet"
        elif "-atk-sheet" in name:
            role = "atk-sheet"
        elif "-roll-sheet" in name:
            role = "roll-sheet"
        sprites[name] = {
            "file": name,
            "char": char,
            "role": role,
            "canvasW": data["canvasW"],
            "canvasH": data["canvasH"],
            "bytes": data["bytes"],
            "sheet": True,
            "cols": data["cols"],
            "rows": data["rows"],
            "cellW": data["cellW"],
            "cellH": data["cellH"],
            "refH": data["refH"],
            "frameCount": data["frameCount"],
            "content": {
                "left": 0,
                "top": 0,
                "right": data["canvasW"] - 1,
                "bottom": data["canvasH"] - 1,
                "w": data["canvasW"],
                "h": data["canvasH"],
            },
            "frames": data["frames"],
            "plant": False,
            "footGap": 0,
        }
        print(
            f"OK {name}: {cols}x{rows} frames={data['frameCount']} "
            f"cell={data['cellW']}x{data['cellH']} refH={data['refH']}"
        )
        for fr in data["frames"]:
            touch = []
            loc = fr["local"]
            if loc["left"] <= 1:
                touch.append("L")
            if loc["left"] + loc["w"] >= data["cellW"] - 1:
                touch.append("R")
            if loc["top"] <= 1:
                touch.append("T")
            if touch:
                print(f"  WARN [{fr['index']}] edge {touch} {loc['w']}x{loc['h']}")
        if name.endswith("-run-sheet.png") and char:
            run_meta[char] = run_foot_stats(data)

    # Remeasure opaque singles (keep align if present)
    for p in sorted(ASSETS.glob("*.png")):
        if "sheet" in p.name or "-magenta" in p.name:
            continue
        entry = measure_single(p)
        old = sprites.get(p.name) or {}
        if old.get("align"):
            entry["align"] = old["align"]
        sprites[p.name] = entry

    man["version"] = 1
    man["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    man["dir"] = "assets"
    man.setdefault("game", {"U": 40, "CHAR_W": 30, "CHAR_H_STAND": 80, "CHAR_H_DUCK": 40})
    man["refH"] = {"mage": 296, "warrior": 296}
    man["sheetRefH"] = {"mage": 296, "warrior": 296}
    man["sheets"] = sheets
    man["sprites"] = sprites
    man_path.write_text(json.dumps(man, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", man_path)

    # Patch characters.js run foot anchors + RUN uses 9 frames
    cfg = ASSETS.parent / "js" / "config" / "characters.js"
    text = cfg.read_text(encoding="utf-8")
    for cid, (foot, lock) in run_meta.items():
        # replace runFootLocalX / runLockW inside that character's run sheet block
        import re

        pat = rf"(src: 'assets/{cid}-run-sheet\.png'[\s\S]*?runFootLocalX: )([0-9.]+)(,\s*runLockW: )([0-9.]+)"
        text2, n = re.subn(pat, rf"\g<1>{foot:.0f}\g<3>{lock:.0f}", text, count=1)
        if n:
            text = text2
            print(f"characters.js {cid} foot={foot:.0f} lock={lock:.0f}")
        else:
            print(f"WARN no runFoot patch for {cid}")
    cfg.write_text(text, encoding="utf-8")

    # bump ASSET_VER (z → next letter + a, never '{')
    root = ASSETS.parent
    cur = (root / "build-id.txt").read_text(encoding="utf-8").strip()
    if cur[-1].isalpha() and cur[-1] != "z":
        nxt = cur[:-1] + chr(ord(cur[-1]) + 1)
    elif cur[-1] == "z" and len(cur) >= 2 and cur[-2].isalpha() and cur[-2] != "z":
        nxt = cur[:-2] + chr(ord(cur[-2]) + 1) + "a"  # bz → ca
    else:
        nxt = cur + "a"
    old, new = cur.encode(), nxt.encode()
    for p in [
        root / "build-id.txt",
        root / "js" / "config" / "characters.js",
        root / "js" / "boot-mobile.js",
        root / "index.html",
    ]:
        d = p.read_bytes()
        if old in d:
            p.write_bytes(d.replace(old, new))
            print("bump", p.name, "->", nxt)


if __name__ == "__main__":
    main()
