import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const localBundlePath = resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json");
const deepSeekPath = resolve(rootDir, "data", "boards", `deepseek_agentic_tool_123_prediction_${stamp}.json`);
const codexPath = resolve(rootDir, "data", "boards", `codex_sequential_123_prediction_${stamp}.json`);
const outputJsonPath = resolve(rootDir, "data", "reports", `third_round_prediction_audit_${stamp}.json`);
const outputMdPath = resolve(rootDir, "data", "reports", `third_round_prediction_audit_${stamp}.md`);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const auditBoard = ({ artifact, candidateIds, kind }) => {
  const rows = artifact.boardRows ?? [];
  const pickAudits = artifact.pickAudits ?? [];
  const selectedIds = rows.map((row) => row.prospectId);
  const duplicateIds = selectedIds.filter((id, index) => selectedIds.indexOf(id) !== index);
  const expectedCounts = Array.from({ length: rows.length }, (_, index) => 123 - index);
  const reviewedCounts =
    kind === "deepseek"
      ? pickAudits.map((audit) => audit.analysis?.reviewedCandidateCount)
      : pickAudits.map((audit) => audit.reviewedCandidates ?? audit.allScores?.length);
  const allScoresCounts =
    kind === "deepseek"
      ? pickAudits.map((audit) => audit.analysis?.allScores?.length)
      : pickAudits.map((audit) => audit.allScores?.length);
  const selectedMatchesAudit =
    kind === "deepseek"
      ? rows.every((row, index) => pickAudits[index]?.decision?.selectedProspectId === row.prospectId)
      : rows.every((row, index) => (pickAudits[index]?.selected?.prospectId ?? pickAudits[index]?.selectedProspectId) === row.prospectId);
  const selectedFromShortlist =
    kind === "deepseek"
      ? pickAudits.every((audit) =>
          (audit.analysis?.toolShortlist ?? []).some((candidate) => candidate.prospectId === audit.decision?.selectedProspectId),
        )
      : true;
  const cleanedRag =
    kind === "deepseek"
      ? pickAudits.every((audit) =>
          (audit.ragResult?.snippets ?? []).length > 0 &&
          (audit.ragResult?.snippets ?? []).every((snippet) => snippet.indexId && snippet.source && snippet.path && snippet.trustTier && snippet.text),
        )
      : null;
  const checks = {
    pickCount: rows.length === 30,
    uniqueSelectedProspects: new Set(selectedIds).size === 30,
    remainingProspects: (artifact.remainingProspects ?? []).length === 93 || artifact.summary?.remainingProspects === 93,
    selectedInCandidatePool: selectedIds.every((id) => candidateIds.has(id)),
    noDuplicates: duplicateIds.length === 0,
    reviewedCountsDescending: reviewedCounts.every((count, index) => Number(count) === expectedCounts[index]),
    allScoresCountsDescending: allScoresCounts.every((count, index) => Number(count) === expectedCounts[index]),
    selectedMatchesAudit,
    selectedFromShortlist,
    cleanedRag,
    totalCandidateScans:
      Number(artifact.summary?.totalCandidateScans ?? artifact.summary?.totalCandidateReviews ?? 0) === 3255 ||
      reviewedCounts.reduce((sum, count) => sum + Number(count ?? 0), 0) === 3255,
    noManual:
      artifact.guardrails?.noManualPrediction === true ||
      artifact.guardrails?.noManualOverride === true ||
      artifact.guardrails?.noHumanPickInjection === true,
  };
  const failed = Object.entries(checks)
    .filter(([, value]) => value === false)
    .map(([key]) => key);
  return {
    kind,
    schemaVersion: artifact.schemaVersion,
    status: failed.length ? "fail" : "pass",
    failed,
    summary: artifact.summary,
    checks,
    duplicateIds,
    changedVsCurrentBoard: artifact.changedVsCurrentBoard ?? [],
  };
};

const run = async () => {
  const [localBundle, deepSeek, codex] = await Promise.all([readJson(localBundlePath), readJson(deepSeekPath), readJson(codexPath)]);
  const candidateIds = new Set((localBundle.prospects ?? []).map((prospect) => prospect.id));
  const report = {
    schemaVersion: "draftops.third_round_prediction_audit.v1",
    generatedAt: new Date().toISOString(),
    candidatePool: {
      uniqueCandidates: candidateIds.size,
      sourceRows: localBundle.metadata?.localPlayerPool124?.sourceRows ?? null,
    },
    boards: [auditBoard({ artifact: deepSeek, candidateIds, kind: "deepseek" }), auditBoard({ artifact: codex, candidateIds, kind: "codex" })],
  };
  const md = [
    "# Third Round Prediction Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Candidate pool unique candidates: ${report.candidatePool.uniqueCandidates}`,
    "",
    "| Board | Status | Picks | Unique | Total scans | Changed vs current | Failed checks |",
    "|---|---|---:|---:|---:|---:|---|",
    ...report.boards.map(
      (board) =>
        `| ${board.kind} | ${board.status} | ${board.summary?.pickCount ?? ""} | ${board.summary?.uniqueSelectedProspects ?? ""} | ${board.summary?.totalCandidateScans ?? board.summary?.totalCandidateReviews ?? ""} | ${board.changedVsCurrentBoard.length} | ${board.failed.join(", ") || "none"} |`,
    ),
    "",
  ].join("\n");
  await mkdir(dirname(outputJsonPath), { recursive: true });
  await Promise.all([writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`), writeFile(outputMdPath, `${md}\n`)]);
  console.log(JSON.stringify({ output: [`data/reports/third_round_prediction_audit_${stamp}.json`, `data/reports/third_round_prediction_audit_${stamp}.md`], boards: report.boards.map((board) => ({ kind: board.kind, status: board.status, failed: board.failed })) }, null, 2));
  if (report.boards.some((board) => board.status !== "pass")) process.exitCode = 1;
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
