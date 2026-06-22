# D9 Historical Prior Debate

Generated at: 2026-06-22 +08:00

Scope: read-only historical-prior analysis for the 2026 first-round prediction board. Source files were not modified. This report uses official historical draft-result rows and official Combine-history rows only as interpretable priors, not as a training set.

## Inputs Reviewed

- `数据/2000-2025_NBA选秀结果_数据汇总.xlsx`
  - Main draft-result sheet `选秀名单`: 1,486 drafted-player rows.
  - Actual drafted-player coverage in this file is 2001-2025, not 2000-2025.
  - First-round sample used here: 746 rows, picks 1-30.
  - The `标记/Honors` symbols are not always isolated in the honors column. Some symbols are appended to `球员/Player`, so outcome flags were read from `球员/Player + 标记/Honors`.
- `数据/DraftCombine_Hackathon/DraftCombineHistory2000_2025.csv`
  - File extension is `.csv`, but the file is an Excel/OpenXML workbook.
  - Main sheet `DraftCombineHistory2000_2025 (2`: 1,795 rows, 2000-2025.
  - Header row 1 is Chinese; header row 2 is English field names.
- `data/final/final_import_bundle.json`
  - Current 2026 board pool: 30 teams and 30 prospects.
  - Current 2026 class mix: 16 Freshman, 6 Sophomore, 3 Junior, 3 Senior, 2 International.
  - Current 2026 age range: 18-23, average 19.8.
  - Current `international: true`: 5 of 30.

## 1. Historical Prior Fields That Are Actually Usable

| Source | Usable fields | How to use | Confidence |
| --- | --- | --- | --- |
| Draft results | `年份/Year`, `轮次/Round`, `顺位/Pick` | Historical pick-band and first-round distribution. Useful for sanity checks and broad priors. | Medium |
| Draft results | `位置/Position` | Position and broad-archetype prior: guard, wing/forward, center, F/C, G/F. | Medium |
| Draft results | `国籍/Nationality` | Non-US / international-origin prior. Use as translation-context signal, not automatic plus or minus. | Medium |
| Draft results | `学校或俱乐部/School/Club` | Pathway/class proxy: NCAA Freshman, Sophomore, Junior, Senior, high school/prep, international club, US pro/development. | Medium-low |
| Draft results | `标记/Honors` plus symbols in `球员/Player` | Rough career outcome markers: All-Star / All-NBA / Rookie of the Year / never played. | Low-medium, because 2021-2025 careers are still incomplete |
| Combine history | Height, weight, wingspan, standing reach, hands | Position-normalized size and length reference. | High when matched |
| Combine history | Vertical jumps, sprint, lane agility, modified lane | Position-normalized athletic reference. Lower-is-better time fields must be inverted. | High when matched |
| Combine history | Body fat, bench, flexibility | Low-weight context only. Coverage is uneven and era-dependent. | Low |
| Final bundle | `age`, `classYear`, `positions`, `origin`, `international`, `profile` | 2026-specific application layer. Use historical priors only after the current player facts are known. | Medium |

Notably absent from the historical tables: exact prospect age at draft, birthdate, medical results, interviews, workouts, college production, shooting-drill results, and team-specific private intel.

## 2. Historical First-Round Baseline

Historical first-round pick bands from the available draft-result file:

| Pick band | Rows | Avg pick | Any All-Star marker | All-Star plus All-NBA marker | ROY marker | Never-played marker |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1-5 | 125 | 3.0 | 36.0% | 24.8% | 16.0% | 0.0% |
| 6-14 | 225 | 10.0 | 13.3% | 7.6% | 1.3% | 0.4% |
| 15-30 | 396 | 22.4 | 5.8% | 2.3% | 0.0% | 1.0% |

Interpretation for 2026:

- The top five should remain heavily protected by consensus and elite profile quality. A team-need reach in the top five needs unusually strong current evidence.
- Picks 6-14 are where historical priors should most often break ties: scarce archetype, younger development runway, or verified size/athletic evidence can reasonably move a player.
- Picks 15-30 should be more tolerant of role specialists, older readiness profiles, and international development bets, but not by pretending those archetypes have top-five upside.

## 3. Position And Archetype Prior

Historical first-round distribution by broad position:

| Broad position | Rows | Avg pick | Top-5 share | Any All-Star marker | All-Star plus All-NBA marker |
| --- | ---: | ---: | ---: | ---: | ---: |
| Guard | 288 | 16.1 | 14.9% | 14.2% | 9.7% |
| Forward | 278 | 15.5 | 15.1% | 9.4% | 4.3% |
| Center | 104 | 14.2 | 18.3% | 17.3% | 9.6% |
| G/F | 38 | 15.0 | 21.1% | 18.4% | 10.5% |
| F/C | 36 | 12.5 | 36.1% | 16.7% | 8.3% |

