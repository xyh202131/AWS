# D2 Official Combine Dimension Debate

Generated at: 2026-06-22 +08:00

Scope: design DraftOps parameters from the official Combine / physical-measurement package only. Source files were read only; app source code and existing normalized/final data were not modified.

## Inputs Reviewed

- `数据/DraftCombine_Hackathon/DraftCombineHistory2000_2025.csv`
  - Actual format is Excel/OpenXML, not plain CSV.
  - Main sheet: `DraftCombineHistory2000_2025 (2`, 1,795 data rows, 2000-2025.
  - Header row 1 is Chinese, header row 2 is English.
- `数据/DraftCombine_Hackathon/NBA_Combine_Stat_Lab_指标中英文.xlsx`
  - Metric dictionary with anthropometric, strength/agility, and shooting drill definitions.
- `数据/DraftCombine_Hackathon/NBA_Draft_Combine_Intro_CN.pptx`
  - Readable through OpenXML text extraction.
  - The relevant slides describe five Combine modules: anthropometric, strength/agility, shooting drills, live action, and medical/movement.
- `data/final/final_import_bundle.json`
  - Current DraftOps candidate pool: 30 prospects.
  - Current profile dimensions available for all 30: `shooting`, `creation`, `defense`, `athleticism`, `feel`, `size`, `upside`.

## Official Reference Dimensions

| Official family | Official metric list | History-table columns available | Coverage in 2000-2025 history | Parameter stance |
| --- | --- | --- | ---: | --- |
| Identity / position | Player, Position, College / Team | `Player_name`, `Player_position`, `Secondary_position`, `Player_ID`, `First_Name`, `Last_Name` | Player rows complete enough for matching | Use only for matching and position-normalized percentiles. Do not score identity. |
| Height / frame | Height W/O Shoes, Height With Shoes, Weight | `Player_height_NoShoes`, `Player_height`, `Weight` | no-shoes 96.8%, with-shoes 67.1%, weight 96.7% | Use no-shoes height as primary. With-shoes is fallback only because recent years often have 0% coverage. |
| Length | Wingspan, Standing Reach, Hand Length, Hand Width | `Wingspan_inches`, `Standing_reach_inches`, `Hand_height_inches`, `Hand_width_inches` | wingspan 96.8%, reach 96.7%, hands 55.8% | Make wingspan and standing reach core `size` signals; hands are a small bonus/role-specific tie-breaker. |
| Body composition | Body Fat % | `Bodyfat_percentage` | 71.1% overall, 0% in 2023-2025 rows | Use only when present. Recent systemic absence must not become a penalty. |
| Flexibility | Not in metric dictionary, but present in history header | `reach_flexibility_inches` | 24.3% | Low-confidence supplementary signal only. Do not include in default score. |
| Vertical explosion | Standing / No-Step Vertical, Max Vertical | `Nostep_vertical_jump_inches`, `Maximum_vertical_jump_inches`, plus jump-reach columns | verticals 86.1%, jump reaches 82.1% | Core `athleticism` signal. Keep no-step and max vertical separate: no-step = functional pop, max = runway explosion. |
| Strength | Max Bench Press | `Bench_press_repetitions` | 61.0% overall, 0% in 2020-2025 rows | Historical-only context. Do not penalize recent prospects for missing bench. |
| Agility / speed | Three-Quarter Court Sprint, Lane Agility Drill, Lane Shuttle / Shuttle Run | `Three_quarter_court_sprint`, `Lane_agility_drill`, `Modified_lane_agility_drill` | sprint 85.8%, lane 85.8%, modified lane 36.7% | Core `athleticism` signal. Times are lower-is-better and must be inverted before scoring. |
| Shooting drills | Off-the-dribble, Spot-up, Star Drill, Side-mid-side, Free throw | No shooting-result columns in the 2000-2025 history file | Not available in history table | Keep as official future dimension, but do not backfill from this history file. |
| Live action | 2v2 / 3v3 / 4v4 / scrimmage style evaluation in PPTX | No numeric history columns in the reviewed history file | Not available | Out of scope for D2 Combine numeric scoring unless a later official event file supplies rows. |
| Medical / movement | Biomechanics, functional movement, isometric strength, physical exam, medical history, blood test, DEXA in PPTX | No direct medical rows in history table; body fat is the only adjacent numeric field | Medical unavailable; body fat partial | Use a conservative `health_proxy`, not a medical grade. Never infer injury status from missing data alone. |

## Conversion Into DraftOps Dimensions

All raw Combine metrics should first be converted to direction-corrected, position-normalized percentiles.

- For higher-is-better fields, use the percentile directly.
- For lower-is-better time fields, invert the percentile.
- Normalize by `Player_position` when possible; for multi-position prospects, average the two closest position groups.
- Cap any single metric's influence so one outlier test does not fully define a prospect.
- Track `combineConfidence` separately from the score.

### `size`

Recommended internal `size` formula when official measurements exist:

