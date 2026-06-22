# A4-R Risk/Upside Parameter Debate

Scope: evaluate parameters from player profile, upside, risk, age, international status, and positional scarcity. This report does not re-audit official team order. Source files were read only; app source code was not modified.

Inputs used:
- `data/final/final_import_bundle.json`
- `data/clean/clean_prospects.json`
- `data/clean/data_quality_report.md`
- `data/normalized/normalized_2026_prospect_big_board.json`
- `src/lib/prediction.ts`

## 1. Recommended Weights

Recommended default:

| Weight | Current | Recommended | Reason |
| --- | ---: | ---: | --- |
| `consensus` | 35 | 30 | Keep media signal important, but reduce protection for hot names with size, shooting, medical, or source-quality risk. Ranks 26-30 are supplemental mock-order rows, not stable ESPN Big Board ranks. |
| `need` | 25 | 22 | Team-context inputs have 15 `needs_review` pick rows, so need should not dominate player-grade decisions. |
| `player` | 20 | 25 | Increase the clean scouting/profile signal: shooting, creation, defense, feel, size, and athleticism should carry more of the board than raw media heat. |
| `upside` | 10 | 15 | Raise enough for young high-ceiling, scarce-position players to remain first-round candidates, especially when late-first adaptive modifiers suppress upside. |
| `intel` | 10 | 8 | Mock heat and source notes are still useful, but the current data package has visible source gaps for the back end of the round. |

Parameter stance: raise `player` more confidently than `upside`. Upside should rise only moderately because `prediction.ts` risk penalties currently miss several important risk types: generated/scaffolded profiles, age curve, medical small sample, low-feel tool bets, and source-quality gaps.

## 2. Safest 10 First-Round Candidates

These are the cleanest first-round locks by profile strength, ceiling, age, role scarcity, and manageable risk. Order is not a mock order.

| Player | Why Safe |
| --- | --- |
| AJ Dybantsa | Elite wing creator profile: creation 94, size 91, upside 98, age 19. Scarce star-wing archetype offsets shot-selection risk. |
| Darryn Peterson | Top guard creation and shooting: shooting 90, creation 93, upside 96, mockHeat 99. Risk is role polish, not a missing NBA skill. |
| Cameron Boozer | High floor and high ceiling: feel 92, size 90, upside 94, age 18. Frontcourt connector profile is safer than a pure tools bet. |
| Caleb Wilson | Big wing/forward scarcity: defense 86, athleticism 89, size 93, upside 95. Strength and shot diet are real but not disqualifying. |
| Keaton Wagler | Big guard shooting profile: shooting 91, feel 83, size 84, upside 90. Clean role even if primary-creation ceiling is uncertain. |
| Kingston Flemings | Young lead-guard case with defense/feel support: creation 86, defense 80, feel 87, upside 88. Jumper consistency needs review, but the profile is balanced. |
| Brayden Burries | Two-way guard frame and role clarity: shooting 82, creation 81, defense 83, size 84. Lower star ceiling than top-five guards, but safer floor. |
| Nate Ament | 6-10 shooting forward profile: shooting 86, size 92, upside 87. Scarce enough to protect a first-round grade despite strength/physicality risk. |
| Karim Lopez | International big-wing defender: defense 85, size 91, upside 86, age 19. Positional scarcity and international pathway justify first-round treatment. |
| Aday Mara | Rare center size: defense 91, size 99, feel 82, international, mockHeat 81. Mobility/stamina are review items, but the rim-protection archetype is scarce. |

Near-safe floor candidates: Yaxel Lendeborg and Dailyn Swain. Yaxel is very stable as a mature connector/defender, but his age curve and lower upside make him less valuable in an upside-weighted first-round debate. Dailyn has a useful wing connector profile, but lower mockHeat and pull-up/creation questions keep him just outside this top 10.

## 3. Most Dangerous 5 Final-30 Candidates

These players should not be blindly lifted by consensus or mock heat.

