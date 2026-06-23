# Current Data Source Audit

Generated at: 2026-06-23T11:01:23+08:00

## Scope

This audit verifies the current DraftOps data chain after refreshing NBA.com official pages on 2026-06-23 and checking local official/user-provided files under `数据/`.

## Current Official Web Evidence

- NBA.com Prospects refreshed to `data/raw/nba-official-2026-prospects-live.md`.
- NBA.com Draft Order refreshed to `data/raw/nba-official-2026-draft-order-live.md`.
- Current NBA.com Draft Order page reports: Updated on June 22, 2026 2:10 PM.

## Mechanical Validation

- Final teams: 30.
- Final prospects: 30.
- Official NBA.com Prospects parsed from current refresh: 101.
- Official NBA.com first-round picks parsed from current refresh: 30.
- Final prospect IDs are unique: pass.
- Pick coverage is exactly 1-30: pass.
- All 30 final prospects appear in the current NBA.com Prospects list: pass.
- Final first-round teams match the current NBA.com Draft Order: pass.
- `data/final/final_import_bundle.json` matches `public/data/final_import_bundle.json`: pass.
- `data/clean/clean_teams.json` and `data/clean/clean_prospects.json` match the final bundle arrays: pass.

## Source Registry Fixes Applied

- `data/raw/raw_sources.json` now registers 42 total sources.
- Official/user-provided source count is now 11.
- `official-draft-combine-hackathon-archive` now points to existing `数据/DraftCombine_Hackathon` instead of missing `数据/DraftCombine_Hackathon.zip`.
- Added `official-2026-27-draft-event-data` for `数据/NBA选秀大会_26-27赛季数据.xlsx`.
- Added `official-submission-answer-template` for `数据/上传此文件即可（选秀+里程碑问题选手答题卡_模板）.xlsx`.
- Added `official-pre-event-training-notes` for `数据/赛前培训直播-会议纪要 (1).md`.

## Registry Completeness Check

- Missing source paths after fix: 0.
- Unregistered official local files after fix: 0.
- Registered source size mismatches after fix: 0.

## Residual Review Risks

- This audit confirms source membership, base biographical fields, pick ownership, counts, and file registration. It does not prove the predicted draft order is correct.
- Ranks 26-30 still depend on supplemental ESPN mock-order rows because the ESPN Big Board scrape exposed only ranks 1-25.
- Team-need notes marked `needs_review` still require basketball judgment before final narrative use.
- Generated scouting/profile scores remain model/seed-derived and should not be described as official NBA measurements.
