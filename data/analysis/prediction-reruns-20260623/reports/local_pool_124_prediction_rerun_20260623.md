# Local 124-Player Pool Prediction Rerun

Generated: 2026-06-23T12:48:14.183Z

## Scope

This run uses the competition answer-card 124-row player pool as the candidate eligibility boundary. It does not overwrite the current frontend board.

The 124-row list is treated as a player pool, not as a ranking board. Matched players retain their current DraftOps/NBA.com profile and consensus rank. Local-only unmatched rows receive deterministic low-trust fallback profiles after the matched profile pool.

## Candidate Pool Audit

- Source rows: 124
- Unique candidate identities used for scoring: 123
- Matched to current 101-profile pool: 84
- Local-only fallback profiles: 39
- Current 101 profiles excluded because absent from local 124 pool: 17
- Duplicate source-name rows skipped for scoring: 1

## Health

- 30 picks: true
- No duplicates: true
- Low-confidence count: 1
- Ready: true

## Board

| Pick | Team | Player | Local name | Rank | Confidence | Margin | Fallback |
|---:|---|---|---|---:|---:|---:|---|
| 1 | Washington Wizards | AJ Dybantsa | AJ 迪班萨 | 2 | 96 | 5 | false |
| 2 | Utah Jazz | Darryn Peterson | 达林 彼得森 | 1 | 93 | 3 | false |
| 3 | Memphis Grizzlies | Cameron Boozer | 卡梅隆 布泽尔 | 3 | 100 | 15 | false |
| 4 | Chicago Bulls | Caleb Wilson | 凯莱布 威尔逊 | 4 | 100 | 9 | false |
| 5 | LA Clippers | Keaton Wagler | 基顿 瓦格勒 | 5 | 89 | 2 | false |
| 6 | Brooklyn Nets | Darius Acuff Jr. | 达柳斯 阿卡夫 | 6 | 89 | 2 | false |
| 7 | Sacramento Kings | Mikel Brown Jr. | 迈克尔 布朗 | 7 | 86 | 0 | false |
| 8 | Atlanta Hawks | Aday Mara | 阿达伊 马拉 | 10 | 94 | 7 | false |
| 9 | Dallas Mavericks | Brayden Burries | 布雷登 伯里斯 | 11 | 97 | 7 | false |
| 10 | Milwaukee Bucks | Kingston Flemings | 金斯顿 弗莱明斯 | 8 | 83 | 1 | false |
| 11 | Golden State Warriors | Nate Ament | 纳撒尼尔 阿门特 | 9 | 75 | 2 | false |
| 12 | Oklahoma City Thunder | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | 12 | 94 | 4 | false |
| 13 | Miami Heat | Karim Lopez | 卡里姆 洛佩兹 | 14 | 88 | 3 | false |
| 14 | Charlotte Hornets | Morez Johnson Jr. | 小莫雷兹 约翰逊 | 15 | 96 | 5 | false |
| 15 | Chicago Bulls | Allen Graves | 阿伦 格雷夫斯 | 17 | 94 | 5 | false |
| 16 | Memphis Grizzlies | Hannes Steinbach | 汉内斯 施泰因巴赫 | 13 | 82 | 4 | false |
| 17 | Oklahoma City Thunder | Chris Cenac Jr. | 克里斯 塞纳克 | 19 | 79 | 4 | false |
| 18 | Charlotte Hornets | Christian Anderson | 克里斯蒂安 安德森 | 16 | 78 | 0 | false |
| 19 | Toronto Raptors | Labaron Philon Jr. | 小拉巴伦 菲隆 | 18 | 71 | 0 | false |
| 20 | San Antonio Spurs | Bennett Stirtz | 本内特 斯特茨 | 20 | 84 | 1 | false |
| 21 | Detroit Pistons | Cameron Carr | 卡梅隆 卡尔 | 21 | 99 | 5 | false |
| 22 | Philadelphia 76ers | Dailyn Swain | 戴林 斯温 | 23 | 74 | 0 | false |
| 23 | Atlanta Hawks | Ebuka Okorie | 埃布卡 奥科里 | 24 | 91 | 7 | false |
| 24 | New York Knicks | Isaiah Evans | 以赛亚 埃文斯 | 25 | 74 | 0 | false |
| 25 | Los Angeles Lakers | Koa Peat | 科阿 皮特 | 27 | 74 | 2 | false |
| 26 | Denver Nuggets | Tarris Reed Jr. | 小塔里斯 里德 | 29 | 68 | 2 | false |
| 27 | Boston Celtics | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | 30 | 68 | 4 | false |
| 28 | Minnesota Timberwolves | Meleek Thomas | 马利克 托马斯 | 28 | 76 | 5 | false |
| 29 | Cleveland Cavaliers | Henri Veesaar | 亨利 维萨尔 | 26 | 80 | 5 | false |
| 30 | Dallas Mavericks | Jack Kayil | 杰克 卡伊尔 | 35 | 60 | 1 | false |

## Changed Vs Current 101-Pool Board

| Pick | Team | Current 101-pool board | Local 124-pool rerun |
|---:|---|---|---|
| 30 | Dallas Mavericks | Marc-Owen Fodzo Dada | Jack Kayil |

## Local-Only Fallback Picks In First Round

None.

## Notes

- `纳撒尼尔 阿门特` appears twice in the source pool. The row with Tennessee/United States data is kept; the blank PF row is skipped for scoring to avoid selecting the same player twice.
- This is still no-manual-override: the script performs deterministic pool matching and then calls `generateBoard` once with the baseline scenario.

