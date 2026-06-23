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
- `boards/sequential_dynamic_board_123_audit_deepseek_llm.json`
  - DeepSeek LLM-generated parameter rerun. It reviewed the same 123-player pool sequentially and matched the mild board's player order.
- `boards/codex_llm_rag_sequential_123_prediction_20260623.json`
  - Codex LLM + local tool/RAG sequential rerun. Codex made one selection per pick after reading generated local packets, with the selected prospect removed before the next pick.
- `boards/deepseek_agentic_tool_123_prediction_20260623.json`
  - Third-round DeepSeek tool-driven rerun. DeepSeek is used only as the LLM decision layer after mandatory data analysis, clean RAG retrieval, and shortlist validation.
- `boards/codex_sequential_123_prediction_20260623.json`
  - Third-round Codex independent sequential rerun. It reviews the 123-unique-candidate pool pick by pick, removes each selected prospect, and stores full per-pick scores.
- `boards/consensus_10_agent_prediction_20260624.json`
  - Fourth consensus rerun. Ten parameterized agent lenses vote each pick, debate until at least 7/10 agree, then remove the selected prospect before the next pick.
- `boards/consensus_10_agent_prediction_20260624_relative.json`
  - Relative-score consensus rerun. Each pick recomputes candidate scores relative to that team's current remaining pool before voting; after a player is selected, he is removed and the next team is rescored from scratch.

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
- `reports/llm_variant_generation_20260623.md`
  - DeepSeek LLM parameter generation record. Claude generation is pending because the local Claude subscription CLI hit its session limit.
- `reports/llm_variant_generation_20260623.json`
  - Structured LLM parameter generation artifact.
- `reports/sequential_dynamic_board_123_audit_deepseek_llm_20260623.md`
  - DeepSeek LLM parameter rerun report.
- `reports/claude_format_failure_data_audit_20260623.md`
  - Audit of the earlier Claude non-JSON run. The complete raw Claude response was not recoverable, so no Claude-labeled board was created from it.
- `reports/codex_llm_rag_sequential_123_prediction_20260623.md`
  - Human-readable report for the Codex LLM + local tool/RAG sequential rerun, including final board, validation summary, and frontend-board differences.
- `reports/deepseek_agentic_tool_123_prediction_20260623.md`
  - Human-readable report for the third-round DeepSeek tool-driven rerun.
- `reports/codex_sequential_123_prediction_20260623.md`
  - Human-readable report for the third-round Codex independent sequential rerun.
- `reports/third_round_prediction_audit_20260623.md`
  - Final third-round audit summary for the DeepSeek tool-driven and Codex independent reruns.
- `reports/third_round_prediction_audit_20260623.json`
  - Structured audit result proving both third-round boards have 30 picks, 30 unique selections, 93 remaining prospects, and 3255 total candidate scans/reviews.
- `reports/consensus_10_agent_prediction_20260624.md`
  - Human-readable report for the 10-agent consensus rerun.
- `reports/consensus_10_agent_prediction_audit_20260624.md`
  - Audit report for the 10-agent consensus rerun.
- `reports/consensus_10_agent_prediction_audit_20260624.json`
  - Structured audit result for the 10-agent consensus rerun.
- `reports/consensus_10_agent_prediction_20260624_relative.md`
  - Human-readable report for the relative-score 10-agent consensus rerun.
- `reports/consensus_10_agent_prediction_audit_20260624_relative.md`
  - Audit report for the relative-score 10-agent consensus rerun.
- `reports/consensus_10_agent_prediction_audit_20260624_relative.json`
  - Structured audit result proving the relative-score rerun has 30 unique picks, 93 remaining prospects, 3255 total reviews, and all picks at or above the 7/10 agreement threshold.
- `reports/real_subagent_challenge_summary_20260624.md`
  - Summary of the ten real read-only subagent challenge passes around the 10-agent consensus rerun. It records disputes and hallucination checks but does not manually override the script-generated board.

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
- `inputs/deepseek_llm_variant_20260623.json`
  - Parameter variant returned by DeepSeek for the LLM rerun.

## Scripts

- `scripts/run-local-pool-124-prediction.mjs`
  - Builds the local-pool baseline.
