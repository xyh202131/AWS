# Mild Parameter Rerun Summary

Generated: 2026-06-23

## Run

Variant: `deepseek-mild`

Parameters:

- weak-preference pick-value cap: `3.25`
- positive feature adjustment cap: `1.15`
- D-tier additional penalty: `0.35`
- athletic-deficit penalty: `1.0`
- athletic-deficit threshold: explosiveness `< 10`
- athletic-deficit team gate: risk tolerance `<= 60`

Guardrails:

- 123-player candidate pool only.
- One pick at a time.
- Selected player removed before next pick.
- No manual prediction or manual slot edits.

## Health

- Picks: 30
- Total candidate reviews: 3255
- Unique selected prospects: 30
- Remaining prospects: 93
- Duplicate selected prospects: none

## Board

| Pick | Team | Player | Score | Confidence | Gap | Tie-break |
|---:|---|---|---:|---:|---:|---|
| 1 | Wizards | AJ Dybantsa | 95.114 | 97 | 3.859 |  |
| 2 | Jazz | Darryn Peterson | 95.561 | 95 | 2.519 |  |
| 3 | Grizzlies | Cameron Boozer | 89.576 | 100 | 8.930 |  |
| 4 | Bulls | Caleb Wilson | 94.979 | 100 | 9.661 |  |
| 5 | Clippers | Keaton Wagler | 95.947 | 92 | 1.753 |  |
| 6 | Nets | Darius Acuff Jr. | 84.859 | 85 | 2.385 |  |
| 7 | Kings | Kingston Flemings | 95.785 | 96 | 3.125 |  |
| 8 | Hawks | Aday Mara | 81.523 | 81 | 3.041 |  |
| 9 | Mavericks | Brayden Burries | 81.790 | 81 | 2.933 |  |
| 10 | Bucks | Yaxel Lendeborg | 90.614 | 82 | 0.340 |  |
| 11 | Warriors | Mikel Brown Jr. | 79.920 | 71 | 1.664 |  |
| 12 | Thunder | Hannes Steinbach | 83.082 | 75 | -0.084 | yes |
| 13 | Heat | Karim Lopez | 95.121 | 100 | 5.040 |  |
| 14 | Hornets | Morez Johnson Jr. | 87.638 | 96 | 7.528 |  |
| 15 | Bulls | Nate Ament | 89.679 | 75 | -0.440 | yes |
| 16 | Grizzlies | Allen Graves | 82.354 | 90 | 5.761 |  |
| 17 | Thunder | Chris Cenac Jr. | 76.049 | 68 | 1.156 |  |
| 18 | Hornets | Labaron Philon Jr. | 87.815 | 82 | 0.839 |  |
| 19 | Raptors | Cameron Carr | 85.687 | 85 | 3.223 |  |
| 20 | Spurs | Bennett Stirtz | 91.367 | 95 | 4.113 |  |
| 21 | Pistons | Christian Anderson | 87.094 | 74 | -0.382 | yes |
| 22 | 76ers | Isaiah Evans | 87.475 | 84 | 2.352 |  |
| 23 | Hawks | Dailyn Swain | 77.001 | 71 | 0.837 |  |
| 24 | Knicks | Ebuka Okorie | 81.652 | 74 | -0.189 | yes |
| 25 | Lakers | Koa Peat | 78.367 | 70 | 0.865 |  |
| 26 | Nuggets | Henri Veesaar | 68.726 | 63 | 0.806 |  |
| 27 | Celtics | Sergio De Larrea | 65.053 | 56 | 0.948 |  |
| 28 | Timberwolves | Meleek Thomas | 78.006 | 82 | 4.703 |  |
| 29 | Cavaliers | Tarris Reed Jr. | 72.589 | 83 | 10.629 |  |
| 30 | Mavericks | Jack Kayil | 64.634 | 53 | 1.154 |  |

## Difference Vs Previous Dynamic Audit

Only two slots moved compared with `sequential_dynamic_board_123_audit.json`:

| Pick | Team | Previous dynamic | Mild rerun |
|---:|---|---|---|
| 18 | Hornets | Christian Anderson | Labaron Philon Jr. |
| 21 | Pistons | Labaron Philon Jr. | Christian Anderson |

This means the mild rerun is much more stable than the stronger `deepseek-guardrails` stress test, which disrupted picks 27-30.

## Remaining Fragile Slots

These remain fragile after the mild pass:

- Pick 10: Yaxel Lendeborg still wins, but gap is only `0.340` after low-explosiveness penalty.
- Pick 12: Hannes Steinbach still wins only through tie-break; raw score gap is `-0.084`.
- Pick 15: Nate Ament still wins only through tie-break; raw score gap is `-0.440`.
- Pick 21: Christian Anderson wins through tie-break; raw score gap is `-0.382`.
- Pick 26: Henri Veesaar remains low-confidence at `63`, gap `0.806`.
- Pick 30: Jack Kayil remains very low-confidence at `53`.

## Codex Recommendation

Use `deepseek-mild` as the current best parameter candidate, not the stronger guardrail run.

Before frontend update, one more discussion round should focus only on:

- Pick 10 Bucks: Yaxel Lendeborg vs Karim Lopez.
- Pick 12 Thunder: Hannes Steinbach vs Karim Lopez.
- Pick 15 Bulls: Nate Ament vs Allen Graves.
- Pick 18/21 guard swap: Labaron Philon Jr. vs Christian Anderson.
- Pick 26/30 low-confidence endings.
