# DraftOps

DraftOps is a local 2026 NBA Draft prediction cockpit for the AWS/NBA competition. It produces a first-round board, milestone answers, evidence notes, and export files for final submission and roadshow prep.

Detailed Chinese development guide: [开发指导.md](./开发指导.md)

Detailed algorithm guide: [算法指导.md](./算法指导.md)

## One-Click Start

Windows:

```powershell
.\start-draftops.bat
```

Or from the parent `AWS` folder:

```powershell
.\start-draftops.bat
```

The launcher checks dependencies, installs them if `node_modules` is missing, starts Vite from `DRAFTOPS_CLIENT_PORT` or `3002`, automatically moves to the next available port when needed, and opens the browser.

Manual commands:

```powershell
npm install
npm run dev:agent
npm run build
```

## DeepSeek Agent

The interactive window calls DeepSeek through an OpenAI-compatible chat completions request. This DeepSeek can answer any competition-related question, including data, milestones, reference-document wording, prediction-board discussion, AWS architecture, submission, roadshow, frontend behavior, code structure, and run guidance. It answers from the global competition context by default; the currently clicked pick/team is only passed to DeepSeek when the user explicitly asks about the current pick, this team, the selected player, or directly names that same pick/team/player. Its hard boundary is execution: it must not directly edit code, write files, run commands, commit, or push. Real code changes stay in the repository workflow. The browser talks to the local proxy from `DEEPSEEK_AGENT_PORT` or `4318`; the launcher automatically moves to the next available port when needed. The proxy reads `.env.local`, so the API key is never sent to the frontend.

Create `.env.local` from `.env.example` and set `DEEPSEEK_API_KEY`. Keep model, label, and preferred ports in `.env.local` when they need to differ from the defaults, then run:

```powershell
npm run dev:agent
npm run agent:deepseek
```

## Competition Workflow

- Register official files and external sources into the Agent data pipeline.
- Let A6/A7 regenerate the locked Agent board after changing parameters or replacing data.
- Click any pick to inspect evidence, warnings, and scoring breakdown.
- Do not manually override, replace, lock, or reorder predicted players.
- Export `draftops-submission.json` before the 08:00 deadline.
- Export `draftops-brief.md` for PPT and the 6-minute roadshow script.

Expected import shape:

```json
{
  "teams": [],
  "prospects": []
}
```

The seed data is intentionally replaceable. It is based on public order/consensus sources and should be refreshed with official Team Portal files during the event.

Hard execution rule: the DeepSeek chat window is for competition Q&A only. It can discuss prediction-board reasoning and code structure, but it must not directly edit code, write files, run commands, commit, or push. Real board and code changes must go through the designated repository workflow. Selection scope rule: clicking a pick/team in the UI does not narrow every answer to that row; DeepSeek only receives that row when the question explicitly asks about the current or selected item.

## Method

Each team-prospect pair is scored with these default weights:

- Consensus mock position: 35
- Team need fit: 25
- Player grade: 20
- Upside: 10
- Late intel/mock heat: 10

The app prevents duplicate players during generation and surfaces low-confidence or medical/international warnings for final review.

## AWS Roadshow Architecture

Recommended AWS mapping for the code-quality and presentation score:

- S3: official data, external mock data, exported board snapshots.
- DynamoDB: saved Agent board snapshots, parameter/audit state, milestone answers.
- Bedrock: explanation summaries, milestone answer reasoning, evidence cleanup.
- App Runner or ECS: web/API runtime.
- CloudWatch: request logs, model-call cost tracking, final submission audit trail.

Keep Bedrock calls batched and cache summaries so the stack stays inside the $170 competition credit target.

## Submission Checklist

- GitHub repository is **Private**.
- Final push completes before the deadline declared in `src/config/draftops-manifest.json`.
- Board has exactly 30 picks and no duplicate players.
- Board provenance declares no manual overrides.
- Milestone answers are exported and source-checked.
- PPT and a video under 60 seconds are ready.
- README explains data, method, AWS services, and how to run.

## Repository Hygiene

The raw `数据/DraftCombine_Hackathon.zip` archive and `数据/DraftCombine_Hackathon/视频介绍/` videos are intentionally excluded from git because they exceed normal GitHub file limits. Keep those files locally, or move final media deliverables to S3/GitHub Releases if they need to be shared.

## Public Seed Sources

- NBA official 2026 Draft order: https://www.nba.com/news/2026-nba-draft-order
- NBA consensus mock draft: https://www.nba.com/news/2026-consensus-mock-draft
- Tankathon 2026 big board: https://www.tankathon.com/big-board
