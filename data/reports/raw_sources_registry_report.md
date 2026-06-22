# Raw Sources Registry Report

Generated at: 2026-06-22T03:31:27+08:00

## Scope

This registry combines the official local data package in `数据/` with the external Firecrawl source inventory under `data/raw/`. The official files are treated as read-only source material; all agent outputs stay under `data/`.

## Counts

- Total sources: 37
- Official/user-provided sources: 8
- External web sources: 29
- External sources marked ignore: 8

## Official Inputs

- `official-draft-results-2000-2025`: `数据/2000-2025_NBA选秀结果_数据汇总.xlsx` (official_historical_draft_results)
- `official-draft-combine-hackathon-archive`: `数据/DraftCombine_Hackathon.zip` (official_archive)
- `official-combine-history-2000-2025`: `数据/DraftCombine_Hackathon/DraftCombineHistory2000_2025.csv` (official_combine_history)
- `official-combine-metric-dictionary`: `数据/DraftCombine_Hackathon/NBA_Combine_Stat_Lab_指标中英文.xlsx` (official_metric_dictionary)
- `official-combine-intro-cn`: `数据/DraftCombine_Hackathon/NBA_Draft_Combine_Intro_CN.pptx` (official_combine_intro)
- `official-combine-video-01`: `数据/DraftCombine_Hackathon/视频介绍/2026 AWS NBA Draft Combine： Strength & Agility + Shooting Drill Highlights.webm` (official_video_context)
- `official-combine-video-02`: `数据/DraftCombine_Hackathon/视频介绍/Lane agility drills side-by-side.mp4` (official_video_context)
- `official-combine-video-03`: `数据/DraftCombine_Hackathon/视频介绍/shuttle run.mp4` (official_video_context)

## External Inputs

- Highest authority: NBA.com draft hub, NBA.com draft order, NBA.com consensus mock.
- Major media signals: ESPN, CBS Sports, Yahoo Sports, The Ringer, The Athletic, Bleacher Report.
- Cross-check/context: Tankathon for order sanity check, RealGM for future pick obligations, official outlet videos only as fallback context.
- Excluded from model input: Reddit, Facebook, Instagram, self-media YouTube, and Wikipedia when stronger sources exist.

## Downstream Use

- A2/A3 should read `data/raw/raw_sources.json` before normalizing external mock data.
- Local official workbooks support field mapping, historical priors, and quality checks.
- 2026 prospect/order predictions should come from official 2026 pages and weighted media mocks, not from historical files alone.