Primary-position detail:

| Primary position | Rows | Avg pick | Top-5 share | Any All-Star marker |
| --- | ---: | ---: | ---: | ---: |
| PG | 123 | 14.1 | 22.8% | 22.0% |
| SG | 170 | 17.1 | 10.6% | 8.8% |
| SF | 155 | 15.7 | 16.8% | 11.0% |
| PF | 146 | 14.4 | 20.5% | 13.0% |
| C | 113 | 13.9 | 19.5% | 16.8% |

2026 application:

- Primary creators at PG can justify premium slots, but the bar is high. Darryn Peterson fits the historical high-end guard prior because he combines creation, shooting, and size. Darius Acuff Jr. and Mikel Brown Jr. need stronger size/defense confidence before history should help them into the same tier.
- Pure SG profiles historically have a lower top-five share than PG, PF, or C. Meleek Thomas should be treated as a late-first scoring-guard case unless current consensus changes.
- Big wings and forward/center hybrids deserve scarcity protection. AJ Dybantsa, Caleb Wilson, Cameron Boozer, Nate Ament, Karim Lopez, and Chris Cenac Jr. should receive small positive historical-prior support because size plus role versatility is hard to find.
- Centers should not be lifted by height alone. Aday Mara gets a real rare-size prior, but mobility, stamina, and role translation still decide how high he can go. Morez Johnson Jr., Henri Veesaar, and Tarris Reed Jr. need skill/feel evidence, not only positional scarcity.

## 4. Age And Class Prior

The official draft-result table and Combine-history table do not contain exact historical ages. Therefore D9 cannot honestly compute a 2001-2025 age curve from these inputs. The usable historical proxy is pathway/class text inside `学校或俱乐部/School/Club`.

Historical first-round pathway/class proxy:

| Pathway/class proxy | Rows | Avg pick | Top-5 share | Any All-Star marker | All-Star plus All-NBA marker |
| --- | ---: | ---: | ---: | ---: | ---: |
| NCAA Freshman | 215 | 12.6 | 28.8% | 21.9% | 11.2% |
| NCAA Sophomore | 135 | 14.7 | 11.9% | 14.8% | 11.1% |
| NCAA Junior | 128 | 16.3 | 14.1% | 8.6% | 6.2% |
| NCAA Senior | 111 | 20.2 | 0.9% | 5.4% | 2.7% |
| International club/other | 113 | 16.8 | 14.2% | 8.0% | 3.5% |
| High school / prep | 23 | 12.0 | 30.4% | 13.0% | 13.0% |
| US pro/development | 9 | 7.7 | 55.6% | 0.0% | 0.0% |

Important caveats:

- High school/prep is mostly an old-rule pathway, so it should not be transferred directly to 2026.
- US pro/development has only 9 first-round rows here and most are recent, so career-outcome rates are not mature.
- NCAA Freshman is the strongest usable class prior, but it is not a standalone scouting grade.
- Senior history is clear directionally: seniors can be useful first-rounders, but they are almost never historical top-five bets from this sample.

2026 application:

- The current top-five being all Freshmen is historically defensible only because the players also have current consensus/profile support. Freshman status alone should not lift a player.
- Cameron Boozer gets the cleanest age/class positive: age 18, Freshman, high feel, frontcourt size.
- Jayden Quaintance is a special case: age 18 as a Sophomore should receive young-runway credit, but his medical and feel/role concerns must gate the benefit.
- Mikel Brown Jr., Brayden Burries, and Hannes Steinbach are age-20 Freshmen. They should get less development-runway credit than age-18/19 Freshmen.
- Yaxel Lendeborg, Bennett Stirtz, and Tarris Reed Jr. should be valued through readiness and role clarity, not upside. The Senior prior should cap their ceiling unless current evidence is unusually strong.

## 5. School / Pathway Prior

The school field should be used to classify pathway, not to create a hidden "blue-blood bonus." The available historical table does not contain coaching, usage, minutes, production, transfer history, NIL context, or program-development quality.

Recommended use:

| School/path signal | Historical-prior use | 2026 examples |
| --- | --- | --- |
| NCAA Freshman at a major college | Positive if paired with top consensus and real profile tools. | Darryn Peterson, AJ Dybantsa, Cameron Boozer, Caleb Wilson, Keaton Wagler |
| Older college prospect | Readiness/floor signal, not star-upside signal. | Yaxel Lendeborg, Bennett Stirtz, Tarris Reed Jr. |
| International club/academy | Translation-risk and archetype-scarcity signal. Do not score it as automatically better or worse. | Karim Lopez, Sergio De Larrea |
| International background but US college pathway | Treat through current role, size, and age, not as stash-only. | Aday Mara, Hannes Steinbach, Henri Veesaar |
| US pro/development pathway | Too small and recent in this file for stable outcome priors. | No direct current top-30 equivalent |

## 6. International Prior

Historical first-round nationality split:

| Group | Rows | Avg pick | Top-5 share | Any All-Star marker | All-Star plus All-NBA marker | Never-played marker |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| United States | 545 | 15.3 | 17.2% | 13.9% | 8.3% | 0.2% |
| Non-US | 201 | 15.8 | 15.4% | 10.9% | 6.0% | 2.0% |

Era share of non-US first-rounders:

| Era | First-round rows | Non-US share |
| --- | ---: | ---: |
| 2001-05 | 146 | 29.5% |
| 2006-10 | 150 | 20.7% |
| 2011-15 | 150 | 28.0% |
| 2016-20 | 150 | 28.0% |
| 2021-25 | 150 | 28.7% |

2026 application:

- International status should not be a blanket penalty. The historical first round has a stable international share, and top-five access is not meaningfully closed.
- The slightly higher never-played marker for non-US players should be read as translation/stash uncertainty, not as a talent downgrade.
- Current final bundle has 5 international-background players: Aday Mara, Hannes Steinbach, Karim Lopez, Henri Veesaar, Sergio De Larrea. That is 16.7% of the board, below the historical first-round non-US share in this file.
- Karim Lopez gets the best international-prior case because age 19, big-wing size, defense, and international pathway all point in the same direction.
- Sergio De Larrea gets a weaker but real archetype prior as a big guard with feel. Low mockHeat and limited current-source support should keep the adjustment small.
- Aday Mara, Hannes Steinbach, and Henri Veesaar should be treated as college-frontcourt translation cases, not pure international stashes.

## 7. Combine And Physical Prior

Combine-history coverage:

| Metric | Coverage |
| --- | ---: |
| Height without shoes | 96.8% |
| Weight | 96.7% |
| Wingspan | 96.8% |
| Standing reach | 96.7% |
| Max vertical | 86.1% |
| No-step vertical | 86.1% |
| Lane agility | 85.8% |
| Three-quarter sprint | 85.8% |
| Hand length/width | 55.8% |
| Modified lane agility | 36.7% |
| Body fat | 71.1% overall, but missing in recent years |
| Bench press | 61.0% overall, 0% in 2021-2025 |

Position medians from Combine history:

| Position code | Rows | Height no shoes | Weight | Wingspan | Standing reach | Max vertical | Sprint | Lane agility |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 364 | 73.0 in | 186.9 lb | 77.5 in | 97.5 in | 36.0 in | 3.20 s | 11.04 s |
| 2 | 400 | 76.0 in | 202.0 lb | 80.75 in | 101.0 in | 35.5 in | 3.22 s | 11.13 s |
| 3 | 353 | 78.25 in | 214.7 lb | 82.75 in | 104.5 in | 35.0 in | 3.25 s | 11.29 s |
| 4 | 449 | 80.0 in | 233.4 lb | 85.0 in | 107.0 in | 33.0 in | 3.30 s | 11.53 s |
| 5 | 224 | 82.0 in | 243.9 lb | 87.25 in | 110.0 in | 31.0 in | 3.39 s | 11.90 s |

Rules for use:

- Always normalize by position. A 6-3 guard and a 6-10 forward should not share the same raw size threshold.
- Lower-is-better time fields must be inverted before scoring.
- Use height without shoes as primary height. Use with-shoes height only as fallback.
- Wingspan and standing reach are the cleanest length priors.
- Bench, body fat, and flexibility should be low-weight because coverage is era-dependent.
- The Combine-history file does not include shooting-drill makes/attempts or medical results. Do not infer shooting or injury status from this file.

Current 2026 final-bundle Combine-history matches:

| Prospect | Official Combine-history row | Directional prior |
| --- | --- | --- |
| Yaxel Lendeborg | 2025, position 4 | Positive length prior: wingspan 91.9th percentile and standing reach 79.2nd percentile within position 4. Neutral frame: weight 52.9th percentile. Athletic cap: no-step vertical 14.5th, max vertical 29.8th, sprint 45.3rd, lane agility 40.2nd. |
| Labaron Philon Jr. | 2025, position 1, secondary 2 | Positive guard size/reach prior: height 77.5th percentile and standing reach 78.0th within position 1. Sprint is positive at 70.4th. Cautions: weight 16.7th, max vertical 19.0th, lane agility 20.2nd. |

