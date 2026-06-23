# Relative Pool-Scoring Prediction (Min-Max Normalized per Pick)

Generated: 2026-06-23T19:15:37.463Z
Script: `scripts/relative-scoring-prediction.mjs`
Scorer role: Codex-as-LLM local scoring subagent

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
- Average score: 88.31
- Average confidence: 91
- Low-confidence picks: 7
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

| Pick | Team | Player | Local name | Pos | Rank | Score | Confidence | Low conf | Margin | Reviewed |
|---:|---|---|---|---|---:|---:|---:|---|---:|---:|
| 1 | Washington Wizards | AJ Dybantsa | AJ 迪班萨 | SF/PF | 2 | 97.681 | 100 | no | 5.861 | 123 |
| 2 | Utah Jazz | Darryn Peterson | 达林 彼得森 | PG/SG | 1 | 95.48 | 100 | no | 3.854 | 122 |
| 3 | Memphis Grizzlies | Cameron Boozer | 卡梅隆 布泽尔 | PF/C | 3 | 97.48 | 100 | no | 3.956 | 121 |
| 4 | Chicago Bulls | Caleb Wilson | 凯莱布 威尔逊 | SF/PF | 4 | 94.486 | 100 | no | 9.979 | 120 |
| 5 | LA Clippers | Keaton Wagler | 基顿 瓦格勒 | PG/SG | 5 | 96.731 | 100 | no | 1.861 | 119 |
| 6 | Brooklyn Nets | Kingston Flemings | 金斯顿 弗莱明斯 | PG/SG | 8 | 97.712 | 99 | no | 1.622 | 118 |
| 7 | Sacramento Kings | Darius Acuff Jr. | 达柳斯 阿卡夫 | PG/SG | 6 | 91.626 | 94 | no | 1.528 | 117 |
| 8 | Atlanta Hawks | Nate Ament | 纳撒尼尔 阿门特 | SF/PF | 9 | 94.399 | 97 | no | 1.651 | 116 |
| 9 | Dallas Mavericks | Brayden Burries | 布雷登 伯里斯 | PG/SG | 11 | 94.106 | 100 | no | 7.591 | 115 |
| 10 | Milwaukee Bucks | Karim Lopez | 卡里姆 洛佩兹 | SF/PF | 14 | 89.573 | 88 | yes | 0.223 | 114 |
| 11 | Golden State Warriors | Labaron Philon Jr. | 小拉巴伦 菲隆 | PG/SG | 18 | 84.878 | 81 | yes | 0.109 | 113 |
| 12 | Oklahoma City Thunder | Aday Mara | 阿达伊 马拉 | C | 10 | 87.964 | 94 | no | 4.415 | 112 |
| 13 | Miami Heat | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | SF/PF | 12 | 90.774 | 99 | no | 5.074 | 111 |
| 14 | Charlotte Hornets | Allen Graves | 阿伦 格雷夫斯 | SF/PF | 17 | 85.62 | 85 | yes | 0.552 | 110 |
| 15 | Chicago Bulls | Cameron Carr | 卡梅隆 卡尔 | PG/SG | 21 | 83.131 | 81 | yes | 0.71 | 109 |
| 16 | Memphis Grizzlies | Dailyn Swain | 戴林 斯温 | SF/PF | 23 | 79.776 | 77 | yes | 0.519 | 108 |
| 17 | Oklahoma City Thunder | Morez Johnson Jr. | 小莫雷兹 约翰逊 | PF/C | 15 | 83.996 | 86 | no | 2.067 | 107 |
| 18 | Charlotte Hornets | Christian Anderson | 克里斯蒂安 安德森 | PG/SG | 16 | 91.339 | 92 | yes | 0.938 | 106 |
| 19 | Toronto Raptors | Mikel Brown Jr. | 迈克尔 布朗 | PG/SG | 7 | 80.959 | 77 | no | 1.604 | 105 |
| 20 | San Antonio Spurs | Bennett Stirtz | 本内特 斯特茨 | PG/SG | 20 | 88.268 | 96 | no | 4.602 | 104 |
| 21 | Detroit Pistons | Isaiah Evans | 以赛亚 埃文斯 | PG/SG | 25 | 87.917 | 88 | no | 1.524 | 103 |
| 22 | Philadelphia 76ers | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | PG/SG | 30 | 84.071 | 80 | yes | 0.083 | 102 |
| 23 | Atlanta Hawks | Ebuka Okorie | 埃布卡 奥科里 | PG/SG | 24 | 81.915 | 88 | no | 3.972 | 101 |
| 24 | New York Knicks | Hannes Steinbach | 汉内斯 施泰因巴赫 | PF/C | 13 | 91.023 | 97 | no | 10.535 | 100 |
| 25 | Los Angeles Lakers | Koa Peat | 科阿 皮特 | SF/PF | 27 | 90.924 | 99 | no | 5.615 | 99 |
| 26 | Denver Nuggets | Henri Veesaar | 亨利 维萨尔 | C | 26 | 82.724 | 88 | no | 3.203 | 98 |
| 27 | Boston Celtics | Chris Cenac Jr. | 克里斯 塞纳克 | PF/C | 19 | 81.463 | 82 | no | 3.167 | 97 |
| 28 | Minnesota Timberwolves | Meleek Thomas | 马利克 托马斯 | SG/SF | 28 | 85.746 | 98 | no | 25.172 | 96 |
| 29 | Cleveland Cavaliers | Tarris Reed Jr. | 小塔里斯 里德 | C | 29 | 83.669 | 90 | no | 3.785 | 95 |
| 30 | Dallas Mavericks | Tyler Bilodeau | 泰勒 比洛多 | SF/PF | 46 | 73.968 | 70 | no | 3.066 | 94 |

## Per-Pick Relative Scoring And Removal Proof

### Pick 1: Washington Wizards

- Pool before scoring: 123
- Pool after removal: 122
- Removed prospect id: `aj-dybantsa`
- Selection: AJ Dybantsa (AJ 迪班萨), score 97.681, margin 5.861, low confidence no
- Scoring basis: weights {"consensus":0.2982,"need":0.1842,"player":0.1579,"upside":0.2105,"feature":0.0702,"source":0.0789}; needs alpha scorer, wing creator, defensive size; priority tags wing creator, star upside, two-way, wing, size, creation; preference families wing, creation, defense, upside_asset, size.
- Evidence basis: RAG matches 33; trust weight 70; source notes NBA.com official prospects: F, age 19, BYU, 6-9, 217 lbs, Freshman, United States / NBA.com consensus: most common No. 1 pick / Tankathon top-tier wing / ESPN 2026 NBA draft big board top 100: normalized rank 2; source rank 2; confidence high. / NBA.com consensus lottery cross-check: pick 1, most common 1 (10)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | AJ Dybantsa | AJ 迪班萨 | 97.681 | 2 | 96.65 | 100 | 100 | 100 | 82.175 | 99.12 |
| 2 | Darryn Peterson | 达林 彼得森 | 91.82 | 1 | 100 | 91.143 | 83.515 | 100 | 44.761 | 99.12 |
| 3 | Cameron Boozer | 卡梅隆 布泽尔 | 90.72 | 3 | 93.3 | 100 | 78.897 | 100 | 44.704 | 99.12 |
| 4 | Caleb Wilson | 凯莱布 威尔逊 | 89.951 | 4 | 89.95 | 100 | 88.402 | 100 | 83.599 | 99.12 |
| 5 | Keaton Wagler | 基顿 瓦格勒 | 80.241 | 5 | 86.6 | 84.277 | 74.078 | 100 | 32.972 | 99.12 |

### Pick 2: Utah Jazz

