# Codex Sequential 123-Player Prediction

Generated: 2026-06-23T17:38:36.141Z
Script: `scripts/codex-sequential-prediction.mjs`

## Guardrails

- No manual prediction or hand-written pick list was used.
- Candidate pool is loaded from `data/final/local_pool_124_import_bundle.json` and validated as 123 unique candidates.
- For every pick, the script scored every remaining candidate, selected the top algorithmic score, removed that prospect, then moved to the next pick.
- Inputs used by the scoring model: team needs, team preference entries, player profile fields, feature reference, consensus rank/mock heat, source notes, and local RAG chunks.
- `public/data` was read only for comparison; this run writes only the Codex board/report outputs.

## Summary

- Picks: 30
- Unique selected players: 30
- Remaining prospects: 93
- Total candidate reviews: 3255
- Average score: 85.32
- Average confidence: 87
- Changed vs current frontend board: 18

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
| 1 | Washington Wizards | AJ Dybantsa | AJ 迪班萨 | SF/PF | 2 | 94.107 | 97 | 1.91 | 123 |
| 2 | Utah Jazz | Darryn Peterson | 达林 彼得森 | PG/SG | 1 | 93.004 | 97 | 2.427 | 122 |
| 3 | Memphis Grizzlies | Cameron Boozer | 卡梅隆 布泽尔 | PF/C | 3 | 91.425 | 99 | 4.523 | 121 |
| 4 | Chicago Bulls | Caleb Wilson | 凯莱布 威尔逊 | SF/PF | 4 | 91.294 | 100 | 6.165 | 120 |
| 5 | LA Clippers | Keaton Wagler | 基顿 瓦格勒 | PG/SG | 5 | 93.118 | 95 | 0.932 | 119 |
| 6 | Brooklyn Nets | Kingston Flemings | 金斯顿 弗莱明斯 | PG/SG | 8 | 88.908 | 88 | 0.197 | 118 |
| 7 | Sacramento Kings | Darius Acuff Jr. | 达柳斯 阿卡夫 | PG/SG | 6 | 90.494 | 94 | 2.539 | 117 |
| 8 | Atlanta Hawks | Aday Mara | 阿达伊 马拉 | C | 10 | 85.126 | 85 | 0.661 | 116 |
| 9 | Dallas Mavericks | Brayden Burries | 布雷登 伯里斯 | PG/SG | 11 | 84.878 | 87 | 2.009 | 115 |
| 10 | Milwaukee Bucks | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | SF/PF | 12 | 88.578 | 88 | 0.243 | 114 |
| 11 | Golden State Warriors | Christian Anderson | 克里斯蒂安 安德森 | PG/SG | 16 | 81.711 | 82 | 1.866 | 113 |
| 12 | Oklahoma City Thunder | Karim Lopez | 卡里姆 洛佩兹 | SF/PF | 14 | 88.141 | 92 | 3.095 | 112 |
| 13 | Miami Heat | Hannes Steinbach | 汉内斯 施泰因巴赫 | PF/C | 13 | 89.948 | 92 | 1.317 | 111 |
| 14 | Charlotte Hornets | Morez Johnson Jr. | 小莫雷兹 约翰逊 | PF/C | 15 | 87.117 | 90 | 2.082 | 110 |
| 15 | Chicago Bulls | Allen Graves | 阿伦 格雷夫斯 | SF/PF | 17 | 83.699 | 84 | 0.931 | 109 |
| 16 | Memphis Grizzlies | Chris Cenac Jr. | 克里斯 塞纳克 | PF/C | 19 | 76.079 | 75 | 0.624 | 108 |
| 17 | Oklahoma City Thunder | Cameron Carr | 卡梅隆 卡尔 | PG/SG | 21 | 80.4 | 83 | 2.806 | 107 |
| 18 | Charlotte Hornets | Labaron Philon Jr. | 小拉巴伦 菲隆 | PG/SG | 18 | 90.411 | 95 | 2.661 | 106 |
| 19 | Toronto Raptors | Nate Ament | 纳撒尼尔 阿门特 | SF/PF | 9 | 87.803 | 89 | 3.689 | 105 |
| 20 | San Antonio Spurs | Bennett Stirtz | 本内特 斯特茨 | PG/SG | 20 | 86.965 | 87 | 0.036 | 104 |
| 21 | Detroit Pistons | Mikel Brown Jr. | 迈克尔 布朗 | PG/SG | 7 | 86.376 | 81 | 1.222 | 103 |
| 22 | Philadelphia 76ers | Ebuka Okorie | 埃布卡 奥科里 | PG/SG | 24 | 84.647 | 87 | 1.901 | 102 |
| 23 | Atlanta Hawks | Meleek Thomas | 马利克 托马斯 | SG/SF | 28 | 77.43 | 75 | 0.432 | 101 |
| 24 | New York Knicks | Isaiah Evans | 以赛亚 埃文斯 | PG/SG | 25 | 83.28 | 84 | 0.576 | 100 |
| 25 | Los Angeles Lakers | Koa Peat | 科阿 皮特 | SF/PF | 27 | 82.744 | 85 | 2.235 | 99 |
| 26 | Denver Nuggets | Dailyn Swain | 戴林 斯温 | SF/PF | 23 | 80.646 | 83 | 2.197 | 98 |
| 27 | Boston Celtics | Tarris Reed Jr. | 小塔里斯 里德 | C | 29 | 74.819 | 76 | 1.243 | 97 |
| 28 | Minnesota Timberwolves | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | PG/SG | 30 | 84.238 | 95 | 9.467 | 96 |
| 29 | Cleveland Cavaliers | Malachi Moreno | 马拉奇 莫雷诺 | C | 34 | 76.659 | 76 | 1.073 | 95 |
| 30 | Dallas Mavericks | Henri Veesaar | 亨利 维萨尔 | C | 26 | 75.482 | 82 | 5.371 | 94 |