| Player | Danger Signal | Parameter Implication |
| --- | --- | --- |
| Darius Acuff Jr. | Media-hot guard: rank 6, mockHeat 90, but size 70 and defense 66 with risks around NBA length and shot discipline. | Do not let consensus plus upside overpower player-grade risk. Needs stronger player/risk scrutiny. |
| Mikel Brown Jr. | Rank 7, mockHeat 88, but defense 68, size 76, age 20, and finishing-through-size risk. | Good prospect, but not a clean top-10 lock if `player` is raised and defensive translation matters. |
| Morez Johnson Jr. | NBA.com consensus lottery crossover, but shooting 56, creation 54, feel 66. Non-spacing big with passing-feel risk. | Consensus/need can overrate him for frontcourt-needy teams; player weight should push him down. |
| Jayden Quaintance | Age 18, defense/upside tools, but explicit medical review and small sample, plus shooting 55, creation 52, feel 64. | Keep in first-round pool only after medical clearance; upside alone should not make him safe. |
| Tarris Reed Jr. | Generated conservative profile, no seed profile match, manual confirmation required, mockHeat 32, upside 65. | Treat as data-risk first. He should not rise from need or center scarcity without manual scouting confirmation. |

Watch-list just outside the top five: Henri Veesaar, Meleek Thomas, and Aday Mara. Henri and Meleek are supplemental-source risks; Aday has enough rare-size value to remain first-round safe but needs mobility/stamina review.

## 4. Profiles Most Needing Manual Review

| Player/Profile Group | Manual Review Needed |
| --- | --- |
| Tarris Reed Jr. | Data-quality report explicitly marks him as generated/conservative because no seed profile match existed. Do not treat his profile as a scouted grade. |
| Supplemental ranks 26-30: Henri Veesaar, Koa Peat, Meleek Thomas, Tarris Reed Jr., Sergio De Larrea | Normalized source says ranks 26-30 are ESPN mock-order supplements because ESPN Big Board ranks 26-100 were not visible. These need independent scouting/biographical confirmation. |
| Jayden Quaintance | Medical review plus small sample. He is the clearest case of "risky but still first-round if cleared" because age 18, defense 86, size 90, upside 88 are premium signals. |
| Darius Acuff Jr. and Mikel Brown Jr. | High media heat but small/guard translation risk. Recheck finishing, defensive pressure, and shot discipline before locking top-10 treatment. |
| Aday Mara, Hannes Steinbach, Henri Veesaar, Sergio De Larrea | International/frontcourt translation group. Separate real skill/feel from size or stash-value assumptions. |
| Yaxel Lendeborg and Bennett Stirtz | Older, productive profiles. Review whether their first-round case is immediate rotation value or whether age/ceiling should cap them. |

## 5. Should Upside Or Player Weight Increase?

Yes, but asymmetrically:

- Increase `player` from 20 to 25. This is the safest improvement because it rewards complete profiles and penalizes one-dimensional media names without needing code changes.
- Increase `upside` from 10 to 15. This is needed so players like Karim Lopez, Nate Ament, Jayden Quaintance, Chris Cenac Jr., Allen Graves, and Sergio De Larrea can stay in the first-round conversation due to ceiling, age, size, international pathway, or scarce role.
- Do not push `upside` above 15 as the default until the risk model is expanded. A bigger upside bump would over-help players with medical, shooting, feel, or source-quality flags.

Players who deserve first-round consideration because of upside/position/age despite risk:

| Player | First-Round Case |
| --- | --- |
| Jayden Quaintance | Age 18 with defense 86, athleticism 85, size 90, upside 88. Medical review decides range, not whether the tools are first-round caliber. |
| Chris Cenac Jr. | 19-year-old 6-11 frontcourt tools profile: defense 82, athleticism 81, size 93, upside 84. Offensive polish is the swing factor. |
| Karim Lopez | International 19-year-old big wing with defense/size/upside. Scarce role should be protected by upside/player weighting. |
| Nate Ament | 6-10 shooter/forward. Shooting plus size is scarce enough to keep him above lower-upside guards and non-spacing bigs. |
| Allen Graves | Freshman forward with defense 86 and size 85. Lower media heat, but position/defense gives a credible late-first case. |
| Sergio De Larrea | International big guard with feel 84 and size 86. Low mockHeat and supplemental-source status require review, but the archetype is scarce. |

Bottom line: the model should become less consensus-led and more profile-led. Recommended weights are `consensus 30 / need 22 / player 25 / upside 15 / intel 8`.
