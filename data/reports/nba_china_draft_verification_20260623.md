# NBA China 2026 Draft Verification

核验时间：2026-06-23 11:46:40 +08:00

核验范围：只核验本地预测前 30 顺位。

## Sources

- NBA 中国选秀大会页：https://china.nba.cn/draft/
- 本次抓取文件：`.firecrawl/china-nba-cn-draft-20260623.md`
- 抓取文件 SHA256：`4F19F446670BD813D172DD9E8CA9B62FEE22314F1F4D9BD0F81F3022DC974819`
- 本地核验对象：
  - `data/final/final_import_bundle.json`
  - `data/boards/main_board_recommended.json`
  - `data/normalized/normalized_2026_team_context.json` first-round picks only

## Official Page Status

NBA 中国当前页面中，本次按要求只读取首轮前 30 顺位做核验：

| Scope | Count |
| --- | ---: |
| Verification picks | 30 |
| Verified scope | Round 1 only |
| Round 1 picks with player populated | 3 |
| Round 1 picks with blank player field | 27 |

已填球员仅有 1-3 顺位；4-30 顺位的球员列仍为空，不能据此核验本地 4-30 顺位球员结果。二轮顺位不进入本次结论。

## Local Comparison Summary

| Check | Result |
| --- | --- |
| NBA 中国 1-30 顺位球队 vs `final_import_bundle.json` teams | PASS, 0 mismatch |
| NBA 中国 1-30 顺位球队 vs `normalized_2026_team_context.json` first-round draft order | PASS, 0 mismatch |
| NBA 中国已公布球员 vs `main_board_recommended.json` picks 1-3 | PASS, 3/3 match |
| NBA 中国 4-30 顺位球员 vs 本地预测板 | NOT VERIFIABLE, official player fields are blank |

## Published Player Checks

| Pick | NBA China team | NBA China player | Local recommended player | Result | Notes |
| ---: | --- | --- | --- | --- | --- |
| 1 | Washington Wizards | AJ Dybantsa / aj_迪班萨 | AJ Dybantsa | PASS | NBA 中国同时标注 draft-day trade to Atlanta Hawks |
| 2 | Utah Jazz | Darryn Peterson / 达林_彼得森 | Darryn Peterson | PASS |  |
| 3 | Memphis Grizzlies | Cameron Boozer / 卡梅隆_布泽尔 | Cameron Boozer | PASS |  |

## Data Gaps / Update Notes

1. `final_import_bundle.json` 和 `main_board_recommended.json` 当前仍是预测/推荐板数据，不是完整官方选秀结果表。
2. NBA 中国已经给出第 1 顺位的选秀当天交易去向：`Atlanta Hawks`。本地 `teams` / `board` 结构目前只记录顺位持有球队 `Washington Wizards`，没有保存 draft-day trade destination。如果产品要展示“最终得到球员的球队”，需要新增或更新交易字段。
3. NBA 中国 top 3 球员基础字段与本地 NBA.com Prospects 字段口径不同：
   - AJ Dybantsa：NBA 中国 `前锋/BYU2.06米210`；本地 `SF/PF, BYU, 6-9, 217 lbs`
   - Darryn Peterson：NBA 中国 `后卫/Kansas1.98米205`；本地 `PG/SG, Kansas, 6-5, 199 lbs`
   - Cameron Boozer：NBA 中国 `前锋/Duke2.06米250`；本地 `PF/C, Duke, 6-8, 253 lbs`
4. 4-30 顺位本地若用于“预测展示”可以保留；若用于“官方结果展示”，当前不应标记为已核验通过。
5. 二轮顺位已按要求排除，不作为本次预测前 30 核验依据。

## Conclusion

本地预测前 30 顺位的球队数据正确：首轮 30 顺位与 NBA 中国一致。

本地推荐板前三顺位与 NBA 中国当前已公布球员一致。

本地数据还不完整：缺少 NBA 中国第 1 顺位 draft-day trade destination 字段；4-30 顺位球员结果因 NBA 中国页面仍为空，当前无法确认。