| Component | Weight inside `size` | Notes |
| --- | ---: | --- |
| Wingspan | 30 | Best length signal and highly covered historically. |
| Standing reach | 25 | Most basketball-specific length signal for rim/contest utility. |
| Height without shoes | 20 | Primary height field; avoid double-counting with with-shoes height. |
| Weight / frame | 15 | Position-normalized. Heavy is not always better; treat as frame readiness, not pure mass. |
| Hand length / width | 10 | Useful secondary role signal, especially for guards/handlers and bigs finishing through contact. |

Use with-shoes height only as fallback if no-shoes height is missing. Do not include both in the same score.

### `athleticism`

Recommended internal `athleticism` formula:

| Component | Weight inside `athleticism` | Notes |
| --- | ---: | --- |
| Three-quarter court sprint | 25 | Lower is better; captures open-court speed. |
| Lane agility | 20 | Lower is better; captures change of direction. |
| Max vertical | 20 | Runway explosion. |
| No-step vertical | 20 | Functional pop without runway. |
| Modified lane / shuttle | 10 | Use when present; otherwise redistribute to sprint and lane agility. |
| Bench / strength | 5 | Only when present. Recent official history often omits it. |

### `shooting`

Shooting is an official Combine dimension in the dictionary/PPTX, but it is not present as numeric columns in `DraftCombineHistory2000_2025.csv`.

Recommended internal `shooting` formula once official drill results are available:

| Component | Weight inside `shooting` | Notes |
| --- | ---: | --- |
| Spot-up | 30 | Most stable NBA-role translation among the listed drills. |
| Off-the-dribble | 25 | Creation shooting signal. |
| Star Drill | 20 | Movement pattern and shot preference signal. |
| Side-mid-side | 15 | Movement shooting, split by three-point/midrange if supplied. |
| Free throw | 10 | Small but useful touch indicator. |

Until a numeric official shooting-drill file is available, the D2 Combine module should not overwrite `profile.shooting`; mark `shootingCombineConfidence = none`.

### `health_proxy`

The official package references medical/movement evaluation, but the history table does not expose medical results. Therefore `health_proxy` must be a low-weight proxy, not an injury or durability model.

Recommended proxy inputs:

| Component | Weight inside `health_proxy` | Notes |
| --- | ---: | --- |
| Measurement/test completeness | 40 | Completion of available official measurement, agility, and vertical rows. Missing systemic fields do not count against a player. |
| Body fat, when present | 25 | Penalize extreme high outliers by position; do not simply reward the lowest number. |
| Movement-test availability | 25 | Agility/sprint/modified-lane availability only; no injury inference without official reason. |
| Strength/body composition consistency | 10 | Bench and weight only when present and era-comparable. |

Default to neutral when official medical/movement details are unavailable.

## Current Final-Bundle Historical Combine Hits

Current player universe: the 30 prospects in `data/final/final_import_bundle.json`.

Exact normalized-name matches against the official 2000-2025 Combine history: 2 of 30.

| Prospect | Official history hit | Official measurements | Directional read |
| --- | --- | --- | --- |
| Yaxel Lendeborg | 2025, `Player_position` 4 | No-shoes height 80.5 in; weight 234.6 lb; wingspan 88 in; standing reach 108.5 in; no-step vertical 25.5 in; max vertical 31.5 in; lane agility 11.68 sec; 3/4 sprint 3.32 sec; modified lane 3.09 sec; hand 9.25 x 10 in | Strong length/standing reach for a forward: wingspan was about 92nd percentile within position 4 history. Athletic testing is below average to modest: no-step vertical about 15th percentile within position 4, max vertical about 30th, sprint about 43rd. |
| Labaron Philon Jr. | 2025, official row as `Labaron Philon`, `Player_position` 1, secondary 2 | No-shoes height 74.75 in; weight 174.6 lb; wingspan 78.25 in; standing reach 99.5 in; no-step vertical 28.5 in; max vertical 32.5 in; lane agility 11.46 sec; 3/4 sprint 3.16 sec; modified lane 3.14 sec; hand 8.5 x 9 in | Position-adjusted guard size/length is solid: height about 77th percentile and standing reach about 78th within position 1 history. Weight is light for the position group, about 17th percentile. Sprint is a positive, while vertical/agility are not standout. |

Official history misses among the current 30:

Darryn Peterson, AJ Dybantsa, Cameron Boozer, Caleb Wilson, Keaton Wagler, Darius Acuff Jr., Mikel Brown Jr., Kingston Flemings, Nate Ament, Aday Mara, Brayden Burries, Hannes Steinbach, Karim Lopez, Morez Johnson Jr., Christian Anderson, Allen Graves, Chris Cenac Jr., Bennett Stirtz, Cameron Carr, Jayden Quaintance, Dailyn Swain, Ebuka Okorie, Isaiah Evans, Henri Veesaar, Koa Peat, Meleek Thomas, Tarris Reed Jr., Sergio De Larrea.

