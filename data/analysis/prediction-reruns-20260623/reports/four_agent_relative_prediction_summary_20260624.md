# Four-Version Relative Prediction Summary

- Generated at: 2026-06-23T19:35:19.136Z
- Rule: Per-pick relative scoring over current remaining pool; select one prospect, remove him, then rescore the next team.

## Files

- Relative Original: `data/boards/relative_scoring_prediction_20260624.json`
- DeepSeek LLM: `data/boards/deepseek_sequential_123_prediction_deepseek_llm_relative_20260624_031357.json`
- Codex LLM: `data/boards/relative_scoring_prediction_codex_as_llm_20260624_031340.json`
- Codex Agent: `data/boards/relative_scoring_prediction_20260624_031533_codex_agent.json`

## Validation

| Version | Picks | Unique | Remaining | Reviews | Chain OK | Top OK | Changed | Avg Confidence |
|---|---:|---:|---:|---:|---|---|---:|---:|
| Relative Original | 30 | 30 | 93 | 3255 | true | true | 21 | 90 |
| DeepSeek LLM | 30 | 30 | 93 | 3255 | true | true | 15 | 82 |
| Codex LLM | 30 | 30 | 93 | 3255 | true | true | 21 | 90 |
| Codex Agent | 30 | 30 | 93 | 3255 | true | true | 21 | 91 |

## Agreement

- Agreement distribution: 4/4=8, 3/4=19, 2/4=3
- Unanimous picks: 1, 2, 3, 4, 5, 9, 21, 28
- Non-unanimous picks: 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 29, 30
- Full-split picks: none

## Pairwise Same Picks

| Pair | Same | Different |
|---|---:|---:|
| relativeOriginal vs deepseekLlm | 8 | 22 |
| relativeOriginal vs codexLlm | 30 | 0 |
| relativeOriginal vs codexAgent | 27 | 3 |
| deepseekLlm vs codexLlm | 8 | 22 |
| deepseekLlm vs codexAgent | 9 | 21 |
| codexLlm vs codexAgent | 27 | 3 |

## Pick Comparison

| Pick | Team | Relative Original | DeepSeek LLM | Codex LLM | Codex Agent | Agreement | Plurality |
|---:|---|---|---|---|---|---:|---|
| 1 | Washington Wizards | AJ Dybantsa | AJ Dybantsa | AJ Dybantsa | AJ Dybantsa | 4/4 | AJ Dybantsa |
| 2 | Utah Jazz | Darryn Peterson | Darryn Peterson | Darryn Peterson | Darryn Peterson | 4/4 | Darryn Peterson |
| 3 | Memphis Grizzlies | Cameron Boozer | Cameron Boozer | Cameron Boozer | Cameron Boozer | 4/4 | Cameron Boozer |
| 4 | Chicago Bulls | Caleb Wilson | Caleb Wilson | Caleb Wilson | Caleb Wilson | 4/4 | Caleb Wilson |
| 5 | LA Clippers | Keaton Wagler | Keaton Wagler | Keaton Wagler | Keaton Wagler | 4/4 | Keaton Wagler |
| 6 | Brooklyn Nets | Kingston Flemings | Darius Acuff Jr. | Kingston Flemings | Kingston Flemings | 3/4 | Kingston Flemings |
| 7 | Sacramento Kings | Darius Acuff Jr. | Mikel Brown Jr. | Darius Acuff Jr. | Darius Acuff Jr. | 3/4 | Darius Acuff Jr. |
| 8 | Atlanta Hawks | Nate Ament | Aday Mara | Nate Ament | Nate Ament | 3/4 | Nate Ament |
| 9 | Dallas Mavericks | Brayden Burries | Brayden Burries | Brayden Burries | Brayden Burries | 4/4 | Brayden Burries |
| 10 | Milwaukee Bucks | Karim Lopez | Kingston Flemings | Karim Lopez | Karim Lopez | 3/4 | Karim Lopez |
| 11 | Golden State Warriors | Labaron Philon Jr. | Bennett Stirtz | Labaron Philon Jr. | Labaron Philon Jr. | 3/4 | Labaron Philon Jr. |
| 12 | Oklahoma City Thunder | Aday Mara | Yaxel Lendeborg | Aday Mara | Aday Mara | 3/4 | Aday Mara |
| 13 | Miami Heat | Yaxel Lendeborg | Karim Lopez | Yaxel Lendeborg | Yaxel Lendeborg | 3/4 | Yaxel Lendeborg |
| 14 | Charlotte Hornets | Allen Graves | Morez Johnson Jr. | Allen Graves | Allen Graves | 3/4 | Allen Graves |
| 15 | Chicago Bulls | Cameron Carr | Allen Graves | Cameron Carr | Cameron Carr | 3/4 | Cameron Carr |
| 16 | Memphis Grizzlies | Dailyn Swain | Chris Cenac Jr. | Dailyn Swain | Dailyn Swain | 3/4 | Dailyn Swain |
| 17 | Oklahoma City Thunder | Morez Johnson Jr. | Nate Ament | Morez Johnson Jr. | Morez Johnson Jr. | 3/4 | Morez Johnson Jr. |
| 18 | Charlotte Hornets | Christian Anderson | Labaron Philon Jr. | Christian Anderson | Christian Anderson | 3/4 | Christian Anderson |
| 19 | Toronto Raptors | Mikel Brown Jr. | Dailyn Swain | Mikel Brown Jr. | Mikel Brown Jr. | 3/4 | Mikel Brown Jr. |
| 20 | San Antonio Spurs | Bennett Stirtz | Cameron Carr | Bennett Stirtz | Bennett Stirtz | 3/4 | Bennett Stirtz |
| 21 | Detroit Pistons | Isaiah Evans | Isaiah Evans | Isaiah Evans | Isaiah Evans | 4/4 | Isaiah Evans |
| 22 | Philadelphia 76ers | Hannes Steinbach | Christian Anderson | Hannes Steinbach | Sergio De Larrea | 2/4 | Hannes Steinbach |
| 23 | Atlanta Hawks | Sergio De Larrea | Ebuka Okorie | Sergio De Larrea | Ebuka Okorie | 2/4 | Ebuka Okorie |
| 24 | New York Knicks | Ebuka Okorie | Koa Peat | Ebuka Okorie | Hannes Steinbach | 2/4 | Ebuka Okorie |
| 25 | Los Angeles Lakers | Koa Peat | Jayden Quaintance | Koa Peat | Koa Peat | 3/4 | Koa Peat |
| 26 | Denver Nuggets | Henri Veesaar | Hannes Steinbach | Henri Veesaar | Henri Veesaar | 3/4 | Henri Veesaar |
| 27 | Boston Celtics | Chris Cenac Jr. | Sergio De Larrea | Chris Cenac Jr. | Chris Cenac Jr. | 3/4 | Chris Cenac Jr. |
| 28 | Minnesota Timberwolves | Meleek Thomas | Meleek Thomas | Meleek Thomas | Meleek Thomas | 4/4 | Meleek Thomas |
| 29 | Cleveland Cavaliers | Tarris Reed Jr. | Henri Veesaar | Tarris Reed Jr. | Tarris Reed Jr. | 3/4 | Tarris Reed Jr. |
| 30 | Dallas Mavericks | Tyler Bilodeau | Jack Kayil | Tyler Bilodeau | Tyler Bilodeau | 3/4 | Tyler Bilodeau |
