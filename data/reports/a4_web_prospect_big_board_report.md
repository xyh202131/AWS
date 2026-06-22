# A4 Web Prospect Big Board Report

Generated: 2026-06-22T03:46:42+08:00

## Summary

- Output prospects: 30 unique candidates.
- Network used: yes. A supplemental ESPN Top 100 Firecrawl scrape was run because the local ESPN Top 100 artifact exposed only 25 ranked prospect entries; the fresh scrape also exposed only those 25.
- Stable top N: 30. Ranks 1-25 come from the visible ESPN Big Board. Ranks 26-30 are supplemental unique candidates from ESPN final mock first-round pick order.
- Top 60/100 status: not stable from available artifacts. ESPN Big Board ranks 26-100 were not visible, and the ESPN final mock local raw exposed first round only.

## Sources Used

| Source | URL | Coverage | Use |
| --- | --- | --- | --- |
| ESPN Big Board Top 100 | https://www.espn.com/nba/story/_/id/46886245/2026-nba-draft-big-board-rankings-top-100-prospects-players | 25 visible ranked prospects | Primary rank/profile source for normalized ranks 1-25 |
| ESPN final mock | https://www.espn.com/nba/story/_/id/49041464/2026-nba-mock-draft-projecting-60-picks-draft-night-trade-talks-boozer-peterson-dybantsa-acuff | 30 visible first-round picks | Supplemented candidates not visible in ESPN top 25 |
| NBA.com consensus mock | https://www.nba.com/news/2026-consensus-mock-draft | 14 lottery prospects | Official consensus cross-check flag |

## Supplemental Crawl Record

- Actual tool call: `mcp__firecrawl.firecrawl_scrape`
- URL: https://www.espn.com/nba/story/_/id/46886245/2026-nba-draft-big-board-rankings-top-100-prospects-players
- Equivalent CLI command: `firecrawl scrape "https://www.espn.com/nba/story/_/id/46886245/2026-nba-draft-big-board-rankings-top-100-prospects-players" --only-main-content --wait-for 5000 --format json`
- Result: partial; visible top 25 only.

## Field Gaps

- ESPN Top 100: only ranks 1-25 were visible in both local raw and supplemental scrape, so ranks 26-100 are not claimed.
- ESPN final mock: local raw exposed 30 first-round pick blocks; mock-only supplemental rows use mock pick context, not ESPN Big Board rank.
- Mock-only supplemental rows may lack height, age, and previous-rank fields because those fields were not present in the ESPN mock blocks.
- NBA.com consensus is used as a lottery cross-check only; it does not cover the full 30-player output.

## NBA.com Consensus Lottery Crossovers

| Prospect | Normalized Rank | ESPN Big Board Rank | NBA.com Consensus Pick | Most Common |
| --- | --- | --- | --- | --- |
| AJ Dybantsa | 2 | 2 | 1 | 1 (10) |
| Darryn Peterson | 1 | 1 | 2 | 2 (8) |
| Cameron Boozer | 3 | 3 | 3 | 3 (8) |
| Caleb Wilson | 4 | 4 | 4 | 4 (8) |
| Keaton Wagler | 5 | 5 | 5 | 5 (8) |
| Darius Acuff Jr. | 6 | 6 | 6 | 6 (5) |
| Mikel Brown Jr. | 7 | 7 | 7 | 6 (4) |
| Kingston Flemings | 8 | 8 | 8 | 7, 9 (3) |
| Brayden Burries | 11 | 11 | 9 | 9 (5) |
| Aday Mara | 10 | 10 | 10 | 8 (4) |
| Nate Ament | 9 | 9 | 11 | 10, 12 (3) |
| Yaxel Lendeborg | 12 | 12 | 12 | 11, 12 (4) |
| Karim Lopez | 14 | 14 | 13 | 11 (2) |
| Morez Johnson Jr. | 15 | 15 | 14 | 14 (8) |

## Supplemental Mock-Only Candidates

| Rank | Prospect | ESPN Mock Pick | Team | Source |
| --- | --- | --- | --- | --- |
| 26 | Henri Veesaar | 24 | New York Knicks | ESPN 2026 NBA mock draft projecting 60 picks |
| 27 | Koa Peat | 26 | Denver Nuggets | ESPN 2026 NBA mock draft projecting 60 picks |
| 28 | Meleek Thomas | 27 | Boston Celtics | ESPN 2026 NBA mock draft projecting 60 picks |
| 29 | Tarris Reed Jr. | 29 | Cleveland Cavaliers | ESPN 2026 NBA mock draft projecting 60 picks |
| 30 | Sergio de Larrea | 30 | Dallas Mavericks | ESPN 2026 NBA mock draft projecting 60 picks |

## Output Files

- data/normalized/normalized_2026_prospect_big_board.json
- data/reports/a4_web_prospect_big_board_report.md
