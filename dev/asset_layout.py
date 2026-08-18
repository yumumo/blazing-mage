# -*- coding: utf-8 -*-
"""Resolve partitioned assets by basename.

Layout (www/castle-parkour/assets/):
  characters/<id>/   portraits + motion sheets
  enemies/           hostile art
  world/             props / tiles / pickups
  ui/                menu plaques
  fonts/             wordmark + HUD digit atlas

中间态不入库：优先 `Back-castle-parkour/art-raw/`，兼容旧 `dev/art-raw/`。
  <char>/<action>/   versioned magenta / keyed iterations
  backups/           *.before-* snapshots
  templates/         blank grid scaffolds
  singles/           debug single frames
  refs/              pose / likeness locks
  audit/             audit scripts + reports
  qa/                QA boards / scratch
"""
from __future__ import annotations

from pathlib import Path

DEV = Path(__file__).resolve().parent
CORE = DEV.parent
ASSETS = CORE / "www" / "castle-parkour" / "assets"
BACKUP_RAW = CORE / "Back-castle-parkour" / "art-raw"


def resolve_raw() -> Path:
    """本机中间态目录。"""
    for p in (BACKUP_RAW, DEV / "art-raw"):
        if p.is_dir():
            return p
    BACKUP_RAW.mkdir(parents=True, exist_ok=True)
    return BACKUP_RAW


RAW = resolve_raw()
REFS = RAW / "refs"
AUDIT = RAW / "audit"
QA = RAW / "qa"
SINGLES = RAW / "singles"
TEMPLATES = RAW / "templates"
BACKUPS = RAW / "backups"


def find_asset(name: str) -> Path:
    """Find ``name`` under assets/ (any depth). Prefer exact relative if given."""
    name = name.replace("\\", "/").lstrip("/")
    if "/" in name:
        p = ASSETS / name
        if p.is_file():
            return p
        name = Path(name).name
    direct = ASSETS / name
    if direct.is_file():
        return direct
    hits = sorted(ASSETS.rglob(name), key=lambda p: len(p.parts))
    hits = [p for p in hits if p.is_file()]
    if not hits:
        raise FileNotFoundError(f"asset not found: {name} under {ASSETS}")
    return hits[0]


def find_raw(name: str, *, prefer_root: bool = True) -> Path:
    """Find ``name`` under art-raw/ (any depth).

    Prefer art-raw root when ``prefer_root`` (pipeline staging), else shallowest hit.
    """
    name = name.replace("\\", "/").lstrip("/")
    if "/" in name:
        p = RAW / name
        if p.is_file():
            return p
        name = Path(name).name
    root_hit = RAW / name
    if prefer_root and root_hit.is_file():
        return root_hit
    hits = sorted(
        (p for p in RAW.rglob(name) if p.is_file()),
        key=lambda p: (len(p.parts), str(p)),
    )
    if not hits:
        raise FileNotFoundError(f"raw not found: {name} under {RAW}")
    return hits[0]


def char_sheet(cid: str, kind: str) -> Path:
    """kind: run|jump|atk|roll|portrait"""
    if kind == "portrait":
        return find_asset(f"{cid}-portrait.png")
    return find_asset(f"{cid}-{kind}-sheet.png")


def raw_action_dir(cid: str, action: str) -> Path:
    """Preferred drop folder for new magenta/keyed iterations."""
    d = RAW / cid / action
    d.mkdir(parents=True, exist_ok=True)
    return d
