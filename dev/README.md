# castle-parkour · motion art pipeline

局内真源只在 `www/castle-parkour/assets/`（**sheet / 立绘 / 世界物**）。  
中间态在 `Back-castle-parkour/art-raw/`（**gitignore，不入库**）。

口径：主仓 skill **`castle-parkour-art`** · 规则 `.cursor/rules/castle-parkour-art.mdc`。  
**局内用哪些 PNG**：[`www/castle-parkour/ASSETS.md`](../www/castle-parkour/ASSETS.md)。

## 分区

| 路径 | 入库？ | 内容 |
|------|--------|------|
| `www/castle-parkour/assets/` | ✅ | **局内** PNG + `sprite-manifest.json` |
| `www/castle-parkour/js/` | ✅ | 游戏逻辑与 `config/` |
| `dev/*.py` | ✅ | **正式**对齐 / 入库脚本（根目录入口） |
| `dev/_archive_oneoff_*` · `dev/_*.py` | ❌ | 历史一次性；gitignore |
| `Back-castle-parkour/art-sheets/` | ❌ | 跳/攻验收 sheet（不进 Pages） |
| `Back-castle-parkour/art-raw/` | ❌ | 品红 / keyed / 参考 / QA |
| `www/castle-parkour/dev/` | ❌ | 禁止（冒烟） |
| `www/dev/` | ❌ | 禁止（误放） |

### `Back-castle-parkour/art-raw/` 子分区

| 路径 | 用途 |
|------|------|
| `<char>/<action>/` | 版本迭代：`*-magenta.png` / `*-keyed*.png`（如 `warrior/run/`） |
| `backups/` | `*.before-*` 快照 |
| `templates/` | 空白宫格脚手架（非备份） |
| `singles/` | 跳/攻散帧调试（局内不加载） |
| `refs/` | 姿势 / likeness 锁（原 `_pose_refs_ai`） |
| `audit/` | 审计脚本与报告（原 `_asset_audit`） |
| `qa/` | QA 板 / scratch（原 `_qa`） |
| （根目录） | 可选管线 staging：`*-sheet.png` / spun / `.cols` |

新品红图请落到 `Back-castle-parkour/art-raw/<char>/<action>/`。按文件名查找用 `asset_layout.find_raw()`。

## 入库脚本（仅这些）

| 脚本 | 作用 |
|------|------|
| `action_sheet_align.py` | 跑步尺、`sheet_k`、plant、书档表 |
| `plant_blob_sheet.py` | **主种入**（blob 切格 + 同尺 + 扩格） |
| `plant_gutter_sheet.py` | 等分 gutter plant（旧路径） |
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
| `audit_all_assets.py` | 全量 PNG 审计；报告 `art-raw/audit/` |
| `audit_sheet_matte.py` | 单表抠图验收 |
| `qa_sheet_scale_dust.py` | coreH + 尾气贴边 QA |
| `compile_castle_hud_font.py` | HUD 数字位图编译 |
| `asset_layout.py` | `find_asset` / `find_raw` / 分区常量 |
| `ingest_motion_from_portrait.py` | 立绘→动作（迁移） |
| `rebuild_rolls_locked.py` | 滚表锁定重建 |
| `replant_all_action_sheets.py` | 批量 plant 基建（被 plant_blob 引用） |

测尺：主仓 `.cursor/skills/castle-parkour-art/scripts/measure_sprites.py`。

**不要**再加一次性 `import_mage_*` / `restore_*` / `fix_*` / `_dbg_*` 脚本进仓根目录；一次性进 `_archive_oneoff_*`，中间态只放 `art-raw/`。

生图硬口径：**品红只许底图**；主体色锁 run0/立绘（见 skill `castle-parkour-art`）。

## 局内布局真源

| 动作 | 文件 | 布局 |
|------|------|------|
| 跑 | `*-run-sheet.png` | **3×3 / 9** |
| 跳 | `*-jump-sheet.png` | **3×3 / 9**（书档 + 7 动作） |
| 滚 | `*-roll-sheet.png` | **3×3 / 9**（书档；播中间 7） |
| 飞 | `*-fly-sheet.png` | **2×2 / 4**（书档 + fly/flyFall） |
| 攻 | `*-atk-sheet.png` | **3×3 / 9**（书档 + wind…recover） |
| 怪 | `*-sheet.png` | **2×2 / 4** |

## 标准流程

```bash
python .cursor/skills/immersive-short-video/scripts/chroma_key.py \
  --input core/castle-parkour/Back-castle-parkour/art-raw --glob "**/*-magenta.png"

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

种入（推荐）：

```bash
python core/castle-parkour/dev/plant_blob_sheet.py --char warrior --role atk \
  --src <path-or-basename-magenta.png> --cols 3 --rows 3 --ver 20260821xx
```

## 局内要点

- 绘制倍率 = 跑步 `refH`（296）；翻滚碰撞 = 显示尺寸 × `ROLL_HIT_FROM_DRAW`
- `ROLL_DUR = 0.55`；角色画格 **512×768**
- `prep_cell` 勿对已裁角色再 `clear_cell_chrome`
- 滚表重建优先用 `art-raw/**/*-roll-sheet-spun.png`，禁止 hold 复用球垫到 16
