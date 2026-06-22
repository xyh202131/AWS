# A6 Consensus Parameter Debate

Generated at: 2026-06-22 +08:00

Scope: recommend a media-consensus-first weight set for selecting the most likely first-round 30 from the NBA.com official 101-player pool. This report only analyzes current data and parameters. It does not modify source code, model weights, or `data/final/final_import_bundle.json`.

## Inputs Reviewed

- `data/final/final_import_bundle.json`: 30 final candidates, all reconciled against the NBA.com official 101 prospect list.
- `data/normalized/normalized_2026_mock_lottery.json`: NBA.com consensus lottery and 140 rows from 10 listed media mocks, 14 picks per source.
- `data/normalized/normalized_2026_prospect_big_board.json`: ESPN Big Board visible ranks 1-25 plus ESPN final mock first-round supplement for 26-30.
- `data/reports/weight_scenarios.json`: baseline, consensus-heavy, team-need-heavy, and late-intel-heavy scenarios.
- `src/lib/prediction.ts`: adaptive scoring model and risk penalties.

## Recommended Weights

Recommended base weights:

```json
{
  "consensus": 55,
  "need": 14,
  "player": 14,
  "upside": 4,
  "intel": 13
}
```

The numbers sum to 100 for readability, but the app does not require that. `prediction.ts` first adjusts the base weights by draft zone and team phase, then normalizes the adjusted values. So the important point is the ratio: `consensus + intel = 68`, meaning media-derived rank/heat controls about two thirds of the decision before adaptive adjustments.

This is more consensus-driven than the existing `consensus-heavy` scenario (`50/20/15/5/10`) without pushing `consensus` so high that the model blindly overfits the final bundle's `consensusRank`. In a test run, `consensus: 58` was high enough to flip pick 1 to Darryn Peterson because his final bundle rank is 1, even though NBA.com consensus and ESPN mock both have AJ Dybantsa at 1. The 55/14/14/4/13 mix preserves that broader mock consensus.

Expected adaptive shape:

- Top-five rebuild pick: roughly `C62/N11/P12/U16/I13`.
- Lottery accelerate pick: roughly `C52/N23/P19/U4/I13`.
- Late-first contend pick: roughly `C51/N26/P24/U1/I15`.

That still lets late teams select plausible positional fits, but prevents weak team-need tags from overpowering stronger media information.

## Why This Should Improve First-Round Accuracy

The target is "most likely first round", not pure best-player ranking and not a team-specific scouting board. Current team need data has known uncertainty: the final bundle marks 15 teams as needing review, while the media data has stronger coverage for the lottery and ESPN coverage for the full first round. A media-heavy ratio is therefore safer.

`consensus` should be the dominant term because the current candidate pool is already built from ESPN Big Board, ESPN mock, and NBA.com consensus. `intel` should stay meaningful because `mockHeat` captures media velocity and source density. `need` and `player` should remain present but secondary: they keep the greedy board from making absurd team fits, yet they should not promote a weakly sourced player over a broadly mocked one. `upside` should be low because high-upside narratives are already embedded in the mock and big-board data; double-counting upside would add noise.

This also handles the 26-30 problem better. ESPN Big Board ranks 26-100 were not visible, so the last five candidates are ESPN mock supplements only. A high `intel` value recognizes their ESPN first-round projection, but the lower `upside` and moderate `player` weights stop them from becoming false locks.

## Consensus Strong Locks

These players are strongest from a media-consensus perspective:

| Tier | Players | Evidence |
| --- | --- | --- |
| Hard top-four locks | AJ Dybantsa, Darryn Peterson, Cameron Boozer, Caleb Wilson | All appear in 10/10 media mocks. AJ is NBA.com consensus No. 1 with 10 votes and ESPN mock No. 1. Darryn is ESPN Big Board No. 1 and NBA.com consensus No. 2. Boozer and Wilson are stable at 3 and 4 across NBA.com, ESPN mock, and ESPN Big Board. |
| Strong lottery locks | Keaton Wagler, Darius Acuff Jr., Mikel Brown Jr., Kingston Flemings, Brayden Burries, Aday Mara, Nate Ament, Yaxel Lendeborg | All have ESPN Big Board top-12 placement, ESPN mock top-12 placement, and NBA.com consensus lottery support. Most have 8-10 appearances in the 10 mock rows. |
| First-round locks, order less stable | Morez Johnson Jr., Karim Lopez | Both are in NBA.com consensus lottery and ESPN first-round data. Morez has stronger 10-mock density; Karim has NBA.com consensus pick 13 and international/wing value. |
| ESPN-first-round strong but not media-wide locked | Hannes Steinbach, Labaron Philon Jr., Cameron Carr | Hannes is ESPN Big Board 13 and appears in 4/10 lottery mocks. Labaron and Cameron Carr have some lottery mock support plus ESPN first-round placement, but they are not in NBA.com consensus lottery. |

## Final-30 Risk Flags

These players are in the current final 30, but their first-round confidence should be treated as lower:

| Player | Risk reason |
| --- | --- |
| Hannes Steinbach | Final rank 13 is aggressive because he is not in NBA.com consensus lottery; support is ESPN Big Board 13, ESPN mock 15, and 4/10 lottery mock appearances. |
| Christian Anderson | ESPN Big Board/mock both place him 16, but he has no NBA.com consensus lottery row and no 10-mock lottery appearances. |
| Allen Graves | ESPN Big Board 17 but ESPN mock 20; no NBA.com consensus lottery row and no 10-mock lottery appearances. |
| Chris Cenac Jr. | ESPN Big Board/mock both around 19, but no NBA.com consensus lottery support. |
| Bennett Stirtz | ESPN Big Board 20 and ESPN mock 21; no NBA.com consensus lottery support. |
| Jayden Quaintance | ESPN Big Board 22 and ESPN mock 25, but the final profile carries "Medical review" and only 1/10 lottery mock appearance. |
| Dailyn Swain | ESPN Big Board 23 and ESPN mock 22, but only 1/10 lottery mock appearance. |
| Ebuka Okorie | ESPN Big Board 24 but ESPN mock 28; no NBA.com consensus lottery support. |
| Isaiah Evans | ESPN mock 23 and ESPN Big Board 25, but no NBA.com consensus lottery support and `mockHeat` is only 45. |
| Henri Veesaar | ESPN mock 24, but no visible ESPN Big Board rank because ranks 26-100 were not extracted; `mockHeat` drops to 39. |
| Koa Peat | ESPN mock 26 only in current normalized data; no NBA.com consensus lottery or visible ESPN Big Board rank. |
| Meleek Thomas | ESPN mock 27 only in current normalized data; no NBA.com consensus lottery or visible ESPN Big Board rank. |
| Tarris Reed Jr. | ESPN mock 29 only, `mockHeat` 32, and the final bundle marks his profile as generated/conservative because no seed profile match existed. |
| Sergio De Larrea | ESPN mock 30 only, no visible ESPN Big Board rank, no NBA.com consensus lottery support, and lowest `mockHeat` in final 30. |

## Recommended Order Adjustments

Yes, the current final-30 order should be adjusted for a media-consensus review board. These are recommendations only; do not write them into the final bundle without a separate decision.

Suggested media-consensus order:

| Suggested | Player | Main adjustment |
| --- | --- | --- |
| 1 | AJ Dybantsa | Move above Darryn. NBA.com consensus is unanimous at No. 1 across the 10 mock rows and ESPN mock also has him No. 1. |
| 2 | Darryn Peterson | Keep top two. ESPN Big Board No. 1, NBA.com consensus No. 2, ESPN mock No. 2. |
| 3 | Cameron Boozer | Stable across NBA.com consensus, ESPN Big Board, and ESPN mock. |
| 4 | Caleb Wilson | Stable No. 4 across the major signals. |
| 5 | Keaton Wagler | Strong top-five/top-nine media range, ESPN Big Board/mock No. 5. |
| 6 | Darius Acuff Jr. | Strong top-seven media range, ESPN Big Board/mock No. 6. |
| 7 | Mikel Brown Jr. | Strong lottery support, ESPN Big Board/mock No. 7. |
| 8 | Kingston Flemings | Keep ahead of later frontcourt fits because ESPN and NBA.com both place him around 8. |
| 9 | Brayden Burries | Move above Nate/Aday cluster because NBA.com consensus is 9, ESPN mock is 9, and he appears in 10/10 mocks. |
| 10 | Aday Mara | NBA.com consensus 10, ESPN Big Board 10, ESPN mock 11. |
| 11 | Nate Ament | ESPN Big Board 9 and ESPN mock 10, but NBA.com consensus row is 11 with a wider 6-12 source range. |
| 12 | Yaxel Lendeborg | Strong 10/10 lottery mock support and ESPN/NBA consensus around 12. |
| 13 | Morez Johnson Jr. | Stronger first-round lock than Hannes because NBA.com consensus has him at 14 with 8 common-pick votes and ESPN mock has him 13. |
| 14 | Karim Lopez | Keep in the 13-14 cluster; NBA.com consensus row 13 and ESPN mock 14. |
| 15 | Hannes Steinbach | Move down from current final rank 13 because he lacks NBA.com consensus lottery status. |
| 16 | Christian Anderson | ESPN Big Board/mock both 16, but no broader lottery consensus. |
| 17 | Labaron Philon Jr. | Bump near Christian because he has ESPN mock 17 and 3/10 lottery mock appearances. |
| 18 | Cameron Carr | Bump above the pure ESPN-only cluster because ESPN mock is 18 and he has 2/10 lottery mock appearances. |
| 19 | Chris Cenac Jr. | ESPN Big Board/mock around 19. |
| 20 | Allen Graves | ESPN Big Board 17 but ESPN mock 20 and no lottery mock support. |
| 21 | Bennett Stirtz | ESPN Big Board 20, ESPN mock 21. |
| 22 | Dailyn Swain | ESPN mock 22 and one lottery mock appearance. |
| 23 | Isaiah Evans | ESPN mock 23 and ESPN Big Board 25; keep ahead of the pure supplemental tail. |
| 24 | Jayden Quaintance | ESPN Big Board 22 but medical review warrants a lower risk-adjusted slot. |
| 25 | Ebuka Okorie | ESPN Big Board 24 but ESPN mock 28; weaker mock support than Isaiah/Dailyn. |
| 26 | Henri Veesaar | ESPN mock 24, but no visible ESPN Big Board rank in current extraction. |
| 27 | Koa Peat | ESPN mock 26 only in normalized current data. |
| 28 | Meleek Thomas | ESPN mock 27 only in normalized current data. |
| 29 | Tarris Reed Jr. | ESPN mock 29 plus generated-profile review flag. |
| 30 | Sergio De Larrea | ESPN mock 30 only; lowest current `mockHeat`. |

## Parameter Decision

Use `55/14/14/4/13` as the debate winner for a consensus-first first-round board. It is conservative enough to favor NBA.com consensus, the 10 media mocks, ESPN Big Board, and ESPN mock, while still leaving just enough team/player structure to avoid a mechanically sorted list. The main manual review should focus on picks 13-15 and 22-30.
