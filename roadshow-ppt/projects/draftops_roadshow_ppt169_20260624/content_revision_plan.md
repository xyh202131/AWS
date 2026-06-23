# 内容修订计划

## 判断

当前视觉和结构已经成立。本轮按用户修正收窄：内容只负责讲解 DraftOps 项目重点，不复述外部规则。

1. 首页和项目重点页需要明确“30 顺位 + 7 个里程碑答案”只是交付对象，正文要讲项目怎么把它们做出来。
2. 数据页需要区分 `101` 官方候选池和 `124` 本地答题候选池，而不是只放一个 124。
3. AWS/RAG 页的 chunk 数应改为当前 `rag-manifest.json` 的 `1304 kept chunks`，并保留“可部署 API 层、未完整 IaC 不夸大”的边界。
4. 产品页和收束页应把提交物说完整：submission JSON、brief、答题卡、锁定 board。

## 落地范围

- 不新增页数，保持 8 页讲解节奏。
- 修改可见 SVG 文案：P01、P02、P03、P05、P06、P07、P08；重点把 P02 从外部规则改成项目总览。
- 同步修改 `notes/total.md`，保证讲稿和画面一致。
- 重新执行 `svg_quality_checker.py`、`total_md_split.py`、`finalize_svg.py`、`svg_to_pptx.py`。
- 用导出 PNG 做最终视觉确认。
