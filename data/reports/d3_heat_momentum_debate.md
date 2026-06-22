# D3 热度 / 行情动量参数辩论报告

生成时间: 2026-06-22 +08:00

范围: 从媒体热度、`mockHeat`、近期媒体一致性、升降趋势、进入乐透频率和首轮支持角度，为 DraftOps 提出参数方案。本报告只做数据分析并生成报告文件，不修改源码，也不修改模型输入 JSON。

## 输入数据

- `data/normalized/normalized_2026_mock_lottery.json`
- `data/normalized/normalized_2026_prospect_big_board.json`
- `data/final/final_import_bundle.json`
- `data/raw/external_source_inventory.json`

关键本地事实:

- The mock lottery file contains 140 rows: 10 media sources times 14 lottery picks.
- NBA.com consensus covers 14 lottery players and includes most-common pick vote density.
- ESPN Big Board is visible only for ranks 1-25 in the current extraction. Ranks 26-30 in the final bundle are ESPN final mock supplements, not confirmed ESPN Big Board ranks.
- The 10-source mock data can strictly measure lottery frequency. It cannot strictly measure full 10-source first-round frequency because only lottery rows were normalized.

## 热度如何计算

D3 should treat `mockHeat` as a media-market confidence score, not as a pure talent grade and not as a simple copy of `consensusRank`.

Recommended `mockHeat` components:

```text
mockHeat =
  30% weighted lottery frequency
+ 22% NBA.com consensus slot and vote density
+ 18% weighted lottery pick quality
+ 12% recent consistency and trend
+ 10% ESPN final mock first-round support
+  8% ESPN Big Board gate
```

Component definitions:

- Weighted lottery frequency: sum of source weights for every source that places the player in the lottery, divided by the total 10-source weight.
- NBA.com consensus slot and vote density: use NBA.com consensus as an official aggregator anchor, but do not count it as an 11th independent mock. Reward higher slots and stronger most-common vote counts.
- Weighted lottery pick quality: weighted average lottery pick, where No. 1 is strongest and No. 14 remains positive but lower.
- Recent consistency and trend: compare recent sources from 2026-06-14 onward against older rows. Reward high appearance count, low pick dispersion, and recent average moving upward.
- ESPN final mock first-round support: confirms first-round plausibility for players outside the lottery rows.
- ESPN Big Board gate: validates talent quality and reduces false negatives for ESPN top-25 players, but should not by itself create lottery heat.

Operational caps:

- 10/10 lottery appearance plus NBA.com and ESPN agreement can reach `mockHeat` 90-100.
- 8-10/10 lottery appearance with wider dispersion should usually sit around 75-90.
- 4-6/10 lottery appearance should be treated as volatile heat unless NBA.com vote density is also strong.
- 0/10 lottery appearance but ESPN Big Board top-25 and ESPN mock first round should be first-round support, not lottery heat; cap around 45-60.
- ESPN mock-only ranks 26-30 with no visible ESPN Big Board rank should be capped around 30-42 until another source confirms them.

## NBA.com consensus 与 ESPN Big Board 如何融合

Use NBA.com consensus as the projection anchor and ESPN Big Board as the talent/board-quality gate.

Recommended fusion for a media projection rank:

```text
projectionRank =
  45% NBA.com consensus pick, when present
+ 25% weighted 10-source lottery average
+ 20% ESPN final mock pick
+ 10% ESPN Big Board rank
```

For players outside NBA.com consensus lottery:

```text
projectionRank =
  55% ESPN final mock pick
+ 35% ESPN Big Board rank, when visible
+ 10% current final-bundle rank as a placeholder tie-breaker
```

Interpretation rules:

- If NBA.com consensus and ESPN Big Board are within roughly 2 slots, treat the heat as stable.
- If NBA.com consensus is strong but ESPN Big Board is weaker, keep the player in the lottery mix but review whether the heat is team-fit driven.
- If ESPN Big Board is strong but NBA.com consensus and the 10-source lottery rows are absent, call it first-round support, not broad media heat.
- If ESPN final mock and ESPN Big Board agree but no other mock source appears, the player is ESPN-supported only and should not overpower multi-source players.

