# 联网核验完整球员名单（2026-06-23）

## 结论

- 本地答题卡里的完整球员池仍是 **124 人**；这是比赛模板 `球员池_勿修改` 的口径，不应被线上 NBA.com Prospects 的 101 人表覆盖。
- NBA.com 当前官方 Prospects 页解析出 **101 人**，与本地已保存的 `normalized_2026_official_prospects_101.json` 对比：新增 **0**、移除 **0**、重复名 **0**。
- NBA 中国选秀页当前有 **60 个顺位行**，但球员字段只填了 **0 个**；在用户要求“只用预测前三十”的范围里，1-30 顺位目前只有 **0 个**可用官方结果，空缺顺位为：1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30。
- Combine 口径需要拆开看：邀请文章是 **73 人**，Stats Anthro 体测表是 **78 行**，Early-entry 报名是 **71 人**。这些都不是 124 人池的替代品，而是不同阶段/数据表的官方子集或相关口径。
- 本地 124 人特征表里有 **76 行**带完整体测组合，其中 **75 组**为去重后的组合；NBA Stats Anthro 78 行中有 **75 行**可做完整组合比对，已被本地组合覆盖 **75 行**。Stats Anthro 缺完整组合的行：Sergio De Larrea、Jaden Harris、Jack Kayil。

## 数量核验

| 来源 | 本次核验数量 | 结论 |
| --- | --- | --- |
| NBA.com Prospects | 101 | 官方 Prospects 线上表；与本地保存的 101 行快照对比 |
| NBA 中国选秀页 | 0/60 个顺位已填球员 | 当前只验证到前三顺位球员字段 |
| NBA.com Combine 邀请文章 | 73 | 官方 73 人邀请口径 |
| NBA Stats Combine Anthro | 78 | 官方 Stats 体测表口径 |
| NBA.com Early-entry | 71 | 早参报名口径，不等同最终 Prospects |
| 本地答题卡球员池 | 124 | 比赛模板口径，仍是本地完整 124 人池 |

## NBA 中国前三顺位核验

| 顺位 | NBA 中国球员 | 本地 124 人池是否存在 | 选秀当天交易字段 |
| --- | --- | --- | --- |

## 跨来源差异

- Combine 邀请名单中未在 Stats Anthro 精确同名/别名匹配到：Mikel Brown Jr.、Juke Harris
- Stats Anthro 中未在 Combine 邀请名单精确同名/别名匹配到：Christopher Brown Jr、Rafael Castro、Jacob Cofie、Jaden Harris、Bryce Hopkins、Trey Kaufman-Renn、Aaron Nkrumah
- Early-entry 中未进入当前 Prospects 页：Matt Able、Amari Allen、Alijah Arenas、Flory Bidunga、Finley Bizjack、John Blackwell、Shane Blakeney、Anton Bonke、Rowan Brumbaugh、Elliot Cadeau、Rueben Chinyelu、Jacob Cofie 等 38 项
- Prospects 页中不属于 Early-entry 报名名单的主要原因通常是自动参选高年级、G League、国际、或其他非 early-entry 口径；未匹配数量：68

## 本地 124 人池完整性

- 本地行数：124
- 序号范围：1-124
- 缺失序号数：0
- 重复姓名：纳撒尼尔 阿门特

## 本次快照

| 来源 | URL / 本地路径 | SHA-256 |
| --- | --- | --- |
| NBA.com 2026 Draft Prospects | https://www.nba.com/draft/2026/prospects | A51DA400E31100E1FBD33F2AB20B3EED5792D3808F13368EB4100CD08A5C454A |
| NBA China draft board | https://china.nba.cn/draft/ | 1C873731DC7423DCF0F8F08C10AF8C5A398FED6220B1AC008B0FDEB2599BF8F9 |
| NBA.com 73-player AWS NBA Draft Combine invite article | https://www.nba.com/news/nba-announces-73-players-invited-to-2026-nba-draft-combine | 7116BFFCF86C40EFAC23878E5AF097A75A4CF060B06C2E8C2FF4D995079FEFFE |
| NBA.com AWS NBA Draft Combine Data Hub article | https://www.nba.com/news/2026-aws-nba-draft-combine-data-hub-everything-you-need-to-know | D3CAFD8EAB742F1DBB25A03030361AF7D973D263E39AF7363AF4DB0C98CA9935 |
| NBA Stats Draft Combine summary | https://www.nba.com/stats/draft/combine | A0F8653C38D48E58608CE785D065496C05CAECE4108B34BAC0124637EB69C428 |
| NBA Stats Draft Combine Anthro | https://www.nba.com/stats/draft/combine-anthro | EA95591EE2DE9633EDBB7B6047296A67330F099AF817D03BD12CB8770905DE38 |
| NBA.com 2026 early entry candidates | https://www.nba.com/news/2026-nba-draft-early-entry-candidates | B9FD8AE9C94F5F70C7A23E6451BCF9D5BEE395A7D18B03E49005EE17581B2238 |
| Saved normalized official prospects | data/normalized/normalized_2026_official_prospects_101.json | 7FD569D675DD0983A37533E8F2E8F4AD2BC5BDC59C86028A1BD925301212196A |
| Local answer-card 124-player pool | data/normalized/normalized_2026_local_player_pool_124.json | B08C276C6EF8A64B2026EC12B88B317237DBBF57E2F471E76C3178A8F13598B7 |
| Local 124-player feature reference | data/normalized/normalized_2026_player_feature_reference_124.json | 294F30DFC7606B406D3941F54D0ADDEDA0DCBF18C9FB702E48EFA2E8EA037BB9 |

## 输出

- 结构化核验结果：`data/normalized/normalized_2026_online_player_list_reverification_20260623.json`
- 本报告：`data/reports/online_full_player_list_reverification_20260623.md`
