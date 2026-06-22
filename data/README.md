# DraftOps Data Workspace

This folder is the handoff area for the multi-agent workflow described in `../多Agent协作指导.md`.

Agents should write structured intermediate outputs here instead of editing source files directly.

```text
raw/          original source captures and source metadata
normalized/   standardized rows before final cleanup
clean/        DraftOps-compatible prospects and teams
reports/      audit reports, conflict notes, parameter notes
boards/       generated board variants
final/        final import bundle, final board, milestone answers
```

Do not place secrets, paid-account credentials, or private Team Portal tokens in this directory.

## Current Artifacts

Raw/source layer:

- `raw/raw_sources.json`: unified registry for official local files and external web sources.
- `raw/external_source_inventory.json`: classified external source inventory.
- `raw/firecrawl-2026-*.json`: Firecrawl captures for 2026 big board, draft order, mock draft, and team needs.
- `raw/nba-official-2026-prospects-live.md`: live NBA.com official Prospects capture used for final candidate reconciliation.
- `raw/nba-official-2026-draft-order-live.md`: live NBA.com official Draft Order capture used for team/pick reconciliation.

Normalized 2026 layer:

- `normalized/normalized_2026_mock_lottery.json`: NBA.com consensus lottery top 14 plus 10 media mock blocks.
- `normalized/normalized_2026_team_context.json`: NBA.com official 60-pick order, team profile links, and team need signals.
- `normalized/normalized_2026_prospect_big_board.json`: 30 unique 2026 prospect candidates from ESPN big board/mock and NBA.com consensus cross-checks.

Reports:

- `reports/raw_sources_registry_report.md`
- `reports/a1_web_source_inventory_report.md`
- `reports/a2_web_mock_normalization_report.md`
- `reports/a4_web_prospect_big_board_report.md`
- `reports/a5_web_team_context_report.md`
- `reports/current_external_data_update_summary.md`

Clean/final layer:

- `clean/clean_prospects.json`: DraftOps-compatible 30-prospect clean list.
- `clean/clean_teams.json`: DraftOps-compatible first-round 30-team clean list.
- `clean/data_quality_report.md`: validation and manual-review report.
- `clean/official_prospect_reconciliation.json`: official NBA.com prospect/order reconciliation audit.
- `final/final_import_bundle.json`: current frontend import bundle.

Current status: all 30 final-bundle prospects are present in NBA.com official Prospects, and first-round team picks match NBA.com official Draft Order. The final bundle still carries manual-review flags for generated scouting profile details and teams marked `needs_review`.