The other 28 current prospects have no official 2000-2025 Combine-history match. Missing history should be neutral, not negative, because most 2026 prospects have not yet appeared in the historical file.

## 8. What Cannot Be Inferred From These Historical Data

- Precise historical age curve. There is no age or birthdate field in the reviewed historical draft-result or Combine tables.
- Current-year Combine score for most 2026 prospects. The history file ends at 2025 and only matches 2 of the current 30.
- Shooting ability from Combine history. The reviewed Combine-history table has no shooting-drill result columns.
- Medical, injury, durability, biomechanics, or movement-screen conclusions. These are not exposed as numeric rows.
- Private workouts, interviews, team promises, agent strategy, or late medical intel.
- College production quality, usage, minutes, conference strength, or role evolution.
- A reliable "school brand" effect. School names exist, but program effects are not separable from player quality.
- Mature career outcomes for 2021-2025 draftees. Recent All-Star / All-NBA markers are incomplete by nature.
- Exact 2026 draft order changes, trades, or team behavior. Historical priors can constrain plausibility but cannot forecast transaction behavior.

## 9. Recommended Weight

D9 recommendation: historical prior should be a small, bounded interpretability layer.

Suggested global influence if a separate sixth dimension is allowed:

```json
{
  "consensus": 31,
  "need": 20,
  "player": 23,
  "upside": 14,
  "intel": 6,
  "historicalPrior": 6
}
```

Rationale:

- `historicalPrior` at 6% is large enough to break ties and catch implausible ordering, but too small to override strong 2026 consensus.
- `consensus` remains the largest term because actual draft prediction is still market/media driven.
- `player` and `upside` stay above historical prior because the current 2026 profile contains prospect-specific evidence that historical averages do not.
- `intel` is reduced because some historical-prior signals overlap with mock/consensus narratives.

If the app cannot accept a sixth dimension, use this no-code-change interpretation:

```json
{
  "consensus": 32,
  "need": 20,
  "player": 25,
  "upside": 15,
  "intel": 8
}
```

Then apply D9 manually as a capped overlay inside `player` and `upside`:

- Position/path/Combine evidence goes through `player`.
- Age/class/international runway evidence goes through `upside`.
- Maximum practical movement: 1-2 slots in the top 14, 2-4 slots in the back half of the first round.
- Missing Combine history is neutral.

Recommended internal D9 subweights for the current data state:

```json
{
  "position_archetype": 30,
  "age_class_proxy": 30,
  "school_pathway": 15,
  "international_context": 15,
  "combine_verified_measurements": 10
}
```

If current-year official Combine data becomes available for most 2026 prospects, raise `combine_verified_measurements` to 20-25 inside D9 and reduce `school_pathway` first.

## 10. Debate Position For 2026 First Round

D9 should argue for these concrete adjustments:

1. Keep the top four protected by current consensus and profile quality. Historical priors support, but do not create, the cases for Darryn Peterson, AJ Dybantsa, Cameron Boozer, and Caleb Wilson.
2. Give a small positive prior to scarce big-wing and forward/center archetypes: AJ Dybantsa, Caleb Wilson, Cameron Boozer, Nate Ament, Karim Lopez, Chris Cenac Jr., and Jayden Quaintance.
3. Apply a stricter translation bar to smaller or defense-light guards. Darius Acuff Jr. and Mikel Brown Jr. should not rise only because media heat is high; their size/defense risks matter historically.
4. Cap older-player upside. Yaxel Lendeborg, Bennett Stirtz, and Tarris Reed Jr. can be first-rounders through maturity and role clarity, but historical priors should not push them as star-upside bets.
5. Treat international status as context. Karim Lopez and Sergio De Larrea can be protected for scarce archetype value; Aday Mara and Hannes Steinbach should be read through current role and college pathway.
6. Use Combine only where it matches. Yaxel gets verified length but not verified explosiveness. Labaron Philon Jr. gets verified guard height/reach/sprint support with weight and agility cautions. Everyone else remains neutral until current-year Combine data exists.

Bottom line: the historical prior should make the 2026 board more honest about archetype and development-window risk. It should not become a black-box probability model, and it should not pretend that old first-round averages know more than current official prospect data, consensus, medical review, or team intel.
