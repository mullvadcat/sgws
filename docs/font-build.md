# HUD 字体构建记录

游戏不依赖操作系统自带的中文字体，也不在运行时请求远程字体。`HudBrush` 是 Ma Shan Zheng 的 HUD 子集；`HudBrushFallback` 是 Noto Serif SC 的两个字形子集，仅覆盖主字体没有的 `·` 与 `郃`。当前实际字表 143 个非空白码点由这两份字体联合覆盖。新增可见文案时先更新 `tools/hud-glyphs.txt`，然后运行下方检查和重建命令。

## 来源与版本

| 字体 | 上游与版本 | 原始文件 | SHA-256 | 授权 |
| --- | --- | --- | --- | --- |
| Ma Shan Zheng | [googlefonts/mashanzheng](https://github.com/googlefonts/mashanzheng), commit `72c50ec001cea63d223d35562eeb2ba42f0fe67a` | `fonts/ttf/MaShanZheng-Regular.ttf` | `6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb` | SIL OFL 1.1，见 [`src/ui/OFL.txt`](../src/ui/OFL.txt) |
| Noto Serif SC | [google/fonts](https://github.com/google/fonts), commit `23e54b51ddffbc7713c583748e3bd86f62b1fa4a`, `ofl/notoserifsc/NotoSerifSC[wght].ttf` | `NotoSerifSC[wght].ttf` | `050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9` | SIL OFL 1.1，见 [`src/ui/OFL-NotoSerifSC.txt`](../src/ui/OFL-NotoSerifSC.txt) |

Noto 字体源文件大约 24 MiB，仅用于裁剪；仓库只分发 2 个字形的 WOFF2 子集。初次构建可在隔离 Python 环境安装 FontTools 4.60.2 与 Brotli 1.2.0（本轮使用此版本组合）；它们是开发工具，不是游戏运行依赖。

## 可复现构建

在仓库根目录，将两个上游 TTF 放在下列临时路径后执行。下载 URL 固定到上表 commit，不要改为浮动的 `main` URL。

```sh
python3 -m venv /tmp/sgws-font-venv
/tmp/sgws-font-venv/bin/pip install fonttools==4.60.2 brotli==1.2.0

# Ma Shan Zheng commit 72c50ec001cea63d223d35562eeb2ba42f0fe67a:
# https://raw.githubusercontent.com/googlefonts/mashanzheng/72c50ec001cea63d223d35562eeb2ba42f0fe67a/fonts/ttf/MaShanZheng-Regular.ttf
# Noto Serif SC commit 23e54b51ddffbc7713c583748e3bd86f62b1fa4a:
# https://raw.githubusercontent.com/google/fonts/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf

/tmp/sgws-font-venv/bin/python -m fontTools.subset /tmp/MaShanZheng-Regular.ttf \
  --text-file=tools/hud-glyphs.txt --flavor=woff2 --output-file=src/ui/brush.woff2
/tmp/sgws-font-venv/bin/python -m fontTools.subset /tmp/NotoSerifSC.ttf \
  --text-file=tools/hud-glyphs-fallback.txt --flavor=woff2 --output-file=src/ui/brush-fallback.woff2
/tmp/sgws-font-venv/bin/python tools/check_hud_font.py \
  --font src/ui/brush.woff2 --font src/ui/brush-fallback.woff2 --text tools/hud-glyphs.txt
```

`tools/check_hud_font.py` unions the Unicode cmaps of repeated `--font` arguments. Missing code points are printed once and return exit status 1; an empty/whitespace-only text manifest is rejected. The manifest is an explicit inventory of current user-facing strings, not a source-code extractor, so review it when copy changes.

The CSS intentionally puts the bundled family before generic serif fallback and does not list platform-specific Chinese fonts. `src/main.js` waits for both subset faces before constructing the one-time canvas textures; this prevents cold-cache system-font glyphs from being baked into the banners. The minimap canvas redraws its map label during regular HUD updates.