- `scripts/run-sequential-dynamic-pick-audit.mjs`
  - Runs sequential dynamic scoring variants.
- `scripts/deepseek-board-change-discussion.mjs`
  - Runs DeepSeek discussion against changed slots.
- `scripts/codex-llm-rag-session.mjs`
  - Interactive helper for the Codex LLM + local tool/RAG sequential rerun. It creates per-pick packets, validates each selected prospect, checkpoints progress, and writes final artifacts.
- `scripts/deepseek-agentic-tool-prediction.mjs`
  - Runs the third-round DeepSeek tool-driven prediction with mandatory analysis tools, clean RAG retrieval, shortlist-only selection, checkpoint/resume, and JSON validation.
- `scripts/codex-sequential-prediction.mjs`
  - Runs the third-round Codex independent sequential prediction with full allScores retention and no manual override.
- `scripts/audit-third-round-predictions.mjs`
  - Audits both third-round boards for candidate-pool validity, pick uniqueness, sequential removal, full scoring coverage, RAG evidence, and guardrails.
- `scripts/run-consensus-10-agent-prediction.mjs`
  - Runs the 10-agent consensus rerun using existing history as calibration anchors plus local candidate, team preference, and feature data.
- `scripts/audit-consensus-10-agent-prediction.mjs`
  - Audits the 10-agent consensus rerun for local-pool validity, 7/10 vote threshold, uniqueness, sequential removal, full allScores coverage, and no manual override.
- `scripts/run-consensus-10-agent-relative-prediction.mjs`
  - Archived copy of the relative-score version of the 10-agent consensus runner.
- `scripts/audit-consensus-10-agent-relative-prediction.mjs`
  - Archived copy of the audit script used for the relative-score run.

## Current Analysis Note

The mild rerun is the cleanest candidate for follow-up analysis. It preserves the stable top board while only changing picks 18 and 21 compared with the first sequential dynamic rerun.

The DeepSeek LLM rerun currently produces the same top-30 player order as the mild rerun. Its only parameter difference is a slightly lower athletic-deficit penalty, so it is best treated as confirmation of the mild board rather than a materially different board.

Codex LLM + RAG rerun status: archived. It produced 30 picks, 30 unique selections, 93 remaining prospects, 3255 total candidate reviews, and 18 changed slots versus the current frontend board.

Third-round rerun status: archived and audited. The DeepSeek tool-driven board produced 30 picks, 30 unique selections, 93 remaining prospects, 3255 total candidate scans, and 11 changed slots versus the current frontend board. The Codex independent board produced 30 picks, 30 unique selections, 93 remaining prospects, 3255 total candidate reviews, and 18 changed slots versus the current frontend board. `reports/third_round_prediction_audit_20260623.md` is the compact validation entry point.

10-agent consensus rerun status: archived and audited. It loaded existing prediction history as calibration anchors, then used ten parameterized agent lenses to vote each pick until a candidate reached at least 7/10 agreement. It produced 30 picks, 30 unique selections, 93 remaining prospects, 3255 total candidate reviews, every pick reached threshold, average vote count 9.57/10, and 13 changed slots versus the current frontend board.

Relative-score correction status: archived and audited. This rerun changes scoring from absolute weighted scores to per-team, per-pick relative scores over the current remaining candidate pool. It produced 30 picks, 30 unique selections, 93 remaining prospects, 3255 total candidate reviews, every pick reached threshold, average vote count 9.3/10, and 19 changed slots versus the current frontend board.

Claude rerun status: pending. The local Claude CLI returned a subscription session-limit error and said it resets at `1:10am (Asia/Shanghai)`.

Claude raw-output safeguard: `scripts/generate-llm-variant-configs.mjs` now saves future parse failures under `data/reports/llm_variant_raw_failures/`, so prose-form Claude responses can be inspected later without manually predicting players.

Remaining fragile picks for discussion:

- 10: Yaxel Lendeborg vs Karim Lopez
- 12: Hannes Steinbach vs Karim Lopez
- 15: Nate Ament vs Allen Graves
- 18/21: Labaron Philon Jr. vs Christian Anderson
- 26: Henri Veesaar vs Tarris Reed Jr.
- 30: Jack Kayil and nearby alternatives