- Pool before scoring: 122
- Pool after removal: 121
- Removed prospect id: `darryn-peterson`
- Selection: Darryn Peterson (达林 彼得森), score 95.48, margin 3.854, low confidence no
- Scoring basis: weights {"consensus":0.2982,"need":0.1842,"player":0.1579,"upside":0.2105,"feature":0.0702,"source":0.0789}; needs lead guard, shot creation, late-clock offense; priority tags primary guard, shot creator, pull-up shooting, guard, creation, shooting; preference families guard, shooting, creation.
- Evidence basis: RAG matches 28; trust weight 62; source notes NBA.com official prospects: G, age 19, Kansas, 6-5, 199 lbs, Freshman, United States / NBA.com consensus: common No. 2 pick / ESPN and Tankathon top guard tier / ESPN 2026 NBA draft big board top 100: normalized rank 1; source rank 1; confidence high. / NBA.com consensus lottery cross-check: pick 2, most common 2 (8)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Darryn Peterson | 达林 彼得森 | 95.48 | 1 | 100 | 100 | 94.47 | 100 | 49.026 | 99.12 |
| 2 | Keaton Wagler | 基顿 瓦格勒 | 91.626 | 5 | 93.068 | 100 | 83.795 | 100 | 47.579 | 99.12 |
| 3 | Darius Acuff Jr. | 达柳斯 阿卡夫 | 90.435 | 6 | 89.602 | 100 | 73.379 | 100 | 68.781 | 99.12 |
| 4 | Kingston Flemings | 金斯顿 弗莱明斯 | 87.425 | 8 | 74.185 | 100 | 76.846 | 100 | 100 | 99.12 |
| 5 | Cameron Boozer | 卡梅隆 布泽尔 | 84.624 | 3 | 100 | 44.651 | 89.247 | 100 | 51.363 | 99.12 |

### Pick 3: Memphis Grizzlies

- Pool before scoring: 121
- Pool after removal: 120
- Removed prospect id: `cameron-boozer`
- Selection: Cameron Boozer (卡梅隆 布泽尔), score 97.48, margin 3.956, low confidence no
- Scoring basis: weights {"consensus":0.2832,"need":0.2124,"player":0.177,"upside":0.177,"feature":0.0708,"source":0.0796}; needs frontcourt scoring, rebounding, secondary passing; priority tags frontcourt engine, rebounder, feel; preference families frontcourt, creation.
- Evidence basis: RAG matches 26; trust weight 52.5; source notes NBA.com official prospects: F-C, age 18, Duke, 6-8, 253 lbs, Freshman, United States / NBA.com consensus: common No. 3 pick / Tankathon lists him in tier 1 / ESPN 2026 NBA draft big board top 100: normalized rank 3; source rank 3; confidence high. / NBA.com consensus lottery cross-check: pick 3, most common 3 (8)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Cameron Boozer | 卡梅隆 布泽尔 | 97.48 | 3 | 100 | 100 | 97.868 | 100 | 70.719 | 99.12 |
| 2 | Caleb Wilson | 凯莱布 威尔逊 | 93.524 | 4 | 96.65 | 100 | 99.998 | 100 | 79.414 | 99.12 |
| 3 | Keaton Wagler | 基顿 瓦格勒 | 82.725 | 5 | 93.3 | 75.855 | 95.364 | 100 | 24.312 | 99.12 |
| 4 | Kingston Flemings | 金斯顿 弗莱明斯 | 78.859 | 8 | 83.25 | 54.024 | 86.771 | 100 | 40.373 | 99.12 |
| 5 | Darius Acuff Jr. | 达柳斯 阿卡夫 | 78.185 | 6 | 89.95 | 53.583 | 76.819 | 100 | 30.257 | 99.12 |

### Pick 4: Chicago Bulls

- Pool before scoring: 120
- Pool after removal: 119
- Removed prospect id: `caleb-wilson`
- Selection: Caleb Wilson (凯莱布 威尔逊), score 94.486, margin 9.979, low confidence no
- Scoring basis: weights {"consensus":0.2982,"need":0.1842,"player":0.1579,"upside":0.2105,"feature":0.0702,"source":0.0789}; needs big wing, rim pressure, defensive playmaking; priority tags big wing, two-way, transition, forward, frontcourt, size, defense; preference families wing, frontcourt, creation, defense, size.
- Evidence basis: RAG matches 26; trust weight 51.5; source notes NBA.com official prospects: F, age 19, North Carolina, 6-9, 211 lbs, Freshman, United States / NBA.com consensus: common No. 4 pick / High lottery forward archetype / ESPN 2026 NBA draft big board top 100: normalized rank 4; source rank 4; confidence high. / NBA.com consensus lottery cross-check: pick 4, most common 4 (8)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Caleb Wilson | 凯莱布 威尔逊 | 94.486 | 4 | 100 | 100 | 99.998 | 100 | 79.414 | 99.12 |
| 2 | Nate Ament | 纳撒尼尔 阿门特 | 84.507 | 9 | 83.25 | 100 | 69.935 | 100 | 76.043 | 99.12 |
| 3 | Kingston Flemings | 金斯顿 弗莱明斯 | 79.746 | 8 | 86.6 | 54.685 | 76.846 | 100 | 40.373 | 99.12 |
| 4 | Keaton Wagler | 基顿 瓦格勒 | 79.118 | 5 | 96.65 | 56.881 | 83.795 | 100 | 24.312 | 99.12 |
| 5 | Aday Mara | 阿达伊 马拉 | 77.949 | 10 | 71.7 | 100 | 57.839 | 79.356 | 80.213 | 99.12 |

### Pick 5: LA Clippers

- Pool before scoring: 119
- Pool after removal: 118
- Removed prospect id: `keaton-wagler`
- Selection: Keaton Wagler (基顿 瓦格勒), score 96.731, margin 1.861, low confidence no
- Scoring basis: weights {"consensus":0.2832,"need":0.1858,"player":0.1593,"upside":0.2035,"feature":0.0708,"source":0.0973}; needs young guard, shooting, pace; priority tags combo guard, pull-up shooting, decision maker, guard, creation, shooting; preference families guard, shooting, creation, upside_asset.
- Evidence basis: RAG matches 19; trust weight 37; source notes NBA.com official prospects: G, age 19, Illinois, 6-5, 188 lbs, Freshman, United States / NBA.com consensus: common No. 5 pick / Media momentum near top five / ESPN 2026 NBA draft big board top 100: normalized rank 5; source rank 5; confidence high. / NBA.com consensus lottery cross-check: pick 5, most common 5 (8)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Keaton Wagler | 基顿 瓦格勒 | 96.731 | 5 | 100 | 100 | 100 | 100 | 55.034 | 99.12 |
| 2 | Kingston Flemings | 金斯顿 弗莱明斯 | 94.87 | 8 | 89.95 | 100 | 86.2 | 100 | 100 | 99.12 |
| 3 | Darius Acuff Jr. | 达柳斯 阿卡夫 | 93.807 | 6 | 96.65 | 100 | 82.269 | 100 | 67.033 | 99.12 |
| 4 | Brayden Burries | 布雷登 伯里斯 | 86.321 | 11 | 71.7 | 100 | 90.858 | 90.962 | 83.989 | 99.12 |
| 5 | Mikel Brown Jr. | 迈克尔 布朗 | 85.367 | 7 | 93.3 | 100 | 81.005 | 88.056 | 26.646 | 99.12 |

### Pick 6: Brooklyn Nets

