# TASKS — Voxel Musou 按 PRD 0.2 / SDD 1.1 开发

基线：上游 5702d90 已导入（commit f2334fd）。分支 `feat/voxel-musou-baseline`。

## D1 固定基线与启动
- [x] 导入固定提交源码树（无上游 .git，保留 docs/）
- [x] 补 `src/ui/OFL.txt`（Yuji Boku 版权 + OFL 1.1 全文）
- [ ] 静态服务打开首屏，无模块/资源缺失

## D2 输入与生命周期
- [ ] `src/core/loop.js`：抽出固定步进调度，main.js 接线
- [ ] `input.js`：`createInput({target,getGamepads})`、`dispose()`；blur/pointercancel 清 drag 与 orbitPx；buttons===0 兜底
- [ ] main.js：`?enemies` 解析按 SDD 12.1 表格
- [ ] `tests/index.html`、`tests/harness.js`、断言工具
- [ ] T01 T02 T15 T17 通过；暂停人工用例

## D3 主角与连招
- [ ] T03 T04 T05 T10 T18 通过；动作人工可见

## D4 Combat
- [ ] T06 T07 T08 T09 通过

## D5 Crowd
- [ ] `waves()` 小队槽满修正（不放兵/不复活敌将/不发事件/不重置 waveT）
- [ ] T13 T14 T15 通过；兵群人工场景

## D6 Musou
- [ ] T11 T12 通过；完整无双人工场景

## D7 音画与信息
- [ ] 异常路径：WebGL2 失败、模块加载失败、context lost、零尺寸 resize、音频失败
- [ ] resize / 无声降级人工核对

## D8 集成与交付
- [ ] T16 调度确定性
- [ ] 长时运行 / 性能矩阵 0/300/2000
- [ ] `docs/verification.md`（FR/NFR 追溯、实测记录）
- [ ] 项目级 `CLAUDE.md`（启动与测试命令）

## 新发现
