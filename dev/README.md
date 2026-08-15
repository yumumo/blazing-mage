# castle-parkour · motion art pipeline

局内真源只在 `www/castle-parkour/assets/`（**sheet / 立绘 / 世界物**）。  
`dev/art-raw/` 为中间态（**gitignore，不入库**）；散帧调试在 `dev/art-raw/singles/`。

口径：主仓 skill **`castle-parkour-art`** · 规则 `.cursor/rules/castle-parkour-art.mdc`。  
**局内用哪些 PNG**：[`www/castle-parkour/ASSETS.md`](../www/castle-parkour/ASSETS.md)。

## 分区

| 路径 | 入库？ | 内容 |
|------|--------|------|
| `www/castle-parkour/assets/` | ✅ | **局内** PNG + `sprite-manifest.json` |
| `www/castle-parkour/js/` | ✅ | 游戏逻辑与 `config/` |
| `dev/*.py` | ✅ | 对齐 / 入库脚本 |
| `dev/art-sheets/` | ✅ | 跳/攻验收 sheet（不进 Pages） |
| `dev/art-raw/` | ❌ | 品红 / keyed / spun / 调试图 |
| `dev/art-raw/singles/` | ❌ | 跳/攻散帧（管线输入，局内不加载） |
| `www/castle-parkour/dev/` | ❌ | 禁止（冒烟） |
| `www/dev/` | ❌ | 禁止（误放） |

## 入库脚本（仅这些）

| 脚本 | 作用 |
|------|------|
| `action_sheet_align.py` | 跑步尺、`sheet_k`、plant、书档表 |
| `import_jump_roll_sheets.py` | 切格 / reconnect / plant 基建 |
| `rebuild_jump_clean.py` | 跳表重打（真姿态，禁残影） |
| `build_mage_jump_align.py` | 法师跳 |
| `build_mage_atk_align.py` | 法师攻 |
| `build_mage_roll_spin.py` | 法师滚 → **3×3 / 9** |
| `build_warrior_jump_align.py` | 战士跳 |
| `build_warrior_atk_align.py` | 战士攻 |
| `build_warrior_roll_spin.py` | 战士滚 → **3×3 / 9** |
| `build_warrior_roll_align.py` | 兼容入口 → `roll_spin` |
| `build_monster_motion_sheets.py` | 怪 2×2 |
| `pack_motion_grids.py` | 散帧→宫格（迁移/验收；滚只检查 3×3） |
| `pad_motion_framecounts.py` | 帧数对齐到 4/9/16 |
| `remeasure_all_sheets.py` | 全表重测 content 盒 |
| `bake_motion_align.py` | 头对齐 + manifest（**勿 blind 全表 bake**） |
| `matte_cleanup.py` | 可选：品红/软边清理 |

测尺：主仓 `.cursor/skills/castle-parkour-art/scripts/measure_sprites.py`。

**不要**再加一次性 `raise_*` / `build_roll_4spin` / `_dbg_*` 脚本进仓。

## 局内布局真源

| 动作 | 文件 | 布局 |
|------|------|------|
| 跑 | `*-run-sheet.png` | **3×3 / 9** |
| 跳 | `*-jump-sheet.png` | **3×3 / 9**（书档 + 7 动作） |
| 滚 | `*-roll-sheet.png` | **3×3 / 9**（书档；播中间 7） |
| 攻 | `*-atk-sheet.png` | **2×2 / 4** |
| 怪 | `*-sheet.png` | **2×2 / 4** |

## 标准流程

```bash
python .cursor/skills/immersive-short-video/scripts/chroma_key.py \
  --input core/castle-parkour/dev/art-raw --glob "*-magenta.png"

python core/castle-parkour/dev/build_mage_jump_align.py
python core/castle-parkour/dev/build_mage_atk_align.py
python core/castle-parkour/dev/build_mage_roll_spin.py
python core/castle-parkour/dev/build_warrior_jump_align.py
python core/castle-parkour/dev/build_warrior_atk_align.py
python core/castle-parkour/dev/build_warrior_roll_spin.py

python .cursor/skills/castle-parkour-art/scripts/measure_sprites.py \
  --input core/castle-parkour/www/castle-parkour/assets
# 仅在需要头对齐时：python core/castle-parkour/dev/bake_motion_align.py
# bump ASSET_VER → Ctrl+F5
```

## 局内要点

- 绘制倍率 = 跑步 `refH`（296）；翻滚碰撞 = 显示尺寸 × `ROLL_HIT_FROM_DRAW`
- `ROLL_DUR = 0.55`；角色画格 **512×768**
- `prep_cell` 勿对已裁角色再 `clear_cell_chrome`
- 滚表重建优先用 `art-raw/*-roll-sheet-spun.png`，禁止 hold 复用球垫到 16
