# Expanded Candidate Pool Rerun

Generated: 2026-06-23T06:24:47.705Z

## Scope

This rerun selects the first round from the NBA.com official 101-player prospect capture, not from the previous preselected 30-player bundle. It does not manually select, replace, or reorder players.

## Candidate Pool

- Official prospects parsed: 101
- Existing full DraftOps profiles retained: 30
- Expanded-pool fallback profiles generated: 71

Fallback profiles are deterministic and low-trust: they use official position, age, height, weight, class, origin, and raw-source mention count. They are included to prevent the 30th pick from being forced by a 30-player candidate pool.

## Health

- 30 picks: true
- No duplicates: true
- Low-confidence picks: 1
- Ready under current code gate: true

## Summary

- Average confidence: 84
- Average score: 86
- Fallback-profile picks in first round: 1
- Changed slots vs previous 30-player baseline: 1

## Changed Slots Vs Previous 30-Player Baseline

| Pick | Team | Previous | Expanded-pool rerun | Fallback profile |
|---:|---|---|---|---|
| 30 | Dallas Mavericks | Jayden Quaintance | Marc-Owen Fodzo Dada | true |

## Expanded-Pool Board

| Pick | Team | Player | Rank | Confidence | Margin | Fallback |
|---:|---|---|---:|---:|---:|---|
| 1 | Washington Wizards | AJ Dybantsa | 2 | 96 | 5 | false |
| 2 | Utah Jazz | Darryn Peterson | 1 | 93 | 3 | false |
| 3 | Memphis Grizzlies | Cameron Boozer | 3 | 100 | 15 | false |
| 4 | Chicago Bulls | Caleb Wilson | 4 | 100 | 9 | false |
| 5 | LA Clippers | Keaton Wagler | 5 | 89 | 2 | false |
| 6 | Brooklyn Nets | Darius Acuff Jr. | 6 | 89 | 2 | false |
| 7 | Sacramento Kings | Mikel Brown Jr. | 7 | 86 | 0 | false |
| 8 | Atlanta Hawks | Aday Mara | 10 | 94 | 7 | false |
| 9 | Dallas Mavericks | Brayden Burries | 11 | 97 | 7 | false |
| 10 | Milwaukee Bucks | Kingston Flemings | 8 | 83 | 1 | false |
| 11 | Golden State Warriors | Nate Ament | 9 | 75 | 2 | false |
| 12 | Oklahoma City Thunder | Yaxel Lendeborg | 12 | 94 | 4 | false |
| 13 | Miami Heat | Karim Lopez | 14 | 88 | 3 | false |
| 14 | Charlotte Hornets | Morez Johnson Jr. | 15 | 96 | 5 | false |
| 15 | Chicago Bulls | Allen Graves | 17 | 94 | 5 | false |
| 16 | Memphis Grizzlies | Hannes Steinbach | 13 | 82 | 4 | false |
| 17 | Oklahoma City Thunder | Chris Cenac Jr. | 19 | 79 | 4 | false |
| 18 | Charlotte Hornets | Christian Anderson | 16 | 78 | 0 | false |
| 19 | Toronto Raptors | Labaron Philon Jr. | 18 | 71 | 0 | false |
| 20 | San Antonio Spurs | Bennett Stirtz | 20 | 84 | 1 | false |
| 21 | Detroit Pistons | Cameron Carr | 21 | 99 | 5 | false |
| 22 | Philadelphia 76ers | Dailyn Swain | 23 | 74 | 0 | false |
| 23 | Atlanta Hawks | Ebuka Okorie | 24 | 91 | 7 | false |
| 24 | New York Knicks | Isaiah Evans | 25 | 74 | 0 | false |
| 25 | Los Angeles Lakers | Koa Peat | 27 | 74 | 2 | false |
| 26 | Denver Nuggets | Tarris Reed Jr. | 29 | 68 | 2 | false |
| 27 | Boston Celtics | Sergio De Larrea | 30 | 68 | 4 | false |
| 28 | Minnesota Timberwolves | Meleek Thomas | 28 | 76 | 5 | false |
| 29 | Cleveland Cavaliers | Henri Veesaar | 26 | 74 | 3 | false |
| 30 | Dallas Mavericks | Marc-Owen Fodzo Dada | 32 | 60 | 0 | true |

## Fallback Picks

| Pick | Team | Player | Rank | Confidence |
|---:|---|---|---:|---:|
| 30 | Dallas Mavericks | Marc-Owen Fodzo Dada | 32 | 60 |

## Pick 30 Audit Note

Pick 30 changed only after the candidate pool was expanded from 30 to 101. The selected player is not a full DraftOps profile; he is a deterministic fallback profile built from NBA.com official bio fields.

This pick is not lock-ready:

- The selected player has `fallbackProfile = true`.
- The pick confidence is 60, below the 65 low-confidence threshold.
- The tiebreaker selected him despite a slightly lower raw score than the first runner-up, because the existing narrow-race rule favors better consensus rank inside the epsilon band.
- The first alternatives are also fallback profiles: Jack Kayil, Mohammad Amini, and Kylan Boswell.

Therefore the expanded-pool rerun proves the old 30-player pool was too narrow, but it does not prove Marc-Owen Fodzo Dada should be locked at pick 30. The next step must be source/profile enrichment for the fallback candidates around pick 30, then another A7 rerun.

## Lock-Gate Note

This is a more valid candidate-pool rerun than the previous 30-player-bundle run, but fallback-profile candidates still need sourceConfidence/profile validation before final lock.
