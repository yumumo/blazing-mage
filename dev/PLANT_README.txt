# -*- coding: utf-8 -*-
"""Active plant / QA entry points for castle-parkour sheets.

Canonical plant (use this):
  python dev/plant_blob_sheet.py --char warrior --role atk \\
    --src <magenta.png> --cols 3 --rows 3 --ver 20260821xx

  - Ruler: body coreH vs game run0
  - Default cell 512x768; EXPANDS if sword/dust need room (no fit-shrink)
  - Bookends stamp game run0 foot-aligned into cell

Also keep:
  plant_gutter_sheet.py  — equal-grid gutter plant (legacy path)

QA:
  python dev/qa_sheet_scale_dust.py
  python dev/qa_sheet_scale_dust.py --sheet warrior-atk-sheet.png

Remeasure after plant:
  python dev/remeasure_all_sheets.py

Do NOT commit:
  Back-castle-parkour/  ·  _*.py  ·  *-magenta.png
Policy (main XRK-AGT repo):
  .cursor/skills/castle-parkour-art/references/gen-and-plant-notes.md
"""
