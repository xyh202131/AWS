# Sequential Dynamic 123-Player Board Audit

Generated: 2026-06-23T13:36:49.538Z

## Method

- Candidate boundary: `data/final/local_pool_124_import_bundle.json`, 123 unique players.
- Selection loop: score every remaining candidate for the current pick, select the top scored player, remove him, then continue to the next pick.
- Dynamic layers: team preference confidence, position/family overlap, same-team sequencing, local combine/shooting feature reference.
- School/state priors are implemented as a configurable channel but remain zero here because no data-backed team school/state preference was present.
- No manual prediction or manual override was used.

## Candidate Review Count

- Picks run: 30
- Total candidate reviews: 3255
- First pick reviewed candidates: 123
- Unique selected players: 30
- Remaining after run: 93

## Board

| Pick | Team | Player | Local name | Pos | Rank | Score | Confidence | Score gap | Tie-break | Reviewed |
|---:|---|---|---|---|---:|---:|---:|---:|---|---:|
| 1 | Washington Wizards | AJ Dybantsa | AJ 迪班萨 | SF/PF | 2 | 95.114 | 97 | 3.859 |  | 123 |
| 2 | Utah Jazz | Darryn Peterson | 达林 彼得森 | PG/SG | 1 | 95.561 | 95 | 2.519 |  | 122 |
| 3 | Memphis Grizzlies | Cameron Boozer | 卡梅隆 布泽尔 | PF/C | 3 | 89.576 | 100 | 8.93 |  | 121 |
| 4 | Chicago Bulls | Caleb Wilson | 凯莱布 威尔逊 | SF/PF | 4 | 94.979 | 100 | 9.661 |  | 120 |
| 5 | LA Clippers | Keaton Wagler | 基顿 瓦格勒 | PG/SG | 5 | 95.947 | 92 | 1.753 |  | 119 |
| 6 | Brooklyn Nets | Darius Acuff Jr. | 达柳斯 阿卡夫 | PG/SG | 6 | 84.859 | 85 | 2.385 |  | 118 |
| 7 | Sacramento Kings | Kingston Flemings | 金斯顿 弗莱明斯 | PG/SG | 8 | 95.785 | 96 | 3.125 |  | 117 |
| 8 | Atlanta Hawks | Aday Mara | 阿达伊 马拉 | C | 10 | 81.523 | 81 | 3.041 |  | 116 |
| 9 | Dallas Mavericks | Brayden Burries | 布雷登 伯里斯 | PG/SG | 11 | 81.79 | 81 | 2.933 |  | 115 |
| 10 | Milwaukee Bucks | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | SF/PF | 12 | 90.714 | 82 | 0.44 |  | 114 |
| 11 | Golden State Warriors | Mikel Brown Jr. | 迈克尔 布朗 | PG/SG | 7 | 79.92 | 71 | 1.664 |  | 113 |
| 12 | Oklahoma City Thunder | Hannes Steinbach | 汉内斯 施泰因巴赫 | PF/C | 13 | 83.082 | 75 | -0.084 | yes | 112 |
| 13 | Miami Heat | Karim Lopez | 卡里姆 洛佩兹 | SF/PF | 14 | 95.121 | 100 | 5.04 |  | 111 |
| 14 | Charlotte Hornets | Morez Johnson Jr. | 小莫雷兹 约翰逊 | PF/C | 15 | 87.638 | 96 | 7.528 |  | 110 |
| 15 | Chicago Bulls | Nate Ament | 纳撒尼尔 阿门特 | SF/PF | 9 | 89.679 | 75 | -0.44 | yes | 109 |
| 16 | Memphis Grizzlies | Allen Graves | 阿伦 格雷夫斯 | SF/PF | 17 | 82.354 | 90 | 5.761 |  | 108 |
| 17 | Oklahoma City Thunder | Chris Cenac Jr. | 克里斯 塞纳克 | PF/C | 19 | 76.049 | 68 | 1.156 |  | 107 |
| 18 | Charlotte Hornets | Labaron Philon Jr. | 小拉巴伦 菲隆 | PG/SG | 18 | 87.815 | 82 | 0.839 |  | 106 |
| 19 | Toronto Raptors | Cameron Carr | 卡梅隆 卡尔 | PG/SG | 21 | 85.687 | 85 | 3.223 |  | 105 |
| 20 | San Antonio Spurs | Bennett Stirtz | 本内特 斯特茨 | PG/SG | 20 | 91.367 | 95 | 4.113 |  | 104 |
| 21 | Detroit Pistons | Christian Anderson | 克里斯蒂安 安德森 | PG/SG | 16 | 87.094 | 74 | -0.382 | yes | 103 |
| 22 | Philadelphia 76ers | Isaiah Evans | 以赛亚 埃文斯 | PG/SG | 25 | 87.475 | 84 | 2.352 |  | 102 |
| 23 | Atlanta Hawks | Dailyn Swain | 戴林 斯温 | SF/PF | 23 | 77.001 | 71 | 0.837 |  | 101 |
| 24 | New York Knicks | Ebuka Okorie | 埃布卡 奥科里 | PG/SG | 24 | 81.652 | 74 | -0.189 | yes | 100 |
| 25 | Los Angeles Lakers | Koa Peat | 科阿 皮特 | SF/PF | 27 | 78.367 | 70 | 0.865 |  | 99 |
| 26 | Denver Nuggets | Henri Veesaar | 亨利 维萨尔 | C | 26 | 68.726 | 63 | 0.806 |  | 98 |
| 27 | Boston Celtics | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | PG/SG | 30 | 65.053 | 56 | 0.948 |  | 97 |
| 28 | Minnesota Timberwolves | Meleek Thomas | 马利克 托马斯 | SG/SF | 28 | 78.006 | 82 | 4.703 |  | 96 |
| 29 | Cleveland Cavaliers | Tarris Reed Jr. | 小塔里斯 里德 | C | 29 | 72.589 | 83 | 10.629 |  | 95 |
| 30 | Dallas Mavericks | Jack Kayil | 杰克 卡伊尔 | PG/SG | 35 | 64.634 | 53 | 1.154 |  | 94 |

