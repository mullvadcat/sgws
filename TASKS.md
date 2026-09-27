# TASKS — Voxel Musou 按 PRD 0.2 / SDD 1.1 开发

基线：上游 5702d90 已导入（commit f2334fd）。分支 `feat/voxel-musou-baseline`。

## D1 固定基线与启动
- [x] 导入固定提交源码树（无上游 .git，保留 docs/）
- [x] 补 `src/ui/OFL.txt`（Yuji Boku 版权 + OFL 1.1 全文）
- [x] 静态服务打开首屏，无模块/资源缺失

## D2 输入与生命周期
- [x] `src/core/loop.js`：抽出固定步进调度，main.js 接线
- [x] `input.js`：`createInput({target,getGamepads})`、`dispose()`；blur/pointercancel 清 drag 与 orbitPx；buttons===0 兜底
- [x] main.js：`?enemies` 解析按 SDD 12.1 表格
- [x] `tests/index.html`、`tests/harness.js`、断言工具
- [x] T01 T02 T15 T17 通过
- [x] 暂停人工用例

## D3 主角与连招
- [x] T03 T04 T05 T10 T18 通过
- [x] 动作人工可见

## D4 Combat
- [x] T06 T07 T08 T09 通过

## D5 Crowd
- [x] `waves()` 小队槽满修正（不放兵/不复活敌将/不发事件/不重置 waveT）
- [x] T13 T14 T15 通过
- [x] 兵群人工场景

## D6 Musou
- [x] T11 T12 通过
- [x] 完整无双人工场景

## D7 音画与信息
- [x] 异常路径：WebGL2 失败、模块加载失败、context lost、零尺寸 resize、音频失败
- [x] resize / 无声降级人工核对

## D8 集成与交付
- [x] T16 调度确定性
- [x] 长时运行 / 性能矩阵 0/300/2000
- [x] `docs/verification.md`（FR/NFR 追溯、实测记录）
- [x] 项目级 `CLAUDE.md`（启动与测试命令）

## 新发现
- 自动规则测试 46/46 通过（tests/index.html，HeadlessChrome 153；含 H01/H02/H03 验收用例）。
- 标准库默认服务曾因请求队列较小和未发送缓存头导致模块重置或旧模块复用；改由仓库自带的 `tools/serve.py` 提供更大的队列、`no-store` 响应，并覆盖并发与响应头的单元测试。
- 用户要求：游戏内繁体改简体（已完成，PRD/SDD 同步）。遗留：HUD 回退字体子集缺 37 个简体字形，待决定是否换字体。
- 未验证：Firefox、Safari、1920×1080、实体手柄、`file://` 分支。
