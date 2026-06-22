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

The launcher checks dependencies, installs them if `node_modules` is missing, starts Vite on `http://127.0.0.1:3002/`, and opens the browser.

Manual commands:

```powershell
npm install
npm run dev:local
npm run build
```

## Competition Workflow

- Import Team Portal data as JSON when official files are available.
- Use **Generate Board** after changing weights or replacing data.
- Click any pick to inspect evidence, warnings, and scoring breakdown.
- Use the dropdown in the evidence panel for manual overrides.
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
- DynamoDB: saved predictions, manual overrides, milestone answers.
- Bedrock: explanation summaries, milestone answer reasoning, evidence cleanup.
- App Runner or ECS: web/API runtime.
- CloudWatch: request logs, model-call cost tracking, final submission audit trail.

Keep Bedrock calls batched and cache summaries so the stack stays inside the $170 competition credit target.

## Submission Checklist

- GitHub repository is **Private**.
- Final push completes before **2026-06-24 08:00**.
- Board has exactly 30 picks and no duplicate players.
- Milestone answers are exported and manually reviewed.
- PPT and a video under 60 seconds are ready.
- README explains data, method, AWS services, and how to run.

## Repository Hygiene

The raw `数据/DraftCombine_Hackathon.zip` archive and `数据/DraftCombine_Hackathon/视频介绍/` videos are intentionally excluded from git because they exceed normal GitHub file limits. Keep those files locally, or move final media deliverables to S3/GitHub Releases if they need to be shared.

## Public Seed Sources

- NBA official 2026 Draft order: https://www.nba.com/news/2026-nba-draft-order
- NBA consensus mock draft: https://www.nba.com/news/2026-consensus-mock-draft
- Tankathon 2026 big board: https://www.tankathon.com/big-board
