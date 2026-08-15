#!/usr/bin/env python3
"""把散帧 / 横条打成宫格 sheet（局内真源）。

约定（跳/攻/滚均含首尾跑步参考，局内播放跳过；帧数只补到 4/9/16）：
- 跳：run | ant…land | run → **3×3 frameCount=9**
- 攻：run | wind | atk | run → **2×2 frameCount=4**
- 跑：**3×3 frameCount=9**（原 8 补 1）
- 滚：**3×3 frameCount=9**（由 `build_*_roll_spin` / spun 精选；勿 hold 垫到 16）
- 怪：**2×2 frameCount=4**

画格：角色 512×768；怪物 512×512。
散帧输入：`assets/` 或 `dev/art-raw/singles/`（局内不加载散帧）。
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEV = Path(__file__).resolve().parent
sys.path.insert(0, str(DEV))

from action_sheet_align import run_ruler_cell, resolve_single  # noqa: E402

ASSETS = ROOT / "www" / "castle-parkour" / "assets"

CHAR_CW, CHAR_CH = 512, 768
MON_CELL = 512


def _paste_grid(
    cells: list[Image.Image | None],
    cols: int,
    rows: int,
    cw: int,
    ch: int,
) -> Image.Image:
    out = Image.new("RGBA", (cw * cols, ch * rows), (0, 0, 0, 0))
    for i, cell in enumerate(cells):
        if i >= cols * rows or cell is None:
            continue
        im = cell.convert("RGBA")
        if im.size != (cw, ch):
            canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            scale = min(cw / im.width, ch / im.height, 1.0)
            nw = max(1, int(im.width * scale))
            nh = max(1, int(im.height * scale))
            fitted = im.resize((nw, nh), Image.Resampling.NEAREST)
            x = (cw - nw) // 2
            y = ch - nh - 14 if ch >= 768 else ch - nh - 10
            if y < 0:
                y = 0
            canvas.alpha_composite(fitted, (x, y))
            im = canvas
        row, col = divmod(i, cols)
        out.alpha_composite(im, (col * cw, row * ch))
    return out


def pack_char_jump(cid: str) -> Path:
    names = ("jump-ant", "jump", "fly", "jump-land")
    poses = [Image.open(resolve_single(cid, n)) for n in names]
    ruler = run_ruler_cell(cid, idx=3)
    from action_sheet_align import expand_jump_up_down, write_pose_grid

    action = expand_jump_up_down(*poses)
    cells = [ruler, *action, ruler]
    out = ASSETS / f"{cid}-jump-sheet.png"
    write_pose_grid(out, cells, cols=3, rows=3)
    print(f"wrote {out.name} 3x3 clean jump (no lerp) frameCount={len(cells)}")
    return out


def pack_char_atk(cid: str) -> Path:
    names = ("atk-wind", "atk")
    poses = [Image.open(resolve_single(cid, n)) for n in names]
    ruler = run_ruler_cell(cid, idx=3)
    cells: list[Image.Image | None] = [ruler, *poses, ruler]
    out = ASSETS / f"{cid}-atk-sheet.png"
    _paste_grid(cells, 2, 2, CHAR_CW, CHAR_CH).save(out)
    print(f"wrote {out.name} 2x2 bookends+{len(poses)} frameCount={len(cells)}")
    return out


def pack_monster_strip(src_name: str, out_name: str) -> Path | None:
    src = ASSETS / src_name
    if not src.exists():
        print(f"skip missing {src_name}")
        return None
    im = Image.open(src).convert("RGBA")
    if im.width == MON_CELL * 2 and im.height == MON_CELL * 2:
        print(f"ok grid {src_name}")
        return src
    cols = max(1, round(im.width / MON_CELL))
    if im.height != MON_CELL and im.height != MON_CELL * 2:
        cols = max(1, round(im.width / max(1, im.height)))
        cell_w = im.width // cols
        cell_h = im.height
    else:
        cell_w = im.width // cols
        cell_h = im.height if cols * MON_CELL == im.width else MON_CELL
    cells = []
    for i in range(cols):
        cells.append(im.crop((i * cell_w, 0, (i + 1) * cell_w, cell_h)))
    while len(cells) < 4:
        cells.append(cells[-1] if cells else Image.new("RGBA", (MON_CELL, MON_CELL), (0, 0, 0, 0)))
    cells = cells[:4]
    out = ASSETS / out_name
    _paste_grid(cells, 2, 2, MON_CELL, MON_CELL).save(out)
    print(f"wrote {out.name} 2x2 from {src_name}")
    return out


def pack_strip_to_grid16(
    src_name: str,
    *,
    src_cols: int,
    cw: int = CHAR_CW,
    ch: int = CHAR_CH,
    out_name: str | None = None,
) -> Path | None:
    """滚等：原 N 帧补到 16，打成 4×4（只补不减；用 hold 复用，避免空格/lerp 残影）。"""
    from action_sheet_align import nearest_grid_count, pad_with_holds, write_pose_grid

    src = ASSETS / src_name
    if not src.exists():
        print(f"skip missing {src_name}")
        return None
    im = Image.open(src).convert("RGBA")
    if im.size == (cw * 4, ch * 4):
        print(f"ok 4x4 {src_name}")
        return src
    if im.height == ch and im.width >= cw * src_cols:
        cells = [im.crop((i * cw, 0, (i + 1) * cw, ch)) for i in range(src_cols)]
    else:
        cell_w = im.width // src_cols
        cells = [im.crop((i * cell_w, 0, (i + 1) * cell_w, im.height)) for i in range(src_cols)]
    # 去掉全空格（不删有内容的帧）
    kept: list[Image.Image] = []
    for cell in cells:
        ext = cell.getextrema()
        if ext[3][1] < 8:
            continue
        kept.append(cell)
    if not kept:
        raise SystemExit(f"{src_name}: no opaque cells")
    if len(kept) > 16:
        raise SystemExit(f"{src_name}: {len(kept)} > 16（不可减）")
    target = nearest_grid_count(len(kept))
    assert target == 16
    padded = pad_with_holds(kept, target)
    out = ASSETS / (out_name or src_name)
    write_pose_grid(out, padded, cols=4, rows=4)
    print(f"wrote {out.name} 4x4 from {len(kept)}→{target}")
    return out


def pack_strip_to_grid9(
    src_name: str,
    *,
    src_cols: int,
    cw: int = CHAR_CW,
    ch: int = CHAR_CH,
    out_name: str | None = None,
) -> Path | None:
    """跑等：原 N 帧补到 9，打成 3×3（只补不减）。"""
    from action_sheet_align import pad_with_lerps, nearest_grid_count, write_pose_grid

    src = ASSETS / src_name
    if not src.exists():
        print(f"skip missing {src_name}")
        return None
    im = Image.open(src).convert("RGBA")
    if im.size == (cw * 3, ch * 3):
        print(f"ok 3x3 {src_name}")
        return src
    if im.size == (cw * 4, ch * 4):
        cells = []
        for r in range(4):
            for c in range(4):
                cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
                # 粗筛空格
                extrema = cell.getextrema()
                if extrema[3][1] < 8:
                    continue
                cells.append(cell)
        cells = cells[:src_cols] if len(cells) >= src_cols else cells
    elif im.height == ch and im.width >= cw * src_cols:
        cells = [im.crop((i * cw, 0, (i + 1) * cw, ch)) for i in range(src_cols)]
    else:
        cell_w = im.width // src_cols
        cells = [im.crop((i * cell_w, 0, (i + 1) * cell_w, im.height)) for i in range(src_cols)]
    target = nearest_grid_count(len(cells))
    if len(cells) > target:
        raise SystemExit(f"{src_name}: {len(cells)} > {target}")
    padded = pad_with_lerps(cells, target)
    out = ASSETS / (out_name or src_name)
    write_pose_grid(out, padded, cols=3, rows=3)
    print(f"wrote {out.name} 3x3 from {len(cells)}→{target}")
    return out


def main() -> None:
    # 跳/攻已是 3×3 / 2×2：只检查，不重打（避免覆盖精修帧）
    for cid in ("mage", "warrior"):
        for name, expect in (
            (f"{cid}-jump-sheet.png", (CHAR_CW * 3, CHAR_CH * 3)),
            (f"{cid}-atk-sheet.png", (CHAR_CW * 2, CHAR_CH * 2)),
        ):
            p = ASSETS / name
            if not p.exists():
                print(f"missing {name}")
                continue
            im = Image.open(p)
            print(f"{'ok' if im.size == expect else 'BAD'} {name} {im.size}")

        pack_strip_to_grid9(f"{cid}-run-sheet.png", src_cols=8)
        # 滚：局内真源 3×3/9；由 build_*_roll_spin 维护，这里只验收尺寸
        roll = ASSETS / f"{cid}-roll-sheet.png"
        if not roll.exists():
            print(f"missing {roll.name}")
        else:
            im = Image.open(roll)
            expect = (CHAR_CW * 3, CHAR_CH * 3)
            print(f"{'ok' if im.size == expect else 'BAD'} {roll.name} {im.size}")

    for name in ("bat-sheet.png", "flyer-sheet.png", "giant-sheet.png", "monster-idle-sheet.png"):
        pack_monster_strip(name, name)
    print("done — next: measure crops (separate step)")


if __name__ == "__main__":
    main()
