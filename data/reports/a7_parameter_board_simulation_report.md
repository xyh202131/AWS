# A7 Parameter Board Simulation Report

Generated at: 2026-06-21T20:19:58.905Z

## Method

- Input bundle: `data/final/final_import_bundle.json` (30 teams, 30 prospects).
- Scenario source: `data/reports/weight_scenarios.json`.
- Prediction source: `src/lib/prediction.ts`.
- Execution path: used the local TypeScript compiler to transpile `prediction.ts` in memory, then directly called its exported `generateBoard` and `getBoardHealth` functions. Source files were not modified.

## Generated Boards

| Alias | Scenario id | Label | Base weights | Avg score | Avg confidence | Low-confidence picks | Output |
|---|---|---|---|---:|---:|---:|---|
| balanced | baseline | balanced baseline | C35/N25/P20/U10/I10 | 85 | 84 | 1 | data/boards/board_balanced_parameter_test.json |
| consensus | consensus-heavy | media consensus heavy | C50/N20/P15/U5/I10 | 85 | 83 | 2 | data/boards/board_consensus_parameter_test.json |
| team_fit | team-need-heavy | team need heavy | C28/N38/P21/U8/I5 | 87 | 86 | 1 | data/boards/board_team_fit_parameter_test.json |

## Pick-by-Pick Comparison

| Pick | Team | Balanced | Consensus-heavy | Team-fit-heavy | All same | Distinct candidates | Candidate rank spread |
|---:|---|---|---|---|---|---:|---:|
| 1 | Washington Wizards | AJ Dybantsa | AJ Dybantsa | AJ Dybantsa | yes | 1 | 0 |
| 2 | Utah Jazz | Darryn Peterson | Darryn Peterson | Darryn Peterson | yes | 1 | 0 |
| 3 | Memphis Grizzlies | Cameron Boozer | Cameron Boozer | Cameron Boozer | yes | 1 | 0 |
| 4 | Chicago Bulls | Caleb Wilson | Caleb Wilson | Caleb Wilson | yes | 1 | 0 |
| 5 | LA Clippers | Keaton Wagler | Keaton Wagler | Keaton Wagler | yes | 1 | 0 |
| 6 | Brooklyn Nets | Darius Acuff Jr. | Darius Acuff Jr. | Darius Acuff Jr. | yes | 1 | 0 |
| 7 | Sacramento Kings | Mikel Brown Jr. | Mikel Brown Jr. | Mikel Brown Jr. | yes | 1 | 0 |
| 8 | Atlanta Hawks | Aday Mara | Aday Mara | Aday Mara | yes | 1 | 0 |
| 9 | Dallas Mavericks | Brayden Burries | Brayden Burries | Brayden Burries | yes | 1 | 0 |
| 10 | Milwaukee Bucks | Kingston Flemings | Kingston Flemings | Kingston Flemings | yes | 1 | 0 |
| 11 | Golden State Warriors | Nate Ament | Nate Ament | Bennett Stirtz | no | 2 | 11 |
| 12 | Oklahoma City Thunder | Yaxel Lendeborg | Yaxel Lendeborg | Yaxel Lendeborg | yes | 1 | 0 |
| 13 | Miami Heat | Karim Lopez | Karim Lopez | Karim Lopez | yes | 1 | 0 |
| 14 | Charlotte Hornets | Morez Johnson Jr. | Morez Johnson Jr. | Morez Johnson Jr. | yes | 1 | 0 |
| 15 | Chicago Bulls | Allen Graves | Allen Graves | Allen Graves | yes | 1 | 0 |
| 16 | Memphis Grizzlies | Hannes Steinbach | Hannes Steinbach | Hannes Steinbach | yes | 1 | 0 |
| 17 | Oklahoma City Thunder | Chris Cenac Jr. | Chris Cenac Jr. | Nate Ament | no | 2 | 10 |
| 18 | Charlotte Hornets | Christian Anderson | Labaron Philon Jr. | Christian Anderson | no | 2 | 2 |
| 19 | Toronto Raptors | Dailyn Swain | Bennett Stirtz | Chris Cenac Jr. | no | 3 | 4 |
| 20 | San Antonio Spurs | Bennett Stirtz | Cameron Carr | Cameron Carr | no | 2 | 1 |
| 21 | Detroit Pistons | Cameron Carr | Ebuka Okorie | Ebuka Okorie | no | 2 | 3 |
| 22 | Philadelphia 76ers | Labaron Philon Jr. | Dailyn Swain | Isaiah Evans | no | 3 | 7 |
| 23 | Atlanta Hawks | Ebuka Okorie | Christian Anderson | Labaron Philon Jr. | no | 3 | 8 |
| 24 | New York Knicks | Koa Peat | Isaiah Evans | Koa Peat | no | 2 | 2 |
| 25 | Los Angeles Lakers | Isaiah Evans | Koa Peat | Dailyn Swain | no | 3 | 4 |
| 26 | Denver Nuggets | Tarris Reed Jr. | Henri Veesaar | Tarris Reed Jr. | no | 2 | 3 |
| 27 | Boston Celtics | Sergio De Larrea | Sergio De Larrea | Sergio De Larrea | yes | 1 | 0 |
| 28 | Minnesota Timberwolves | Meleek Thomas | Meleek Thomas | Meleek Thomas | yes | 1 | 0 |
| 29 | Cleveland Cavaliers | Henri Veesaar | Tarris Reed Jr. | Henri Veesaar | no | 2 | 3 |
| 30 | Dallas Mavericks | Jayden Quaintance | Jayden Quaintance | Jayden Quaintance | yes | 1 | 0 |

