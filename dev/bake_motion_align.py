#!/usr/bin/env python3
"""Bake head-lock alignment for motion frames; write align into sprite-manifest.

Head rule (hard): match run targetHead — NEVER leave the head larger or smaller
when detection is reliable. Do NOT apply a second height scale after head lock
(that would grow/shrink the head again).

1) Uniform scale so headMetric ≈ targetHead (both grow and shrink)
2) Skip bake when face/helm detection is unreliable (e.g. tumble)
3) Persist residual headScale for runtime (draw = refH × headScale only)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "www" / "castle-parkour" / "assets"
ALPHA = 28
CHAR_H = 80
SINGLES = ("jump-ant", "jump", "fly", "jump-land", "atk-wind", "atk")
# 低于此比例视为检测失败（蜷缩/倒置丢面），禁止盲放大
MIN_RELIABLE_RATIO = 0.70
HEAD_BAND = (0.96, 1.04)


def content_box(a: np.ndarray):
    ys, xs = np.where(a[:, :, 3] > ALPHA)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def mage_face_diag(arr: np.ndarray) -> float:
    """Legacy face-only diag (skin+eye). Prefer mage_head_sil_h for lock."""
    r, g, b, al = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int), arr[:, :, 3]
    skin = (
        (al > 110) & (r > 155) & (g > 105) & (b > 75) & (r > b + 25) & (np.abs(r - g) < 65) & (r < 230)
    )
    eye = (al > 130) & (b > r + 35) & (b > 130) & (r < 110) & (g < 95)
    mark = skin | eye
    ys = np.where(al > 40)[0]
    if len(ys) == 0:
        return 0.0
    y0, y1 = int(ys[0]), int(ys[-1])
    cut = y0 + int((y1 - y0) * 0.45)
    sub = mark.copy()
    sub[cut:] = False
    if not sub.any():
        return 0.0
    ys2, xs2 = np.where(sub)
    w = int(xs2.max() - xs2.min() + 1)
    h = int(ys2.max() - ys2.min() + 1)
    return float((w * w + h * h) ** 0.5)


def mage_head_sil_h(arr: np.ndarray) -> float:
    """Mage head lock = hat + hair + face height (not face-only).

    face_diag alone matched while hats were ~22% shorter on jump-ant/fly/roll,
    so gameplay looked big→small on action switch.
    """
    r, g, b, al = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int), arr[:, :, 3]
    ys = np.where(al > 40)[0]
    if len(ys) == 0:
        return 0.0
    y0, y1 = int(ys[0]), int(ys[-1])
    body_h = y1 - y0 + 1
    hat = (al > 80) & (r > 70) & (b > 110) & (b > r + 15) & (b > g + 20)
    hair = (al > 80) & (r > 90) & (g > 55) & (b < 90) & (r > g) & (r > b + 20)
    skin = (
        (al > 110) & (r > 155) & (g > 105) & (b > 75) & (r > b + 25) & (np.abs(r - g) < 65) & (r < 230)
    )
    eye = (al > 130) & (b > r + 35) & (b > 130) & (r < 110) & (g < 95)
    mark = hat | hair | skin | eye
    cut = y0 + int(body_h * 0.62)
    sub = mark.copy()
    sub[cut:] = False
    if not sub.any():
        # fallback: upper 55% of opaque (still includes hat volume)
        return float(max(8, int(body_h * 0.55)))
    hs = np.where(sub.any(axis=1))[0]
    return float(hs[-1] - hs[0] + 1)


def warrior_helm_h(arr: np.ndarray) -> float:
    r, g, b, al = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int), arr[:, :, 3]
    silver = (al > 90) & (np.abs(r - g) < 38) & (np.abs(g - b) < 50) & (r > 95) & (r < 200)
    plume = (al > 90) & (r > 155) & (r > g + 45) & (r > b + 45)
    visor = (al > 140) & (b > 160) & (g > 130) & (r < 125)
    mark = silver | plume | visor
    ys = np.where(al > 40)[0]
    if len(ys) == 0:
        return 0.0
    y0, y1 = int(ys[0]), int(ys[-1])
    cut = y0 + int((y1 - y0) * 0.42)
    sub = mark.copy()
    sub[cut:] = False
    hs = np.where(sub.any(axis=1))[0]
    if len(hs) < 5:
        return 0.0
    return float(hs[-1] - hs[0] + 1)


def head_metric(arr: np.ndarray, cid: str) -> float:
    return mage_head_sil_h(arr) if cid == "mage" else warrior_helm_h(arr)


def plant(crop: Image.Image, canvas_w: int, canvas_h: int, foot: int) -> Image.Image:
    a = np.array(crop.convert("RGBA"))
    a[:, :, 3] = np.where(a[:, :, 3] < 36, 0, a[:, :, 3])
    box = content_box(a)
    if not box:
        return Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    crop = Image.fromarray(a, "RGBA").crop(box)
    nw, nh = crop.size
    k = min(1.0, (foot - 4) / nh, (canvas_w - 8) / nw)
    if k < 1.0:
        nw, nh = max(1, int(nw * k)), max(1, int(nh * k))
        crop = crop.resize((nw, nh), Image.Resampling.BICUBIC)
    out = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    out.paste(crop, ((canvas_w - nw) // 2, foot - nh))
    return out


def resize(crop: Image.Image, k: float) -> Image.Image:
    if abs(k - 1.0) < 1e-6:
        return crop
    nw = max(1, int(round(crop.width * k)))
    nh = max(1, int(round(crop.height * k)))
    return crop.resize((nw, nh), Image.Resampling.BICUBIC)


def head_k(metric: float, target: float) -> float:
    """Scale factor so head matches target. 1.0 if unreliable or already in band."""
    if metric < 8 or target < 8:
        return 1.0
    ratio = metric / target
    if ratio < MIN_RELIABLE_RATIO:
        # under-detect — do not enlarge
        return 1.0
    if HEAD_BAND[0] <= ratio <= HEAD_BAND[1]:
        return 1.0
    # Only SHRINK oversized heads. Growing flat-hat crouch/fly makes the whole
    # figure bulkier (跳/滚变大). Undersized hats → WARN + regenerate art.
    return float(np.clip(target / metric, 0.80, 1.0))


def residual_head_scale(hm: float, target: float) -> float:
    if hm < 8 or target < 8:
        return 1.0
    ratio = hm / target
    if ratio < MIN_RELIABLE_RATIO:
        return 1.0
    # Runtime residual: never enlarge (same reason as head_k).
    residual = float(np.clip(target / hm, 0.85, 1.0))
    if 0.97 <= residual <= 1.0:
        return 1.0
    return residual


def bake_single(cid: str, role: str, target_head: float, ref_h: int) -> dict:
    path = ASSETS / f"{cid}-{role}.png"
    im = Image.open(path).convert("RGBA")
    box = content_box(np.array(im))
    crop = im.crop(box)
    m0 = head_metric(np.array(crop), cid)
    k1 = head_k(m0, target_head)
    crop = resize(crop, k1)
    # 头锁定后禁止再按身高缩放（会连带放大/缩小头）
    # 与跑步/action_sheet_align 同格：512×768（旧 512×512 会裁掉盔缨）
    planted = plant(crop, 512, 768, 754)
    planted.save(path)
    a = np.array(planted)
    box2 = content_box(a)
    crop2 = a[box2[1] : box2[3], box2[0] : box2[2]]
    hm = head_metric(crop2, cid)
    residual = residual_head_scale(hm, target_head)
    scale = CHAR_H / ref_h
    w, h = box2[2] - box2[0], box2[3] - box2[1]
    ratio = (hm / target_head) if target_head else 0
    warn = " WARN-underdetect" if m0 > 0 and m0 / target_head < MIN_RELIABLE_RATIO else ""
    print(
        f"  {role:10s} kHead={k1:.3f} residual={residual:.3f} "
        f"headRatio={ratio:.3f} draw {w * scale:.1f}x{h * scale:.1f}{warn}"
    )
    return {
        "headMetric": round(hm, 2),
        "headScale": round(residual, 4),
        "targetHead": round(target_head, 2),
    }


def bake_roll(cid: str, target_head: float, ref_h: int) -> list[dict]:
    path = ASSETS / f"{cid}-roll-sheet.png"
    sheet = Image.open(path).convert("RGBA")
    W, H = sheet.size
    cols = max(3, round(W / 512))
    cols = min(15, cols)
    cw, ch = W // cols, H
    foot = ch - 3
    scale = CHAR_H / ref_h
    out = Image.new("RGBA", (cw * cols, ch), (0, 0, 0, 0))
    aligns = []
    for i in range(cols):
        cell = sheet.crop((i * cw, 0, (i + 1) * cw, ch))
        box = content_box(np.array(cell))
        if not box:
            aligns.append({"headMetric": 0, "headScale": 1.0, "targetHead": round(target_head, 2)})
            continue
        crop = cell.crop(box)
        m0 = head_metric(np.array(crop), cid)
        k1 = head_k(m0, target_head)
        crop = resize(crop, k1)
        planted = plant(crop, cw, ch, foot)
        out.paste(planted, (i * cw, 0))
        a = np.array(planted)
        box2 = content_box(a)
        crop2 = a[box2[1] : box2[3], box2[0] : box2[2]]
        hm = head_metric(crop2, cid)
        residual = residual_head_scale(hm, target_head)
        w, h = box2[2] - box2[0], box2[3] - box2[1]
        ratio = (hm / target_head) if target_head else 0
        warn = " WARN-underdetect" if m0 > 0 and m0 / target_head < MIN_RELIABLE_RATIO else ""
        print(
            f"  roll[{i}/{cols}] kHead={k1:.3f} residual={residual:.3f} "
            f"headRatio={ratio:.3f} draw {w * scale:.1f}x{h * scale:.1f}{warn}"
        )
        aligns.append(
            {
                "headMetric": round(hm, 2),
                "headScale": round(residual, 4),
                "targetHead": round(target_head, 2),
            }
        )
    out.save(path)
    return aligns


def sheet_cols(path: Path) -> int:
    """Prefer art-raw/<name>.cols; else width/512 for 1xN planted strips."""
    meta = Path(__file__).resolve().parent / "art-raw" / f"{path.stem}.cols"
    if meta.exists():
        return max(1, int(meta.read_text(encoding="utf-8").strip()))
    with Image.open(path) as im:
        w, h = im.size
    if w >= h * 1.5:
        return max(1, min(15, round(w / 512)))
    return 3


def remasure_sheet(path: Path, cols: int, rows: int = 1) -> None:
    import subprocess

    measure_roll = (
        Path(__file__).resolve().parents[3]
        / ".cursor"
        / "skills"
        / "castle-parkour-art"
        / "scripts"
        / "measure_run_sheet.py"
    )
    subprocess.check_call(
        [
            sys.executable,
            str(measure_roll),
            "--input",
            str(ASSETS),
            "--cols",
            str(cols),
            "--rows",
            str(rows),
            "--glob",
            path.name,
        ]
    )


def run_target(cid: str, man: dict) -> float:
    """Head target from CURRENT run sheet cells (must remasure before call)."""
    run = Image.open(ASSETS / f"{cid}-run-sheet.png").convert("RGBA")
    key = f"{cid}-run-sheet.png"
    frames = man["sheets"][key]["frames"]
    # Safety: if manifest still has old 3x3 rects on a 1x8 strip, ignore and scan equal cells
    cell_w = run.size[0] // max(1, man["sheets"][key].get("cols") or sheet_cols(ASSETS / key))
    if frames and frames[0].get("cellW") and abs(frames[0]["cellW"] - cell_w) > 8:
        print(f"  WARN {key}: stale frame cellW={frames[0].get('cellW')} vs {cell_w}, rescanning")
        cols = sheet_cols(ASSETS / key)
        frames = []
        cw, ch = run.size[0] // cols, run.size[1]
        for i in range(cols):
            frames.append({"left": i * cw, "top": 0, "right": (i + 1) * cw - 1, "bottom": ch - 1})
    vals = []
    for fr in frames:
        crop = np.array(run.crop((fr["left"], fr["top"], fr["right"] + 1, fr["bottom"] + 1)))
        box = content_box(crop)
        if not box:
            continue
        m = head_metric(crop[box[1] : box[3], box[0] : box[2]], cid)
        if m > 0:
            vals.append(m)
    target = float(np.median(vals)) if vals else 0.0
    print(f"\n# {cid} run head={target:.1f} (n={len(vals)})")
    if target < 20:
        raise RuntimeError(f"{cid} run head target too low ({target:.1f}) — remasure run sheet first")
    return target


def main() -> None:
    import subprocess
    import sys

    man_path = ASSETS / "sprite-manifest.json"

    # 0) Remasure run + roll sheets with correct cols BEFORE head bake
    for cid in ("mage", "warrior"):
        rp = ASSETS / f"{cid}-run-sheet.png"
        if rp.exists():
            remasure_sheet(rp, sheet_cols(rp), 1 if sheet_cols(rp) >= 6 else 3)
        roll = ASSETS / f"{cid}-roll-sheet.png"
        if roll.exists():
            remasure_sheet(roll, sheet_cols(roll), 1)

    man = json.loads(man_path.read_text(encoding="utf-8"))
    align_sprites: dict[str, dict] = {}
    align_rolls: dict[str, list] = {}

    for cid in ("mage", "warrior"):
        # refresh refH from remasured run sheet if present
        run_key = f"{cid}-run-sheet.png"
        if run_key in man.get("sheets", {}) and man["sheets"][run_key].get("refH"):
            man.setdefault("refH", {})[cid] = int(man["sheets"][run_key]["refH"])
        ref_h = int(man["refH"][cid])
        target = run_target(cid, man)
        for role in SINGLES:
            align_sprites[f"{cid}-{role}.png"] = bake_single(cid, role, target, ref_h)
        align_rolls[f"{cid}-roll-sheet.png"] = bake_roll(cid, target, ref_h)

    # Remeasure geometry after PNG rewrites
    measure = Path(__file__).resolve().parents[3] / ".cursor" / "skills" / "castle-parkour-art" / "scripts" / "measure_sprites.py"
    subprocess.check_call([sys.executable, str(measure), "--input", str(ASSETS)])
    for cid in ("mage", "warrior"):
        for kind in ("run-sheet", "roll-sheet"):
            rp = ASSETS / f"{cid}-{kind}.png"
            if not rp.exists():
                continue
            remasure_sheet(rp, sheet_cols(rp), 1 if sheet_cols(rp) >= 5 else 3)

    man = json.loads(man_path.read_text(encoding="utf-8"))
    for file, align in align_sprites.items():
        if file in man.get("sprites", {}):
            man["sprites"][file]["align"] = align
    for file, aligns in align_rolls.items():
        sheet = man.get("sheets", {}).get(file)
        if not sheet or not sheet.get("frames"):
            continue
        for i, fr in enumerate(sheet["frames"]):
            if i < len(aligns):
                fr["align"] = aligns[i]
        sheet["alignFrames"] = aligns

    man["alignNote"] = (
        "Head lock: align.headScale multiplies CHAR_H_STAND/refH at draw time only. "
        "PNGs are baked so headMetric≈run targetHead; never apply a second height scale "
        "that would enlarge/shrink the head. Under-detected tumble frames skip bake grow."
    )
    man_path.write_text(json.dumps(man, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("\nwrote align fields into sprite-manifest.json")


if __name__ == "__main__":
    main()