- Pool before scoring: 118
- Pool after removal: 117
- Removed prospect id: `kingston-flemings`
- Selection: Kingston Flemings (金斯顿 弗莱明斯), score 97.712, margin 1.622, low confidence no
- Scoring basis: weights {"consensus":0.2545,"need":0.2455,"player":0.1818,"upside":0.1636,"feature":0.0727,"source":0.0818}; needs primary guard, rim pressure, fan-facing upside; priority tags primary guard, shot creator, speed; preference families guard, creation, upside_asset.
- Evidence basis: RAG matches 27; trust weight 52.5; source notes NBA.com official prospects: G, age 19, Houston, 6-3, 183 lbs, Freshman, United States / Appears across NBA.com consensus mocks / Houston guard with creation profile / ESPN 2026 NBA draft big board top 100: normalized rank 8; source rank 8; confidence high. / NBA.com consensus lottery cross-check: pick 8, most common 7, 9 (3)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Kingston Flemings | 金斯顿 弗莱明斯 | 97.712 | 8 | 93.3 | 100 | 98.09 | 100 | 97.76 | 99.12 |
| 2 | Darius Acuff Jr. | 达柳斯 阿卡夫 | 96.09 | 6 | 100 | 100 | 93.664 | 100 | 63.06 | 99.12 |
| 3 | Brayden Burries | 布雷登 伯里斯 | 91.889 | 11 | 83.25 | 100 | 100 | 86.06 | 79.457 | 99.12 |
| 4 | Mikel Brown Jr. | 迈克尔 布朗 | 85.954 | 7 | 96.65 | 97.284 | 87.797 | 83.31 | 24.309 | 99.12 |
| 5 | Karim Lopez | 卡里姆 洛佩兹 | 78.005 | 14 | 73.2 | 55.885 | 92.193 | 100 | 60.772 | 99.12 |

### Pick 7: Sacramento Kings

- Pool before scoring: 117
- Pool after removal: 116
- Removed prospect id: `darius-acuff-jr`
- Selection: Darius Acuff Jr. (达柳斯 阿卡夫), score 91.626, margin 1.528, low confidence no
- Scoring basis: weights {"consensus":0.2385,"need":0.2752,"player":0.2018,"upside":0.1284,"feature":0.0734,"source":0.0826}; needs point guard depth, paint touch, defensive activity; priority tags primary guard, pace, playmaking, guard, creation, defense; preference families guard, creation, defense.
- Evidence basis: RAG matches 19; trust weight 44; source notes NBA.com official prospects: G, age 19, Arkansas, 6-2, 186 lbs, Freshman, United States / NBA.com consensus: common pick in 6-7 range / Tankathon top guard group / ESPN 2026 NBA draft big board top 100: normalized rank 6; source rank 6; confidence high. / NBA.com consensus lottery cross-check: pick 6, most common 6 (5)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Darius Acuff Jr. | 达柳斯 阿卡夫 | 91.626 | 6 | 96.65 | 97.848 | 86.969 | 100 | 41.682 | 99.12 |
| 2 | Brayden Burries | 布雷登 伯里斯 | 90.098 | 11 | 86.6 | 100 | 100 | 81.404 | 42.173 | 99.12 |
| 3 | Mikel Brown Jr. | 迈克尔 布朗 | 86.672 | 7 | 100 | 97.301 | 94.375 | 78.804 | 9.331 | 99.12 |
| 4 | Labaron Philon Jr. | 小拉巴伦 菲隆 | 76.544 | 18 | 57.55 | 100 | 90.002 | 76.203 | 19.337 | 89.885 |
| 5 | Christian Anderson | 克里斯蒂安 安德森 | 76.24 | 16 | 69.85 | 95.879 | 75.387 | 55.397 | 46.839 | 89.885 |

### Pick 8: Atlanta Hawks

- Pool before scoring: 116
- Pool after removal: 115
- Removed prospect id: `nate-ament`
- Selection: Nate Ament (纳撒尼尔 阿门特), score 94.399, margin 1.651, low confidence no
- Scoring basis: weights {"consensus":0.2385,"need":0.2477,"player":0.1835,"upside":0.156,"feature":0.0734,"source":0.1009}; needs rim protection, frontcourt size, vertical spacing; priority tags rim protector, size, interior finisher; preference families shooting, frontcourt, defense, size.
- Evidence basis: RAG matches 26; trust weight 52; source notes NBA.com official prospects: F, age 19, Tennessee, 6-10, 211 lbs, Freshman, United States / Appears in NBA.com consensus lottery boards / Valued for size-shooting mix / ESPN 2026 NBA draft big board top 100: normalized rank 9; source rank 9; confidence high. / NBA.com consensus lottery cross-check: pick 11, most common 10, 12 (3)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Nate Ament | 纳撒尼尔 阿门特 | 94.399 | 9 | 100 | 100 | 93.311 | 99.206 | 97.804 | 99.12 |
| 2 | Karim Lopez | 卡里姆 洛佩兹 | 92.748 | 14 | 82.669 | 100 | 91.462 | 96.561 | 87.373 | 99.12 |
| 3 | Brayden Burries | 布雷登 伯里斯 | 91.064 | 11 | 93.068 | 92.616 | 100 | 82.804 | 63.451 | 99.12 |
| 4 | Aday Mara | 阿达伊 马拉 | 89.866 | 10 | 96.534 | 100 | 81.476 | 71.693 | 80.863 | 99.12 |
| 5 | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | 81.799 | 12 | 89.602 | 100 | 83.877 | 25.661 | 84.078 | 100 |

### Pick 9: Dallas Mavericks

- Pool before scoring: 115
- Pool after removal: 114
- Removed prospect id: `brayden-burries`
- Selection: Brayden Burries (布雷登 伯里斯), score 94.106, margin 7.591, low confidence no
- Scoring basis: weights {"consensus":0.2364,"need":0.2818,"player":0.2182,"upside":0.0909,"feature":0.0727,"source":0.1}; needs two-way guard, shooting, secondary creation; priority tags combo guard, shooter, two-way; preference families guard, shooting, creation, defense.
- Evidence basis: RAG matches 22; trust weight 47.5; source notes NBA.com official prospects: G, age 20, Arizona, 6-4, 215 lbs, Freshman, United States / Consensus lottery name / Tankathon top-ten wing/guard / ESPN 2026 NBA draft big board top 100: normalized rank 11; source rank 11; confidence high. / NBA.com consensus lottery cross-check: pick 9, most common 9 (5)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Brayden Burries | 布雷登 伯里斯 | 94.106 | 11 | 96.534 | 100 | 96.015 | 81.046 | 67.084 | 99.12 |
| 2 | Mikel Brown Jr. | 迈克尔 布朗 | 86.515 | 7 | 96.534 | 100 | 88.391 | 78.457 | 16.316 | 99.12 |
| 3 | Labaron Philon Jr. | 小拉巴伦 菲隆 | 82.274 | 18 | 72.271 | 100 | 82.212 | 75.867 | 43.832 | 89.885 |
| 4 | Christian Anderson | 克里斯蒂安 安德森 | 81.4 | 16 | 79.203 | 100 | 68.409 | 55.153 | 76.578 | 89.885 |
| 5 | Cameron Carr | 卡梅隆 卡尔 | 78.249 | 21 | 55.251 | 100 | 86.819 | 52.046 | 84.65 | 94.283 |

### Pick 10: Milwaukee Bucks

- Pool before scoring: 114
- Pool after removal: 113
- Removed prospect id: `karim-lopez`
- Selection: Karim Lopez (卡里姆 洛佩兹), score 89.573, margin 0.223, low confidence yes
- Scoring basis: weights {"consensus":0.2364,"need":0.2818,"player":0.2182,"upside":0.0909,"feature":0.0727,"source":0.1}; needs connector forward, defense, rebounding; priority tags big wing, connector, defense, guard, creation; preference families guard, wing, frontcourt, creation, defense.
- Evidence basis: RAG matches 17; trust weight 36; source notes NBA.com official prospects: F, age 19, New Zealand Breakers (Australia), 6-8, 222 lbs, International, Mexico / Appears in NBA.com consensus top-14 boards / International milestone candidate / ESPN 2026 NBA draft big board top 100: normalized rank 14; source rank 14; confidence high. / NBA.com consensus lottery cross-check: pick 13, most common 11 (2)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Karim Lopez | 卡里姆 洛佩兹 | 89.573 | 14 | 86.6 | 100 | 82.961 | 94.511 | 59.362 | 99.12 |
| 2 | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | 89.35 | 12 | 93.3 | 100 | 100 | 25.117 | 68.938 | 100 |
| 3 | Aday Mara | 阿达伊 马拉 | 88.216 | 10 | 100 | 100 | 79.634 | 70.171 | 37.569 | 99.12 |
| 4 | Hannes Steinbach | 汉内斯 施泰因巴赫 | 82.11 | 13 | 89.95 | 100 | 61.791 | 62.921 | 63.597 | 88.4 |
| 5 | Allen Graves | 阿伦 格雷夫斯 | 79.356 | 17 | 76.55 | 100 | 73.455 | 73.796 | 18.662 | 89.885 |

