# DraftOps

DraftOps is a local 2026 NBA Draft prediction cockpit for the AWS/NBA competition. It turns official files, public draft signals, team context, and agent-generated evidence into a locked first-round board, milestone answers, export files, and roadshow material.

Detailed Chinese development guide: [开发指导.md](./开发指导.md)

Detailed algorithm guide: [算法指导.md](./算法指导.md)

Multi-agent workflow guide: [多Agent协作指导.md](./多Agent协作指导.md)

Codex operating constraints and anti-hallucination rules: [AGENTS.md](./AGENTS.md)

## Current Status

The checked-in app is a local React + TypeScript + Vite application with a read-only Agent board. It currently loads the data paths declared in `src/config/draftops-manifest.json`:

```text
public/data/expanded_import_bundle.json
public/data/agent_expanded_recommended_board.json
```

Current artifact contract:

- `expanded_import_bundle.json` contains 30 first-round teams and a 101-player official candidate pool.
- `data/normalized/normalized_2026_local_player_pool_124.json` contains the 124-player local answer-card candidate pool extracted from the official workbook.
- `data/normalized/normalized_2026_player_feature_reference_124.json` contains the 124-player feature/parameter reference built from local 26-27 participant, measurement, agility, shooting, and historical Combine data.
- `data/normalized/normalized_2026_online_player_list_reverification_20260623.json` reconciles the live NBA.com Prospects, NBA China draft board, Combine invite, Stats Anthro, Early-entry, and local 124-player pool counts.
- `agent_expanded_recommended_board.json` contains 30 picks, 30 unique selected prospects, no duplicate players, and `noManualOverride: true`.
- The current recommended scenario is `baseline`.
- README status note refreshed on 2026-06-27 to keep the current run guidance easy to find.
- The current board health gate is passing: exactly 30 picks, no duplicates, and 1 low-confidence pick.
- The current milestone set has 7 answers, matching `src/config/draftops-manifest.json` and `data/final/milestone_answers.json`.
- The filled answer-card workbook is `数据/上传此文件即可（选秀+里程碑问题选手答题卡_里程碑预测已填）.xlsx`.

The older `public/data/final_import_bundle.json` and `public/data/agent_balanced_board.json` files are retained as historical or fallback artifacts. They are not the current frontend default.

## One-Click Start

Windows:

```powershell
.\start-draftops.bat
```

macOS:

```bash
chmod +x start-draftops.command
./start-draftops.command
```

Or from the parent `AWS` folder:

```powershell
.\start-draftops.bat
```

On macOS, you can also run the parent launcher:

```bash
chmod +x start-draftops.command
./start-draftops.command
```

The launcher checks dependencies, installs them if `node_modules` is missing, starts Vite from `DRAFTOPS_CLIENT_PORT` or `3002`, automatically moves to the next available port when needed, and opens the browser.

Manual commands:

```powershell
npm install
npm run rag:build
npm run rag:sync:aws
npm run audit:grounding
npm run dev:agent
npm run build
```

## System Grounding Audit

Run the system-level anti-hallucination gate before demos, submission checks, or broad claims about the board, RAG, candidate pools, milestones, or Codex/DeepSeek behavior:

```powershell
npm run audit:grounding
```

The audit reads the current `AGENTS.md`, locked board, candidate-pool files, milestone answers, RAG manifest, frontend guardrails, and local/cloud DeepSeek guardrail text. It writes JSON and Markdown reports under `data/reports/` and fails only on blocker-level grounding problems.

Watch late-breaking team-change news and official top-30 draft-order shifts once per minute:

```powershell
npm run news:watch
```

Useful monitor variants:

```powershell
npm run news:watch -- --once
npm run news:watch -- --official-only
npm run news:watch -- --interval 30
```

The watcher checks NBA official sources first, including the official 2026 Draft Order page. It hashes the top-30 pick sequence, team ownership, and `from/via` pick-rights notes so first-round pick-order changes are reported even when they are not written as a normal trade headline.

Watch draft player-list and pick-board data once per minute:

```powershell
npm run draft:watch
```

Useful draft monitor variants:

```powershell
npm run draft:watch -- --once
npm run draft:watch -- --full-firecrawl
npm run draft:watch -- --refresh-on-direct-change
```

