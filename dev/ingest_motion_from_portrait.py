"""立绘系动作入库（jump / atk / roll）。

真源参考：assets/*-portrait.png（GenerateImage 时已用立绘）。
本脚本：拷贝 gen 品红 sheet → chroma → 竖/横布局归一 → 切格对齐 refH → measure。
禁止改动 *-run-sheet.png。

用法：
  python core/castle-parkour/dev/ingest_motion_from_portrait.py
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(r"e:/Users/lin/Desktop/Home/XRK-AGT")
GEN = Path(r"C:/Users/lin/.cursor/projects/e-Users-lin-Desktop-Home-XRK-AGT/assets")
ASSETS = ROOT / "core/castle-parkour/www/castle-parkour/assets"
RAW = ROOT / "core/castle-parkour/dev/art-raw"
CHROMA = ROOT / ".cursor/skills/immersive-short-video/scripts/chroma_key.py"
MEASURE_SHEET = ROOT / ".cursor/skills/castle-parkour-art/scripts/measure_run_sheet.py"
MEASURE = ROOT / ".cursor/skills/castle-parkour-art/scripts/measure_sprites.py"
CHARS = ROOT / "core/castle-parkour/www/castle-parkour/js/config/characters.js"

SHEETS = [
    "mage-jump-sheet-magenta.png",
    "warrior-jump-sheet-magenta.png",
    "mage-atk-sheet-magenta.png",
    "warrior-atk-sheet-magenta.png",
    "mage-roll-sheet-magenta.png",
    "warrior-roll-sheet-magenta.png",
]

JUMP = {0: "jump-ant.png", 1: "jump.png", 2: "fly.png"}
ATK = {0: "atk-wind.png", 1: "atk.png"}


def run(cmd: list) -> None:
    print("+", " ".join(str(c) for c in cmd))
    subprocess.check_call(cmd)


def bbox(im: Image.Image, a_min: int = 12):
    a = im.split()[-1]
    return a.point(lambda p: 255 if p > a_min else 0).getbbox()


def cell_opaque_score(im: Image.Image, box: tuple[int, int, int, int]) -> int:
    crop = im.crop(box)
    a = crop.split()[-1]
    # count roughly
    return sum(1 for p in a.getdata() if p > 12)


def detect_layout(im: Image.Image) -> tuple[str, int, int]:
    """Return ('h'|'v', cols, rows) for 3-frame sheet."""
    W, H = im.size
    # horizontal thirds
    cw, ch = W // 3, H
    h_scores = [cell_opaque_score(im, (i * cw, 0, (i + 1) * cw, H)) for i in range(3)]
    # vertical thirds
    cw2, ch2 = W, H // 3
    v_scores = [cell_opaque_score(im, (0, i * ch2, W, (i + 1) * ch2)) for i in range(3)]
    h_ok = sum(1 for s in h_scores if s > 500)
    v_ok = sum(1 for s in v_scores if s > 500)
    print("  layout scores H", h_scores, "V", v_scores, "->", "H" if h_ok >= v_ok else "V")
    if v_ok > h_ok:
        return "v", 1, 3
    return "h", 3, 1


def split_cells(path: Path, inset: int = 4) -> tuple[list[Image.Image], int, int]:
    im = Image.open(path).convert("RGBA")
    orient, cols, rows = detect_layout(im)
    W, H = im.size
    cw, ch = W // cols, H // rows
    cells = []
    for r in range(rows):
        for c in range(cols):
            x0 = c * cw + inset
            y0 = r * ch + inset
            x1 = (c + 1) * cw - inset
            y1 = (r + 1) * ch - inset
            cells.append(im.crop((x0, y0, x1, y1)))
    return cells, cols, rows


def fit_ref(cell: Image.Image, ref_h: int, canvas: int = 512) -> Image.Image:
    bb = bbox(cell)
    if not bb:
        raise ValueError("empty cell")
    cropped = cell.crop(bb)
    cw, ch = cropped.size
    scale = ref_h / ch
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.NEAREST)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(resized, ((canvas - nw) // 2, canvas - nh - 2), resized)
    return out


def darken_middle_h(path: Path, factor: float = 0.82) -> None:
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    orient, cols, rows = detect_layout(im)
    if orient != "h":
        return
    cw = W // 3
    mid = im.crop((cw, 0, 2 * cw, H))
    rgb = ImageEnhance.Brightness(mid.convert("RGB")).enhance(factor)
    mid2 = Image.merge("RGBA", (*rgb.split(), mid.split()[-1]))
    im.paste(mid2, (cw, 0))
    im.save(path)


def export(char: str, sheet: str, mapping: dict[int, str], ref_h: int) -> tuple[int, int]:
    cells, cols, rows = split_cells(ASSETS / sheet)
    for i, suf in mapping.items():
        out = fit_ref(cells[i], ref_h)
        dest = ASSETS / f"{char}-{suf}"
        out.save(dest)
        bb = bbox(out)
        print(" ", dest.name, "h", bb[3] - bb[1] if bb else None)
    return cols, rows


def normalize_sheet_to_horizontal(path: Path) -> None:
    """If sheet is vertical 1x3, rewrite as horizontal 3x1 for game roll/measure consistency."""
    im = Image.open(path).convert("RGBA")
    orient, cols, rows = detect_layout(im)
    if orient != "v":
        return
    cells, _, _ = split_cells(path, inset=2)
    # pack horizontally on magenta-cleared canvas
    # use max cell content fitted into equal cells
    cell_w, cell_h = 512, 1024
    out = Image.new("RGBA", (cell_w * 3, cell_h), (0, 0, 0, 0))
    for i, cell in enumerate(cells):
        bb = bbox(cell)
        if not bb:
            continue
        cropped = cell.crop(bb)
        # fit into cell keeping aspect, feet near bottom of cell
        cw, ch = cropped.size
        scale = min((cell_w * 0.9) / cw, (cell_h * 0.85) / ch)
        nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
        resized = cropped.resize((nw, nh), Image.Resampling.NEAREST)
        x = i * cell_w + (cell_w - nw) // 2
        y = cell_h - nh - 20
        out.paste(resized, (x, y), resized)
    out.save(path)
    print("normalized vertical→horizontal", path.name)


def main() -> None:
    run_mtime = {n: (ASSETS / n).stat().st_mtime for n in ("mage-run-sheet.png", "warrior-run-sheet.png")}

    for name in SHEETS:
        src = GEN / name
        if not src.exists():
            print("MISSING", name)
            continue
        shutil.copy2(src, ASSETS / name)
        shutil.copy2(src, RAW / name)

    run([sys.executable, str(CHROMA), "--input", str(ASSETS), "--glob", "*-magenta.png"])

    # fix vertical jump sheets etc before export
    for n in [
        "mage-jump-sheet.png", "warrior-jump-sheet.png",
        "mage-atk-sheet.png", "warrior-atk-sheet.png",
        "mage-roll-sheet.png", "warrior-roll-sheet.png",
    ]:
        p = ASSETS / n
        if p.exists():
            normalize_sheet_to_horizontal(p)

    if (ASSETS / "characters" / "warrior" / "warrior-roll-sheet.png").exists():
        darken_middle_h(ASSETS / "characters" / "warrior" / "warrior-roll-sheet.png", 0.82)

    mpath = ASSETS / "sprite-manifest.json"
    ref = {"mage": 275, "warrior": 277}
    if mpath.exists():
        m = json.loads(mpath.read_text(encoding="utf-8"))
        ref.update(m.get("refH") or {})

    export("mage", "mage-jump-sheet.png", JUMP, ref["mage"])
    export("warrior", "warrior-jump-sheet.png", JUMP, ref["warrior"])
    export("mage", "mage-atk-sheet.png", ATK, ref["mage"])
    export("warrior", "warrior-atk-sheet.png", ATK, ref["warrior"])

    for glob_pat in ("*-jump-sheet.png", "*-atk-sheet.png", "*-roll-sheet.png"):
        run([
            sys.executable, str(MEASURE_SHEET),
            "--input", str(ASSETS), "--cols", "3", "--rows", "1", "--glob", glob_pat,
        ])
    run([sys.executable, str(MEASURE), "--input", str(ASSETS)])

    m = json.loads(mpath.read_text(encoding="utf-8"))
    mr = m["sprites"].get("mage-roll-sheet.png", {}).get("refH") or 280
    wr = m["sprites"].get("warrior-roll-sheet.png", {}).get("refH") or 260
    # if bad full-cell refH, use plant frame content h
    for key, var in (("mage-roll-sheet.png", "mr"), ("warrior-roll-sheet.png", "wr")):
        ent = m["sprites"].get(key) or {}
        frames = ent.get("frames") or []
        if frames and ent.get("refH", 0) > 800:
            hs = [f["h"] for f in frames if f.get("h")]
            if hs:
                if key.startswith("mage"):
                    mr = int(sum(hs) / len(hs))
                else:
                    wr = int(sum(hs) / len(hs))

    c = CHARS.read_text(encoding="utf-8")
    c = re.sub(
        r"(mage: \{ src: 'assets/mage-roll-sheet\.png', img: null, ready: false, frames: null, refH: )\d+",
        rf"\g<1>{mr}",
        c,
        count=1,
    )
    c = re.sub(
        r"(warrior: \{ src: 'assets/warrior-roll-sheet\.png', img: null, ready: false, frames: null, refH: )\d+",
        rf"\g<1>{wr}",
        c,
        count=1,
    )
    c = re.sub(r"ASSET_VER = '[^']+'", "ASSET_VER = '20260813q'", c, count=1)
    CHARS.write_text(c, encoding="utf-8", newline="\n")

    for p in ASSETS.rglob("*-magenta.png"):
        p.unlink()

    for n, mt0 in run_mtime.items():
        assert (ASSETS / n).stat().st_mtime == mt0, f"RUN TOUCHED {n}"
        print("RUN intact", n)

    print("done refH", m.get("refH"), "roll", mr, wr)


if __name__ == "__main__":
    main()