### Pick 11: Golden State Warriors

- Pool before scoring: 113
- Pool after removal: 112
- Removed prospect id: `labaron-philon-jr`
- Selection: Labaron Philon Jr. (小拉巴伦 菲隆), score 84.878, margin 0.109, low confidence yes
- Scoring basis: weights {"consensus":0.2364,"need":0.2818,"player":0.2182,"upside":0.0909,"feature":0.0727,"source":0.1}; needs smart guard, movement shooting, decision making; priority tags shooter, decision maker, off-ball; preference families guard, shooting.
- Evidence basis: RAG matches 25; trust weight 46; source notes NBA.com official prospects: G, age 20, Alabama, 6-3, 176 lbs, Sophomore, United States / Consensus fringe lottery candidate / Productive guard profile / ESPN 2026 NBA draft big board top 100: normalized rank 18; source rank 18; confidence high. / Visible ESPN Big Board profile entry extracted from local raw markdown. ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Labaron Philon Jr. | 小拉巴伦 菲隆 | 84.878 | 18 | 79.203 | 100 | 82.212 | 75.867 | 57.107 | 89.885 |
| 2 | Mikel Brown Jr. | 迈克尔 布朗 | 84.769 | 7 | 89.602 | 100 | 88.391 | 78.457 | 14.836 | 99.12 |
| 3 | Christian Anderson | 克里斯蒂安 安德森 | 84.525 | 16 | 86.136 | 100 | 68.409 | 55.153 | 97.02 | 89.885 |
| 4 | Cameron Carr | 卡梅隆 卡尔 | 80.946 | 21 | 63.839 | 96.557 | 86.819 | 52.046 | 86.53 | 94.283 |
| 5 | Bennett Stirtz | 本内特 斯特茨 | 78.49 | 20 | 72.271 | 100 | 76.745 | 17.866 | 80.695 | 89.885 |

### Pick 12: Oklahoma City Thunder

- Pool before scoring: 112
- Pool after removal: 111
- Removed prospect id: `aday-mara`
- Selection: Aday Mara (阿达伊 马拉), score 87.964, margin 4.415, low confidence no
- Scoring basis: weights {"consensus":0.2385,"need":0.2477,"player":0.1835,"upside":0.156,"feature":0.0734,"source":0.1009}; needs frontcourt depth, versatility, long-term value; priority tags versatile forward, feel, defense; preference families wing, frontcourt, defense, upside_asset.
- Evidence basis: RAG matches 34; trust weight 89.5; source notes NBA.com official prospects: C, age 21, Michigan, 7-3, 260 lbs, Junior, Spain / NBA.com consensus common top-eight mention / International big milestone candidate / ESPN 2026 NBA draft big board top 100: normalized rank 10; source rank 10; confidence high. / NBA.com consensus lottery cross-check: pick 10, most common 8 (4)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Aday Mara | 阿达伊 马拉 | 87.964 | 10 | 93.3 | 100 | 91.388 | 75.048 | 33.542 | 99.12 |
| 2 | Hannes Steinbach | 汉内斯 施泰因巴赫 | 83.549 | 13 | 96.65 | 100 | 66.464 | 67.294 | 56.036 | 88.4 |
| 3 | Morez Johnson Jr. | 小莫雷兹 约翰逊 | 83.152 | 15 | 89.95 | 100 | 50.475 | 70.064 | 91.743 | 99.12 |
| 4 | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | 82.713 | 12 | 100 | 100 | 94.081 | 26.862 | 34.681 | 100 |
| 5 | Cameron Carr | 卡梅隆 卡尔 | 81.762 | 21 | 69.85 | 100 | 88.416 | 55.663 | 80.524 | 94.283 |

### Pick 13: Miami Heat

- Pool before scoring: 111
- Pool after removal: 110
- Removed prospect id: `yaxel-lendeborg`
- Selection: Yaxel Lendeborg (亚克塞尔 伦德伯格), score 90.774, margin 5.074, low confidence no
- Scoring basis: weights {"consensus":0.2364,"need":0.2818,"player":0.2182,"upside":0.0909,"feature":0.0727,"source":0.1}; needs physical wing, defense, self creation; priority tags two-way, toughness, big wing, frontcourt, forward, size; preference families wing, frontcourt, creation, defense, size.
- Evidence basis: RAG matches 21; trust weight 42; source notes NBA.com official prospects: F, age 23, Michigan, 6-9, 241 lbs, Senior, United States / NBA.com consensus mid-first name / Strong analytics profile / ESPN 2026 NBA draft big board top 100: normalized rank 12; source rank 12; confidence high. / NBA.com consensus lottery cross-check: pick 12, most common 11, 12 (4)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Yaxel Lendeborg | 亚克塞尔 伦德伯格 | 90.774 | 12 | 96.65 | 100 | 100 | 25.117 | 77.64 | 100 |
| 2 | Hannes Steinbach | 汉内斯 施泰因巴赫 | 85.7 | 13 | 100 | 100 | 61.791 | 62.921 | 80.302 | 88.4 |
| 3 | Allen Graves | 阿伦 格雷夫斯 | 84.253 | 17 | 86.6 | 100 | 73.455 | 73.796 | 53.327 | 89.885 |
| 4 | Morez Johnson Jr. | 小莫雷兹 约翰逊 | 81.331 | 15 | 93.3 | 100 | 37.001 | 65.51 | 98.403 | 99.12 |
| 5 | Dailyn Swain | 戴林 斯温 | 79.592 | 23 | 61.7 | 100 | 88.263 | 70.689 | 35.936 | 92.798 |

### Pick 14: Charlotte Hornets

- Pool before scoring: 110
- Pool after removal: 109
- Removed prospect id: `allen-graves`
- Selection: Allen Graves (阿伦 格雷夫斯), score 85.62, margin 0.552, low confidence yes
- Scoring basis: weights {"consensus":0.2385,"need":0.2752,"player":0.2018,"upside":0.1284,"feature":0.0734,"source":0.0826}; needs frontcourt defense, rebounding, finishing; priority tags rim protector, rebounder, finisher; preference families frontcourt, defense.
- Evidence basis: RAG matches 18; trust weight 34.5; source notes NBA.com official prospects: F, age 19, Santa Clara, 6-8, 226 lbs, Freshman, United States / Tankathon No. 21 range / Multi-category forward production / ESPN 2026 NBA draft big board top 100: normalized rank 17; source rank 17; confidence high. / Visible ESPN Big Board profile entry extracted from local raw markdown. ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Allen Graves | 阿伦 格雷夫斯 | 85.62 | 17 | 93.068 | 100 | 73.55 | 75.138 | 53.327 | 90.682 |
| 2 | Hannes Steinbach | 汉内斯 施泰因巴赫 | 85.068 | 13 | 100 | 100 | 60.476 | 64.065 | 80.302 | 89.185 |
| 3 | Dailyn Swain | 戴林 斯温 | 83.032 | 23 | 72.271 | 100 | 92.44 | 71.975 | 35.936 | 93.622 |
| 4 | Morez Johnson Jr. | 小莫雷兹 约翰逊 | 82.738 | 15 | 100 | 100 | 36.246 | 66.702 | 98.403 | 100 |
| 5 | Chris Cenac Jr. | 克里斯 塞纳克 | 78.002 | 19 | 86.136 | 100 | 39.202 | 90.957 | 93.345 | 90.682 |

### Pick 15: Chicago Bulls

