# A2/A3 First Round Report - Local Data Mapping

Scope: local-only first round. No web access, no source file edits.

## Core Conclusion

The files under `数据/` are mostly historical draft data, historical Combine measurements, a metric dictionary, and presentation material. They are valuable for standardization, historical priors, profile calibration, and quality checks.

They are not enough to generate final 2026 predictions by themselves.

Only two current `seedProspects` directly match the historical Combine workbook:

- `Labaron Philon Jr.`
- `Yaxel Lendeborg`

The other 28 current seed prospects still need 2026-specific sources.

## File Inventory

| File | Use |
|---|---|
| `数据/2000-2025_NBA选秀结果_数据汇总.xlsx` | Historical draft results, undrafted players, lottery history, position/nationality/school parsing examples. |
| `数据/DraftCombine_Hackathon/DraftCombineHistory2000_2025.csv` | Actually an Excel/OpenXML workbook despite `.csv`; useful for historical height, weight, wingspan, reach, agility, sprint, jump fields. |
| `数据/DraftCombine_Hackathon/NBA_Combine_Stat_Lab_指标中英文.xlsx` | Metric dictionary for English/Chinese field names and units. |
| `数据/DraftCombine_Hackathon/NBA_Draft_Combine_Intro_CN.pptx` | Combine process explanation and roadshow background, not structured player data. |
| `数据/DraftCombine_Hackathon/视频介绍/*` | Demo/background media, not structured model input. |

## Recommended Normalized Outputs

```text
data/normalized/normalized_sources_inventory.json
data/normalized/normalized_draft_history.json
data/normalized/normalized_combine_history.json
data/normalized/normalized_metric_dictionary.json
data/normalized/normalized_current_prospect_matches.json
data/normalized/normalized_prospects.json
data/normalized/normalized_teams.json
```

## Recommended Clean Outputs

```text
data/clean/clean_prospects.json
data/clean/clean_teams.json
data/clean/clean_measurement_priors.json
data/clean/data_quality_report.md
```

## Conversion Plan

1. Inventory raw files, sheets, row counts, column counts, and read method.
2. Normalize draft history: positions, nationality, school/club, class-year suffixes, honors, traded-team text.
3. Normalize Combine history: use second header row as canonical English keys; keep Chinese header labels; convert `NULL`, dashes, and empty strings to null.
4. Map Combine numeric position codes carefully. Tentative mapping is `1=PG`, `2=SG`, `3=SF`, `4=PF`, `5=C`; mark as requiring human confirmation.
5. Match current prospects by normalized names, including `Last, First` to `First Last`, suffix handling, case, punctuation, and accent normalization.
6. Derive profile priors only where defensible:
   - `size`: height, wingspan, standing reach, weight
   - `athleticism`: vertical jump, agility, sprint
   - `defense`: weak proxy only
   - Do not infer `shooting`, `creation`, `feel`, or `upside` from historical measurements alone.
7. Export DraftOps-compatible clean files only after quality checks pass.

## Still Needed From 2026 Sources

- Official 2026 first-round order and traded-pick ownership.
- Current candidate list, withdrawals, injuries, medical context.
- Current school/team, age, nationality, and international status.
- `consensusRank`, `mockHeat`, big board, and mock draft heat.
- `roleTags`, `strengths`, `risks`.
- `profile.shooting`, `profile.creation`, `profile.feel`, `profile.upside`, and reliable defense evidence.
- Current team `phase`, `needs`, `priorityTags`, `riskTolerance`, `notes`.
- Real milestone questions and any fields they require.

## Quality Checks

- Raw files remain unmodified.
- `DraftCombineHistory2000_2025.csv` is read as workbook, not plain CSV.
- Workbook sheet names, row counts, and column counts match inventory.
- Null-like values are normalized.
- `Prospect.positions` only uses `PG`, `SG`, `SF`, `PF`, `C`.
- `profile` scores stay within `0-100`.
- `prospect.id` is unique.
- Match rate between current prospects and historical Combine is reported separately.
- No unmatched prospect receives fake historical measurement values.
- `teams` has exactly 30 entries and `pick` covers 1-30.
- Milestone-dependent fields are complete: `international`, `origin`, `school`, `classYear`, `positions`, `acquiredFrom`.
