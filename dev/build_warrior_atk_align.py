#!/usr/bin/env python3
"""战士攻击 — 无新品红表时：以现有散帧对齐跑步尺 + 出验收表。"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from action_sheet_align import (  # noqa: E402
    ASSETS,
    RAW,
    crop_alpha,
    plant_poses,
    resolve_single,
    run_ruler_cell,
    run_target_height,
    save_singles,
    uniform_scale_poses,
    write_bookend_sheet,
    write_pose_grid_bookends,
)

SINGLE_NAMES = ("atk-wind", "atk")
CID = "warrior"
ART_SHEETS = Path(__file__).resolve().parent / "art-sheets"


def main() -> None:
    if not (ASSETS / f"{CID}-run-sheet.png").exists():
        raise SystemExit(f"missing {CID}-run-sheet.png")

    poses0 = []
    for n in SINGLE_NAMES:
        try:
            path = resolve_single(CID, n)
        except FileNotFoundError as e:
            raise SystemExit(f"missing {e}") from e
        poses0.append(crop_alpha(Image.open(path).convert("RGBA")))

    h_run = run_target_height(CID)
    ruler = run_ruler_cell(CID, idx=3)
    print(f"h_run={h_run}")

    poses, sheet_k = uniform_scale_poses(poses0, h_run=h_run, anchor_ratio=0.95)
    print(f"sheet_k={sheet_k:.4f} sizes={[p.size for p in poses]}")

    planted = plant_poses(poses)
    save_singles(CID, SINGLE_NAMES, planted)
    write_pose_grid_bookends(
        ASSETS / "warrior-atk-sheet.png",
        planted,
        ruler,
        cols=2,
        rows=2,
        raw_aligned=RAW / "warrior-atk-sheet-aligned.png",
    )
    write_bookend_sheet(
        ART_SHEETS / "warrior-atk-sheet.png",
        planted,
        ruler,
        cols_meta=RAW / "warrior-atk-sheet.cols",
    )


if __name__ == "__main__":
    main()
