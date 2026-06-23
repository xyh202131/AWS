# Prediction Model Training (20260624)

## Conclusion

- Training completed using `pickAudits.allScores` from the final delivery board.
- Training samples: **3255** candidate-score rows across **30** picks.
- Label type: weak label from `deepseek-mild`, not completed official draft results.
- Best trained scoring weights: `consensus 30 / need 30 / player 15 / upside 1 / intel 24`.
- The trained scoring layer ranks the final-delivery selection first in **29/30** recorded pick states.
- It places the final-delivery selection inside top 5 in **30/30** states and top 10 in **30/30** states.
- Frontend artifact exact match vs final delivery remains **16/30**; Codex sequential exact match vs final delivery is **12/30**.

## Comparison

| Model | Weights | Exact top | Selected top5 | Selected top10 | Avg selected rank | Rank penalty |
| --- | --- | --- | --- | --- | --- | --- |
| trained | consensus 30 / need 30 / player 15 / upside 1 / intel 24 | 29 | 30 | 30 | 1.033 | 1 |
| baseline | consensus 35 / need 25 / player 20 / upside 10 / intel 10 | 27 | 30 | 30 | 1.1 | 3 |
| frontend-current | artifact board | 16 |  |  |  |  |
| codex-sequential | separate scorer | 12 |  |  |  |  |

## Top Weight Sets

| Rank | Label | Weights | Exact top | Top5 | Top10 | Avg rank | Penalty |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | search | consensus 30 / need 30 / player 15 / upside 1 / intel 24 | 29 | 30 | 30 | 1.033 | 1 |
| 2 | search | consensus 30 / need 30 / player 20 / upside 1 / intel 19 | 29 | 30 | 30 | 1.033 | 1 |
| 3 | search | consensus 30 / need 30 / player 25 / upside 1 / intel 14 | 29 | 30 | 30 | 1.033 | 1 |
| 4 | search | consensus 30 / need 35 / player 10 / upside 1 / intel 24 | 29 | 30 | 30 | 1.033 | 1 |
| 5 | search | consensus 30 / need 35 / player 15 / upside 1 / intel 19 | 29 | 30 | 30 | 1.033 | 1 |
| 6 | search | consensus 26 / need 31 / player 16 / upside 1 / intel 26 | 29 | 30 | 30 | 1.033 | 1 |
| 7 | search | consensus 26 / need 31 / player 17 / upside 1 / intel 25 | 29 | 30 | 30 | 1.033 | 1 |
| 8 | search | consensus 26 / need 31 / player 18 / upside 1 / intel 24 | 29 | 30 | 30 | 1.033 | 1 |
| 9 | search | consensus 26 / need 31 / player 18 / upside 2 / intel 23 | 29 | 30 | 30 | 1.033 | 1 |
| 10 | search | consensus 26 / need 31 / player 19 / upside 1 / intel 23 | 29 | 30 | 30 | 1.033 | 1 |

## Remaining Non-Top Picks

| Pick | Team | Target selection | Trained winner | Target rank | Target minus winner score |
| --- | --- | --- | --- | --- | --- |
| 15 | Chicago Bulls | Nate Ament | Allen Graves | 2 | -1.391 |

## Outputs

- Training JSON: `data/reports/prediction_model_training_20260624.json`
- Trained rerank board: `data/boards/trained_prediction_model_board_20260624.json`
- Training report: `data/reports/prediction_model_training_20260624.md`

## Boundary

This trains the scoring layer on recorded sequential candidate states. It is suitable for parameter calibration and evidence review, but it does not replace a fresh end-to-end sequential rerun unless those trained weights are later wired into the generating script.
