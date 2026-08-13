# www/castle-parkour 文件分区

静态页游戏（Cloudflare Pages / AGT 挂载），**无构建**；用原生 ES module。

```text
www/castle-parkour/
  index.html              # 壳：DOM + 入口
  css/app.css             # UI 样式
  js/
    boot-mobile.js        # 尽早打 mobile/desktop class（非 module）
    main.js               # module 入口 → game.js
    game.js               # 玩法 / 渲染 / 音频 / 存档 / 商店文案
    config/
      index.js            # barrel（优先从此 import）
      characters.js       # 可玩角色注册表 + ASSET_VER
      world.js            # 世界道具/障碍贴图注册表
      gameplay.js         # 画布尺寸与玩法数值（扩展点）
  assets/                 # 局内真源 PNG + sprite-manifest.json
                          # 只放：立绘、散帧、run/roll sheet、世界图
```

## 扩展点（先改配置，再补图 / 再动 game.js）

| 要加什么 | 改哪里 |
|----------|--------|
| 新角色 | `config/characters.js`（或 `registerCharacter()`）+ `assets/` + measure |
| 新障碍/道具图 | `config/world.js`（或 `registerWorldAsset()`）+ `assets/` |
| 调跳跃/坑/蝙蝠等数值 | `config/gameplay.js` |
| 换图刷缓存 | `ASSET_VER`（`characters.js`） |
| 商店文案 / 状态机 | `game.js` |

## 资源分区

| 目录 | 放什么 |
|------|--------|
| `assets/` | 局内加载的透明 PNG + `sprite-manifest.json` |
| `dev/art-raw/`（gitignore） | 品红原稿、`*-jump/atk/fly-sheet.png` 中间态 |

**不要**把 `*-jump-sheet` / `*-atk-sheet` / `*-fly-sheet` / `*-magenta` 放进 `assets/`——局内只用切好的散帧 + run/roll sheet。
