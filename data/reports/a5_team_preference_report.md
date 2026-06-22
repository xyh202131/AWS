# A5 First Round Report - Team Preference

Scope: local-only first round. No web access, no source file edits.

## Current Contract Status

`seedTeams` is structurally usable:

- 30 teams
- picks cover 1-30
- no duplicate pick values
- `phase` values are valid
- `needs`, `priorityTags`, `riskTolerance`, and `notes` are present

Current phase distribution:

- `rebuild`: 5
- `accelerate`: 8
- `asset`: 5
- `contend`: 12

Current `acquiredFrom` count: 14.

## Highest-Risk Fields

- `needs` and `priorityTags`: strongest impact on board changes.
- `phase`: changes adaptive weights, player-score preference, risk handling.
- `acquiredFrom`: does not change scoring but directly affects traded-pick milestone answers.
- `riskTolerance`: lower current impact, but still affects upside scoring.

## Current Review Queue

Low-confidence or high-review picks:

```text
8, 14, 17, 21, 22, 25, 26, 27, 29, 30
```

These should be manually reviewed for fit, confidence margin, warnings, and traded-pick context.

## Existing Data Directory Use

`数据/` is useful for historical preference evidence:

- 2000-2025 draft results can support team historical drafting tendencies.
- Combine history can support archetype and profile calibration.
- Metric glossary and PPT explain Combine fields and competition context.

It cannot replace 2026 current roster needs, current traded-pick ownership, or late news.

## Recommended Next Output

```text
data/reports/team_preference_report.md
data/clean/clean_teams.json
```

`clean_teams.json` should add source IDs or source notes for phase, needs, priority tags, traded-pick ownership, and risk tolerance.