## Exact Three-Scenario Consensus

These picks have the same player at the same slot in all three generated boards.

| Pick | Team | Prospect | Prospect consensus rank |
|---:|---|---|---:|
| 1 | Washington Wizards | AJ Dybantsa | 2 |
| 2 | Utah Jazz | Darryn Peterson | 1 |
| 3 | Memphis Grizzlies | Cameron Boozer | 3 |
| 4 | Chicago Bulls | Caleb Wilson | 4 |
| 5 | LA Clippers | Keaton Wagler | 5 |
| 6 | Brooklyn Nets | Darius Acuff Jr. | 6 |
| 7 | Sacramento Kings | Mikel Brown Jr. | 7 |
| 8 | Atlanta Hawks | Aday Mara | 10 |
| 9 | Dallas Mavericks | Brayden Burries | 11 |
| 10 | Milwaukee Bucks | Kingston Flemings | 8 |
| 12 | Oklahoma City Thunder | Yaxel Lendeborg | 12 |
| 13 | Miami Heat | Karim Lopez | 14 |
| 14 | Charlotte Hornets | Morez Johnson Jr. | 15 |
| 15 | Chicago Bulls | Allen Graves | 17 |
| 16 | Memphis Grizzlies | Hannes Steinbach | 13 |
| 27 | Boston Celtics | Sergio De Larrea | 30 |
| 28 | Minnesota Timberwolves | Meleek Thomas | 28 |
| 30 | Dallas Mavericks | Jayden Quaintance | 22 |

## Largest Pick Divergence

Divergence is ranked by distinct candidates at the same pick, then by candidate consensus-rank spread, then by score spread.

| Pick | Team | Balanced | Consensus-heavy | Team-fit-heavy | Distinct candidates | Candidate rank spread | Score spread |
|---:|---|---|---|---|---:|---:|---:|
| 23 | Atlanta Hawks | Ebuka Okorie | Christian Anderson | Labaron Philon Jr. | 3 | 8 | 9 |

## Largest Player Movement

| Prospect | Balanced pick | Consensus-heavy pick | Team-fit-heavy pick | Pick spread |
|---|---:|---:|---:|---:|
| Bennett Stirtz | 20 | 19 | 11 | 9 |
| Nate Ament | 11 | 11 | 17 | 6 |
| Dailyn Swain | 19 | 22 | 25 | 6 |
| Christian Anderson | 18 | 23 | 18 | 5 |
| Labaron Philon Jr. | 22 | 18 | 23 | 5 |
| Isaiah Evans | 25 | 24 | 22 | 3 |
| Henri Veesaar | 29 | 26 | 29 | 3 |
| Tarris Reed Jr. | 26 | 29 | 26 | 3 |
| Chris Cenac Jr. | 17 | 17 | 19 | 2 |
| Ebuka Okorie | 23 | 21 | 21 | 2 |

