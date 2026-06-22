# Current External Data Update Summary

Generated at: 2026-06-22 03:50 +08:00

## Scope

The official user-provided data package is under `数据/` and remains read-only. This round only added external 2026 draft data under `data/`, focused on current prospect lists, mock consensus, draft order, and team context.

## Agents Run

| Agent | Output | Status |
| --- | --- | --- |
| A1-Web Source Inventory | `data/raw/external_source_inventory.json`, `data/reports/a1_web_source_inventory_report.md` | Completed |
| Main source registry | `data/raw/raw_sources.json`, `data/reports/raw_sources_registry_report.md` | Completed |
| A2-Web Mock Normalizer | `data/normalized/normalized_2026_mock_lottery.json`, `data/reports/a2_web_mock_normalization_report.md` | Completed |
| A5-Web Team Context | `data/normalized/normalized_2026_team_context.json`, `data/reports/a5_web_team_context_report.md` | Completed |
| A4-Web Prospect Big Board | `data/normalized/normalized_2026_prospect_big_board.json`, `data/reports/a4_web_prospect_big_board_report.md` | Completed |
| A3-Clean Import Composer | `data/clean/clean_prospects.json`, `data/clean/clean_teams.json`, `data/clean/data_quality_report.md`, `data/final/final_import_bundle.json` | Completed |
| Official Reconciliation | `data/clean/official_prospect_reconciliation.json`, `data/reports/official_prospect_reconciliation_report.md` | Completed |

## Key Outputs

- `data/raw/raw_sources.json`: 37 sources registered; 8 official local sources, 29 external web sources, 8 external sources marked ignore.
- `data/normalized/normalized_2026_mock_lottery.json`: 14 NBA.com consensus lottery rows and 140 source mock pick rows from 10 listed mock sources.
- `data/normalized/normalized_2026_team_context.json`: 60 NBA.com official draft-order picks, including first round 30 and second round 30; 30 team profile links.
- `data/normalized/normalized_2026_prospect_big_board.json`: 30 unique 2026 prospect candidates; ESPN Big Board visible ranks 1-25 plus ESPN final mock supplement for 26-30.
- `data/final/final_import_bundle.json`: current frontend import bundle with 30 teams and 30 prospects.
- `data/clean/official_prospect_reconciliation.json`: confirms all 30 final-bundle prospects are present in NBA.com official Prospects and the first-round team order matches NBA.com official Draft Order.

## Source Hierarchy

1. NBA.com official draft hub, draft order, and consensus mock.
2. ESPN, CBS Sports, Yahoo Sports, The Ringer, The Athletic, Bleacher Report.
3. Tankathon only for draft-order cross-check.
4. RealGM only for future-pick and trade-provenance context.
5. Reddit, Facebook, Instagram, Wikipedia, and self-media YouTube should not enter model input when stronger sources exist.

## Current Gaps

- ESPN Top 100 could only be stably extracted through visible rank 25. The normalized 30-player list is usable for first-round candidate coverage, but it is not a full Top 100 extraction.
- Media mock rows embedded in NBA.com consensus do not include per-source team assignments, so `team_if_available` is intentionally null.
- Team need signals are incomplete: 16 teams are marked `needs_review`, and 7 teams are `unknown` because no clear need source was present in the available raw files.
- `Tarris Reed Jr.` has a conservative generated DraftOps profile because he was not present in the original seed data.
- `Tarris Reed Jr.` now has official NBA.com biographical fields, but his scouting profile still needs basketball review.
- The current final bundle is structurally valid and official-list reconciled, but still needs basketball review before treating it as final submission truth.

## Next Required Work

1. Normalize official historical draft, Combine history, and metric dictionary files from `数据/`.
2. Use official historical/Combine data to improve profile and quality calibration.
3. Add or enforce frontend import validation for 30 teams, 30+ prospects, unique ids, valid picks, valid positions, valid phases, and profile scores in 0-100.
4. Review `Tarris Reed Jr.` scouting profile, supplemental ranks 26-30, and `needs_review` team signals.
5. Generate board variants from `data/final/final_import_bundle.json`.
