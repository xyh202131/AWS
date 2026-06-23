# Expanded 101-Candidate Full Strategy Rerun

Generated: 2026-06-23T06:30:41.845Z

## Scope

This run reselects picks 1-30 from the expanded NBA.com official 101-player candidate pool across every configured strategy. No player was manually selected, replaced, locked, or reordered.

## Strategy Recommendation Rule

The recommended strategy is selected by an audit score that rewards average confidence and penalizes low-confidence picks, fallback-profile picks, narrow margins, and excessive drift from the previous published board. This is a strategy-selection rule, not a manual player override.

```text
strategyAuditScore = averageConfidence - 8*lowConfidence - 6*fallbackPicks - 0.8*narrowMargins - 0.25*changedVsPrevious
```

## Strategy Summary

| Strategy | Weights | Audit score | Avg confidence | Low confidence | Fallback picks | Narrow margins | Changed vs old 30-pool board |
|---|---|---:|---:|---:|---:|---:|---:|
| baseline | C35/N25/P20/U10/I10 | 63.35 | 84 | 1 | 1 | 8 | 1 |
| consensus-heavy | C50/N20/P15/U5/I10 | 52.80 | 85 | 2 | 1 | 9 | 12 |
| team-need-heavy | C28/N38/P21/U8/I5 | 56.35 | 85 | 1 | 2 | 8 | 9 |
| late-intel-heavy | C30/N18/P15/U7/I30 | 16.20 | 76 | 4 | 3 | 11 | 4 |

Recommended strategy: **baseline / balanced baseline**

## Recommended Board

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

## Low-Confidence Picks In Recommended Board

| Pick | Team | Player | Confidence | Fallback |
|---:|---|---|---:|---|
| 30 | Dallas Mavericks | Marc-Owen Fodzo Dada | 60 | true |

## Fallback Picks In Recommended Board

| Pick | Team | Player | Rank | Confidence |
|---:|---|---|---:|---:|
| 30 | Dallas Mavericks | Marc-Owen Fodzo Dada | 32 | 60 |

## Changed Slots Vs Old 30-Player Board

| Pick | Team | Old 30-player board | Expanded recommended | Fallback |
|---:|---|---|---|---|
| 30 | Dallas Mavericks | Jayden Quaintance | Marc-Owen Fodzo Dada | true |

## Lock-Gate Warning

This is the correct candidate-pool rerun boundary. Any fallback-profile pick still requires source/profile enrichment before final lock.