## Changed Vs Previous 124-Pool Baseline

| Pick | Team | Previous baseline | Sequential dynamic |
|---:|---|---|---|
| 7 | Sacramento Kings | Mikel Brown Jr. | Kingston Flemings |
| 10 | Milwaukee Bucks | Kingston Flemings | Yaxel Lendeborg |
| 11 | Golden State Warriors | Nate Ament | Mikel Brown Jr. |
| 12 | Oklahoma City Thunder | Yaxel Lendeborg | Hannes Steinbach |
| 15 | Chicago Bulls | Allen Graves | Nate Ament |
| 16 | Memphis Grizzlies | Hannes Steinbach | Allen Graves |
| 18 | Charlotte Hornets | Christian Anderson | Labaron Philon Jr. |
| 19 | Toronto Raptors | Labaron Philon Jr. | Cameron Carr |
| 21 | Detroit Pistons | Cameron Carr | Christian Anderson |
| 22 | Philadelphia 76ers | Dailyn Swain | Isaiah Evans |
| 23 | Atlanta Hawks | Ebuka Okorie | Dailyn Swain |
| 24 | New York Knicks | Isaiah Evans | Ebuka Okorie |
| 26 | Denver Nuggets | Tarris Reed Jr. | Henri Veesaar |
| 29 | Cleveland Cavaliers | Henri Veesaar | Tarris Reed Jr. |

## Pick 1 Detail

- Team: Washington Wizards
- Reviewed candidates: 123
- Selected: AJ Dybantsa (AJ 迪班萨)
- Removed prospect id: aj-dybantsa
- Remaining after pick 1: 122
- Dynamic preference: 锋线、创造/得分、防守、上限/资产、尺寸
- School/state preference: no data-backed team school/state priors configured
- Score gap vs next sorted candidate: 3.859

| Rank | Player | Local name | Pos | Consensus | Final | Raw | Team pref adj | Feature adj | Overlap families |
|---:|---|---|---|---:|---:|---:|---:|---:|---|
| 1 | AJ Dybantsa | AJ 迪班萨 | SF/PF | 2 | 95.114 | 91.124 | 2.84 | 1.15 | wing, creation, defense, size |
| 2 | Caleb Wilson | 凯莱布 威尔逊 | SF/PF | 4 | 91.255 | 87.265 | 2.84 | 1.15 | wing, creation, defense, size |
| 3 | Darryn Peterson | 达林 彼得森 | PG/SG | 1 | 87.848 | 88.688 | -0.84 | 0 | creation |
| 4 | Cameron Boozer | 卡梅隆 布泽尔 | PF/C | 3 | 87.526 | 84.976 | 2 | 0.55 | wing, defense, size |
| 5 | Keaton Wagler | 基顿 瓦格勒 | PG/SG | 5 | 77.552 | 77.552 | 0 | 0 | creation, size |
| 6 | Darius Acuff Jr. | 达柳斯 阿卡夫 | PG/SG | 6 | 77.198 | 78.038 | -0.84 | 0 | creation |
| 7 | Kingston Flemings | 金斯顿 弗莱明斯 | PG/SG | 8 | 74.477 | 73.927 | 0 | 0.55 | creation, defense |
| 8 | Nate Ament | 纳撒尼尔 阿门特 | SF/PF | 9 | 72.338 | 71.228 | 0.56 | 0.55 | wing, size |
| 9 | Mikel Brown Jr. | 迈克尔 布朗 | PG/SG | 7 | 71.429 | 73.069 | -0.84 | -0.8 | creation |
| 10 | Brayden Burries | 布雷登 伯里斯 | PG/SG | 11 | 70.31 | 67.48 | 2.28 | 0.55 | wing, creation, defense, size |
| 11 | Aday Mara | 阿达伊 马拉 | C | 10 | 68.581 | 67.371 | 0.56 | 0.65 | defense, size |
| 12 | Karim Lopez | 卡里姆 洛佩兹 | SF/PF | 14 | 64.175 | 60.785 | 2.84 | 0.55 | wing, creation, defense, size |
| 13 | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | SF/PF | 12 | 62.869 | 60.219 | 2 | 0.65 | wing, defense, size |
| 14 | Morez Johnson Jr. | 小莫雷兹 约翰逊 | PF/C | 15 | 60.004 | 56.854 | 2 | 1.15 | wing, defense, size |
| 15 | Hannes Steinbach | 汉内斯 施泰因巴赫 | PF/C | 13 | 58.768 | 55.618 | 2 | 1.15 | wing, defense, size |
