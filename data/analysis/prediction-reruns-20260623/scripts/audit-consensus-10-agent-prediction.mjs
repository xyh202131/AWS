import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const stampArgIndex = process.argv.indexOf("--run-stamp");
const runStamp =
  stampArgIndex >= 0 && process.argv[stampArgIndex + 1] ? process.argv[stampArgIndex + 1] : "20260624";

const boardPath = resolve(rootDir, "data", "boards", `consensus_10_agent_prediction_${runStamp}.json`);
const candidatePath = resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json");
const outputJsonPath = resolve(rootDir, "data", "reports", `consensus_10_agent_prediction_audit_${runStamp}.json`);
const outputReportPath = resolve(rootDir, "data", "reports", `consensus_10_agent_prediction_audit_${runStamp}.md`);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const expectedDescending = Array.from({ length: 30 }, (_, index) => 123 - index);

const main = async () => {
  const [board, candidateBundle] = await Promise.all([readJson(boardPath), readJson(candidatePath)]);
  const candidateIds = new Set((candidateBundle.prospects ?? []).map((prospect) => prospect.id));
  const selectedIds = board.boardRows.map((row) => row.prospectId);
  const auditReviewedCounts = board.pickAudits.map((audit) => audit.selected.reviewedCandidates);
  const allScoresCounts = board.pickAudits.map((audit) => audit.allScores.length);
  const failures = [];

  if (candidateIds.size !== 123) failures.push(`candidate pool unique count is ${candidateIds.size}, expected 123`);
  if (board.boardRows.length !== 30) failures.push(`boardRows length is ${board.boardRows.length}, expected 30`);
  if (new Set(selectedIds).size !== 30) failures.push("selected prospects are not unique");
  for (const id of selectedIds) {
    if (!candidateIds.has(id)) failures.push(`selected prospect not in local pool: ${id}`);
  }
  if (board.summary?.remainingProspects !== 93) failures.push(`remainingProspects is ${board.summary?.remainingProspects}, expected 93`);
  if (board.summary?.totalCandidateReviews !== 3255) failures.push(`totalCandidateReviews is ${board.summary?.totalCandidateReviews}, expected 3255`);
  if (!board.summary?.allPicksReachedThreshold) failures.push("not all picks reached 7/10 threshold");
  if (!board.guardrails?.noManualOverride || !board.guardrails?.noHumanPickInjection) failures.push("manual override guardrails missing");
  if ((board.agents ?? []).length !== 10) failures.push(`agent count is ${(board.agents ?? []).length}, expected 10`);

  auditReviewedCounts.forEach((count, index) => {
    if (count !== expectedDescending[index]) failures.push(`pick ${index + 1} reviewedCandidates ${count}, expected ${expectedDescending[index]}`);
  });
  allScoresCounts.forEach((count, index) => {
    if (count !== expectedDescending[index]) failures.push(`pick ${index + 1} allScores length ${count}, expected ${expectedDescending[index]}`);
  });
  board.boardRows.forEach((row) => {
    if (row.voteCount < 7) failures.push(`pick ${row.pick} voteCount ${row.voteCount}, expected >= 7`);
    if (row.remainingAfter !== 123 - row.pick) failures.push(`pick ${row.pick} remainingAfter ${row.remainingAfter}, expected ${123 - row.pick}`);
  });
  board.pickAudits.forEach((audit) => {
    if (!audit.noManualOverride || !audit.selectedFromLocalPool) failures.push(`pick ${audit.pick} audit guardrail missing`);
    if (audit.selected.prospectId !== audit.removedProspectId) failures.push(`pick ${audit.pick} removedProspectId mismatch`);
    if (!audit.allScores.some((score) => score.prospectId === audit.selected.prospectId)) {
      failures.push(`pick ${audit.pick} selected prospect missing from allScores`);
    }
  });

  const result = {
    schemaVersion: "consensus-10-agent-audit-v1",
    generatedAt: new Date().toISOString(),
    boardPath,
    candidatePath,
    status: failures.length ? "fail" : "pass",
    failures,
    summary: {
      candidatePoolUnique: candidateIds.size,
      pickCount: board.boardRows.length,
      uniqueSelectedProspects: new Set(selectedIds).size,
      remainingProspects: board.summary?.remainingProspects,
      totalCandidateReviews: board.summary?.totalCandidateReviews,
      allPicksReachedThreshold: board.summary?.allPicksReachedThreshold,
      averageVoteCount: board.summary?.averageVoteCount,
      averageConsensusRound: board.summary?.averageConsensusRound,
      changedVsCurrentBoardCount: board.summary?.changedVsCurrentBoardCount,
    },
  };

  await mkdir(dirname(outputJsonPath), { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(
    outputReportPath,
    [
      "# 10-Agent Consensus Prediction Audit",
      "",
      `Status: ${result.status}`,
      "",
      `- Candidate pool unique: ${result.summary.candidatePoolUnique}`,
      `- Picks: ${result.summary.pickCount}`,
      `- Unique selected prospects: ${result.summary.uniqueSelectedProspects}`,
      `- Remaining prospects: ${result.summary.remainingProspects}`,
      `- Total candidate reviews: ${result.summary.totalCandidateReviews}`,
      `- All picks reached 7/10 threshold: ${result.summary.allPicksReachedThreshold}`,
      `- Average vote count: ${result.summary.averageVoteCount}/10`,
      `- Average consensus round: ${result.summary.averageConsensusRound}`,
      `- Changed vs current frontend board: ${result.summary.changedVsCurrentBoardCount}`,
      "",
      "## Failures",
      "",
      ...(failures.length ? failures.map((failure) => `- ${failure}`) : ["- None"]),
      "",
    ].join("\n"),
    "utf8"
  );

  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
