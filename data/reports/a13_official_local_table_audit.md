# A13 Official Local Table Audit

Agent: DraftOps A13 Official Local Table Audit Agent

## Scope

- Official source: `data/raw/nba-official-2026-prospects-live.md`
- Final bundle: `data/final/final_import_bundle.json`
- Network usage: none; local files only.
- Official rows parsed from markdown table lines only.

## Matching Rule

Strict name normalization ignored case, punctuation, accents, and `Jr`/`Sr` suffix differences. Canonical display-name differences are reported separately.

## Counts

- Official prospects parsed: 101
- Final players: 30
- Matched final players: 30
- Missing from official: 0
- Canonical name differences: 0
- Duplicate final IDs: 0
- Unique final IDs: 30

## Verdict

- Status: PASS
- Final count exactly 30: True
- All final players appear in official table: True
- Final contains non-official players: False
- Final IDs unique: True

## Exceptions

- Missing from official: none.
- Canonical name differences: none.
- Duplicate final IDs: none.

## Matched Final Players

| # | Final ID | Final Name | Official Name | Official Pos | Official School/Club | Official URL |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | darryn-peterson | Darryn Peterson | Darryn Peterson | G | Kansas | https://www.nba.com/draft/2026/prospects/darryn-peterson |
| 2 | aj-dybantsa | AJ Dybantsa | AJ Dybantsa | F | BYU | https://www.nba.com/draft/2026/prospects/aj-dybantsa |
| 3 | cameron-boozer | Cameron Boozer | Cameron Boozer | F-C | Duke | https://www.nba.com/draft/2026/prospects/cameron-boozer |
| 4 | caleb-wilson | Caleb Wilson | Caleb Wilson | F | North Carolina | https://www.nba.com/draft/2026/prospects/caleb-wilson |
| 5 | keaton-wagler | Keaton Wagler | Keaton Wagler | G | Illinois | https://www.nba.com/draft/2026/prospects/keaton-wagler |
| 6 | darius-acuff-jr | Darius Acuff Jr. | Darius Acuff Jr. | G | Arkansas | https://www.nba.com/draft/2026/prospects/darius-acuff |
| 7 | mikel-brown-jr | Mikel Brown Jr. | Mikel Brown Jr. | G | Louisville | https://www.nba.com/draft/2026/prospects/mikel-brown |
| 8 | kingston-flemings | Kingston Flemings | Kingston Flemings | G | Houston | https://www.nba.com/draft/2026/prospects/kingston-flemings |
| 9 | nate-ament | Nate Ament | Nate Ament | F | Tennessee | https://www.nba.com/draft/2026/prospects/nate-ament |
| 10 | aday-mara | Aday Mara | Aday Mara | C | Michigan | https://www.nba.com/draft/2026/prospects/aday-mara |
| 11 | brayden-burries | Brayden Burries | Brayden Burries | G | Arizona | https://www.nba.com/draft/2026/prospects/brayden-burries |
| 12 | yaxel-lendeborg | Yaxel Lendeborg | Yaxel Lendeborg | F | Michigan | https://www.nba.com/draft/2026/prospects/yaxel-lendeborg |
| 13 | hannes-steinbach | Hannes Steinbach | Hannes Steinbach | F-C | Washington | https://www.nba.com/draft/2026/prospects/hannes-steinbach |
| 14 | karim-lopez | Karim Lopez | Karim Lopez | F | New Zealand Breakers (Australia) | https://www.nba.com/draft/2026/prospects/karim-lopez |
| 15 | morez-johnson-jr | Morez Johnson Jr. | Morez Johnson Jr. | F-C | Michigan | https://www.nba.com/draft/2026/prospects/morez-johnson-jr |
| 16 | christian-anderson | Christian Anderson | Christian Anderson | G | Texas Tech | https://www.nba.com/draft/2026/prospects/christian-anderson |
| 17 | allen-graves | Allen Graves | Allen Graves | F | Santa Clara | https://www.nba.com/draft/2026/prospects/allen-graves |
| 18 | labaron-philon-jr | Labaron Philon Jr. | Labaron Philon Jr. | G | Alabama | https://www.nba.com/draft/2026/prospects/labaron-philon |
| 19 | chris-cenac-jr | Chris Cenac Jr. | Chris Cenac Jr. | F-C | Houston | https://www.nba.com/draft/2026/prospects/chris-cenac-jr |
| 20 | bennett-stirtz | Bennett Stirtz | Bennett Stirtz | G | Iowa | https://www.nba.com/draft/2026/prospects/bennett-stirtz |
| 21 | cameron-carr | Cameron Carr | Cameron Carr | G | Baylor | https://www.nba.com/draft/2026/prospects/cameron-carr |
| 22 | jayden-quaintance | Jayden Quaintance | Jayden Quaintance | F-C | Kentucky | https://www.nba.com/draft/2026/prospects/jayden-quaintance |
| 23 | dailyn-swain | Dailyn Swain | Dailyn Swain | F | Texas | https://www.nba.com/draft/2026/prospects/dailyn-swain |
| 24 | ebuka-okorie | Ebuka Okorie | Ebuka Okorie | G | Stanford | https://www.nba.com/draft/2026/prospects/ebuka-okorie |
| 25 | isaiah-evans | Isaiah Evans | Isaiah Evans | G | Duke | https://www.nba.com/draft/2026/prospects/isaiah-evans |
| 26 | henri-veesaar | Henri Veesaar | Henri Veesaar | C | North Carolina | https://www.nba.com/draft/2026/prospects/henri-veesaar |
| 27 | koa-peat | Koa Peat | Koa Peat | F | Arizona | https://www.nba.com/draft/2026/prospects/koa-peat |
| 28 | meleek-thomas | Meleek Thomas | Meleek Thomas | G-F | Arkansas | https://www.nba.com/draft/2026/prospects/meleek-thomas |
| 29 | tarris-reed-jr | Tarris Reed Jr. | Tarris Reed Jr. | C | Connecticut | https://www.nba.com/draft/2026/prospects/tarris-reed-jr |
| 30 | sergio-de-larrea | Sergio De Larrea | Sergio De Larrea | G | Vallodolid (Spain) | https://www.nba.com/draft/2026/prospects/sergio-de-larrea |
