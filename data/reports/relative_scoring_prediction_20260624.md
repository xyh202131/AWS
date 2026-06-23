# Relative Pool-Scoring Prediction (Min-Max Normalized per Pick)

Generated: 2026-06-23T19:03:28.339Z
Script: `scripts/relative-scoring-prediction.mjs`

## Key Difference: Relative vs Absolute Scoring

- **Absolute scoring (previous versions)**: Each prospect receives a fixed global grade (e.g. 85/100) regardless of who else is available. Scores are computed against static thresholds.
- **Relative scoring (this run)**: At each pick, ALL remaining candidates are scored on raw dimensions, then each dimension is **min-max normalized within the current available pool** (0 = worst remaining, 100 = best remaining). The weighted sum uses these relative scores. After selecting the best relative prospect, they are removed and the next pick **renormalizes against the new smaller pool**.
- This simulates true BPA (Best Player Available) draft logic: a player's value depends on who is still on the board.

## Guardrails

- No manual prediction or hand-written pick list was used.
- Candidate pool is loaded from `data/final/local_pool_124_import_bundle.json` and validated as 123 unique candidates.
- For every pick, the script scored every remaining candidate in TWO passes: (1) raw dimension scores, (2) min-max normalization within the current pool, then weighted scoring. The top relative score was selected, removed, and normalization was redone for the next pick.
- Inputs used by the scoring model: team needs, team preference entries, player profile fields, feature reference, consensus rank/mock heat, source notes, and local RAG chunks.
- `public/data` was read only for comparison; this run writes only the relative-scoring board/report outputs.

## Summary

- Picks: 30
- Unique selected players: 30
- Remaining prospects: 93
- Total candidate reviews: 3255
- Average score: 87.93
- Average confidence: 90
- Changed vs current frontend board: 21

## Validation

| Check | Value |
|---|---|
| pickCountIs30 | true |
| uniqueSelectedIs30 | true |
| remainingIs93 | true |
| noDuplicateSelectedProspects | true |
| reviewedAllRemainingEachPick | true |
| expectedReviewCount | 3255 |
| actualReviewCount | 3255 |
| duplicateSelectedProspectIds |  |

## Board

| Pick | Team | Player | Local name | Pos | Rank | Score | Confidence | Margin | Reviewed |
|---:|---|---|---|---|---:|---:|---:|---:|---:|
| 1 | Washington Wizards | AJ Dybantsa | AJ 迪班萨 | SF/PF | 2 | 97.681 | 100 | 5.861 | 123 |
| 2 | Utah Jazz | Darryn Peterson | 达林 彼得森 | PG/SG | 1 | 95.48 | 100 | 3.854 | 122 |
| 3 | Memphis Grizzlies | Cameron Boozer | 卡梅隆 布泽尔 | PF/C | 3 | 97.48 | 100 | 3.956 | 121 |
| 4 | Chicago Bulls | Caleb Wilson | 凯莱布 威尔逊 | SF/PF | 4 | 94.486 | 100 | 9.979 | 120 |
| 5 | LA Clippers | Keaton Wagler | 基顿 瓦格勒 | PG/SG | 5 | 96.731 | 100 | 1.861 | 119 |
| 6 | Brooklyn Nets | Kingston Flemings | 金斯顿 弗莱明斯 | PG/SG | 8 | 97.712 | 99 | 1.622 | 118 |
| 7 | Sacramento Kings | Darius Acuff Jr. | 达柳斯 阿卡夫 | PG/SG | 6 | 91.626 | 94 | 1.528 | 117 |
| 8 | Atlanta Hawks | Nate Ament | 纳撒尼尔 阿门特 | SF/PF | 9 | 94.399 | 97 | 1.651 | 116 |
| 9 | Dallas Mavericks | Brayden Burries | 布雷登 伯里斯 | PG/SG | 11 | 94.106 | 100 | 7.591 | 115 |
| 10 | Milwaukee Bucks | Karim Lopez | 卡里姆 洛佩兹 | SF/PF | 14 | 89.573 | 88 | 0.223 | 114 |
| 11 | Golden State Warriors | Labaron Philon Jr. | 小拉巴伦 菲隆 | PG/SG | 18 | 84.878 | 81 | 0.109 | 113 |
| 12 | Oklahoma City Thunder | Aday Mara | 阿达伊 马拉 | C | 10 | 87.964 | 94 | 4.265 | 112 |
| 13 | Miami Heat | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | SF/PF | 12 | 90.774 | 99 | 4.926 | 111 |
| 14 | Charlotte Hornets | Allen Graves | 阿伦 格雷夫斯 | SF/PF | 17 | 85.62 | 85 | 0.428 | 110 |
| 15 | Chicago Bulls | Cameron Carr | 卡梅隆 卡尔 | PG/SG | 21 | 83.131 | 81 | 0.71 | 109 |
| 16 | Memphis Grizzlies | Dailyn Swain | 戴林 斯温 | SF/PF | 23 | 79.899 | 77 | 0.519 | 108 |
| 17 | Oklahoma City Thunder | Morez Johnson Jr. | 小莫雷兹 约翰逊 | PF/C | 15 | 83.996 | 86 | 2.067 | 107 |
| 18 | Charlotte Hornets | Christian Anderson | 克里斯蒂安 安德森 | PG/SG | 16 | 91.339 | 92 | 0.938 | 106 |
| 19 | Toronto Raptors | Mikel Brown Jr. | 迈克尔 布朗 | PG/SG | 7 | 80.959 | 77 | 1.604 | 105 |
| 20 | San Antonio Spurs | Bennett Stirtz | 本内特 斯特茨 | PG/SG | 20 | 88.268 | 96 | 4.602 | 104 |
| 21 | Detroit Pistons | Isaiah Evans | 以赛亚 埃文斯 | PG/SG | 25 | 87.173 | 86 | 0.78 | 103 |
| 22 | Philadelphia 76ers | Hannes Steinbach | 汉内斯 施泰因巴赫 | PF/C | 13 | 84.152 | 79 | 0.081 | 102 |
| 23 | Atlanta Hawks | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | PG/SG | 30 | 80.703 | 78 | 0.764 | 101 |
| 24 | New York Knicks | Ebuka Okorie | 埃布卡 奥科里 | PG/SG | 24 | 85.408 | 97 | 7.029 | 100 |
| 25 | Los Angeles Lakers | Koa Peat | 科阿 皮特 | SF/PF | 27 | 89.354 | 97 | 5.116 | 99 |
| 26 | Denver Nuggets | Henri Veesaar | 亨利 维萨尔 | C | 26 | 81.653 | 85 | 2.132 | 98 |
| 27 | Boston Celtics | Chris Cenac Jr. | 克里斯 塞纳克 | PF/C | 19 | 81.463 | 85 | 4.774 | 97 |
| 28 | Minnesota Timberwolves | Meleek Thomas | 马利克 托马斯 | SG/SF | 28 | 84.14 | 96 | 23.566 | 96 |
| 29 | Cleveland Cavaliers | Tarris Reed Jr. | 小塔里斯 里德 | C | 29 | 83.669 | 90 | 3.785 | 95 |
| 30 | Dallas Mavericks | Tyler Bilodeau | 泰勒 比洛多 | SF/PF | 46 | 73.968 | 70 | 3.066 | 94 |