## 10 家媒体 mock 如何给权重

These weights apply only to the 10 lottery mock rows embedded in the normalized file. They sum to 1.00.

| Source | Date in data | D3 weight | Reason |
| --- | ---: | ---: | --- |
| ESPN.com | 2026-06-15 | 0.14 | High-credibility major mock and also linked to the ESPN final mock context. |
| Yahoo Sports | 2026-06-17 | 0.13 | Fresh major-media mock. |
| CBS Sports | 2026-06-17 | 0.13 | Fresh major-media mock; keep as one CBS-family signal. |
| The Athletic | 2026-06-08 | 0.12 | High-quality expert signal, slightly older than the freshest mocks. |
| USA Today / For the Win | 2026-06-15 | 0.10 | Fresh major-media source, useful supporting signal. |
| The Ringer | 2026-05-27 | 0.09 | High-quality draft guide, but older than the June cluster. |
| Bleacher Report | 2026-06-16 | 0.08 | Fresh, but source inventory weights it below ESPN/CBS/Yahoo/Athletic/Ringer. |
| NetScouts Basketball | 2026-06-14 | 0.08 | Specialist source, useful but below major-media anchors. |
| SB Nation | 2026-06-08 | 0.07 | Older and more rumor-driven context. |
| Hoops HQ | 2026-05-29 | 0.06 | Older lottery mock; keep but downweight. |

## 哪些球员热度最稳

The strongest stable heat group is clear:

| Tier | Players | Evidence |
| --- | --- | --- |
| Hard top-four locks | AJ Dybantsa, Darryn Peterson, Cameron Boozer, Caleb Wilson | All are 10/10 lottery appearances. AJ is 10/10 at pick 1. Caleb is 10/10 at pick 4. Darryn and Boozer only move between picks 2-3. NBA.com and ESPN agree on the top-four cluster. |
| Stable top-seven heat | Keaton Wagler, Darius Acuff Jr., Mikel Brown Jr. | All are 10/10 lottery appearances and ESPN Big Board/mock ranks 5-7. Keaton has a wider 5-9 range but recent average improved. |
| Strong lottery heat, order still debatable | Brayden Burries, Kingston Flemings, Yaxel Lendeborg | Brayden is 10/10 and rising in recent mocks, stronger than his current bundle `mockHeat` implies. Kingston is 9/10 but slightly softer recently. Yaxel is 10/10 but late-lottery range. |
| Watch-list lottery heat | Aday Mara, Nate Ament, Morez Johnson Jr. | Aday and Nate are still ESPN/NBA-supported but recent average moved down. Morez is only 8/10, but the range is tightly 13-14 and NBA.com has strong common-pick density at 14. |

Recent movement from the 10-source rows:

- Rising or firming: Karim Lopez (+1.8 average slots, but only 5 total lottery appearances), Brayden Burries (+0.9), Keaton Wagler (+0.8), Mikel Brown Jr. (+0.4), Darius Acuff Jr. (+0.3), Cameron Boozer (+0.3).
- Flat: AJ Dybantsa, Caleb Wilson, Hannes Steinbach, Morez Johnson Jr.
- Softening: Aday Mara (-1.8), Labaron Philon Jr. (-1.5), Nate Ament (-1.1), Kingston Flemings (-0.8), Darryn Peterson (-0.3, not material because he remains a top-two lock).

ESPN Big Board movement should be treated separately from mock heat:

- Up on ESPN board: Darryn Peterson (+1), Hannes Steinbach (+2), Christian Anderson (+2), Chris Cenac Jr. (+2), Ebuka Okorie (+3).
- Down on ESPN board: AJ Dybantsa (-1), Karim Lopez (-1), Morez Johnson Jr. (-1), Labaron Philon Jr. (-2), Bennett Stirtz (-1), Cameron Carr (-1), Isaiah Evans (-1).
- This is talent-board momentum. It should help first-round confidence but should not override broad mock frequency.

