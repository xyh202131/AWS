# Xiaobei Screenshot Preservation Manifest

目标：在本版 PPT 中使用少量真实产品截图作为证据，同时保持标题、注释、流程、架构图等结构元素可编辑。

| id | type | bucket | bbox_px | style | text | endpoints | z_order | preserve_reason | crop_path |
|---|---|---|---|---|---|---|---:|---|---|
| R01 | raster | preserved | 0,0,1440,1000 | no-crop | null | null | 1 | complex UI screenshot; rebuilding as shapes would exceed 15 objects and reduce fidelity | images/product-home.png |
| R02 | raster | preserved | 0,0,1440,1000 | no-crop | null | null | 1 | complex UI screenshot; preserves board and evidence panel exactly | images/product-evidence.png |
| R03 | raster | preserved | 0,0,1440,1000 | no-crop | null | null | 1 | complex UI screenshot; preserves export feedback state exactly | images/product-export-or-lower.png |
| E01 | textbox | editable | 64,54,620,80 | fill=null, font=Microsoft YaHei, size=50, color=#E7F2FF | DraftOps | null | 2 | null | null |
| E02 | textbox | editable | 64,126,760,48 | fill=null, font=Microsoft YaHei, size=24, color=#94A8BC | 面向 2026 NBA 选秀的 Agent 预测驾驶舱 | null | 2 | null | null |
| E03 | callout | editable | 834,112,300,80 | fill=#142231, stroke=#62B8FF | 真实产品界面截图作为佐证 | null | 3 | null | null |
| L01 | arrow | editable | null | stroke=#62B8FF, width=3 | null | from:E03.left -> to:R01.center | 4 | null | null |

自检：

- 截图以原始宽高比插入，未拉伸变形。
- 截图没有被声明为可编辑形状；它们是保留 raster 证据。
- 标题、标签、流程、架构、说明、页码等均由 SVG/PPT 可编辑对象构成。