## Changed Vs Current Frontend Board

| Pick | Team | Current frontend | Current local name | Relative rerun | Relative local name |
|---:|---|---|---|---|---|
| 6 | Brooklyn Nets | Darius Acuff Jr. | 达柳斯 阿卡夫 | Kingston Flemings | 金斯顿 弗莱明斯 |
| 7 | Sacramento Kings | Kingston Flemings | 金斯顿 弗莱明斯 | Darius Acuff Jr. | 达柳斯 阿卡夫 |
| 10 | Milwaukee Bucks | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | Karim Lopez | 卡里姆 洛佩兹 |
| 11 | Golden State Warriors | Christian Anderson | 克里斯蒂安 安德森 | Labaron Philon Jr. | 小拉巴伦 菲隆 |
| 12 | Oklahoma City Thunder | Karim Lopez | 卡里姆 洛佩兹 | Aday Mara | 阿达伊 马拉 |
| 13 | Miami Heat | Hannes Steinbach | 汉内斯 施泰因巴赫 | Yaxel Lendeborg | 亚克塞尔 伦德伯格 |
| 14 | Charlotte Hornets | Morez Johnson Jr. | 小莫雷兹 约翰逊 | Allen Graves | 阿伦 格雷夫斯 |
| 15 | Chicago Bulls | Allen Graves | 阿伦 格雷夫斯 | Cameron Carr | 卡梅隆 卡尔 |
| 16 | Memphis Grizzlies | Chris Cenac Jr. | 克里斯 塞纳克 | Dailyn Swain | 戴林 斯温 |
| 17 | Oklahoma City Thunder | Cameron Carr | 卡梅隆 卡尔 | Morez Johnson Jr. | 小莫雷兹 约翰逊 |
| 18 | Charlotte Hornets | Labaron Philon Jr. | 小拉巴伦 菲隆 | Christian Anderson | 克里斯蒂安 安德森 |
| 19 | Toronto Raptors | Dailyn Swain | 戴林 斯温 | Mikel Brown Jr. | 迈克尔 布朗 |
| 22 | Philadelphia 76ers | Ebuka Okorie | 埃布卡 奥科里 | Hannes Steinbach | 汉内斯 施泰因巴赫 |
| 23 | Atlanta Hawks | Meleek Thomas | 马利克 托马斯 | Sergio De Larrea | 塞尔吉奥 德拉雷亚 |
| 24 | New York Knicks | Koa Peat | 科阿 皮特 | Ebuka Okorie | 埃布卡 奥科里 |
| 25 | Los Angeles Lakers | Henri Veesaar | 亨利 维萨尔 | Koa Peat | 科阿 皮特 |
| 26 | Denver Nuggets | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | Henri Veesaar | 亨利 维萨尔 |
| 27 | Boston Celtics | Tarris Reed Jr. | 小塔里斯 里德 | Chris Cenac Jr. | 克里斯 塞纳克 |
| 28 | Minnesota Timberwolves | Jayden Quaintance | 杰登 昆坦斯 | Meleek Thomas | 马利克 托马斯 |
| 29 | Cleveland Cavaliers | Malachi Moreno | 马拉奇 莫雷诺 | Tarris Reed Jr. | 小塔里斯 里德 |
| 30 | Dallas Mavericks | Jack Kayil | 杰克 卡伊尔 | Tyler Bilodeau | 泰勒 比洛多 |
