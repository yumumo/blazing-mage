#!/usr/bin/env python3
"""战士翻滚成球旋转 — 与法师同流程（跑步尺、同表缩放、尾气不跟转）。

源：art-raw/warrior-roll-sheet.png
  tuck / dive / ball / unroll（去掉 recover）
  ball 去尾气后顺时针旋转（PIL 负角）；尾气旋转后 stamp 左侧
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
    FOOT,
    MARGIN,
    RAW,
    crop_alpha,
    run_ruler_cell,
    run_target_height,
    scale_uniform,
)
from build_mage_roll_spin import (  # noqa: E402
    ball_spin_cell,
    clean_ball,
    content_box,
    extract_dust,
    fit_once,
    lerp_cell,
    plant_ground,
    stamp_dust,
)
from import_jump_roll_sheets import split_cells  # noqa: E402

CID = "warrior"


def main() -> None:
    src = RAW / "warrior-roll-sheet.png"
    if not src.exists():
        raise SystemExit(f"missing {src}")
    if not (ASSETS / f"{CID}-run-sheet.png").exists():
        raise SystemExit(f"missing {CID}-run-sheet.png")

    h_run = run_target_height(CID)
    ruler = run_ruler_cell(CID, idx=3)
    print(f"h_run={h_run}")

    cells = split_cells(src, cols=5, hard_magenta=True)
    if len(cells) < 4:
        raise SystemExit(f"need ≥4 roll poses, got {len(cells)}")
    # tuck dive ball unroll（丢 recover）
    tuck0, dive0, ball0, unroll0 = [crop_alpha(c) for c in cells[:4]]
    # 存球原稿便于复跑
    ball0.save(RAW / "warrior-roll-ball.png")
    ball0 = clean_ball(ball0)

    crouch_h = max(1, int(h_run * 0.72))
    sheet_k = crouch_h / max(1, tuck0.height)
    tuck = scale_uniform(tuck0, sheet_k)
    dive = scale_uniform(dive0, sheet_k)
    unroll = scale_uniform(unroll0, sheet_k)
    ball = scale_uniform(ball0, sheet_k)
    # 战士球已朝右，不 FLIP

    compact_max_w = int(h_run * 0.95)
    for name, im in (("dive", dive), ("unroll", unroll)):
        if im.width > compact_max_w:
            ck = compact_max_w / im.width
            print(f"compact {name}: {im.size} → k={ck:.3f}")
            if name == "dive":
                dive = scale_uniform(dive, ck)
            else:
                unroll = scale_uniform(unroll, ck)

    max_w = CW - 2 * MARGIN
    widest = max(tuck.width, dive.width, unroll.width, ball.width)
    if widest > max_w:
        fit_k = max_w / widest
        print(f"WARN width clamp fit_k={fit_k:.3f}")
        tuck = scale_uniform(tuck, fit_k)
        dive = scale_uniform(dive, fit_k)
        unroll = scale_uniform(unroll, fit_k)
        ball = scale_uniform(ball, fit_k)
        sheet_k *= fit_k

    lock = max(ball.size)
    print(f"sheet_k={sheet_k:.4f} tuck={tuck.size} dive={dive.size} ball={ball.size} unroll={unroll.size} lock={lock}")

    dust = extract_dust(src)
    if dust is not None:
        dust = fit_once(dust, max(28, lock // 4))

    # 同法师：第 12 格收 -360° → lerp×2 → unroll；lock 不变
    spin_start = -120.0
    spin_end = -360.0
    spin_n = 9
    spin_step = (spin_end - spin_start) / (spin_n - 1)
    unroll_cell = stamp_dust(plant_ground(unroll), dust)
    action = [
        stamp_dust(plant_ground(tuck), dust),
        stamp_dust(plant_ground(dive), dust),
    ]
    for i in range(spin_n):
        ang = spin_start + i * spin_step
        action.append(stamp_dust(ball_spin_cell(ball, float(ang), lock), dust))
    exit_ball = action[-1]
    action.append(lerp_cell(exit_ball, unroll_cell, 0.34))
    action.append(lerp_cell(exit_ball, unroll_cell, 0.67))
    action.append(unroll_cell)

    seq = [ruler, *action, ruler]
    assert len(seq) == 16, f"want 16 got {len(seq)}"
    n = len(seq)
    for i, cell in enumerate(seq):
        box = content_box(np.array(cell))
        h = (box[3] - box[1]) if box else 0
        tag = "runRef" if i in (0, n - 1) else "action"
        print(f"  [{i}] {tag} {(box[2]-box[0]) if box else 0}x{h}")

    dest = ASSETS / "warrior-roll-sheet.png"
    grid = Image.new("RGBA", (CW * 4, CH * 4), (0, 0, 0, 0))
    for i, cell in enumerate(seq):
        row, col = divmod(i, 4)
        grid.paste(cell, (col * CW, row * CH))
    grid.save(dest)
    (RAW / "warrior-roll-sheet.cols").write_text(f"{n}\n", encoding="utf-8")
    (RAW / "warrior-roll-sheet.grid").write_text("4x4\n", encoding="utf-8")
    grid.save(RAW / "warrior-roll-sheet-spun.png")
    print(f"wrote {dest} grid=4x4 frameCount={n} spin={spin_start}→{spin_end}×{spin_n} +lerp×2 lock={lock}")


if __name__ == "__main__":
    main()
