# A1 First Round Report - Data Collection

Scope: local-only first round. No web access, no source file edits.

## Priority Sources

P0 official/user files:
- Team Portal official data when available.
- Local user data under `数据/`.
- Official draft order and traded pick ownership.

P1 mock and big board:
- NBA.com consensus mock draft.
- Tankathon big board.
- Other major mock sources after source credibility review.

P2 context:
- Team needs and trade context.
- Injury, medical, workout, and late-news signals.

P3 scouting supplements:
- Role tags, strengths, risks, and player profile evidence.

## Existing Local Data

Raw data entry point:

```text
C:\Users\24048\Desktop\AWS\draftops\数据
```

Important files:

- `2000-2025_NBA选秀结果_数据汇总.xlsx`
- `DraftCombine_Hackathon/DraftCombineHistory2000_2025.csv`
- `DraftCombine_Hackathon/NBA_Combine_Stat_Lab_指标中英文.xlsx`
- `DraftCombine_Hackathon/NBA_Draft_Combine_Intro_CN.pptx`

Note: `DraftCombineHistory2000_2025.csv` has a `.csv` extension but should be read as an Excel workbook.

## Most Important Fields To Refresh

- `seedTeams.pick`, `team`, `acquiredFrom`
- `seedProspects.consensusRank`, `mockHeat`
- `sourceNotes` with traceable source IDs
- `positions`, `school`, `origin`, `classYear`, `international`
- `height`, `weight`, `age`
- `roleTags`, `strengths`, `risks`
- `profile`
- `seedTeams.phase`, `needs`, `priorityTags`, `riskTolerance`

## Recommended Output

```text
data/raw/raw_sources.json
data/reports/a1_first_round_report.md
```

`raw_sources.json` must preserve source name, URL or local path, collection time, credibility, covered fields, raw excerpt, and notes.