- Pool before scoring: 109
- Pool after removal: 108
- Removed prospect id: `cameron-carr`
- Selection: Cameron Carr (卡梅隆 卡尔), score 83.131, margin 0.71, low confidence yes
- Scoring basis: weights {"consensus":0.2273,"need":0.2727,"player":0.1909,"upside":0.1273,"feature":0.1,"source":0.0818}; needs frontcourt depth, shooting, upside; priority tags stretch forward, rebounder, upside, forward, frontcourt, size, defense; preference families shooting, wing, frontcourt, defense, upside_asset, size.
- Evidence basis: RAG matches 29; trust weight 56; source notes NBA.com official prospects: G, age 21, Baylor, 6-5, 184 lbs, Sophomore, United States / Tankathon top-15 range / Consensus late-lottery/mid-first / ESPN 2026 NBA draft big board top 100: normalized rank 21; source rank 21; confidence high. / Visible ESPN Big Board profile entry extracted from local raw markdown. ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Cameron Carr | 卡梅隆 卡尔 | 83.131 | 21 | 79.9 | 100 | 89.601 | 52.046 | 85.871 | 95.119 |
| 2 | Morez Johnson Jr. | 小莫雷兹 约翰逊 | 82.421 | 15 | 100 | 100 | 53.585 | 65.51 | 96.716 | 100 |
| 3 | Chris Cenac Jr. | 克里斯 塞纳克 | 77.522 | 19 | 86.6 | 100 | 64.614 | 89.332 | 74.428 | 90.682 |
| 4 | Dailyn Swain | 戴林 斯温 | 75.549 | 23 | 73.2 | 100 | 99.998 | 70.689 | 44.925 | 93.622 |
| 5 | Hannes Steinbach | 汉内斯 施泰因巴赫 | 73.084 | 13 | 93.3 | 100 | 63.438 | 62.921 | 57.91 | 89.185 |

### Pick 16: Memphis Grizzlies

- Pool before scoring: 108
- Pool after removal: 107
- Removed prospect id: `dailyn-swain`
- Selection: Dailyn Swain (戴林 斯温), score 79.776, margin 0.519, low confidence yes
- Scoring basis: weights {"consensus":0.211,"need":0.3028,"player":0.211,"upside":0.0917,"feature":0.1009,"source":0.0826}; needs rim protection, bench size, defense; priority tags rim protector, size, rebounder; preference families frontcourt, defense, size.
- Evidence basis: RAG matches 19; trust weight 31.5; source notes NBA.com official prospects: F, age 20, Texas, 6-7, 211 lbs, Junior, United States / Appears on NBA.com consensus boards / Tankathon No. 22 range / ESPN 2026 NBA draft big board top 100: normalized rank 23; source rank 23; confidence high. / Visible ESPN Big Board profile entry extracted from local raw markdown. ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Dailyn Swain | 戴林 斯温 | 79.776 | 23 | 76.55 | 100 | 92.44 | 70.689 | 35.936 | 93.622 |
| 2 | Hannes Steinbach | 汉内斯 施泰因巴赫 | 79.257 | 13 | 89.95 | 100 | 60.476 | 62.921 | 80.302 | 89.185 |
| 3 | Morez Johnson Jr. | 小莫雷兹 约翰逊 | 78.515 | 15 | 96.65 | 100 | 36.246 | 65.51 | 98.403 | 100 |
| 4 | Chris Cenac Jr. | 克里斯 塞纳克 | 74.631 | 19 | 89.95 | 100 | 39.202 | 89.332 | 93.345 | 90.682 |
| 5 | Jayden Quaintance | 杰登 昆坦斯 | 68.013 | 22 | 79.9 | 100 | 36.389 | 100 | 68.412 | 86.245 |

### Pick 17: Oklahoma City Thunder

- Pool before scoring: 107
- Pool after removal: 106
- Removed prospect id: `morez-johnson-jr`
- Selection: Morez Johnson Jr. (小莫雷兹 约翰逊), score 83.996, margin 2.067, low confidence no
- Scoring basis: weights {"consensus":0.211,"need":0.2752,"player":0.1927,"upside":0.1193,"feature":0.1009,"source":0.1009}; needs big wing, shooting, stash optionality; priority tags big wing, international, upside; preference families shooting, wing, frontcourt, upside_asset.
- Evidence basis: RAG matches 25; trust weight 50.5; source notes NBA.com official prospects: F-C, age 20, Michigan, 6-9, 250 lbs, Sophomore, United States / NBA.com consensus top-14 in several boards / Clear frontcourt role / ESPN 2026 NBA draft big board top 100: normalized rank 15; source rank 15; confidence high. / NBA.com consensus lottery cross-check: pick 14, most common 14 (8)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Morez Johnson Jr. | 小莫雷兹 约翰逊 | 83.996 | 15 | 96.534 | 100 | 50.475 | 67.305 | 96.716 | 100 |
| 2 | Chris Cenac Jr. | 克里斯 塞纳克 | 81.929 | 19 | 96.534 | 100 | 61.911 | 91.78 | 74.428 | 90.682 |
| 3 | Meleek Thomas | 马利克 托马斯 | 76.422 | 28 | 65.339 | 78.886 | 78.413 | 75.818 | 52.637 | 89.795 |
| 4 | Koa Peat | 科阿 皮特 | 76.145 | 27 | 68.805 | 100 | 64.027 | 70.497 | 56.567 | 90.682 |
| 5 | Isaiah Evans | 以赛亚 埃文斯 | 74.999 | 25 | 75.737 | 99.392 | 70.504 | 59.324 | 52.04 | 90.682 |

### Pick 18: Charlotte Hornets

- Pool before scoring: 106
- Pool after removal: 105
- Removed prospect id: `christian-anderson`
- Selection: Christian Anderson (克里斯蒂安 安德森), score 91.339, margin 0.938, low confidence yes
- Scoring basis: weights {"consensus":0.211,"need":0.3028,"player":0.211,"upside":0.0917,"feature":0.1009,"source":0.0826}; needs guard depth, shooting, secondary creation; priority tags combo guard, shooter, playmaking; preference families guard, shooting, creation.
- Evidence basis: RAG matches 32; trust weight 71; source notes NBA.com official prospects: G, age 20, Texas Tech, 6-1, 180 lbs, Sophomore, United States / Tankathon first-round guard / High playmaking signal / ESPN 2026 NBA draft big board top 100: normalized rank 16; source rank 16; confidence high. / Visible ESPN Big Board profile entry extracted from local raw markdown. ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Christian Anderson | 克里斯蒂安 安德森 | 91.339 | 16 | 96.534 | 100 | 79.881 | 55.153 | 97.02 | 90.682 |
| 2 | Mikel Brown Jr. | 迈克尔 布朗 | 90.401 | 7 | 69.064 | 100 | 100 | 78.457 | 14.836 | 100 |
| 3 | Bennett Stirtz | 本内特 斯特茨 | 86.844 | 20 | 96.534 | 100 | 82.599 | 17.866 | 80.695 | 90.682 |
| 4 | Ebuka Okorie | 埃布卡 奥科里 | 84.984 | 24 | 82.669 | 100 | 70.307 | 73.796 | 66.108 | 90.682 |
| 5 | Meleek Thomas | 马利克 托马斯 | 79.713 | 28 | 68.805 | 100 | 72.768 | 73.796 | 47.362 | 89.795 |

### Pick 19: Toronto Raptors

