# Prediction Reruns Archive

Folder:

`C:\Users\24048\Desktop\AWS\draftops\data\analysis\prediction-reruns-20260623`

Purpose:

This folder is a copied archive of the major 123-player-pool prediction reruns and related discussion artifacts. Original files remain in their normal `data/boards`, `data/reports`, `data/final`, `data/normalized`, and `scripts` locations.

## Boards

- `boards/local_pool_124_baseline_board.json`
  - First valid 124-row source / 123-unique-candidate baseline using existing board logic.
- `boards/sequential_dynamic_board_123_audit.json`
  - First sequential dynamic rerun: score current pick, remove selected player, continue.
- `boards/sequential_dynamic_board_123_audit_deepseek_guardrails.json`
  - Strong DeepSeek guardrail stress-test variant.
- `boards/sequential_dynamic_board_123_audit_deepseek_mild.json`
  - Mild DeepSeek parameter rerun; current best candidate parameter set for analysis.

## Reports

- `reports/local_pool_124_prediction_rerun_20260623.md`
  - Baseline local-pool rerun summary.
- `reports/sequential_dynamic_board_123_audit_20260623.md`
  - First sequential dynamic rerun report.
- `reports/sequential_dynamic_board_123_audit_deepseek_guardrails_20260623.md`
  - Strong guardrail stress-test report.
- `reports/sequential_dynamic_board_123_audit_deepseek_mild_20260623.md`
  - Mild parameter rerun report.
- `reports/deepseek_board_change_discussion_20260623.md`
  - DeepSeek three-round discussion of whether changes were reasonable.
- `reports/deepseek_board_change_discussion_20260623.json`
  - Full structured DeepSeek discussion artifact.
- `reports/board_change_reasonableness_review_20260623.md`
  - Codex + DeepSeek reasonableness review summary.
- `reports/mild_parameter_rerun_summary_20260623.md`
  - Concise summary of the mild rerun and remaining fragile picks.

## Inputs

- `inputs/local_pool_124_import_bundle.json`
  - Candidate bundle used for local 123-player scoring.
- `inputs/normalized_2026_local_player_pool_124.json`
  - Normalized source player pool from the competition sheet.
- `inputs/normalized_2026_player_feature_reference_124.json`
  - Player feature and combine/shooting reference data.
- `inputs/team_preference_research_20260623.json`
  - Team preference families and confidence coefficients.
- `inputs/weight_scenarios.json`
  - Baseline scoring weight configuration.

## Scripts

- `scripts/run-local-pool-124-prediction.mjs`
  - Builds the local-pool baseline.
- `scripts/run-sequential-dynamic-pick-audit.mjs`
  - Runs sequential dynamic scoring variants.
- `scripts/deepseek-board-change-discussion.mjs`
  - Runs DeepSeek discussion against changed slots.

## Current Analysis Note

The mild rerun is the cleanest candidate for follow-up analysis. It preserves the stable top board while only changing picks 18 and 21 compared with the first sequential dynamic rerun.

Remaining fragile picks for discussion:

- 10: Yaxel Lendeborg vs Karim Lopez
- 12: Hannes Steinbach vs Karim Lopez
- 15: Nate Ament vs Allen Graves
- 18/21: Labaron Philon Jr. vs Christian Anderson
- 26: Henri Veesaar vs Tarris Reed Jr.
- 30: Jack Kayil and nearby alternatives
