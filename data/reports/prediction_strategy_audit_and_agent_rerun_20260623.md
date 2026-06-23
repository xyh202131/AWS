# Prediction Strategy Audit and Agent Rerun

Generated: 2026-06-23T06:15:01Z

Scope: audit every currently configured prediction strategy and rerun the official Agent board pipeline. This report does not manually select, replace, lock, or reorder any player.

## Inputs

- `src/lib/prediction.ts`
- `public/data/final_import_bundle.json`
- `data/reports/weight_scenarios.json`
- `scripts/regenerate-board.mjs`

## Blocking Addendum: Candidate Pool Is Too Narrow

After the pick 30 review, the candidate-pool boundary was rechecked.

Current counts:

| Source | Prospect rows used by current board pipeline |
|---|---:|
| `public/data/final_import_bundle.json` | 30 |
| `data/final/final_import_bundle.json` | 30 |
| `data/clean/clean_prospects.json` | 30 |
| `data/normalized/normalized_2026_prospect_big_board.json` | 30 |
| NBA.com official prospects capture | 101 |

This means the current `board:regen` pipeline is not selecting the first round from the full 101-player official prospect universe. It is assigning 30 picks from a preselected 30-player pool. As a result, pick 30 has no true alternative candidates inside the runnable model: after 29 greedy selections, only one prospect remains.

This does not prove the pick 30 player is wrong, and it does not authorize a manual replacement. It does mean the current model cannot honestly audit pick 30 until the candidate pool is expanded beyond 30 and the board is rerun from that expanded structured pool.

Revised lock status:

- Current board remains a valid regeneration of the existing 30-player bundle.
- Current board is not a valid final lock under the stricter multi-agent standard.
- Pick 30 review is blocked until the prediction pipeline uses at least a broader first-round candidate pool, preferably official 101 with source-confidence and profile fallbacks, or a documented top-60/top-75 derived pool.

## Current Runnable Strategies

`weight_scenarios.json` currently defines four runnable strategies:

| Strategy | Weights | Intended use |
|---|---|---|
| `baseline` | C35 / N25 / P20 / U10 / I10 | Default first board before late breaking news |
| `consensus-heavy` | C50 / N20 / P15 / U5 / I10 | When latest mock drafts are stable and team-specific data is weak |
| `team-need-heavy` | C28 / N38 / P21 / U8 / I5 | When team needs and priority tags have been reviewed |
| `late-intel-heavy` | C30 / N18 / P15 / U7 / I30 | Final hours with reliable updated mockHeat, medical, workout, or trade signals |

## Strategy Audit Summary

| Strategy | Health | Avg confidence | Low confidence | Narrow margins | Changed slots vs baseline | Spearman vs baseline | Audit verdict |
|---|---|---:|---:|---:|---:|---:|---|
| `baseline` | PASS | 84 | 1 | 7 | 0 | 1.0000 | Current safest lock candidate |
| `consensus-heavy` | PASS | 84 | 2 | 8 | 11 | 0.9840 | Too many slot changes for direct lock |
| `team-need-heavy` | PASS | 86 | 2 | 7 | 9 | 0.9849 | Need data not reliable enough for direct lock |
| `late-intel-heavy` | PASS | 79 | 2 | 9 | 2 | 0.9960 | Stable order but confidence drops; use as sensitivity check |

All four strategies produced 30 picks with no duplicate prospects and passed the current `getBoardHealth` readiness check. However, readiness only checks count, duplicates, and low-confidence count. It does not yet enforce the newer multi-agent lock-gate requirements such as `needConfidence`, sourceConfidence outlet caps, healthAvailability coverage, or ablation audit.

## Baseline Findings

Baseline remains the best current default:

- 30 picks: true
- No duplicates: true
- Low-confidence picks: 1
- Average confidence: 84
- Average score: 85
- Changed slots vs previous Agent board: 0

Low-confidence pick:

| Pick | Team | Player | Confidence |
|---:|---|---|---:|
| 30 | Dallas Mavericks | Jayden Quaintance | 33 |

Narrow-margin picks:

| Pick | Team | Player | Margin | Confidence |
|---:|---|---|---:|---:|
| 7 | Sacramento Kings | Mikel Brown Jr. | 0 | 86 |
| 10 | Milwaukee Bucks | Kingston Flemings | 1 | 83 |
| 18 | Charlotte Hornets | Christian Anderson | 0 | 78 |
| 19 | Toronto Raptors | Labaron Philon Jr. | 0 | 71 |
| 20 | San Antonio Spurs | Bennett Stirtz | 1 | 84 |
| 22 | Philadelphia 76ers | Dailyn Swain | 0 | 74 |
| 24 | New York Knicks | Isaiah Evans | 0 | 74 |

## Strategy-Specific Risks

### `consensus-heavy`

This strategy is too volatile for direct lock because it changes 11 slots while adding one extra low-confidence pick.

Changed slots vs baseline:

- 13 Miami Heat: Karim Lopez -> Hannes Steinbach
- 15 Chicago Bulls: Allen Graves -> Karim Lopez
- 16 Memphis Grizzlies: Hannes Steinbach -> Allen Graves
- 18 Charlotte Hornets: Christian Anderson -> Labaron Philon Jr.
- 19 Toronto Raptors: Labaron Philon Jr. -> Bennett Stirtz
- 20 San Antonio Spurs: Bennett Stirtz -> Cameron Carr
- 21 Detroit Pistons: Cameron Carr -> Ebuka Okorie
- 23 Atlanta Hawks: Ebuka Okorie -> Christian Anderson
- 25 Los Angeles Lakers: Koa Peat -> Henri Veesaar
- 26 Denver Nuggets: Tarris Reed Jr. -> Koa Peat
- 29 Cleveland Cavaliers: Henri Veesaar -> Tarris Reed Jr.

Audit verdict: keep as sensitivity scenario only. It is useful for detecting whether current board is over-trusting team needs, but it should not replace baseline without better sourceConfidence and outlet dedupe.

### `team-need-heavy`

This strategy changes 9 slots and moves the low-confidence issue away from pick 30 into picks 27 and 29. Because team-context data still has many `needs_review` and mixed-signal rows, this strategy is not safe as a lock board.

Changed slots vs baseline:

- 19 Toronto Raptors: Labaron Philon Jr. -> Dailyn Swain
- 22 Philadelphia 76ers: Dailyn Swain -> Isaiah Evans
- 23 Atlanta Hawks: Ebuka Okorie -> Labaron Philon Jr.
- 24 New York Knicks: Isaiah Evans -> Koa Peat
- 25 Los Angeles Lakers: Koa Peat -> Henri Veesaar
- 27 Boston Celtics: Sergio De Larrea -> Ebuka Okorie
- 28 Minnesota Timberwolves: Meleek Thomas -> Sergio De Larrea
- 29 Cleveland Cavaliers: Henri Veesaar -> Jayden Quaintance
- 30 Dallas Mavericks: Jayden Quaintance -> Meleek Thomas

Audit verdict: do not lock. Use only after `needConfidence`, `disableNeedScoring`, and multi-pick sequencing are implemented and audited.

### `late-intel-heavy`

This strategy is structurally close to baseline, changing only picks 26 and 29, but average confidence falls from 84 to 79 and narrow-margin count rises to 9.

Changed slots vs baseline:

- 26 Denver Nuggets: Tarris Reed Jr. -> Henri Veesaar
- 29 Cleveland Cavaliers: Henri Veesaar -> Tarris Reed Jr.

Audit verdict: useful late-intel sensitivity check, but not a better lock board unless fresh, high-quality late intel exists.

## Strategy Audit Verdict

The current best runnable board remains `baseline`.

Reasons:

1. It has the fewest low-confidence picks.
2. It avoids the high slot churn of `consensus-heavy` and `team-need-heavy`.
3. It keeps average confidence above `late-intel-heavy`.
4. It is consistent with the multi-agent consensus that current team-need and source-confidence data are not mature enough to drive a more aggressive strategy.

This is an audit conclusion, not a manual pick decision. The board remains produced by `generateBoard`.

## Agent Rerun Result

Command executed:

```powershell
npm run board:regen
```

