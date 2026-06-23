# Q5 国际球员数量重算报告

- 当前预测板：`C:\Users\24048\Desktop\AWS\draftops\data\boards\local_pool_124_baseline_board.json`
- NBA 官方笔记：https://www.nba.com/news/2026-nba-draft-news-notes
- 作用范围：只重算 Q5，不改变 1-30 顺位。
- 约束：没有人工重新选人；只做字段口径修订。

## 结论

- 原 Q5：6
- 修订后 Q5：7
- 修订原因：NBA 官方笔记把 Michigan 的 Yaxel Lendeborg 标入 U.S. college international prospects，国家/地区为 Dominican Republic；本地 board 原先把他的 origin 标成 United States。

## 修订后国际球员
- 第 8 顺位 阿达伊 马拉 (Aday Mara)，Spain，NBA官方笔记覆盖
- 第 12 顺位 亚克塞尔 伦德伯格 (Yaxel Lendeborg)，Dominican Republic，NBA官方笔记覆盖
- 第 13 顺位 卡里姆 洛佩兹 (Karim Lopez)，Mexico，NBA官方笔记覆盖
- 第 16 顺位 汉内斯 施泰因巴赫 (Hannes Steinbach)，Germany，本地origin字段
- 第 27 顺位 塞尔吉奥 德拉雷亚 (Sergio De Larrea)，Spain，NBA官方笔记覆盖
- 第 29 顺位 亨利 维萨尔 (Henri Veesaar)，Estonia，NBA官方笔记覆盖
- 第 30 顺位 杰克 卡伊尔 (Jack Kayil)，Germany，NBA官方笔记覆盖

## 本次新增
- 第 12 顺位 亚克塞尔 伦德伯格 (Yaxel Lendeborg)：本地 origin=United States，NBA 官方笔记口径=Dominican Republic
