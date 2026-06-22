# Official Double-Agent Roster Audit Summary

Generated at: 2026-06-22 04:13 +08:00

## Goal

Verify that `data/final/final_import_bundle.json` contains exactly 30 prospects and that none are outside the NBA.com official 2026 Draft Prospects list.

## Audit Methods

| Method | Source | Output | Official Rows | Final Count | Matched | Missing | Duplicate IDs | Verdict |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| A13 local official table audit | `data/raw/nba-official-2026-prospects-live.md` | `data/reports/a13_official_local_table_audit.md` | 101 | 30 | 30 | 0 | 0 | PASS |
| A14 live refresh audit | refreshed NBA.com Prospects scrape | `data/reports/a14_official_live_refresh_audit.md` | 101 | 30 | 30 | 0 | 0 | PASS |
| Main-thread set difference audit | local official table + final bundle | console validation | 101 | 30 | 30 | 0 | 0 | PASS |

## Final Verdict

PASS. The current final import bundle has exactly 30 prospects. All 30 appear in the NBA.com official 2026 Draft Prospects list. There are no extra prospects, no missing official-list matches, and no duplicate final prospect IDs.

## Non-Blocking Notes

- NBA.com official profile URLs omit `jr` from some slugs, while the final bundle keeps explicit suffix IDs: `darius-acuff-jr`, `mikel-brown-jr`, and `labaron-philon-jr`. Both A13 and A14 matched these by normalized official names.
- This audit verifies official candidate-list membership and final-bundle count. It does not claim the predicted draft order is official; prediction order remains a model/media-signal output.
