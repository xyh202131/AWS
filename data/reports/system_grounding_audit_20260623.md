# DraftOps System Grounding Audit

Generated: 2026-06-23T14:31:27.105Z

Status: pass_with_warnings

## Summary

- Checks: 10
- Blockers: 0
- Warnings: 1
- Board picks: 30
- Unique selected prospects: 30
- Local answer-card pool: 124
- Feature reference players: 124
- Online official prospect rows: 101
- Milestone answers: 7
- RAG indexes: 5

## Checks

### PASS codex-policy-file

Severity: blocker

Root AGENTS.md defines Codex anti-hallucination and no-manual-prediction rules.

Evidence:
- AGENTS.md

Remediation: Create or repair AGENTS.md before Codex analysis or prediction work.

### PASS policy-linked-from-docs

Severity: info

README and multi-agent guide expose the Codex grounding policy.

Evidence:
- README.md
- 多Agent协作指导.md

Remediation: Link AGENTS.md from user-facing docs and keep the multi-agent guide aligned.

### PASS locked-board-contract

Severity: blocker

Locked board is generated, top-30 sequential, duplicate-free, and evidence-bearing.

Evidence:
- path=public/data/agent_expanded_recommended_board.json
- pickCount=30
- noManualOverride=true
- duplicates=0
- missingEvidence=0

Remediation: Regenerate the board through scripts/agents; do not hand-edit picks or evidence.

### WARN board-review-surface

Severity: warning

Low-confidence, thin-evidence, and narrow-margin picks are exposed for review.

Evidence:
- lowConfidence=30:Marc-Owen Fodzo Dada:60
- thinEvidence=none
- narrowMargins=7:Mikel Brown Jr.:margin=0, 10:Kingston Flemings:margin=1, 18:Christian Anderson:margin=0, 19:Labaron Philon Jr.:margin=0, 20:Bennett Stirtz:margin=1, 22:Dailyn Swain:margin=0, 24:Isaiah Evans:margin=0, 30:Marc-Owen Fodzo Dada:margin=0

Remediation: Treat these picks as explanation-review targets, not as manual replacement targets.

### PASS candidate-pool-counts

Severity: blocker

Candidate-pool counts are read from current files and selected players are present in the online official prospect list.

Evidence:
- localPool=124
- featureReference=124
- onlineOfficialProspects=101
- boardCandidatePool.officialProspectRows=101
- selectedMissingFromOfficialList=none

Remediation: Refresh normalized source files or regenerate the board from the verified pool.

### PASS official-result-boundary

Severity: info

Online draft-board verification is recorded as a source boundary, not silently treated as official results.

Evidence:
- chinaDraft.rowCount=60
- chinaDraft.top30PopulatedPickCount=0
- No populated top-30 player picks in the China board snapshot; do not cite it as actual selected-player results.

Remediation: If official result rows appear, rerun source reconciliation before changing any prediction artifacts.

### PASS milestone-grounding

Severity: blocker

Milestone answer count and evidence are grounded in current answer files.

Evidence:
- manifestMilestones=7
- answerRows=7
- withoutEvidence=none

Remediation: Regenerate milestone answers from the locked board and evidence files.

### PASS rag-grounding-indexes

Severity: blocker

RAG indexes exist and contain retrievable chunks.

Evidence:
- core-board: declared=231, actual=231, sources=12
- team-preference: declared=134, actual=134, sources=8
- prospect-evidence: declared=820, actual=820, sources=18
- milestone: declared=68, actual=68, sources=8
- architecture: declared=83, actual=83, sources=9

Remediation: Run npm run rag:build before relying on RAG answers.

### PASS runtime-answer-guardrails

Severity: blocker

Frontend and local DeepSeek proxy carry anti-hallucination guardrails into chat answers.

Evidence:
- src/App.tsx
- scripts/deepseek-chat-server.mjs

Remediation: Restore request guardrails and answer grounding status before enabling chat demos.

### PASS cloud-answer-guardrail-visibility

Severity: info

Lambda source contains retrieval-reflection or weak-evidence guardrail wording.

Evidence:
- infra/lambda/draftops-ai-api/index.mjs

Remediation: Keep cloud prompt and local proxy aligned before the next deploy.