The draft watcher logs every pass to `.draftops-watch/online-player-list-watch.log`, including `无变动` when the parsed data is unchanged. Pick order, selected player, team, pick-trade notes, draft-day trade notes, source list counts, and source-list content are all treated as data changes. Default mode Firecrawl-scrapes the NBA China draft board every pass and parses other NBA.com sources from the latest verified snapshots while direct-fetching them only for health/hash observation. `--full-firecrawl` refreshes every monitored page with Firecrawl every pass and will consume credits much faster; `--refresh-on-direct-change` refreshes a non-China source when its raw direct-fetch hash changes.

For a plain frontend-only run:

```powershell
npm run dev:local
```

## DeepSeek Agent

The interactive window calls DeepSeek through an OpenAI-compatible chat completions request. It can answer competition-related questions about data, milestones, reference documents, the prediction board, AWS architecture, submission, roadshow prep, frontend behavior, code structure, and run guidance.

The assistant is read-only. It must not directly edit code, write files, run commands, commit, push, reorder picks, or replace players. Real code and board changes must go through the repository workflow and regenerated data artifacts.

The browser talks to the local proxy from `DEEPSEEK_AGENT_PORT` or `4318`. The proxy reads `.env.local`, so the API key is never sent to the frontend.
Local chat output is controlled by `DEEPSEEK_CHAT_MAX_TOKENS` and defaults to `8192`. If DeepSeek returns `finish_reason=length`, the chat window will show a local truncation notice; raise this value in `.env.local` and restart the local agent for longer answers.

Create `.env.local` from `.env.example` and set `DEEPSEEK_API_KEY` when local chat is needed:

```powershell
npm run dev:agent
npm run agent:deepseek
```

## AWS Agent API

The Lambda implementation lives in `infra/lambda/draftops-ai-api`. It mirrors the same read-only boundary and can retrieve deployed data before calling DeepSeek or Bedrock.

Current implemented pieces:

- S3 RAG: reads prebuilt indexes from `data/rag/` first (`rag-core-board`, `rag-team-preference`, `rag-prospect-evidence`, `rag-milestone`, and `rag-architecture`). Raw S3 objects remain a fallback path when indexes are absent.
- DynamoDB RAG: scans configured tables for board snapshots, audit state, parameter state, or milestone answers.
- Retrieval ranking: uses local hashed-token embeddings, lexical matching, source weighting, and MMR reranking by default.
- Optional embedding rerank: supports Bedrock Titan embeddings or DashScope/Qwen embeddings, with fallback to local hash embeddings.
- Offline embedding index: run `npm run rag:build` to pre-slice source data and store vectors in `data/rag/*.json`; with `DASHSCOPE_API_KEY` it writes DashScope `text-embedding-v4` vectors, otherwise it writes local-hash 256-dimensional vectors compatible with the Lambda fallback.
- External RAG sync: run `npm run rag:sync:aws` after rebuilding indexes to upload the current `data/rag/`, normalized source files, and verification reports to S3, then write the 124-player feature records into DynamoDB.
- Candidate-pool supplement: RAG also reads `data/normalized/normalized_2026_local_player_pool_124.json`, `data/normalized/normalized_2026_player_feature_reference_124.json`, and `data/normalized/normalized_2026_online_player_list_reverification_20260623.json` so questions about the full local answer-card pool, Combine-style parameters, and online 101/73/78/71 source counts are not limited to the 101-row NBA.com official prospects capture.
- Model providers: supports DeepSeek through a secret/API key or Bedrock through `MODEL_PROVIDER=bedrock`.
- Health route: `GET /api/deepseek/health`.
- Chat route: `POST /api/deepseek/chat`.

This repository currently includes the Lambda code and package files, but not a full CDK/SAM/Terraform deployment stack. For the roadshow, present it as the deployable API layer unless an infrastructure stack is added.

## Competition Workflow

- Treat `数据/` as the official local raw input bundle.
- Write all derived Agent outputs to `data/` and synchronized frontend copies to `public/data/`.
- Regenerate the locked Agent board through scripts and structured data, not by manually editing individual picks.
- Click any pick in the UI to inspect evidence, warnings, fit context, profile signals, and alternatives.
- Export `draftops-submission.json` before the configured deadline.
- Export `draftops-brief.md` for PPT and the 6-minute roadshow script.