## Changed Vs Current Frontend Board

| Pick | Team | Current frontend | Current local name | Codex rerun | Codex local name |
|---:|---|---|---|---|---|
| 6 | Brooklyn Nets | Darius Acuff Jr. | 达柳斯 阿卡夫 | Kingston Flemings | 金斯顿 弗莱明斯 |
| 7 | Sacramento Kings | Mikel Brown Jr. | 迈克尔 布朗 | Darius Acuff Jr. | 达柳斯 阿卡夫 |
| 10 | Milwaukee Bucks | Kingston Flemings | 金斯顿 弗莱明斯 | Yaxel Lendeborg | 亚克塞尔 伦德伯格 |
| 11 | Golden State Warriors | Nate Ament | 纳撒尼尔 阿门特 | Christian Anderson | 克里斯蒂安 安德森 |
| 12 | Oklahoma City Thunder | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | Karim Lopez | 卡里姆 洛佩兹 |
| 13 | Miami Heat | Karim Lopez | 卡里姆 洛佩兹 | Hannes Steinbach | 汉内斯 施泰因巴赫 |
| 16 | Memphis Grizzlies | Hannes Steinbach | 汉内斯 施泰因巴赫 | Chris Cenac Jr. | 克里斯 塞纳克 |
| 17 | Oklahoma City Thunder | Chris Cenac Jr. | 克里斯 塞纳克 | Cameron Carr | 卡梅隆 卡尔 |
| 18 | Charlotte Hornets | Christian Anderson | 克里斯蒂安 安德森 | Labaron Philon Jr. | 小拉巴伦 菲隆 |
| 19 | Toronto Raptors | Labaron Philon Jr. | 小拉巴伦 菲隆 | Nate Ament | 纳撒尼尔 阿门特 |
| 21 | Detroit Pistons | Cameron Carr | 卡梅隆 卡尔 | Mikel Brown Jr. | 迈克尔 布朗 |
| 22 | Philadelphia 76ers | Dailyn Swain | 戴林 斯温 | Ebuka Okorie | 埃布卡 奥科里 |
| 23 | Atlanta Hawks | Ebuka Okorie | 埃布卡 奥科里 | Meleek Thomas | 马利克 托马斯 |
| 26 | Denver Nuggets | Tarris Reed Jr. | 小塔里斯 里德 | Dailyn Swain | 戴林 斯温 |
| 27 | Boston Celtics | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | Tarris Reed Jr. | 小塔里斯 里德 |
| 28 | Minnesota Timberwolves | Meleek Thomas | 马利克 托马斯 | Sergio De Larrea | 塞尔吉奥 德拉雷亚 |
| 29 | Cleveland Cavaliers | Henri Veesaar | 亨利 维萨尔 | Malachi Moreno | 马拉奇 莫雷诺 |
| 30 | Dallas Mavericks | Jack Kayil | 杰克 卡伊尔 | Henri Veesaar | 亨利 维萨尔 |
