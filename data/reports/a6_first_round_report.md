# A6 First Round Report - Parameter Optimization

Scope: local-only first round. No file edits by subagent.

## Current Scoring Model

`generateBoard` uses greedy pick-by-pick selection. Each team scores all remaining prospects, selects the highest score, and removes that player from the pool.

Base weights are adjusted by draft zone and team phase before normalization:

```text
score =
  consensusScore * normalized.consensus
  + needScore * normalized.need
  + playerScore * normalized.player
  + upsideScore * normalized.upside
  + intelScore * normalized.intel
  - riskPenalty
```

## Recommended First-Round Scenarios

- `baseline`: balanced default.
- `consensus-heavy`: conservative, mock-driven board.
- `team-need-heavy`: emphasizes reviewed team needs.
- `late-intel-heavy`: final-hours reliable news and mock heat.

Use `baseline` as the default. Use other scenarios to find disputed picks, not as automatic replacements.

## A7 Should Track

- `margin < 5`
- `confidence < 65`
- first international player
- first center
- lottery guard count
- top school count

These are likely to affect milestone answers.
