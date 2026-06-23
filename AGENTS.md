# DraftOps Codex Operating Constraints

These rules apply to Codex work in this repository.

## Anti-Hallucination Rules

1. Verify before claiming. For repo facts, read the current local file or run the relevant command in this workspace. For current external facts, verify against official or primary sources before answering.
2. Separate three states in analysis and final answers when relevant:
   - Confirmed: supported by current local files, command output, generated artifacts, or verified official sources.
   - Inference: a reasoned conclusion from confirmed evidence.
   - Unknown or needs review: not present in available evidence.
3. Do not fill missing facts from model memory. This includes player names, team pick order, prospect counts, scores, RAG source coverage, AWS state, model configuration, and contest submission fields.
4. If evidence is weak or unavailable, say what is missing and what should be checked next. Do not write a confident answer to make the workflow look complete.
5. When summarizing DeepSeek, Claude, subagent, or script output, distinguish their actual output from Codex interpretation.
6. Do not present old memory, stale reports, or previous chat context as current truth without a fresh local check when the fact can drift.
7. Never print secrets, API keys, tokens, or secret values. If a secret appears in context, refer to it only as redacted or configured.

## Prediction Boundary

1. Codex must not manually predict, replace, lock, or reorder picks 1-30.
2. If a board changes, it must come from a script, agent run, parameter file, or regenerated artifact. Codex may adjust documented parameters or guardrails, then rerun the pipeline and report the command and output path.
3. Candidate counts must be counted from current data files before use. Do not repeat prior counts such as 101, 123, or 124 unless they were verified in the current task.
4. A single-pick explanation must be grounded in the current board row, team context, prospect profile, evidence fields, and alternatives. Missing evidence must be labeled as missing.
5. Milestone answers must be derived from the locked board and evidence files, not from intuition.
6. Run `npm run audit:grounding` before system-level claims, demos, or submission checks when practical. Treat blocker failures as stop conditions.

## Code And Deployment Discipline

1. Check `git status --short` before substantial edits and avoid reverting unrelated dirty files.
2. Keep changes scoped to the user's request. If cloud deployment is not explicitly requested, do not deploy or mutate AWS resources.
3. For frontend changes, run `npm run lint` and `npm run build` before claiming completion unless blocked; report any failure.
4. For local agent or script changes, run a syntax or health check when practical, such as `node --check` or the relevant health endpoint.
5. For grounding-policy or data-integrity changes, run `npm run audit:grounding` and include the report path.
6. Final responses should name the files changed, the verification performed, and any remaining uncertainty.