Expected import shape:

```json
{
  "teams": [],
  "prospects": []
}
```

Hard execution rule: no manual override, replacement, locking, or reordering of predicted players. If a prediction must change, update source data, parameters, or guardrails, then rerun the Agent board generation script.

## Prediction Method

Each team-prospect pair is scored by `src/lib/prediction.ts` with five base factors:

- Consensus mock position: 35
- Team need fit: 25
- Player grade: 20
- Upside: 10
- Late intel/mock heat: 10

The scoring layer also applies draft-zone adjustment, team-phase adjustment, risk penalties, pick-value adjustment, and deterministic tie handling. The app prevents duplicate players during generation and surfaces low-confidence, medical, international, and fit warnings for final review.

## Key Data Files

Current frontend inputs:

```text
src/config/draftops-manifest.json
public/data/expanded_import_bundle.json
public/data/agent_expanded_recommended_board.json
```

Current source artifacts:

```text
data/final/expanded_import_bundle.json
data/normalized/normalized_2026_local_player_pool_124.json
data/normalized/normalized_2026_player_feature_reference_124.json
data/normalized/normalized_2026_online_player_list_reverification_20260623.json
data/reports/player_feature_parameter_reference_124_20260623.md
data/reports/player_feature_parameter_reference_124_20260623.csv
data/reports/online_full_player_list_reverification_20260623.md
data/boards/expanded_strategy_boards_20260623.json
data/final/milestone_answers.json
data/reports/expanded_strategy_full_rerun_20260623.md
data/reports/milestone_answer_card_write_report_20260623.json
```

Important official/user-provided local files:

```text
数据/NBA选秀大会_26-27赛季数据.xlsx
数据/上传此文件即可（选秀+里程碑问题选手答题卡_模板）.xlsx
数据/上传此文件即可（选秀+里程碑问题选手答题卡_里程碑预测已填）.xlsx
数据/赛前培训直播-会议纪要 (1).md
数据/DraftCombine_Hackathon/
```

## AWS Roadshow Architecture

Recommended AWS mapping for the code-quality and presentation score:

- S3: official data, external mock data, exported board snapshots, and frontend static assets.
- DynamoDB: saved Agent board snapshots, parameter/audit state, milestone answers, and review state.
- Bedrock: explanation summaries, milestone reasoning, evidence cleanup, and optional embedding rerank.
- Lambda: read-only chat API that retrieves S3/DynamoDB chunks before calling DeepSeek or Bedrock.
- App Runner, ECS, S3 static hosting, or CloudFront: web/API runtime.
- CloudWatch: request logs, model-call cost tracking, and final submission audit trail.

Keep model calls batched and cached so the stack stays inside the competition credit budget.

## Submission Checklist

- GitHub repository is private.
- Final push completes before the deadline declared in `src/config/draftops-manifest.json`.
- Frontend manifest points to the intended final data files.
- Board has exactly 30 picks and no duplicate players.
- Board provenance declares `noManualOverride: true`.
- Low-confidence and narrow-margin picks are reviewed before final lock.
- 7 current milestone answers are source-checked and match the filled answer-card workbook.
- `draftops-submission.json` and `draftops-brief.md` export successfully.
- `npm run lint` passes.
- `npm run build` passes.
- PPT and a video under 60 seconds are ready.
- README explains data, method, AWS services, and how to run.

## Repository Hygiene

The raw `数据/DraftCombine_Hackathon.zip` archive and `数据/DraftCombine_Hackathon/视频介绍/` videos are intentionally excluded from git because they exceed normal GitHub file limits. Keep those files locally, or move final media deliverables to S3/GitHub Releases if they need to be shared.

Do not commit `.env.local`, API keys, Team Portal tokens, or paid-account credentials.

## Public Seed Sources

- NBA official 2026 Draft order: https://www.nba.com/news/2026-nba-draft-order
- NBA official 2026 prospects: https://www.nba.com/draft/2026/prospects
- NBA consensus mock draft: https://www.nba.com/news/2026-consensus-mock-draft
- Tankathon 2026 big board: https://www.tankathon.com/big-board
