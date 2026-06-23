# DraftOps System Grounding Audit

Generated: 2026-06-23T19:15:55.585Z

Status: pass_with_warnings

## Summary

- Checks: 11
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

### PASS board-review-surface

Severity: warning

Low-confidence, thin-evidence, and narrow-margin picks are exposed for review.

Evidence:
- lowConfidence=none
- thinEvidence=none
- narrowMargins=none

Remediation: Treat these picks as explanation-review targets, not as manual replacement targets.

### PASS candidate-pool-counts

Severity: blocker

Candidate-pool counts are read from current files and selected players are present in the online official prospect list.

Evidence:
- localPool=124
- featureReference=124
- onlineOfficialProspects=101
- boardCandidatePool.officialProspectRows=not recorded
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
- prospect-evidence: declared=819, actual=819, sources=18
- milestone: declared=36, actual=36, sources=8
- architecture: declared=84, actual=84, sources=9

Remediation: Run npm run rag:build before relying on RAG answers.

### PASS rag-cleaning-policy

Severity: blocker

RAG indexes are rebuilt through the data-cleaning quality gate before retrieval.

Evidence:
- core-board: cleaned=231/231, dropped=0, redactions=0, summary=true
- team-preference: cleaned=134/134, dropped=0, redactions=0, summary=true
- prospect-evidence: cleaned=819/819, dropped=1, redactions=0, summary=true
- milestone: cleaned=36/36, dropped=0, redactions=0, summary=true
- architecture: cleaned=84/84, dropped=0, redactions=0, summary=true

Remediation: Run npm run rag:build so every RAG chunk carries cleaning metadata and the manifest records dropped/noisy sources.

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
