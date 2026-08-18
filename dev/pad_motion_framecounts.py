#!/usr/bin/env python3
"""把跳/跑等现有 sheet 帧数对齐到 4 / 9 / 16（只补不减）。

- 跳：走 `rebuild_jump_clean`（真姿态，**禁止 lerp 残影**）→ 3×3 / 9
- 跑：现 8 → 9（插 1 帧；跑姿相近可用 lerp）→ 3×3
- 攻 4 / 滚 9 / 怪 4：已对齐则只检查（滚由 `build_*_roll_spin` 维护）
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from action_sheet_align import (  # noqa: E402
    ASSETS,
    CW,
    CH,
    nearest_grid_count,
    pad_with_lerps,
    write_pose_grid,
)
from import_jump_roll_sheets import content_box  # noqa: E402

ALPHA_FULL = 0.92


def nonempty_cells(path: Path, cols: int, rows: int, cw: int, ch: int) -> list[Image.Image]:
    im = Image.open(path).convert("RGBA")
    out: list[Image.Image] = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            box = content_box(np.array(cell))
            if not box:
                continue
            if (box[3] - box[1]) >= ch * ALPHA_FULL:
                continue
            out.append(cell)
    return out


def pad_jump(cid: str) -> None:
    """跳表改走 rebuild_jump_clean（真姿态上下，无残影）。"""
    from rebuild_jump_clean import rebuild

    rebuild(cid)


def pad_run(cid: str) -> None:
    path = (ASSETS / "characters" / cid / f"{cid}-run-sheet.png")
    cells = nonempty_cells(path, 4, 4, CW, CH)
    if len(cells) < 4:
        cells = nonempty_cells(path, 3, 3, CW, CH)
    if len(cells) < 4:
        raise SystemExit(f"{path.name}: need run frames, got {len(cells)}")
    target = nearest_grid_count(len(cells))
    if len(cells) > target:
        raise SystemExit(f"{path.name}: {len(cells)} > {target} (不可减)")
    padded = pad_with_lerps(cells, target)
    side = 3 if target == 9 else (2 if target == 4 else 4)
    write_pose_grid(path, padded, cols=side, rows=side)
    print(f"  {cid} run: {len(cells)}→{target} ({side}×{side})")


def check_sheet(name: str, cols: int, rows: int, cw: int, ch: int, expect: int) -> None:
    p = ASSETS / name
    if not p.exists():
        print(f"  skip missing {name}")
        return
    cells = nonempty_cells(p, cols, rows, cw, ch)
    n = len(cells)
    status = "OK" if n == expect else ("PAD?" if n < expect else "TOO MANY")
    print(f"  check {name}: nonempty={n} expect={expect} {status}")


def main() -> None:
    for cid in ("mage", "warrior"):
        pad_jump(cid)
        pad_run(cid)
    check_sheet("mage-atk-sheet.png", 2, 2, CW, CH, 4)
    check_sheet("warrior-atk-sheet.png", 2, 2, CW, CH, 4)
    check_sheet("mage-roll-sheet.png", 3, 3, CW, CH, 9)
    check_sheet("warrior-roll-sheet.png", 3, 3, CW, CH, 9)
    for name in ("bat-sheet.png", "flyer-sheet.png", "giant-sheet.png", "monster-idle-sheet.png"):
        check_sheet(name, 2, 2, 512, 512, 4)
    print("done")


if __name__ == "__main__":
    main()