- Pool before scoring: 105
- Pool after removal: 104
- Removed prospect id: `mikel-brown-jr`
- Selection: Mikel Brown Jr. (迈克尔 布朗), score 80.959, margin 1.604, low confidence no
- Scoring basis: weights {"consensus":0.211,"need":0.3028,"player":0.211,"upside":0.0917,"feature":0.1009,"source":0.0826}; needs connector forward, length, team defense; priority tags versatile forward, defense, passing, frontcourt, creation, shooting; preference families shooting, wing, frontcourt, creation, defense, size.
- Evidence basis: RAG matches 21; trust weight 43.5; source notes NBA.com official prospects: G, age 20, Louisville, 6-5, 180 lbs, Freshman, United States / NBA.com consensus top-ten range / Tankathon guard group / ESPN 2026 NBA draft big board top 100: normalized rank 7; source rank 7; confidence high. / NBA.com consensus lottery cross-check: pick 7, most common 6 (4)..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Mikel Brown Jr. | 迈克尔 布朗 | 80.959 | 7 | 64.3 | 76.247 | 100 | 78.457 | 7.449 | 100 |
| 2 | Chris Cenac Jr. | 克里斯 塞纳克 | 79.355 | 19 | 100 | 100 | 39.202 | 89.332 | 79.514 | 90.682 |
| 3 | Isaiah Evans | 以赛亚 埃文斯 | 78.911 | 25 | 79.9 | 97.608 | 75.676 | 57.742 | 76.761 | 90.682 |
| 4 | Hannes Steinbach | 汉内斯 施泰因巴赫 | 77.334 | 13 | 79.9 | 100 | 60.476 | 62.921 | 74.331 | 89.185 |
| 5 | Meleek Thomas | 马利克 托马斯 | 76.773 | 28 | 69.85 | 92.461 | 72.768 | 73.796 | 44.615 | 89.795 |

### Pick 20: San Antonio Spurs

- Pool before scoring: 104
- Pool after removal: 103
- Removed prospect id: `bennett-stirtz`
- Selection: Bennett Stirtz (本内特 斯特茨), score 88.268, margin 4.602, low confidence no
- Scoring basis: weights {"consensus":0.211,"need":0.3028,"player":0.211,"upside":0.0917,"feature":0.1009,"source":0.0826}; needs shooting guard, secondary handler, spacing; priority tags combo guard, shooter, decision maker, frontcourt, size, shooting; preference families guard, shooting, frontcourt, size.
- Evidence basis: RAG matches 23; trust weight 45.5; source notes NBA.com official prospects: G, age 22, Iowa, 6-3, 186 lbs, Senior, United States / Tankathon first-round range / Ready guard archetype / ESPN 2026 NBA draft big board top 100: normalized rank 20; source rank 20; confidence high. / Visible ESPN Big Board profile entry extracted from local raw markdown. ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Bennett Stirtz | 本内特 斯特茨 | 88.268 | 20 | 100 | 100 | 97.459 | 17.866 | 64.127 | 99.513 |
| 2 | Ebuka Okorie | 埃布卡 奥科里 | 83.666 | 24 | 86.6 | 90.499 | 82.956 | 73.796 | 54.52 | 99.513 |
| 3 | Isaiah Evans | 以赛亚 埃文斯 | 82.577 | 25 | 83.25 | 100 | 89.291 | 57.742 | 63.218 | 99.513 |
| 4 | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | 81.065 | 30 | 66.5 | 100 | 100 | 60.331 | 18.874 | 99.513 |
| 5 | Meleek Thomas | 马利克 托马斯 | 79.62 | 28 | 73.2 | 92.448 | 85.859 | 73.796 | 31.325 | 98.539 |

### Pick 21: Detroit Pistons

- Pool before scoring: 103
- Pool after removal: 102
- Removed prospect id: `isaiah-evans`
- Selection: Isaiah Evans (以赛亚 埃文斯), score 87.917, margin 1.524, low confidence no
- Scoring basis: weights {"consensus":0.211,"need":0.3028,"player":0.211,"upside":0.0917,"feature":0.1009,"source":0.0826}; needs wing shooting, defensive activity, floor spacing; priority tags 3-and-D, wing defender, shooter, guard, wing, shooting, creation; preference families guard, shooting, wing, creation, defense.
- Evidence basis: RAG matches 20; trust weight 34; source notes NBA.com official prospects: G, age 20, Duke, 6-6, 186 lbs, Sophomore, United States / Tankathon No. 25 range / Late-first 3-and-D fit / ESPN 2026 NBA draft big board top 100: normalized rank 25; source rank 25; confidence high. / Visible ESPN Big Board profile entry extracted from local raw markdown. ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Isaiah Evans | 以赛亚 埃文斯 | 87.917 | 25 | 89.602 | 100 | 89.291 | 57.742 | 63.218 | 99.513 |
| 2 | Ebuka Okorie | 埃布卡 奥科里 | 86.393 | 24 | 93.068 | 95 | 82.956 | 73.796 | 54.52 | 99.513 |
| 3 | Meleek Thomas | 马利克 托马斯 | 83.173 | 28 | 79.203 | 100 | 85.859 | 73.796 | 31.325 | 98.539 |
| 4 | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | 79.527 | 30 | 72.271 | 90.9 | 100 | 60.331 | 18.874 | 99.513 |
| 5 | Chris Cenac Jr. | 克里斯 塞纳克 | 70.83 | 19 | 96.534 | 55.38 | 46.254 | 89.332 | 74.531 | 99.513 |

### Pick 22: Philadelphia 76ers

- Pool before scoring: 102
- Pool after removal: 101
- Removed prospect id: `sergio-de-larrea`
- Selection: Sergio De Larrea (塞尔吉奥 德拉雷亚), score 84.071, margin 0.083, low confidence yes
- Scoring basis: weights {"consensus":0.2091,"need":0.3091,"player":0.2273,"upside":0.0545,"feature":0.1,"source":0.1}; needs ready guard, bench creation, shooting; priority tags primary guard, shooter, maturity, forward, size, defense; preference families guard, shooting, wing, creation, defense, size.
- Evidence basis: RAG matches 26; trust weight 71.5; source notes NBA.com official prospects: G, age 20, Vallodolid (Spain), 6-6, 205 lbs, International, Spain / Tankathon No. 30 range / Late-first international guard / ESPN 2026 NBA mock draft projecting 60 picks: normalized rank 30; source rank 30; confidence medium_high. / Supplemental first-round candidate from ESPN final mock because ESPN Big Board ranks 26-100 were not visible. ESPN mock pick 30 to Dallas Mavericks..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | 84.071 | 30 | 73.2 | 100 | 100 | 60.331 | 18.874 | 99.513 |
| 2 | Hannes Steinbach | 汉内斯 施泰因巴赫 | 83.988 | 13 | 71.65 | 100 | 81.269 | 62.921 | 62.081 | 97.87 |
| 3 | Ebuka Okorie | 埃布卡 奥科里 | 80.877 | 24 | 93.3 | 81.432 | 73.791 | 73.796 | 54.52 | 99.513 |
| 4 | Koa Peat | 科阿 皮特 | 77.646 | 27 | 83.25 | 82.282 | 75.787 | 68.617 | 38.886 | 99.513 |
| 5 | Chris Cenac Jr. | 克里斯 塞纳克 | 77.488 | 19 | 89.95 | 92.864 | 51.478 | 89.332 | 74.531 | 99.513 |

### Pick 23: Atlanta Hawks

- Pool before scoring: 101
- Pool after removal: 100
- Removed prospect id: `ebuka-okorie`
- Selection: Ebuka Okorie (埃布卡 奥科里), score 81.915, margin 3.972, low confidence no
- Scoring basis: weights {"consensus":0.211,"need":0.2752,"player":0.1927,"upside":0.1193,"feature":0.1009,"source":0.1009}; needs guard defense, playmaking, depth; priority tags primary guard, defense, pace; preference families guard, creation, defense.
- Evidence basis: RAG matches 21; trust weight 38; source notes NBA.com official prospects: G, age 19, Stanford, 6-1, 186 lbs, Freshman, United States / Tankathon No. 24 range / Scoring guard profile / ESPN 2026 NBA draft big board top 100: normalized rank 24; source rank 24; confidence high. / Visible ESPN Big Board profile entry extracted from local raw markdown. ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Ebuka Okorie | 埃布卡 奥科里 | 81.915 | 24 | 100 | 72.793 | 87.676 | 73.796 | 35.114 | 99.513 |
| 2 | Meleek Thomas | 马利克 托马斯 | 77.943 | 28 | 86.136 | 72.793 | 99.997 | 73.796 | 11.111 | 98.539 |
| 3 | Hannes Steinbach | 汉内斯 施泰因巴赫 | 67.772 | 13 | 71.599 | 34.646 | 84.759 | 62.921 | 63.597 | 97.87 |
| 4 | Chris Cenac Jr. | 克里斯 塞纳克 | 62.701 | 19 | 89.602 | 13.07 | 78.953 | 89.332 | 82.136 | 99.513 |
| 5 | Jayden Quaintance | 杰登 昆坦斯 | 56.531 | 22 | 100 | 13.617 | 75.191 | 100 | 56.661 | 94.644 |

