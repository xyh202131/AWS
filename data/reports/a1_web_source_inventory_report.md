# A1 Web Source Inventory Report

Scope: local-only review of Firecrawl raw JSON files. No web access, no source-code edits, and no long webpage excerpts copied.

Raw files reviewed:

- `data/raw/firecrawl-2026-big-board-search.json`
- `data/raw/firecrawl-2026-draft-order-search.json`
- `data/raw/firecrawl-2026-mock-draft-search.json`
- `data/raw/firecrawl-2026-team-needs-search.json`

## Summary

The four raw files contain 34 search result rows and 29 unique URLs. The usable set is concentrated in NBA.com, ESPN, CBS Sports, Yahoo Sports, The Ringer, The Athletic via NBA.com, Bleacher Report, Tankathon, RealGM, and NBC Sports. Social posts, Reddit threads, Wikipedia, and self-media YouTube results should not feed the final prediction data.

Recommended downstream inventory:

- Structured source list: `data/raw/external_source_inventory.json`
- Primary source of truth for draft order: NBA.com official draft order.
- Primary mock/board sources: NBA.com consensus, ESPN, The Athletic, CBS Sports, Yahoo Sports, The Ringer.
- Secondary/support sources: Bleacher Report, NBC Sports, Tankathon, RealGM.
- Ignore or context-only: Reddit, Facebook, Instagram, Wikipedia, and most YouTube results.

## Classification Rules

- Authoritative: official NBA.com pages and NBA.com-hosted official aggregation. Use first for draft order and consensus aggregation.
- Usable: professional media or specialist references with identifiable outlet/editorial process. Use with source weighting and deduplication.
- Context only: official outlet videos where a structured article exists; useful only as fallback transcript context.
- Ignore: social reposts, community discussion, self-media videos, and non-primary encyclopedic pages.

## Authoritative Sources

| Source | URLs | Use |
| --- | --- | --- |
| NBA.com official draft hub | `https://www.nba.com/draft/2026` | Official draft hub, team profile links, prospect/profile entry point. |
| NBA.com draft order | `https://www.nba.com/news/2026-nba-draft-order` | Source of truth for pick order and rounds. |
| NBA.com consensus mock | `https://www.nba.com/news/2026-consensus-mock-draft` | Official aggregation of external mocks; use for consensus, not as league preference. |

## Usable Sources

| Source | URLs | Use | Notes |
| --- | --- | --- | --- |
| ESPN | big board, final mock, post-combine mock, Draftcast | Prospect rankings, profiles, 60-pick mocks, team intel, pick-by-round validation. | Deduplicate the final mock URL, which appears in multiple raw files. Use the final mock over the older post-combine mock on conflicts. |
| CBS Sports | `2026-nba-mock-draft-isaac-trotter`, Norlander mock URL | First-round projections and team-fit notes. | Treat different authors as same outlet family unless applying author-level weights. |
| Yahoo Sports | `https://sports.yahoo.com/nba/draft/` | Mock draft projections and consensus comparison. | Use direct Yahoo page, not Facebook repost. |
| The Ringer | `https://theringer.com/nba-draft/2026/mock-draft` | Mock draft and player/team-fit context. | Appears in two searches; deduplicate by URL. |
| The Athletic | `https://www.nba.com/news/the-athletic-latest-mock-draft` | External expert mock and team-fit context. | Hosted on NBA.com but should be counted as The Athletic/Sam Vecenie signal, not official NBA forecast. |
| Bleacher Report | `https://bleacherreport.com/articles/25441296-2026-nba-mock-draft-consensus-picks-every-1st-rounder` | Secondary mock/consensus signal. | Usable but lower weight than NBA.com consensus, ESPN, The Athletic, CBS, Yahoo, and The Ringer. |
| Tankathon | `https://www.tankathon.com/full-draft` | Draft-order sanity check. | Not official; NBA.com order overrides. |
| RealGM | `https://basketball.realgm.com/nba/draft/future_drafts/detailed` | Future pick obligations and trade provenance. | Not a mock source. Filter unrelated sports links from page chrome. |
| NBC Sports | `https://www.nbcsports.com/fantasy/basketball/news/nbc-sports-2026-nba-draft-big-board-aj-dybantsa-darryn-peterson-lead-the-way` | Secondary big-board comparison. | Useful as support, not core weighting source. |

## Context Only Or Ignore

| Source type | Raw examples | Decision |
| --- | --- | --- |
| Official media YouTube | CBS Sports and ESPN YouTube videos | Context only. Prefer structured ESPN/CBS web articles. |
| Self-media YouTube | Chat Sports, Utility Sports | Ignore for data ingestion. |
| Reddit | r/nba and r/washingtonwizards threads | Ignore; community discussion/repost only. |
| Facebook | azcentral/Yahoo reposts | Ignore; use underlying article only if separately fetched and evaluated. |
| Instagram | top-four order post | Ignore; partial social post. |
| Wikipedia | 2026 NBA draft page | Discovery only; do not use as final evidence while official/professional sources exist. |

## Named Source Decisions

- NBA.com official: authoritative for draft hub, draft order, and consensus aggregation.
- ESPN: high-credibility professional source for big board, player profiles, mock projections, and team intel.
- CBS Sports: high-credibility professional source; article pages are usable, videos are context-only.
- Yahoo Sports: high-credibility professional mock source; use direct Yahoo pages.
- The Ringer: high-credibility independent draft guide/mock source.
- The Athletic: high-credibility professional source, but raw result is NBA.com-hosted syndication; do not label it official NBA projection.
- Bleacher Report: usable secondary source; weight below the core professional/official set.
- Tankathon: useful draft-order cross-check, not official.
- RealGM: useful for future pick obligations and trade provenance, not for player mock ranking.
- YouTube/self-media: official outlet videos are fallback context only; self-media videos should be ignored.

## Recommended Ingestion Priority

1. Draft order: NBA.com draft order, then ESPN Draftcast/Tankathon as checks.
2. Consensus mock: NBA.com consensus mock, then direct ESPN/CBS/Yahoo/Ringer/Athletic/Bleacher sources for components.
3. Prospect quality: ESPN big board first, then NBC Sports and individual media guide notes as supporting signals.
4. Team needs and fit: ESPN final mock, CBS article mocks, The Ringer guide, and The Athletic via NBA.com.
5. Pick ownership and future obligations: RealGM plus NBA.com order; use RealGM for trade-provenance detail.

## Output

Created `data/raw/external_source_inventory.json` with `sourceId`, `sourceName`, `url`, `sourceType`, `credibility`, `usableFor`, and `notes` for each evaluated source.
