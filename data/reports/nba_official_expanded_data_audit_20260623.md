# NBA Official Expanded Data Audit

Generated at: 2026-06-23T09:09:48.424Z

Scope: expand judgment data without replacing the current prediction bundle. This audit adds the official 101-prospect pool and first-round 30 pick-team context.

## Sources

- NBA.com Prospects: https://www.nba.com/draft/2026/prospects
- NBA.com Draft Order: https://www.nba.com/news/2026-nba-draft-order
- NBA.com Team Profiles: https://www.nba.com/draft/2026/team-profiles/
- NBA China Draft cross-check: https://china.nba.cn/draft/

## Output Files

- `data/normalized/normalized_2026_official_prospects_101.json`
- `data/normalized/normalized_2026_official_team_profiles_30.json`

## Validation Summary

| Check | Result |
| --- | --- |
| Current NBA.com prospects parsed | 101/101 |
| Duplicate prospect names | 0 |
| Prospects missing required fields | 0 |
| Previous local NBA.com prospects capture count | 101/101 |
| Added vs previous local prospects capture | 0 |
| Removed vs previous local prospects capture | 0 |
| Final bundle 30 prospects present in official 101 | PASS |
| Recommended board 30 prospects present in official 101 | PASS |
| NBA.com first-round pick-team rows parsed | 30/30 |
| Unique team profile URLs scraped | 24/24 |
| NBA.com order vs local final bundle teams | PASS |
| NBA.com order vs local normalized team context | PASS |
| NBA.com order vs NBA China first-round teams | PASS |
| NBA China published top players vs recommended board | PASS |

## Notes

- The 30-team output means 30 first-round pick-team rows. Because some teams own multiple first-round picks, those rows map to 24 unique NBA.com team profile pages.
- This does not overwrite `data/final/final_import_bundle.json`; it adds expanded context for deeper judgment.
- NBA China currently publishes players for picks 1-3 only in the scraped table; picks 4-30 remain blank there, so 4-30 are still prediction-board context rather than verified official result picks.
- First pick has NBA China draft-day trade destination `Atlanta Hawks`; this is retained in `nbaChinaDraftDayTradeTo` on pick 1.

## Watch Items

These are page-section presence notes, not core validation failures. Some NBA.com team profile pages simply do not expose a `Free Agents` or `The Way to Go` section in the current scrape.

- Utah Jazz: missing hasFreeAgents
- Memphis Grizzlies: missing hasFreeAgents
- Chicago Bulls: missing hasFreeAgents
- Brooklyn Nets: missing hasFreeAgents
- Sacramento Kings: missing hasWayToGo, hasFreeAgents
- Dallas Mavericks: missing hasFreeAgents
- Milwaukee Bucks: missing hasFreeAgents
- Oklahoma City Thunder: missing hasWayToGo, hasFreeAgents
- Toronto Raptors: missing hasFreeAgents
- Detroit Pistons: missing hasFreeAgents
- Philadelphia 76ers: missing hasFreeAgents
- New York Knicks: missing hasFreeAgents
- Denver Nuggets: missing hasWayToGo, hasFreeAgents
- Boston Celtics: missing hasFreeAgents
- Minnesota Timberwolves: missing hasWayToGo, hasFreeAgents
- Cleveland Cavaliers: missing hasFreeAgents
