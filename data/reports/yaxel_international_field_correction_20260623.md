# Yaxel 国际身份字段修正与前端同步报告

- 来源：https://www.nba.com/news/2026-nba-draft-news-notes
- 范围：只修字段并同步已有 124 人池 Agent board/bundle；不改顺位、不改分数、不人工预测。
- 修正：Yaxel Lendeborg origin -> Dominican Republic，international -> true。
- 前端同步：`public/data/agent_expanded_recommended_board.json` 现在使用 124 人池版，30 顺位为 Jack Kayil。
- 前端候选包：`public/data/expanded_import_bundle.json` 现在使用 123 唯一候选的 124 人池版。

## 改动文件
- `C:\Users\24048\Desktop\AWS\draftops\data\boards\local_pool_124_baseline_board.json` (board)
- `C:\Users\24048\Desktop\AWS\draftops\data\boards\local_pool_124_baseline_board.json` (boardRows)
- `C:\Users\24048\Desktop\AWS\draftops\data\final\local_pool_124_import_bundle.json` (prospects)
- `C:\Users\24048\Desktop\AWS\draftops\public\data\agent_expanded_recommended_board.json` (whole-file)
- `C:\Users\24048\Desktop\AWS\draftops\public\data\expanded_import_bundle.json` (whole-file)