## Recommended Current Weights

Recommended scenario: **balanced baseline** (`baseline`) with weights **C35/N25/P20/U10/I10**.

Reason: Use balanced baseline as the current most likely board because the import bundle flags 15 team-need rows for review and weight_scenarios.json describes baseline as the default first board before late breaking news. It keeps consensus as the anchor while still giving reviewed needs/player grade material weight.

Recommended board file: `data/boards/board_balanced_parameter_test.json`.

## Recommended Board

| Pick | Team | Prospect | Pos | Score | Confidence | Role fit |
|---:|---|---|---|---:|---:|---|
| 1 | Washington Wizards | AJ Dybantsa | SF/PF | 96 | 98 | wing creator |
| 2 | Utah Jazz | Darryn Peterson | PG/SG | 96 | 98 | primary guard |
| 3 | Memphis Grizzlies | Cameron Boozer | PF/C | 97 | 100 | frontcourt engine |
| 4 | Chicago Bulls | Caleb Wilson | SF/PF | 94 | 100 | big wing |
| 5 | LA Clippers | Keaton Wagler | PG/SG | 97 | 98 | combo guard |
| 6 | Brooklyn Nets | Darius Acuff Jr. | PG/SG | 95 | 96 | primary guard |
| 7 | Sacramento Kings | Mikel Brown Jr. | PG/SG | 94 | 88 | primary guard |
| 8 | Atlanta Hawks | Aday Mara | C | 90 | 95 | rim protector |
| 9 | Dallas Mavericks | Brayden Burries | PG/SG | 91 | 97 | combo guard |
| 10 | Milwaukee Bucks | Kingston Flemings | PG/SG | 91 | 84 | defense |
| 11 | Golden State Warriors | Nate Ament | SF/PF | 82 | 80 | shooter |
| 12 | Oklahoma City Thunder | Yaxel Lendeborg | SF/PF | 91 | 95 | feel |
| 13 | Miami Heat | Karim Lopez | SF/PF | 91 | 83 | big wing |
| 14 | Charlotte Hornets | Morez Johnson Jr. | PF/C | 89 | 92 | rim protector |
| 15 | Chicago Bulls | Allen Graves | SF/PF | 88 | 90 | stretch forward |
| 16 | Memphis Grizzlies | Hannes Steinbach | PF/C | 86 | 83 | size |
| 17 | Oklahoma City Thunder | Chris Cenac Jr. | PF/C | 78 | 78 | upside |
| 18 | Charlotte Hornets | Christian Anderson | PG/SG | 88 | 79 | combo guard |
| 19 | Toronto Raptors | Dailyn Swain | SF/PF | 79 | 69 | defense |
| 20 | San Antonio Spurs | Bennett Stirtz | PG/SG | 89 | 84 | combo guard |
| 21 | Detroit Pistons | Cameron Carr | PG/SG | 90 | 98 | wing defender |
| 22 | Philadelphia 76ers | Labaron Philon Jr. | PG/SG | 84 | 72 | primary guard |
| 23 | Atlanta Hawks | Ebuka Okorie | PG/SG | 81 | 89 | pace |
| 24 | New York Knicks | Koa Peat | SF/PF | 81 | 71 | maturity |
| 25 | Los Angeles Lakers | Isaiah Evans | PG/SG | 83 | 88 | 3-and-D |
| 26 | Denver Nuggets | Tarris Reed Jr. | C | 71 | 65 | rebounder |
| 27 | Boston Celtics | Sergio De Larrea | PG/SG | 70 | 66 | shooter |
| 28 | Minnesota Timberwolves | Meleek Thomas | SG/SF | 75 | 74 | combo guard |
| 29 | Cleveland Cavaliers | Henri Veesaar | C | 77 | 81 | rim protector |
| 30 | Dallas Mavericks | Jayden Quaintance | PF/C | 43 | 34 | frontcourt size |

## Validation

- Each generated JSON file has 30 picks.
- Each board has 30 unique prospects.
- All three board files were written as parseable JSON objects with both full `board` and flattened `firstRoundPrediction` arrays.