Generated outputs:

- `public/data/agent_balanced_board.json`
- `data/boards/board_balanced_parameter_test.json`
- `data/reports/model_v2_regeneration_report.md`

Rerun health:

```json
{
  "hasThirtyPicks": true,
  "noDuplicates": true,
  "lowConfidence": 1,
  "ready": true
}
```

Rerun summary:

- Scenario: `baseline / balanced baseline`
- Average confidence: 84
- Changed player slots: 0
- Low-confidence pick: pick 30 Dallas Mavericks -> Jayden Quaintance, confidence 33
- Top-five unchanged: AJ Dybantsa, Darryn Peterson, Cameron Boozer, Caleb Wilson, Keaton Wagler

## Current Rebuilt Board

| Pick | Team | Player | Confidence | Margin |
|---:|---|---|---:|---:|
| 1 | Washington Wizards | AJ Dybantsa | 96 | 5 |
| 2 | Utah Jazz | Darryn Peterson | 93 | 3 |
| 3 | Memphis Grizzlies | Cameron Boozer | 100 | 15 |
| 4 | Chicago Bulls | Caleb Wilson | 100 | 9 |
| 5 | LA Clippers | Keaton Wagler | 89 | 2 |
| 6 | Brooklyn Nets | Darius Acuff Jr. | 89 | 2 |
| 7 | Sacramento Kings | Mikel Brown Jr. | 86 | 0 |
| 8 | Atlanta Hawks | Aday Mara | 94 | 7 |
| 9 | Dallas Mavericks | Brayden Burries | 97 | 7 |
| 10 | Milwaukee Bucks | Kingston Flemings | 83 | 1 |
| 11 | Golden State Warriors | Nate Ament | 75 | 2 |
| 12 | Oklahoma City Thunder | Yaxel Lendeborg | 94 | 4 |
| 13 | Miami Heat | Karim Lopez | 88 | 3 |
| 14 | Charlotte Hornets | Morez Johnson Jr. | 96 | 5 |
| 15 | Chicago Bulls | Allen Graves | 94 | 5 |
| 16 | Memphis Grizzlies | Hannes Steinbach | 82 | 4 |
| 17 | Oklahoma City Thunder | Chris Cenac Jr. | 79 | 4 |
| 18 | Charlotte Hornets | Christian Anderson | 78 | 0 |
| 19 | Toronto Raptors | Labaron Philon Jr. | 71 | 0 |
| 20 | San Antonio Spurs | Bennett Stirtz | 84 | 1 |
| 21 | Detroit Pistons | Cameron Carr | 99 | 5 |
| 22 | Philadelphia 76ers | Dailyn Swain | 74 | 0 |
| 23 | Atlanta Hawks | Ebuka Okorie | 91 | 7 |
| 24 | New York Knicks | Isaiah Evans | 74 | 0 |
| 25 | Los Angeles Lakers | Koa Peat | 74 | 2 |
| 26 | Denver Nuggets | Tarris Reed Jr. | 68 | 2 |
| 27 | Boston Celtics | Sergio De Larrea | 68 | 4 |
| 28 | Minnesota Timberwolves | Meleek Thomas | 76 | 5 |
| 29 | Cleveland Cavaliers | Henri Veesaar | 82 | 17 |
| 30 | Dallas Mavericks | Jayden Quaintance | 33 | 12 |

## Remaining Strategy Gaps

The rerun passed the current code health gate, but it does not yet satisfy the stricter multi-agent consensus from `multi_agent_top30_prediction_consensus_20260623.md`.

Still missing from code:

- `needConfidence`
- `disableNeedScoring`
- `healthAvailability`
- `sourceConfidence`
- separate `TIEBREAK_EPSILON = 0.8` and `NARROW_MARGIN_OBSERVABILITY_BAND = 1.25`
- source outlet dedupe and cap 0.5
- multi-pick sequencing need-only discount
- neutral ablation report
- P2 scoring audit for any future multipliers

Therefore the current board is a valid regenerated Agent board under the existing model, but not a final lock under the stricter consensus lock-gate.

## Verification

`npm run build` completed successfully after the rerun.

No manual override was used.
