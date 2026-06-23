# DraftOps RAG Source Cleaning

Generated: 2026-06-23T16:21:11.217Z

## Summary

- Quality gate: enabled
- Sources inspected: 55
- Raw chunks: 1305
- Kept chunks: 1304
- Dropped chunks: 1
- Secret-like token redactions: 0
- Excluded sources: data/reports/milestone_deepseek_discussion_20260623.json, data/reports/milestone_deepseek_discussion_20260623.md, data/reports/deepseek_exam_answers.json, data/reports/deepseek_exam_answers.txt

## Sources

| Source | Category | Trust tier | Raw | Kept | Dropped | Redactions | Drop reasons |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| public/data/agent_expanded_board.json | core-board | locked-artifact | 24 | 24 | 0 | 0 | none |
| public/data/final_import_bundle.json | core-board | locked-artifact | 24 | 24 | 0 | 0 | none |
| public/data/agent_expanded_recommended_board.json | core-board | locked-artifact | 24 | 24 | 0 | 0 | none |
| public/data/agent_balanced_board.json | core-board | locked-artifact | 24 | 24 | 0 | 0 | none |
| public/data/expanded_import_bundle.json | core-board | locked-artifact | 24 | 24 | 0 | 0 | none |
| data/reports/integrated_scoring_framework.json | core-board | project-report | 15 | 15 | 0 | 0 | none |
| data/reports/main_parameter_board_simulation.json | core-board | project-report | 24 | 24 | 0 | 0 | none |
| data/reports/main_parameter_board_simulation_report.md | core-board | project-report | 4 | 4 | 0 | 0 | none |
| data/final/final_import_bundle.json | core-board | locked-artifact | 24 | 24 | 0 | 0 | none |
| data/reports/multi_agent_top30_prediction_consensus_20260623.md | core-board | model-discussion-secondary | 8 | 8 | 0 | 0 | none |
| data/reports/prediction_strategy_audit_and_agent_rerun_20260623.md | core-board | project-report | 12 | 12 | 0 | 0 | none |
| data/final/expanded_import_bundle.json | core-board | locked-artifact | 24 | 24 | 0 | 0 | none |
| data/clean/clean_teams.json | team-preference | normalized-data | 24 | 24 | 0 | 0 | none |
| data/reports/a5_team_preference_report.md | team-preference | project-report | 2 | 2 | 0 | 0 | none |
| data/reports/team_preference_research_20260623.json | team-preference | project-report | 24 | 24 | 0 | 0 | none |
| data/normalized/normalized_2026_team_context.json | team-preference | normalized-data | 24 | 24 | 0 | 0 | none |
| data/reports/a5_web_team_context_report.md | team-preference | project-report | 5 | 5 | 0 | 0 | none |
| data/reports/team_preference_research_20260623.md | team-preference | project-report | 14 | 14 | 0 | 0 | none |
| data/reports/a5_team_fit_parameter_debate.md | team-preference | model-discussion-secondary | 17 | 17 | 0 | 0 | none |
| data/normalized/normalized_2026_official_team_profiles_30.json | team-preference | official-or-reverified | 24 | 24 | 0 | 0 | none |
| data/normalized/normalized_2026_official_prospects_101.json | prospect-evidence | official-or-reverified | 101 | 101 | 0 | 0 | none |
| data/normalized/normalized_2026_local_player_pool_124.json | prospect-evidence | normalized-data | 129 | 129 | 0 | 0 | none |
| data/normalized/normalized_2026_prospect_big_board.json | prospect-evidence | normalized-data | 24 | 24 | 0 | 0 | none |
| data/normalized/normalized_2026_mock_lottery.json | prospect-evidence | normalized-data | 24 | 24 | 0 | 0 | none |
| data/clean/clean_prospects.json | prospect-evidence | normalized-data | 24 | 24 | 0 | 0 | none |
| data/normalized/normalized_2026_online_player_list_reverification_20260623.json | prospect-evidence | official-or-reverified | 180 | 180 | 0 | 0 | none |
| data/normalized/normalized_china_nba_draft_board_20260623.json | prospect-evidence | normalized-data | 24 | 24 | 0 | 0 | none |
| data/reports/official_prospect_reconciliation_report.md | prospect-evidence | official-or-reverified | 2 | 2 | 0 | 0 | none |
| data/clean/official_prospect_reconciliation.json | prospect-evidence | official-or-reverified | 24 | 24 | 0 | 0 | none |
| public/data/prospect_media.json | prospect-evidence | locked-artifact | 24 | 24 | 0 | 0 | none |
| data/reports/official_double_agent_roster_audit_summary.md | prospect-evidence | official-or-reverified | 2 | 2 | 0 | 0 | none |
| data/reports/nba_official_expanded_data_audit_20260623.md | prospect-evidence | official-or-reverified | 4 | 4 | 0 | 0 | none |
| data/reports/china_nba_draft_scrape_report_20260623.md | prospect-evidence | project-report | 1 | 1 | 0 | 0 | none |
| data/reports/player_feature_parameter_reference_124_20260623.md | prospect-evidence | project-report | 24 | 24 | 0 | 0 | none |
| data/reports/online_full_player_list_reverification_20260623.md | prospect-evidence | project-report | 5 | 5 | 0 | 0 | none |
| data/raw/china-nba-draft-20260623.md | prospect-evidence | official-or-reverified | 24 | 23 | 1 | 0 | duplicate-within-source:1 |
| data/raw/nba-official-2026-prospects-live.md | prospect-evidence | official-or-reverified | 24 | 24 | 0 | 0 | none |
| data/normalized/normalized_2026_player_feature_reference_124.json | prospect-evidence | normalized-data | 180 | 180 | 0 | 0 | none |
| data/reports/milestone_deepseek_discussion_20260623.json | milestone | model-discussion-secondary | 0 | 0 | 0 | 0 | superseded-model-discussion: final milestone_answers.json and tolerance reports are the source of truth |
| data/reports/milestone_deepseek_discussion_20260623.md | milestone | model-discussion-secondary | 0 | 0 | 0 | 0 | superseded-model-discussion: final milestone_answers.json and tolerance reports are the source of truth |
| data/reports/deepseek_exam_answers.json | milestone | model-discussion-secondary | 0 | 0 | 0 | 0 | model-output-answer-file: final milestone_answers.json and evidence reports are the source of truth |
| data/reports/deepseek_exam_answers.txt | milestone | model-discussion-secondary | 0 | 0 | 0 | 0 | model-output-answer-file: final milestone_answers.json and evidence reports are the source of truth |
| data/documents/milestone-questions/DraftCode24里程碑事件预测.md | milestone | architecture-or-source-registry | 3 | 3 | 0 | 0 | none |
| data/final/milestone_answers.json | milestone | locked-artifact | 7 | 7 | 0 | 0 | none |
| data/reports/milestone_prediction_evidence_20260623.json | milestone | evidence-report | 24 | 24 | 0 | 0 | none |
| data/reports/milestone_answer_card_write_report_20260623.json | milestone | evidence-report | 2 | 2 | 0 | 0 | none |
| README.md | architecture | architecture-or-source-registry | 16 | 16 | 0 | 0 | none |
| data/README.md | architecture | architecture-or-source-registry | 4 | 4 | 0 | 0 | none |
| data/documents/README.md | architecture | architecture-or-source-registry | 1 | 1 | 0 | 0 | none |
| data/reports/current_external_data_update_summary.md | architecture | project-report | 6 | 6 | 0 | 0 | none |
| data/documents/document_index.json | architecture | architecture-or-source-registry | 1 | 1 | 0 | 0 | none |
| data/reports/raw_sources_registry_report.md | architecture | architecture-or-source-registry | 4 | 4 | 0 | 0 | none |
| data/reports/current_data_source_audit_20260623.md | architecture | project-report | 4 | 4 | 0 | 0 | none |
| data/raw/external_source_inventory.json | architecture | architecture-or-source-registry | 24 | 24 | 0 | 0 | none |
| data/raw/raw_sources.json | architecture | architecture-or-source-registry | 24 | 24 | 0 | 0 | none |
