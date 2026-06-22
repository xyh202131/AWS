# A2 Web Mock Normalization Report

Generated at: 2026-06-22T03:33:07+08:00

## Scope

- Input files used: `data/raw/firecrawl-2026-mock-draft-search.json`, `data/raw/firecrawl-2026-big-board-search.json`, `data/raw/external_source_inventory.json`.
- Primary extraction target: NBA.com Consensus Mock Draft local Firecrawl result at `https://www.nba.com/news/2026-consensus-mock-draft`.
- Normalized output: 14 NBA.com consensus lottery records and 140 media mock pick rows from 10 listed mocks.
- No network access was used. All data came from the local raw Firecrawl JSON files and the local source inventory.

## Field Provenance

- `consensus_lottery`: `pick`, `team`, `player`, `school_or_team`, `position`, `height`, `class_or_status`, `most_common_pick`, and `most_common_votes` were parsed from the NBA.com "Consensus Mock Draft Top 14" player cards.
- `source_url`, `source_name`, and `source_date` for consensus rows came from the same NBA.com Firecrawl result and article header. The article header text was: `June 19, 2026 9:41 AM`.
- `source_mock_picks`: `source_name`, `source_url`, `source_last_updated`, `pick`, and `player` were parsed from the NBA.com "MOCK DRAFTS" markdown section listing ESPN.com, The Ringer, The Athletic, Yahoo Sports, Bleacher Report, NetScouts Basketball, CBS Sports, Hoops HQ, SB Nation, and USA Today / For the Win.
- `team_if_available` is present but set to `null` for media mock rows because the NBA.com media mock table lists pick number and player only, not the team attached to each source's original mock row.
- `sources` combines NBA.com page metadata, local inventory source typing/credibility where available, and notes on the inspected big-board raw file. The big-board file was not used to override NBA.com consensus profile fields.

## Parsing Method

- Parsed the Firecrawl JSON structurally first, then extracted two bounded markdown sections from the NBA.com page: "Consensus Mock Draft Top 14" and "MOCK DRAFTS".
- The Top 14 player cards had regular heading/info/status/most-common lines and were parsed deterministically.
- The media mock lists were markdown text only, so each source block was parsed by source link, 14 numbered rows, and `Last updated` text.
- Tied `most_common_pick` values are represented as arrays, for example Kingston Flemings has `[7, 9]` and Nate Ament has `[10, 12]`.

## Gaps And Risks

- Individual media mock rows in NBA.com's embedded table do not include teams; downstream consumers should not treat `team_if_available: null` as missing draft order, only as unavailable per-source team text.
- Original linked media pages were not re-fetched. Some sources may have fuller team/trade context, later updates, or paywall constraints not captured in the NBA.com aggregate table.
- The Athletic, ESPN, and some other linked sources can be paywalled or dynamically rendered; this run intentionally used the locally crawled NBA.com aggregate rather than attempting live access.
- Chinese names/translations were not generated or normalized. Player names are preserved from the English source text, including accents such as `Karim López`.
- NBA.com's page includes both a "MOST COMMON PICKS" summary and Top 14 cards. The normalized `most_common_*` fields come from the Top 14 cards. One visible count discrepancy remains in the source text for Brayden Burries at pick 9: the earlier summary says 4 votes while the Top 14 card says 5.
- NBA.com source-footnote links/attributions contain minor inconsistencies in the raw markdown; the normalization trusts the main "MOCK DRAFTS" source names and links above each 14-pick block.

## Key Counts

- Consensus lottery rows: 14
- Media mock sources: 10
- Media mock pick rows: 140
- Expected rows per media mock: 14