### Pick 24: New York Knicks

- Pool before scoring: 100
- Pool after removal: 99
- Removed prospect id: `hannes-steinbach`
- Selection: Hannes Steinbach (汉内斯 施泰因巴赫), score 91.023, margin 10.535, low confidence no
- Scoring basis: weights {"consensus":0.2091,"need":0.3091,"player":0.2273,"upside":0.0545,"feature":0.1,"source":0.1}; needs bench guard, shooting, toughness; priority tags shooter, maturity, decision maker, frontcourt, size, defense; preference families guard, shooting, frontcourt, defense, size.
- Evidence basis: RAG matches 18; trust weight 31.5; source notes NBA.com official prospects: F-C, age 20, Washington, 6-10, 248 lbs, Freshman, Germany / Consensus mid-first name / Fits international-player milestones / ESPN 2026 NBA draft big board top 100: normalized rank 13; source rank 13; confidence high. / Visible ESPN Big Board profile entry extracted from local raw markdown. ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Hannes Steinbach | 汉内斯 施泰因巴赫 | 91.023 | 13 | 71.543 | 100 | 100 | 62.921 | 62.081 | 97.87 |
| 2 | Koa Peat | 科阿 皮特 | 80.488 | 27 | 96.409 | 69.726 | 93.257 | 68.617 | 38.886 | 99.513 |
| 3 | Henri Veesaar | 亨利 维萨尔 | 79.466 | 26 | 100 | 91.465 | 71.836 | 28.224 | 65.662 | 98.539 |
| 4 | Meleek Thomas | 马利克 托马斯 | 78.94 | 28 | 92.819 | 82.931 | 96.305 | 73.796 | 31.325 | 98.539 |
| 5 | Chris Cenac Jr. | 克里斯 塞纳克 | 76.505 | 19 | 89.228 | 81.449 | 63.344 | 89.332 | 74.531 | 99.513 |

### Pick 25: Los Angeles Lakers

- Pool before scoring: 99
- Pool after removal: 98
- Removed prospect id: `koa-peat`
- Selection: Koa Peat (科阿 皮特), score 90.924, margin 5.615, low confidence no
- Scoring basis: weights {"consensus":0.2091,"need":0.3091,"player":0.2273,"upside":0.0545,"feature":0.1,"source":0.1}; needs wing shooting, size, low-usage defense; priority tags 3-and-D, big wing, off-ball, frontcourt, size; preference families shooting, wing, frontcourt, defense, size.
- Evidence basis: RAG matches 18; trust weight 41; source notes NBA.com official prospects: F, age 19, Arizona, 6-7, 245 lbs, Freshman, United States / Tankathon No. 26 range / Physical forward archetype / ESPN 2026 NBA mock draft projecting 60 picks: normalized rank 27; source rank 26; confidence medium_high. / Supplemental first-round candidate from ESPN final mock because ESPN Big Board ranks 26-100 were not visible. ESPN mock pick 26 to Denver Nuggets..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Koa Peat | 科阿 皮特 | 90.924 | 27 | 96.534 | 100 | 96.833 | 68.617 | 41.295 | 99.513 |
| 2 | Henri Veesaar | 亨利 维萨尔 | 85.309 | 26 | 100 | 99.697 | 74.59 | 28.224 | 92.388 | 98.539 |
| 3 | Chris Cenac Jr. | 克里斯 塞纳克 | 81.918 | 19 | 82.669 | 100 | 65.773 | 89.332 | 79.514 | 99.513 |
| 4 | Meleek Thomas | 马利克 托马斯 | 75.685 | 28 | 93.068 | 65.218 | 99.997 | 73.796 | 44.615 | 98.539 |
| 5 | Tarris Reed Jr. | 小塔里斯 里德 | 74.921 | 29 | 89.602 | 95.915 | 41.318 | 15.277 | 63.157 | 100 |

### Pick 26: Denver Nuggets

- Pool before scoring: 98
- Pool after removal: 97
- Removed prospect id: `henri-veesaar`
- Selection: Henri Veesaar (亨利 维萨尔), score 82.724, margin 3.203, low confidence no
- Scoring basis: weights {"consensus":0.2091,"need":0.3091,"player":0.2273,"upside":0.0545,"feature":0.1,"source":0.1}; needs frontcourt depth, passing feel, rebounding; priority tags connector, rebounder, feel; preference families frontcourt.
- Evidence basis: RAG matches 15; trust weight 32; source notes NBA.com official prospects: C, age 22, North Carolina, 6-11, 227 lbs, Junior, Estonia / Tankathon No. 29 range / International center option / ESPN 2026 NBA mock draft projecting 60 picks: normalized rank 26; source rank 24; confidence medium_high. / Supplemental first-round candidate from ESPN final mock because ESPN Big Board ranks 26-100 were not visible. ESPN mock pick 24 to New York Knicks..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Henri Veesaar | 亨利 维萨尔 | 82.724 | 26 | 100 | 96.163 | 74.59 | 28.224 | 77.462 | 98.539 |
| 2 | Chris Cenac Jr. | 克里斯 塞纳克 | 79.521 | 19 | 76.55 | 91.91 | 65.773 | 89.332 | 93.345 | 99.513 |
| 3 | Tarris Reed Jr. | 小塔里斯 里德 | 75.99 | 29 | 89.95 | 92.644 | 41.318 | 15.277 | 83.23 | 100 |
| 4 | Jayden Quaintance | 杰登 昆坦斯 | 72.503 | 22 | 86.6 | 90.976 | 63.868 | 100 | 68.412 | 94.644 |
| 5 | Malachi Moreno | 马拉奇 莫雷诺 | 71.86 | 34 | 73.2 | 93.648 | 49.513 | 91.921 | 69.654 | 43.761 |

### Pick 27: Boston Celtics

- Pool before scoring: 97
- Pool after removal: 96
- Removed prospect id: `chris-cenac-jr`
- Selection: Chris Cenac Jr. (克里斯 塞纳克), score 81.463, margin 3.167, low confidence no
- Scoring basis: weights {"consensus":0.2091,"need":0.3091,"player":0.2273,"upside":0.0545,"feature":0.1,"source":0.1}; needs switchable forward, shooting, defensive depth; priority tags two-way, big wing, shooter; preference families shooting, wing, frontcourt, defense.
- Evidence basis: RAG matches 27; trust weight 48; source notes NBA.com official prospects: F-C, age 19, Houston, 6-11, 240 lbs, Freshman, United States / Tankathon top-20 frontcourt prospect / Useful late-lottery big target / ESPN 2026 NBA draft big board top 100: normalized rank 19; source rank 19; confidence high. / Visible ESPN Big Board profile entry extracted from local raw markdown. ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Chris Cenac Jr. | 克里斯 塞纳克 | 81.463 | 19 | 76.668 | 100 | 65.773 | 89.332 | 79.514 | 99.513 |
| 2 | Meleek Thomas | 马利克 托马斯 | 78.296 | 28 | 100 | 68.976 | 99.997 | 73.796 | 44.615 | 98.539 |
| 3 | Tarris Reed Jr. | 小塔里斯 里德 | 74.935 | 29 | 96.534 | 91.272 | 41.318 | 15.277 | 63.157 | 100 |
| 4 | Jayden Quaintance | 杰登 昆坦斯 | 73.325 | 22 | 86.136 | 100 | 63.868 | 100 | 49.716 | 94.644 |
| 5 | Ugonna Onyenso | 乌戈纳 奥尼恩索 | 73.273 | 41 | 54.941 | 97.932 | 63.996 | 48.162 | 89.635 | 53.804 |