## 哪些是假热 / 样本不足

These are not automatic removals. They are players whose current heat should be capped or labeled as sample-limited.

| Player | Current concern |
| --- | --- |
| Hannes Steinbach | ESPN Big Board rank 13 and ESPN mock 15 are strong, but he is not in NBA.com consensus lottery and has only 4/10 lottery appearances. Treat as ESPN-supported, not a full lottery lock. |
| Karim Lopez | Has NBA.com consensus pick 13 and recent improvement, but only 5/10 lottery appearances and NBA.com most-common vote count is only 2. Moderate heat, not stable heat. |
| Labaron Philon Jr. | 3/10 lottery appearances and recent average moved down. ESPN first-round support remains useful, but broad heat is thin. |
| Cameron Carr | 2/10 lottery appearances, recent support weaker, and ESPN Big Board rank 21. Do not let a few lottery rows overstate him. |
| Dailyn Swain | 1/10 lottery appearance and no recent lottery-row appearance. ESPN mock/top-25 support is first-round context, not heat. |
| Jayden Quaintance | 1/10 lottery appearance, no recent lottery-row appearance, ESPN mock 25. Keep medical/profile review separate from heat. |
| Christian Anderson | 0/10 lottery rows, but ESPN Big Board/mock both place him 16. First-round plausible, lottery heat absent. |
| Allen Graves, Chris Cenac Jr., Bennett Stirtz | 0/10 lottery rows, visible ESPN Big Board top 20-21 and ESPN mock support. Treat as ESPN-backed first-round candidates, not multi-source heat candidates. |
| Ebuka Okorie, Isaiah Evans | 0/10 lottery rows and back-end ESPN support. Keep heat below the 60 range unless another source confirms. |
| Henri Veesaar, Koa Peat, Meleek Thomas, Tarris Reed Jr., Sergio De Larrea | ESPN mock-only supplements in current normalized data, with no visible ESPN Big Board rank. Cap heat until full first-round source coverage is extracted. |

## 建议权重

D3 debate winner:

```json
{
  "consensus": 46,
  "need": 12,
  "player": 14,
  "upside": 4,
  "intel": 24
}
```

Reasoning:

- `consensus + intel = 70`, so the board is controlled by media projection and `mockHeat`.
- `intel` is higher than the existing consensus-heavy setup because D3 is specifically modeling recent mock velocity and source density.
- `consensus` remains higher than `intel` because NBA.com consensus and ESPN ranks are more stable than a single late mock swing.
- `need` is intentionally low because team-fit evidence is outside D3's mandate and the final bundle already flags many team rows for review.
- `player` stays meaningful so ESPN Big Board and player quality can break ties after the media heat cluster.
- `upside` stays low to avoid double-counting hype already embedded in media mocks and Big Boards.

Alternative guardrails:

| Scenario | Weights | Use only when |
| --- | --- | --- |
| D3 conservative heat | C50/N13/P14/U4/I19 | You want to stay closer to NBA.com consensus and avoid overreacting to recent movement. |
| D3 debate winner | C46/N12/P14/U4/I24 | Best current balance for this dataset. |
| D3 aggressive late heat | C40/N10/P12/U3/I35 | Only after refreshed full first-round mocks from multiple sources, ideally within 24 hours of draft lock. |

## 参数结论

Use `46/12/14/4/24` as D3's recommended heat/momentum parameter set.

Do not bulk-overwrite the final bundle from this report alone. The concrete data recommendations are:

- Raise the review priority of Brayden Burries and Morez Johnson Jr. relative to their current `mockHeat`, because their lottery frequency and stability are stronger than nearby players.
- Do not treat Hannes Steinbach, Karim Lopez, Labaron Philon Jr., Cameron Carr, Dailyn Swain, or Jayden Quaintance as equally stable lottery heat despite ESPN support.
- Keep Christian Anderson through Isaiah Evans as first-round candidates, but label them ESPN-supported rather than broad media-consensus supported.
- Treat ranks 26-30 as sample-limited until the project has normalized full first-round rows from more than ESPN final mock.
