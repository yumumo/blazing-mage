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
    run_ruler_cell,
    run_target_height,
    save_singles,
    uniform_scale_poses,
    write_bookend_sheet,
)

SINGLE_NAMES = ("atk-wind", "atk")
CID = "warrior"


def main() -> None:
    if not (ASSETS / f"{CID}-run-sheet.png").exists():
        raise SystemExit(f"missing {CID}-run-sheet.png")

    srcs = [ASSETS / f"{CID}-{n}.png" for n in SINGLE_NAMES]
    # 优先 art-raw keyed；否则用 assets 旧散帧重对齐
    raw_alts = [RAW / f"{CID}-{n}.png" for n in SINGLE_NAMES]
    poses0 = []
    for alt, asset in zip(raw_alts, srcs):
        path = alt if alt.exists() else asset
        if not path.exists():
            raise SystemExit(f"missing {path}")
        poses0.append(crop_alpha(Image.open(path).convert("RGBA")))

    h_run = run_target_height(CID)
    ruler = run_ruler_cell(CID, idx=3)
    print(f"h_run={h_run}")

    poses, sheet_k = uniform_scale_poses(poses0, h_run=h_run, anchor_ratio=0.95)
    print(f"sheet_k={sheet_k:.4f} sizes={[p.size for p in poses]}")

    planted = plant_poses(poses)
    save_singles(CID, SINGLE_NAMES, planted)
    write_bookend_sheet(
        ASSETS / "warrior-atk-sheet.png",
        planted,
        ruler,
        raw_aligned=RAW / "warrior-atk-sheet-aligned.png",
        cols_meta=RAW / "warrior-atk-sheet.cols",
    )


if __name__ == "__main__":
    main()
