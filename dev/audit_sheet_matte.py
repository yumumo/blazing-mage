# -*- coding: utf-8 -*-
"""Post-plant matte QC for character sheets. Exit 1 if fail."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ALPHA = 28


def audit_cell(cell: np.ndarray) -> dict:
    r, g, b, a = (
        cell[:, :, 0].astype(int),
        cell[:, :, 1].astype(int),
        cell[:, :, 2].astype(int),
        cell[:, :, 3],
    )
    H, W = a.shape
    hot = int(((a > 40) & (r > 200) & (b > 200) & (g < 100) & (np.abs(r - b) < 50)).sum())
    pad = np.pad(a <= 20, 1, constant_values=True)
    edge = np.zeros_like(a, bool)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        edge |= pad[1 + dy : H + 1 + dy, 1 + dx : W + 1 + dx]
    soft = int(
        (
            edge
            & (a > 40)
            & (r > 160)
            & (b > 145)
            & (g < 175)
            & (r > g + 15)
            & (b > g + 8)
            & (np.abs(r - b) < 75)
        ).sum()
    )
    ys, xs = np.where(a > ALPHA)
    if len(ys) == 0:
        return {"empty": True, "hot": hot, "soft": soft, "holes": 0}
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    # Enclosed holes: transparent regions inside content bbox that do NOT touch bbox border
    # (leg gaps open to border → ignored; armor punched holes → counted)
    from collections import deque

    sub_h, sub_w = y1 - y0 + 1, x1 - x0 + 1
    trans = a[y0 : y1 + 1, x0 : x1 + 1] <= 20
    visited = np.zeros_like(trans, bool)
    holes = 0
    for sy in range(sub_h):
        for sx in range(sub_w):
            if not trans[sy, sx] or visited[sy, sx]:
                continue
            q = deque([(sy, sx)])
            visited[sy, sx] = True
            comp = [(sy, sx)]
            touches_border = sy == 0 or sx == 0 or sy == sub_h - 1 or sx == sub_w - 1
            while q:
                cy, cx = q.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < sub_h and 0 <= nx < sub_w and trans[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        q.append((ny, nx))
                        comp.append((ny, nx))
                        if ny == 0 or nx == 0 or ny == sub_h - 1 or nx == sub_w - 1:
                            touches_border = True
            if not touches_border and len(comp) >= 4:
                holes += len(comp)
    return {
        "empty": False,
        "hot": hot,
        "soft": soft,
        "holes": holes,
        "w": x1 - x0 + 1,
        "h": y1 - y0 + 1,
        "footB": H - 1 - y1,
        "margL": x0,
        "margR": W - 1 - x1,
    }


def audit_sheet(path: Path, cols: int, rows: int) -> list[str]:
    im = np.array(Image.open(path).convert("RGBA"))
    H, W = im.shape[:2]
    cw, ch = W // cols, H // rows
    fails: list[str] = []
    print(f"== {path.name} {cols}x{rows} cell={cw}x{ch}")
    for i in range(cols * rows):
        ri, ci = divmod(i, cols)
        cell = im[ri * ch : (ri + 1) * ch, ci * cw : (ci + 1) * cw]
        m = audit_cell(cell)
        if m.get("empty"):
            msg = f"c{i}: EMPTY"
            print(msg)
            fails.append(msg)
            continue
        ok = m["hot"] == 0 and m["soft"] <= 40 and m["holes"] <= 80
        flag = "OK" if ok else "FAIL"
        line = (
            f"c{i}: {flag} hot={m['hot']} soft={m['soft']} enclosedHoles={m['holes']} "
            f"{m['w']}x{m['h']} B{m['footB']} L{m['margL']}R{m['margR']}"
        )
        print(line)
        if not ok:
            fails.append(line)
    return fails


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", type=Path, required=True)
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    args = ap.parse_args()
    fails = audit_sheet(args.sheet, args.cols, args.rows)
    if fails:
        print(f"MATTE_FAIL {len(fails)}")
        sys.exit(1)
    print("MATTE_OK")


if __name__ == "__main__":
    main()