### Pick 28: Minnesota Timberwolves

- Pool before scoring: 96
- Pool after removal: 95
- Removed prospect id: `meleek-thomas`
- Selection: Meleek Thomas (马利克 托马斯), score 85.746, margin 25.172, low confidence no
- Scoring basis: weights {"consensus":0.2091,"need":0.3091,"player":0.2273,"upside":0.0545,"feature":0.1,"source":0.1}; needs combo guard, bench scoring, point-of-attack defense; priority tags combo guard, shot creator, defense, guard, creation; preference families guard, creation, defense.
- Evidence basis: RAG matches 15; trust weight 32; source notes NBA.com official prospects: G-F, age 19, Arkansas, 6-3, 190 lbs, Freshman, United States / Tankathon No. 28 range / Late-first scoring guard / ESPN 2026 NBA mock draft projecting 60 picks: normalized rank 28; source rank 27; confidence medium_high. / Supplemental first-round candidate from ESPN final mock because ESPN Big Board ranks 26-100 were not visible. ESPN mock pick 27 to Boston Celtics..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Meleek Thomas | 马利克 托马斯 | 85.746 | 28 | 100 | 97.38 | 99.997 | 73.796 | 31.325 | 98.539 |
| 2 | Ryan Conwell | 莱恩 康韦尔 | 60.574 | 49 | 27.4 | 95.033 | 42.952 | 43.76 | 80.898 | 59.83 |
| 3 | Jack Kayil | 杰克 卡伊尔 | 59.196 | 35 | 76.55 | 78.508 | 34.733 | 84.93 | 18.874 | 45.1 |
| 4 | Kylan Boswell | 凯兰 博斯韦尔 | 57.921 | 37 | 69.85 | 78.632 | 38.435 | 59.814 | 23.024 | 47.109 |
| 5 | Josh Dix | 约什 迪克斯 | 56.72 | 38 | 66.5 | 80.116 | 48.913 | 59.814 | 16.316 | 40.414 |

### Pick 29: Cleveland Cavaliers

- Pool before scoring: 95
- Pool after removal: 94
- Removed prospect id: `tarris-reed-jr`
- Selection: Tarris Reed Jr. (小塔里斯 里德), score 83.669, margin 3.785, low confidence no
- Scoring basis: weights {"consensus":0.2091,"need":0.3091,"player":0.2273,"upside":0.0545,"feature":0.1,"source":0.1}; needs center depth, size, finishing; priority tags rim protector, size, finisher; preference families frontcourt, size.
- Evidence basis: RAG matches 22; trust weight 38.5; source notes NBA.com official prospects: C, age 22, Connecticut, 6-10, 260 lbs, Senior, United States / ESPN 2026 NBA mock draft projecting 60 picks: normalized rank 29; source rank 29; confidence medium_high. / Supplemental first-round candidate from ESPN final mock because ESPN Big Board ranks 26-100 were not visible. ESPN mock pick 29 to Cleveland Cavaliers. / needs_review: generated conservative DraftOps profile from normalized source row; manual player-image/profile review required. / needs_review: normalized source did not provide height; placeholder retained..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Tarris Reed Jr. | 小塔里斯 里德 | 83.669 | 29 | 100 | 100 | 55.856 | 15.277 | 83.23 | 100 |
| 2 | Malachi Moreno | 马拉奇 莫雷诺 | 79.884 | 34 | 83.25 | 100 | 66.934 | 91.921 | 69.654 | 43.761 |
| 3 | Ugonna Onyenso | 乌戈纳 奥尼恩索 | 79.636 | 41 | 59.8 | 100 | 86.514 | 48.162 | 85.537 | 53.804 |
| 4 | Jayden Quaintance | 杰登 昆坦斯 | 78.298 | 22 | 76.55 | 100 | 86.34 | 100 | 68.412 | 94.644 |
| 5 | Tobe Awaka | 托比 阿瓦卡 | 75.148 | 45 | 46.4 | 100 | 86.529 | 41.17 | 79.148 | 47.109 |

### Pick 30: Dallas Mavericks

- Pool before scoring: 94
- Pool after removal: 93
- Removed prospect id: `tyler-bilodeau`
- Selection: Tyler Bilodeau (泰勒 比洛多), score 73.968, margin 3.066, low confidence no
- Scoring basis: weights {"consensus":0.2091,"need":0.3091,"player":0.2273,"upside":0.0545,"feature":0.1,"source":0.1}; needs big guard, shooting, secondary ball handling; priority tags combo guard, international, shooter; preference families guard, shooting, frontcourt.
- Evidence basis: RAG matches 10; trust weight 23.5; source notes NBA.com official prospects: F, age 22, UCLA, 6-8, 228 lbs, Senior, United States / Expanded-pool fallback profile: no full DraftOps scouting profile in original 30-player bundle. / Fallback consensusRank 46 derived deterministically from media mention count, age, and official row order; media mention count 1. / Local 124-player pool match: row 41, 泰勒 比洛多; method=name-translation..

| Rank | Player | Local name | Score | Consensus | Rel consensus | Rel need | Rel player | Rel upside | Rel feature | Rel source |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Tyler Bilodeau | 泰勒 比洛多 | 73.968 | 46 | 51.584 | 100 | 80.653 | 41.17 | 81.296 | 59.678 |
| 2 | Ugonna Onyenso | 乌戈纳 奥尼恩索 | 70.902 | 41 | 70.206 | 75.474 | 86.514 | 48.162 | 55.202 | 56.849 |
| 3 | Jack Kayil | 杰克 卡伊尔 | 68.288 | 35 | 92.551 | 98.935 | 46.954 | 84.93 | 18.874 | 47.653 |
| 4 | Vsevolod Ishchenko | 弗塞沃落德 伊先科 | 65.969 | 39 | 77.654 | 100 | 61.627 | 68.876 | 16.316 | 41.286 |
| 5 | Mohammad Amini | 穆罕默德 阿米尼 | 65.234 | 36 | 88.827 | 98.761 | 49.799 | 68.876 | 16.316 | 41.286 |

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
| 22 | Philadelphia 76ers | Ebuka Okorie | 埃布卡 奥科里 | Sergio De Larrea | 塞尔吉奥 德拉雷亚 |
| 23 | Atlanta Hawks | Meleek Thomas | 马利克 托马斯 | Ebuka Okorie | 埃布卡 奥科里 |
| 24 | New York Knicks | Koa Peat | 科阿 皮特 | Hannes Steinbach | 汉内斯 施泰因巴赫 |
| 25 | Los Angeles Lakers | Henri Veesaar | 亨利 维萨尔 | Koa Peat | 科阿 皮特 |
| 26 | Denver Nuggets | Sergio De Larrea | 塞尔吉奥 德拉雷亚 | Henri Veesaar | 亨利 维萨尔 |
| 27 | Boston Celtics | Tarris Reed Jr. | 小塔里斯 里德 | Chris Cenac Jr. | 克里斯 塞纳克 |
| 28 | Minnesota Timberwolves | Jayden Quaintance | 杰登 昆坦斯 | Meleek Thomas | 马利克 托马斯 |
| 29 | Cleveland Cavaliers | Malachi Moreno | 马拉奇 莫雷诺 | Tarris Reed Jr. | 小塔里斯 里德 |
| 30 | Dallas Mavericks | Jack Kayil | 杰克 卡伊尔 | Tyler Bilodeau | 泰勒 比洛多 |
