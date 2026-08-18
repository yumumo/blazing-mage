# -*- coding: utf-8 -*-
"""Full audit of castle-parkour www assets PNGs."""
from __future__ import annotations

import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_layout import ASSETS, AUDIT  # noqa: E402

OUT = AUDIT
OUT.mkdir(parents=True, exist_ok=True)

CW, CH = 512, 768
SHEET_HINTS = {
    "run-sheet": (3, 3),
    "jump-sheet": (3, 3),
    "roll-sheet": (3, 3),
    "atk-sheet": (2, 2),
    "bat-sheet": (2, 2),
    "flyer-sheet": (2, 2),
    "giant-sheet": (2, 2),
    "monster-idle-sheet": (2, 2),
}


def guess_grid(im: Image.Image, name: str) -> tuple[int, int]:
    for k, (c, r) in SHEET_HINTS.items():
        if k in name:
            return c, r
    w, h = im.size
    for cols, rows in ((2, 2), (3, 3), (4, 4), (1, 1)):
        if w % cols == 0 and h % rows == 0:
            cw, ch = w // cols, h // rows
            if 0.5 <= cw / max(1, ch) <= 2.0:
                return cols, rows
    return 1, 1


def content_box(a: np.ndarray):
    ys, xs = np.where(a[:, :, 3] > 28)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def analyze_rgba(a: np.ndarray, label: str) -> dict:
    r, g, b, al = [a[:, :, i].astype(np.int16) for i in range(4)]
    opaque = al > 40
    n_op = int(opaque.sum())
    if n_op == 0:
        return {"label": label, "opaque": 0, "issues": ["EMPTY"], "hot_mag": 0, "soft_mag": 0, "fringe": 0, "near_black": 0}

    hot = opaque & (r > 200) & (b > 200) & (g < 110) & (np.abs(r.astype(int) - b) < 50)
    soft = opaque & (r > 185) & (b > 175) & (g < 150) & (r > g + 25) & (b > g + 15) & (np.abs(r.astype(int) - b) < 60)
    pink = opaque & (r > 200) & (b > 170) & (g > 140) & (g < 210) & (np.abs(r.astype(int) - b) < 55)
    near_black = opaque & ((r.astype(int) + g + b) < 45)

    h, w = al.shape
    pad = np.pad(al <= 20, 1, constant_values=True)
    edge = np.zeros_like(opaque, bool)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        edge |= pad[1 + dy : h + 1 + dy, 1 + dx : w + 1 + dx]
    fringe = (hot | soft | pink) & edge

    issues: list[str] = []
    hot_n = int(hot.sum())
    soft_n = int(soft.sum())
    fringe_n = int(fringe.sum())
    black_n = int(near_black.sum())
    if hot_n > 80:
        issues.append(f"HOT_MAGENTA_ON_SUBJECT:{hot_n}")
    if soft_n > 400:
        issues.append(f"SOFT_MAGENTA_ON_SUBJECT:{soft_n}")
    if fringe_n > 200:
        issues.append(f"MAGENTA_EDGE_FRINGE:{fringe_n}")
    if black_n > n_op * 0.35 and black_n > 2000:
        issues.append(f"NEAR_BLACK_PLATE:{black_n}")
    box = content_box(a)
    area = (box[2] - box[0]) * (box[3] - box[1]) if box else 0
    if area and area < 2500:
        issues.append(f"TINY_CONTENT:{area}")
    return {
        "label": label,
        "opaque": n_op,
        "hot_mag": hot_n,
        "soft_mag": soft_n,
        "fringe": fringe_n,
        "near_black": black_n,
        "issues": issues,
    }


