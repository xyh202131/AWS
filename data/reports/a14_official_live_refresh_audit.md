# A14 Official Live Refresh Audit

Generated: 2026-06-22T04:10:42+08:00

## Scope

- Refreshed official source: https://www.nba.com/draft/2026/prospects
- Raw refresh file: `data/raw/nba-official-2026-prospects-a14-refresh.md`
- Final bundle: `data/final/final_import_bundle.json`
- Refresh command/tool: `firecrawl scrape "https://www.nba.com/draft/2026/prospects" --wait-for 5000 -o "data\raw\nba-official-2026-prospects-a14-refresh.md"`
- Independence note: verdict uses only the refreshed NBA.com raw file and final bundle; `data/clean/official_prospect_reconciliation.json` was not used for the verdict.

## Counts

| Check | Result |
| --- | ---: |
| Refreshed official prospect rows | 101 |
| Refreshed official unique normalized names | 101 |
| Final prospect count | 30 |
| Final exactly 30 | true |
| Final unique ids | true |
| Final matched in refreshed official list | 30 |
| Final missing from refreshed official list | 0 |

## Missing From Refreshed Official

None

## Duplicate Final IDs

None

## Canonical Name Differences

None

## Non-Blocking Final ID vs Official URL Slug Differences

- `darius-acuff-jr` maps to official slug `darius-acuff` for `Darius Acuff Jr.`
- `mikel-brown-jr` maps to official slug `mikel-brown` for `Mikel Brown Jr.`
- `labaron-philon-jr` maps to official slug `labaron-philon` for `Labaron Philon Jr.`

## Matched Final Prospects

| # | Final ID | Final Name | Refreshed Official Name | Official Slug |
| ---: | --- | --- | --- | --- |
| 1 | `darryn-peterson` | Darryn Peterson | Darryn Peterson | `darryn-peterson` |
| 2 | `aj-dybantsa` | AJ Dybantsa | AJ Dybantsa | `aj-dybantsa` |
| 3 | `cameron-boozer` | Cameron Boozer | Cameron Boozer | `cameron-boozer` |
| 4 | `caleb-wilson` | Caleb Wilson | Caleb Wilson | `caleb-wilson` |
| 5 | `keaton-wagler` | Keaton Wagler | Keaton Wagler | `keaton-wagler` |
| 6 | `darius-acuff-jr` | Darius Acuff Jr. | Darius Acuff Jr. | `darius-acuff` |
| 7 | `mikel-brown-jr` | Mikel Brown Jr. | Mikel Brown Jr. | `mikel-brown` |
| 8 | `kingston-flemings` | Kingston Flemings | Kingston Flemings | `kingston-flemings` |
| 9 | `nate-ament` | Nate Ament | Nate Ament | `nate-ament` |
| 10 | `aday-mara` | Aday Mara | Aday Mara | `aday-mara` |
| 11 | `brayden-burries` | Brayden Burries | Brayden Burries | `brayden-burries` |
| 12 | `yaxel-lendeborg` | Yaxel Lendeborg | Yaxel Lendeborg | `yaxel-lendeborg` |
| 13 | `hannes-steinbach` | Hannes Steinbach | Hannes Steinbach | `hannes-steinbach` |
| 14 | `karim-lopez` | Karim Lopez | Karim Lopez | `karim-lopez` |
| 15 | `morez-johnson-jr` | Morez Johnson Jr. | Morez Johnson Jr. | `morez-johnson-jr` |
| 16 | `christian-anderson` | Christian Anderson | Christian Anderson | `christian-anderson` |
| 17 | `allen-graves` | Allen Graves | Allen Graves | `allen-graves` |
| 18 | `labaron-philon-jr` | Labaron Philon Jr. | Labaron Philon Jr. | `labaron-philon` |
| 19 | `chris-cenac-jr` | Chris Cenac Jr. | Chris Cenac Jr. | `chris-cenac-jr` |
| 20 | `bennett-stirtz` | Bennett Stirtz | Bennett Stirtz | `bennett-stirtz` |
| 21 | `cameron-carr` | Cameron Carr | Cameron Carr | `cameron-carr` |
| 22 | `jayden-quaintance` | Jayden Quaintance | Jayden Quaintance | `jayden-quaintance` |
| 23 | `dailyn-swain` | Dailyn Swain | Dailyn Swain | `dailyn-swain` |
| 24 | `ebuka-okorie` | Ebuka Okorie | Ebuka Okorie | `ebuka-okorie` |
| 25 | `isaiah-evans` | Isaiah Evans | Isaiah Evans | `isaiah-evans` |
| 26 | `henri-veesaar` | Henri Veesaar | Henri Veesaar | `henri-veesaar` |
| 27 | `koa-peat` | Koa Peat | Koa Peat | `koa-peat` |
| 28 | `meleek-thomas` | Meleek Thomas | Meleek Thomas | `meleek-thomas` |
| 29 | `tarris-reed-jr` | Tarris Reed Jr. | Tarris Reed Jr. | `tarris-reed-jr` |
| 30 | `sergio-de-larrea` | Sergio De Larrea | Sergio De Larrea | `sergio-de-larrea` |

## Verdict

PASS: final has exactly 30 unique-id prospects, and all 30 appear in the refreshed NBA.com official Prospects list.
