# -*- coding: utf-8 -*-
"""QA: cream/foot dust clip + body coreH vs run0.

Usage:
  python dev/qa_sheet_scale_dust.py
  python dev/qa_sheet_scale_dust.py --sheet warrior-atk-sheet.png
"""
from __future__ import annotations

import argparse
from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_layout import ASSETS as _ASSETS, QA  # noqa: E402

ASSETS = _ASSETS / "characters"
OUT = QA
OUT.mkdir(parents=True, exist_ok=True)
ALPHA = 28


def body_core_h(cell: np.ndarray) -> int | None:
    al = cell[:, :, 3] > ALPHA
    if not al.any():
        return None
    widths = al.sum(axis=1)
    mx = int(widths.max())
    thick = widths >= max(8, int(mx * 0.40))
    ys = np.where(thick)[0]
    if len(ys) == 0:
        return None
    return int(ys.max() - ys.min() + 1)


def is_dust(r, g, b, a):
    return (
        (a > ALPHA)
        & (r > 145)
        & (g > 115)
        & (b < 198)
        & (np.abs(r.astype(int) - g.astype(int)) < 55)
        & (r.astype(int) > b.astype(int) + 8)
    )


def audit(path: Path, cols: int, rows: int, run0: np.ndarray | None) -> None:
    im = np.array(Image.open(path).convert("RGBA"))
    H, W = im.shape[:2]
    cw, ch = W // cols, H // rows
    h0 = body_core_h(run0) if run0 is not None else None
    print(f"\n=== {path.name} cell={cw}x{ch} ===")
    OUT.mkdir(parents=True, exist_ok=True)
    for i in range(cols * rows):
        ri, ci = divmod(i, cols)
        cell = im[ri * ch : (ri + 1) * ch, ci * cw : (ci + 1) * cw]
        r, g, b, a = cell[:, :, 0], cell[:, :, 1], cell[:, :, 2], cell[:, :, 3]
        dust = is_dust(r, g, b, a)
        edge = []
        if int(dust[:, :2].sum()) > 20:
            edge.append("dustL")
        if int(dust[:, -2:].sum()) > 20:
            edge.append("dustR")
        if int(dust[-2:, :].sum()) > 20:
            edge.append("dustB")
        ys, xs = np.where(a > ALPHA)
        content_edge = []
        if len(xs) and int(xs.min()) <= 1:
            content_edge.append("L")
        if len(xs) and int(xs.max()) >= cw - 2:
            content_edge.append("R")
        if len(ys) and int(ys.min()) <= 1:
            content_edge.append("T")
        hh = body_core_h(cell)
        ratio = (hh / h0) if (hh and h0) else None
        ok = ratio is None or 0.88 <= ratio <= 1.12
        rs = f"r={ratio:.3f}" if ratio is not None else "n/a"
        print(
            f"  c{i}: coreH={'OK' if ok else 'FAIL'} {rs} "
            f"dustPx={int(dust.sum())} edge={edge or '-'} contentEdge={content_edge or '-'}"
        )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", default="", help="e.g. warrior-atk-sheet.png")
    args = ap.parse_args()
    targets = []
    if args.sheet:
        targets = list(ASSETS.rglob(args.sheet))
    else:
        for name in (
            "warrior-run-sheet.png",
            "warrior-atk-sheet.png",
            "mage-run-sheet.png",
            "mage-atk-sheet.png",
        ):
            targets.extend(ASSETS.rglob(name))
    for path in targets:
        char = path.parent.name
        run_p = ASSETS / char / f"{char}-run-sheet.png"
        run0 = None
        if run_p.exists():
            run = np.array(Image.open(run_p).convert("RGBA"))
            # first cell
            cols = 3
            cw, ch = run.shape[1] // cols, run.shape[0] // cols
            run0 = run[0:ch, 0:cw]
        # infer grid from aspect
        w, h = Image.open(path).size
        if abs(w / h - 1.0) < 0.15:
            cols = rows = 2 if w < 2000 else 3
        else:
            cols, rows = 3, 3
            if w // 3 * 3 != w:
                cols, rows = 2, 2
        # prefer 3x3 for known motion sheets
        if "-run-" in path.name or "-atk-" in path.name or "-jump-" in path.name:
            cols, rows = 3, 3
        audit(path, cols, rows, run0)


if __name__ == "__main__":
    main()
