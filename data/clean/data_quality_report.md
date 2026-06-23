# DraftOps Clean Data Quality Report

Generated at: 2026-06-21T19:54:33.696Z

## Scope

This clean package merges the existing DraftOps seed profiles with the current normalized 2026 prospect board, official first-round order, team context, mock-lottery cross-checks, and raw source registry. Source files were read only; app source files were not modified.

## Output Summary

- Prospects: 30
- Teams: 30
- Pick coverage: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30
- Prospect id uniqueness: pass
- Validation status: pass

## Prospect Matching

- Normalized big-board rows: 30
- Matched to seed prospects: 29
- New/generated prospects: 1
- Seed prospects not present in this normalized 30-player board: 1

New/generated prospects requiring manual profile review: Tarris Reed Jr.

Seed prospects excluded by the current normalized board: Joshua Jefferson.

## Team Review Flags

- Teams/picks marked needs_review by normalized team context: 15
- Unique first-round teams affected: 10

- Pick 3, Memphis Grizzlies: multiple_pick_mixed_signal; tags=forward, big, guard, creation
- Pick 6, Brooklyn Nets: mixed_signal_needs_review; tags=guard, wing, size, creation
- Pick 8, Atlanta Hawks: mixed_signal_needs_review; tags=guard, big, shooting
- Pick 9, Dallas Mavericks: mixed_signal_needs_review; tags=guard, wing, shooting, creation
- Pick 11, Golden State Warriors: fit_signal_needs_review; tags=big, size, shooting
- Pick 12, Oklahoma City Thunder: asset_and_fit_signal_needs_review; tags=big, wing, size
- Pick 14, Charlotte Hornets: explicit_need_with_trade_uncertainty; tags=forward, big, size, defense
- Pick 16, Memphis Grizzlies: multiple_pick_mixed_signal; tags=forward, big, guard, creation
- Pick 17, Oklahoma City Thunder: asset_and_fit_signal_needs_review; tags=big, wing, size
- Pick 18, Charlotte Hornets: explicit_need_with_trade_uncertainty; tags=forward, big, size, defense
- Pick 23, Atlanta Hawks: mixed_signal_needs_review; tags=guard, big, shooting
- Pick 26, Denver Nuggets: mixed_signal_needs_review; tags=guard, creation, forward, size, defense
- Pick 27, Boston Celtics: no_clear_need_source; tags=unknown
- Pick 29, Cleveland Cavaliers: mixed_signal_needs_review; tags=big, forward, creation, shooting
- Pick 30, Dallas Mavericks: mixed_signal_needs_review; tags=guard, wing, shooting, creation

## Source Risks

- Some supplemental prospect rows do not include height and/or age; existing seed values were retained where available and generated rows are marked for review.
- Prospect ranks 26-30 are supplemental ESPN mock-order rows because ESPN Big Board ranks 26-100 were not visible in the available extraction.
- Raw source policy: Use NBA.com official pages first; use major media as weighted signals; ignore social/self-media for model input.
- Raw source inventory counts: {"total_sources":42,"official_user_provided":11,"external_web":29,"ignored_external":8,"official_live_web":2}
- Team need tags from rows marked needs_review were not appended to DraftOps priorityTags; seed needs were preserved to avoid inventing unsupported needs.

## Validation

- JSON parseable: pass
- teams exactly 30: pass
- prospects at least 30: pass
- pick coverage 1-30: pass
- prospect ids unique: pass
- positions constrained to PG/SG/SF/PF/C: pass
- phase constrained to rebuild/accelerate/contend/asset: pass
- profile scores in 0-100: pass

## Manual Review Required

- Tarris Reed Jr.: generated conservative profile because no seed prospect match exists and normalized supplemental row lacks height/age/weight.
- Supplemental ranks 26-30: normalized source supplies limited physical data; retained seed values where available.
- needs_review team-context rows: keep seed needs until a stronger current source confirms exact needs.

## Official Prospects Reconciliation

- Checked at: 2026-06-22T04:04:42+08:00
- Official NBA.com prospect rows parsed: 101
- Final prospects matched to official Prospects page: 30/30
- Missing from official Prospects page: 0
- Canonical name updates: 2
- Base biographical fields now follow NBA.com official Prospects.
- Detailed scouting profile fields are preserved from DraftOps seed/clean data and remain subject to basketball review.