def main() -> None:
    rows: list[dict] = []
    files = sorted(ASSETS.rglob("*.png"))
    for p in files:
        rel = str(p.relative_to(ASSETS)).replace("\\", "/")
        im = Image.open(p).convert("RGBA")
        a = np.array(im)
        name = p.name
        file_issues: list[str] = []
        cell_results: list[dict] = []
        if "sheet" in name:
            cols, rows_g = guess_grid(im, name)
            cw, ch = im.width // cols, im.height // rows_g
            for ri in range(rows_g):
                for ci in range(cols):
                    cell = a[ri * ch : (ri + 1) * ch, ci * cw : (ci + 1) * cw]
                    st = analyze_rgba(cell, f"{ri},{ci}")
                    cell_results.append(st)
                    for iss in st["issues"]:
                        file_issues.append(f"cell[{ri * cols + ci}] {iss}")
            empty = sum(
                1
                for c in cell_results
                if "EMPTY" in c["issues"] or any(i.startswith("TINY") for i in c["issues"])
            )
            if empty:
                file_issues.append(f"BAD_CELLS:{empty}/{cols * rows_g}")
        else:
            st = analyze_rgba(a, "full")
            cell_results = [st]
            file_issues.extend(st["issues"])

        sev = "ok"
        joined = " ".join(file_issues)
        if any(k in joined for k in ("HOT_MAGENTA", "EMPTY", "TINY", "BAD_CELLS")):
            sev = "high"
        elif any(k in joined for k in ("FRINGE", "SOFT_MAGENTA", "NEAR_BLACK")):
            sev = "med"
        elif file_issues:
            sev = "low"

        rows.append(
            {
                "file": rel,
                "size": list(im.size),
                "kb": p.stat().st_size // 1024,
                "severity": sev,
                "issues": file_issues[:24],
                "hot_sum": sum(c.get("hot_mag", 0) for c in cell_results),
                "fringe_sum": sum(c.get("fringe", 0) for c in cell_results),
                "soft_sum": sum(c.get("soft_mag", 0) for c in cell_results),
            }
        )

    def run0(cid: str) -> np.ndarray:
        p = ASSETS / "characters" / cid / f"{cid}-run-sheet.png"
        im = np.array(Image.open(p).convert("RGBA"))
        return im[0:CH, 0:CW].copy()

    for cid in ("mage", "warrior"):
        r0 = run0(cid)
        for motion, cols, rows_g in (("atk", 2, 2), ("jump", 3, 3), ("roll", 3, 3)):
            p = ASSETS / "characters" / cid / f"{cid}-{motion}-sheet.png"
            if not p.exists():
                continue
            im = np.array(Image.open(p).convert("RGBA"))
            scw, sch = im.shape[1] // cols, im.shape[0] // rows_g
            first = im[0:sch, 0:scw]
            last = im[(rows_g - 1) * sch : rows_g * sch, (cols - 1) * scw : cols * scw]

            def cell_eq(c: np.ndarray) -> np.ndarray:
                if c.shape[0] != CH or c.shape[1] != CW:
                    canvas = np.zeros((CH, CW, 4), np.uint8)
                    h = min(CH, c.shape[0])
                    w = min(CW, c.shape[1])
                    canvas[:h, :w] = c[:h, :w]
                    return canvas
                return c

            first, last = cell_eq(first), cell_eq(last)
            iss = []
            if not np.array_equal(first, r0):
                iss.append("FIRST_NE_RUN0")
            if not np.array_equal(last, r0):
                iss.append("LAST_NE_RUN0")
            if iss:
                rows.append(
                    {
                        "file": f"characters/{cid}/{cid}-{motion}-sheet.png [bookend]",
                        "size": [im.shape[1], im.shape[0]],
                        "kb": 0,
                        "severity": "high",
                        "issues": iss,
                        "hot_sum": 0,
                        "fringe_sum": 0,
                        "soft_sum": 0,
                    }
                )

    order = {"high": 0, "med": 1, "low": 2, "ok": 3}
    rows.sort(key=lambda x: (order.get(x["severity"], 9), -(x.get("hot_sum", 0) + x.get("fringe_sum", 0)), x["file"]))

    report = {
        "total_png": len(files),
        "high": sum(1 for r in rows if r["severity"] == "high"),
        "med": sum(1 for r in rows if r["severity"] == "med"),
        "low": sum(1 for r in rows if r["severity"] == "low"),
        "ok": sum(1 for r in rows if r["severity"] == "ok"),
        "rows": rows,
    }
    (OUT / "FULL_asset_audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# Castle Parkour asset audit",
        f"total_png={len(files)} high={report['high']} med={report['med']} low={report['low']} ok={report['ok']}",
        "",
    ]
    for r in rows:
        if r["severity"] == "ok" and not r["issues"]:
            continue
        lines.append(f"## [{r['severity']}] {r['file']}")
        lines.append(
            f"size={r['size']} kb={r['kb']} hot={r.get('hot_sum')} fringe={r.get('fringe_sum')} soft={r.get('soft_sum')}"
        )
        for i in r["issues"]:
            lines.append(f"- {i}")
        lines.append("")
    (OUT / "FULL_asset_audit.txt").write_text("\n".join(lines), encoding="utf-8")

    print(f"total={len(files)} high={report['high']} med={report['med']} low={report['low']} ok={report['ok']}")
    print("--- HIGH ---")
    for r in rows:
        if r["severity"] == "high":
            print(r["file"], "|", "; ".join(r["issues"][:8]))
    print("--- MED ---")
    for r in rows:
        if r["severity"] == "med":
            print(r["file"], "|", "; ".join(r["issues"][:5]), f"hot={r.get('hot_sum')} fringe={r.get('fringe_sum')}")


if __name__ == "__main__":
    main()
