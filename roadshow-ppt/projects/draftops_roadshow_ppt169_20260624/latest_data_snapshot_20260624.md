# DraftOps Latest Data Snapshot

Generated for PPT data alignment on 2026-06-24.

## Local Verified Facts

| Fact | Value | Source |
|---|---:|---|
| Frontend teams | 30 | `public/data/expanded_import_bundle.json` |
| Frontend candidate pool | 123 | `public/data/expanded_import_bundle.json` |
| Local answer-card pool | 124 | `data/normalized/normalized_2026_local_player_pool_124.json` |
| Player feature records | 124 | `data/normalized/normalized_2026_player_feature_reference_124.json` |
| Locked board picks | 30 | `public/data/agent_expanded_recommended_board.json` |
| Unique selected prospects | 30 | `public/data/agent_expanded_recommended_board.json` |
| Low-confidence picks | 0 | `public/data/agent_expanded_recommended_board.json` |
| Manual override | false / `noManualOverride: true` | `public/data/agent_expanded_recommended_board.json` |
| Relative candidate reviews | 3255 | `public/data/agent_expanded_recommended_board.json` |
| Milestone answers | 7 | `data/final/milestone_answers.json` |
| RAG indexes | 5 | `data/rag/rag-manifest.json` |
| RAG kept chunks | 1304 | `data/rag/rag-manifest.json` |
| RAG source count | 55 | `data/rag/rag-manifest.json` |

## Online Watch Results

- `npm run draft:watch -- --once`: no change; NBA China populated 0/60; NBA.com Prospects 101; Combine 73/78; Early-entry 71; local pool 124.
- `npm run news:watch -- --once --official-only`: no new team-change signal; checked 4/4 official sources; current related signals 76.

## PPT Usage Rule

- Use `123` for the current frontend candidate pool.
- Use `124` for local answer-card pool and feature records.
- Use `101` only when explicitly referring to the online NBA.com Prospects monitor.
- Use `7` for current milestone answers.
- Use `1304 / 55` for RAG kept chunks and source count.
- Use `3255` only for relative scoring candidate-review evidence.
