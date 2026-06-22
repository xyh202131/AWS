# Official Prospect Reconciliation Report

Checked at: 2026-06-22T04:04:42+08:00

## Official Sources

- NBA.com 2026 Draft Prospects: https://www.nba.com/draft/2026/prospects
- NBA.com 2026 Draft Order: https://www.nba.com/news/2026-nba-draft-order
- Local captures: `data/raw/nba-official-2026-prospects-live.md`, `data/raw/nba-official-2026-draft-order-live.md`

## Result

- Official prospect rows parsed: 101
- Final prospects checked: 30
- Matched on official Prospects page: 30
- Missing from official Prospects page: 0
- Official first-round order rows parsed: 30
- Team pick validation errors: 0

All 30 final-bundle prospects are present in the NBA.com official Prospects list.

## Canonical Name Updates

- `Christian Anderson Jr.` -> `Christian Anderson`
- `Sergio de Larrea` -> `Sergio De Larrea`

## Base Field Policy

- Updated player `name`, `school`, `height`, `weight`, `age`, `classYear`, `origin`, and `international` from NBA.com official Prospects.
- Converted NBA.com coarse positions to DraftOps app positions: `G` -> `PG/SG`, `F` -> `SF/PF`, `C` -> `C`, `F-C` -> `PF/C`, `G-F` -> `SG/SF`.
- Existing scouting `profile`, `roleTags`, `strengths`, and `risks` were preserved because NBA.com Prospects is a biographical list, not a scouting model.
- Media mock data remains a prediction signal and no longer overrides official biographical fields.

## Manual Review Still Required

- `Tarris Reed Jr.` now has official NBA.com biographical fields, but his scoring profile and tags were still generated conservatively and need basketball review.
- Team need signals marked `needs_review` remain unresolved; official Draft Order only validates pick/team ownership, not tactical needs.
- NBA.com official Draft Order validates team/pick order, but pick 30 source text is malformed in the captured markdown; existing parsed value still matches Dallas from Oklahoma City via WAS and PHI.