This is the central constraint: the current final bundle is a 2026 prospect pool, while the official history file ends at 2025. Historical Combine data can validate a few returning/previous-cycle players, but it cannot fairly rank the whole 2026 group yet.

## Missing-Data Policy

Use these rules before any parameter tuning:

1. No historical Combine hit = no Combine adjustment.
   - Keep the existing final-bundle profile values unchanged.
   - Set `combineConfidence = none`.
   - Do not treat absence from 2000-2025 history as a negative, because many 2026 prospects have not yet appeared in that history file.

2. Matched player with partial metric missing = subscore from available sibling metrics.
   - Example: if sprint and lane agility exist but bench is missing, compute `athleticism` from sprint/lane/verticals and reduce confidence; do not assign bench zero.

3. Systemic era missing = no penalty.
   - 2025 coverage examples: no-shoes height, weight, wingspan, reach, hands are 100%; with-shoes height, body fat, and bench are 0%.
   - Therefore 2025 missing with-shoes/bodyfat/bench is a data-design issue, not a player weakness.

4. Shooting missing in history = unavailable, not neutral evidence.
   - The metric dictionary and PPTX confirm official shooting drill categories.
   - The reviewed history table does not contain made/attempt columns, so D2 should not invent shooting scores from it.

5. Health proxy must stay conservative.
   - Use only official Combine-adjacent facts from the package.
   - Do not convert missing medical data into an injury penalty.
   - Do not import broader scouting risk text into D2's official Combine module; that belongs to risk/upside review.

6. Name matching must be auditable.
   - Normalize punctuation and suffixes such as `Jr.` for matching.
   - Keep the official row name in the report when it differs from the final-bundle display name.

## Recommended Weights

### Official Combine Module, Future Full Data

If the app receives a current-year official Combine table with measurements, athletic tests, and shooting drills for most 2026 prospects, use this internal Combine mix:

```json
{
  "size": 36,
  "athleticism": 34,
  "shooting": 20,
  "health_proxy": 10
}
```

Rationale: size and athletic testing are the most complete and historically comparable official signals. Shooting is official and required per the local PPTX/dictionary, but it should only activate when numeric drill results are present. Health stays low because the exposed package lacks direct medical rows.

### Official Combine Module, Current Reviewed Package

For the current package actually available today, use this historical-backfill mix:

```json
{
  "size": 48,
  "athleticism": 42,
  "shooting": 0,
  "health_proxy": 10
}
```

Rationale: the history file contains strong measurement and athletic-test coverage, but no shooting results. Keeping shooting at 0 prevents false precision.

### Overall DraftOps Influence

Do not add a high global Combine weight yet. With only 2 of 30 current prospects matched, Combine should be an evidence modifier, not a board driver.

Recommended overall influence:

| Data state | Suggested overall influence | Reason |
| --- | ---: | --- |
| Current package, 2/30 current-player hits | 3-5% max, or annotation-only | Prevents the two matched players from being compared against 28 players with no official rows. |
| Current-year official Combine data for most of the class | 10-12% | Enough to correct size/athletic/shooting assumptions without overpowering consensus, team need, and scouting profile. |
| Full official Combine plus medical/movement details | 12-15% | Only justified if shooting and medical/movement rows are real numeric inputs, not text references. |

If integrated into existing DraftOps profiles, the cleanest path is a bounded adjustment to `profile.size`, `profile.athleticism`, and eventually `profile.shooting`, with a separate confidence flag. Do not make official Combine a direct replacement for the broader `player` profile.

## Player-Specific Parameter Implications

| Prospect | Suggested D2 treatment |
| --- | --- |
| Yaxel Lendeborg | Add official-size confidence: length/reach are real positives. Do not let the size hit imply elite athleticism; the official vertical/speed profile is modest. Shooting remains unavailable from Combine history. Health proxy neutral because 2025 bodyfat/bench/medical fields are absent systemically. |
| Labaron Philon Jr. | Add position-adjusted guard-size confidence despite low global height/weight percentiles. Sprint is a positive. Weight, vertical pop, and agility should be mild caution flags, not major downgrades. Shooting remains unavailable from Combine history. Health proxy neutral. |
| Other 28 prospects | No official Combine-history adjustment. Keep existing final-bundle size/athleticism/shooting values until current-year official Combine data arrives. |

## Bottom Line

D2's official Combine parameter stance should be conservative:

- Use official Combine history strongly for measurement and athletic-test verification when a player has a row.
- Treat the current package's shooting and medical dimensions as official reference categories, not as numeric evidence, because the reviewed history file does not expose those results.
- For the current 2026 final bundle, only Yaxel Lendeborg and Labaron Philon Jr. have official historical Combine hits.
- Recommended current-package module weights are `size 48 / athleticism 42 / shooting 0 / health_proxy 10`.
- Recommended future full-data module weights are `size 36 / athleticism 34 / shooting 20 / health_proxy 10`.
- Overall board influence should stay at 3-5% or annotation-only until most current prospects have official Combine rows.
