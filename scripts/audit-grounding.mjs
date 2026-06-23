import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { draftOpsManifest, resolveManifestPath, rootDir } from "./lib/draftops-manifest.mjs";

const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const reportsDir = resolve(rootDir, "data", "reports");
const reportJsonPath = resolve(reportsDir, `system_grounding_audit_${stamp}.json`);
const reportMdPath = resolve(reportsDir, `system_grounding_audit_${stamp}.md`);

const checks = [];

const addCheck = ({ id, status, severity = "blocker", summary, evidence = [], remediation = "" }) => {
  checks.push({ id, status, severity, summary, evidence, remediation });
};

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const readText = async (path, fallback = "") => {
  try {
    return await readFile(path, "utf8");
  } catch {
    return fallback;
  }
};

const readJson = async (path, fallback = null) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
};

const arrayLength = (value) => {
  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value?.items)) return value.items.length;
  if (Array.isArray(value?.players)) return value.players.length;
  if (Array.isArray(value?.prospects)) return value.prospects.length;
  if (Array.isArray(value?.answers)) return value.answers.length;
  return 0;
};

const nameKey = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "");

const countBy = (items, keyFn) => {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const statusIcon = (status) => (status === "pass" ? "PASS" : status === "warn" ? "WARN" : "FAIL");

const boardPath = resolveManifestPath(draftOpsManifest.data?.boardPath, "public/data/agent_expanded_recommended_board.json");
const bundlePath = resolveManifestPath(draftOpsManifest.data?.bundlePath, "public/data/expanded_import_bundle.json");
const agentsPath = resolve(rootDir, "AGENTS.md");
const readmePath = resolve(rootDir, "README.md");
const collaborationGuidePath = resolve(rootDir, "多Agent协作指导.md");
const localPoolPath = resolve(rootDir, "data", "normalized", "normalized_2026_local_player_pool_124.json");
const featureReferencePath = resolve(rootDir, "data", "normalized", "normalized_2026_player_feature_reference_124.json");
const onlineVerificationPath = resolve(rootDir, "data", "normalized", "normalized_2026_online_player_list_reverification_20260623.json");
const milestoneAnswersPath = resolve(rootDir, "data", "final", "milestone_answers.json");
const ragManifestPath = resolve(rootDir, "data", "rag", "rag-manifest.json");
const frontendPath = resolve(rootDir, "src", "App.tsx");
const localDeepSeekPath = resolve(rootDir, "scripts", "deepseek-chat-server.mjs");
const lambdaPath = resolve(rootDir, "infra", "lambda", "draftops-ai-api", "index.mjs");

const [
  agentsText,
  readmeText,
  collaborationText,
  frontendText,
  localDeepSeekText,
  lambdaText,
  boardArtifact,
  bundle,
  localPool,
  featureReference,
  onlineVerification,
  milestoneAnswers,
  ragManifest,
] = await Promise.all([
  readText(agentsPath),
  readText(readmePath),
  readText(collaborationGuidePath),
  readText(frontendPath),
  readText(localDeepSeekPath),
  readText(lambdaPath),
  readJson(boardPath),
  readJson(bundlePath),
  readJson(localPoolPath),
  readJson(featureReferencePath),
  readJson(onlineVerificationPath),
  readJson(milestoneAnswersPath),
  readJson(ragManifestPath),
]);

addCheck({
  id: "codex-policy-file",
  status:
    (await exists(agentsPath)) &&
    /Anti-Hallucination Rules/.test(agentsText) &&
    /Codex must not manually predict/.test(agentsText)
      ? "pass"
      : "fail",
  summary: "Root AGENTS.md defines Codex anti-hallucination and no-manual-prediction rules.",
  evidence: [basename(agentsPath)],
  remediation: "Create or repair AGENTS.md before Codex analysis or prediction work.",
});

addCheck({
  id: "policy-linked-from-docs",
  status:
    /AGENTS\.md/.test(readmeText) &&
    /Codex 主线程同样受防幻觉约束/.test(collaborationText)
      ? "pass"
      : "warn",
  severity: "info",
  summary: "README and multi-agent guide expose the Codex grounding policy.",
  evidence: ["README.md", "多Agent协作指导.md"],
  remediation: "Link AGENTS.md from user-facing docs and keep the multi-agent guide aligned.",
});

const board = Array.isArray(boardArtifact?.board) ? boardArtifact.board : [];
const pickNumbers = board.map((pick) => Number(pick.pick)).filter(Number.isFinite);
const sequentialTop30 = pickNumbers.length === 30 && pickNumbers.every((pick, index) => pick === index + 1);
const playerCounts = countBy(board, (pick) => nameKey(pick.prospect?.name));
const duplicatePlayers = [...playerCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
const missingEvidence = board
  .filter((pick) => !Array.isArray(pick.evidence) || pick.evidence.length === 0)
  .map((pick) => `${pick.pick}: ${pick.prospect?.name ?? "unknown"}`);
const thinEvidence = board
  .filter((pick) => Array.isArray(pick.evidence) && pick.evidence.length > 0 && pick.evidence.length < 3)
  .map((pick) => `${pick.pick}: ${pick.prospect?.name ?? "unknown"} (${pick.evidence.length})`);
const lowConfidence = board.filter((pick) => Number(pick.confidence ?? 0) < 65);
const narrowMargins = board.filter((pick) => Math.abs(Number(pick.margin ?? 99)) <= 1);

addCheck({
  id: "locked-board-contract",
  status:
    boardArtifact &&
    boardArtifact.noManualOverride === true &&
    sequentialTop30 &&
    duplicatePlayers.length === 0 &&
    missingEvidence.length === 0
      ? "pass"
      : "fail",
  summary: "Locked board is generated, top-30 sequential, duplicate-free, and evidence-bearing.",
  evidence: [
    `path=${draftOpsManifest.data?.boardPath}`,
    `pickCount=${board.length}`,
    `noManualOverride=${boardArtifact?.noManualOverride}`,
    `duplicates=${duplicatePlayers.length}`,
    `missingEvidence=${missingEvidence.length}`,
  ],
  remediation: "Regenerate the board through scripts/agents; do not hand-edit picks or evidence.",
});

addCheck({
  id: "board-review-surface",
  status: lowConfidence.length || thinEvidence.length || narrowMargins.length ? "warn" : "pass",
  severity: "warning",
  summary: "Low-confidence, thin-evidence, and narrow-margin picks are exposed for review.",
  evidence: [
    `lowConfidence=${lowConfidence.map((pick) => `${pick.pick}:${pick.prospect?.name}:${pick.confidence}`).join(", ") || "none"}`,
    `thinEvidence=${thinEvidence.join(", ") || "none"}`,
    `narrowMargins=${narrowMargins.map((pick) => `${pick.pick}:${pick.prospect?.name}:margin=${pick.margin}`).join(", ") || "none"}`,
  ],
  remediation: "Treat these picks as explanation-review targets, not as manual replacement targets.",
});

const onlineProspects = onlineVerification?.lists?.nbaProspects ?? [];
const onlineNameSet = new Set(onlineProspects.map((item) => nameKey(item.name)).filter(Boolean));
const selectedMissingFromOfficialList = board
  .filter((pick) => !onlineNameSet.has(nameKey(pick.prospect?.name)))
  .map((pick) => `${pick.pick}: ${pick.prospect?.name ?? "unknown"}`);
const officialProspectRows = onlineVerification?.validation?.nbaProspects?.currentRowCount ?? arrayLength(onlineProspects);
const boardOfficialRows = boardArtifact?.candidatePool?.officialProspectRows ?? null;

addCheck({
  id: "candidate-pool-counts",
  status:
    arrayLength(localPool?.prospects) >= 120 &&
    arrayLength(featureReference?.players) >= 120 &&
    officialProspectRows >= 90 &&
    selectedMissingFromOfficialList.length === 0 &&
    (boardOfficialRows == null || Number(boardOfficialRows) === Number(officialProspectRows))
      ? "pass"
      : "fail",
  summary: "Candidate-pool counts are read from current files and selected players are present in the online official prospect list.",
  evidence: [
    `localPool=${arrayLength(localPool?.prospects)}`,
    `featureReference=${arrayLength(featureReference?.players)}`,
    `onlineOfficialProspects=${officialProspectRows}`,
    `boardCandidatePool.officialProspectRows=${boardOfficialRows ?? "not recorded"}`,
    `selectedMissingFromOfficialList=${selectedMissingFromOfficialList.join(", ") || "none"}`,
  ],
  remediation: "Refresh normalized source files or regenerate the board from the verified pool.",
});

const chinaDraft = onlineVerification?.validation?.chinaDraft;
addCheck({
  id: "official-result-boundary",
  status: "pass",
  severity: "info",
  summary: "Online draft-board verification is recorded as a source boundary, not silently treated as official results.",
  evidence: [
    `chinaDraft.rowCount=${chinaDraft?.rowCount ?? "unknown"}`,
    `chinaDraft.top30PopulatedPickCount=${chinaDraft?.top30PopulatedPickCount ?? "unknown"}`,
    chinaDraft?.top30PopulatedPickCount === 0
      ? "No populated top-30 player picks in the China board snapshot; do not cite it as actual selected-player results."
      : "China board contains populated top-30 player rows; verify before replacing prediction context.",
  ],
  remediation: "If official result rows appear, rerun source reconciliation before changing any prediction artifacts.",
});

const expectedMilestoneCount = Array.isArray(draftOpsManifest.milestones) ? draftOpsManifest.milestones.length : null;
const milestoneRows = Array.isArray(milestoneAnswers?.answers) ? milestoneAnswers.answers : [];
const milestoneWithoutEvidence = milestoneRows
  .filter((item) => !Array.isArray(item.evidence) || item.evidence.length === 0)
  .map((item) => item.id ?? item.question ?? "unknown");

addCheck({
  id: "milestone-grounding",
  status:
    milestoneRows.length > 0 &&
    (expectedMilestoneCount == null || milestoneRows.length === expectedMilestoneCount) &&
    milestoneWithoutEvidence.length === 0
      ? "pass"
      : "fail",
  summary: "Milestone answer count and evidence are grounded in current answer files.",
  evidence: [
    `manifestMilestones=${expectedMilestoneCount ?? "not declared"}`,
    `answerRows=${milestoneRows.length}`,
    `withoutEvidence=${milestoneWithoutEvidence.join(", ") || "none"}`,
  ],
  remediation: "Regenerate milestone answers from the locked board and evidence files.",
});

const ragIndexes = Array.isArray(ragManifest?.indexes) ? ragManifest.indexes : [];
const ragIndexChecks = await Promise.all(
  ragIndexes.map(async (index) => {
    const path = resolve(rootDir, index.key);
    const artifact = await readJson(path);
    return {
      id: index.id,
      key: index.key,
      declaredChunks: Number(index.chunkCount ?? 0),
      actualChunks: Array.isArray(artifact?.chunks) ? artifact.chunks.length : 0,
      declaredSources: Number(index.sourceCount ?? 0),
      exists: await exists(path),
    };
  }),
);
const ragProblems = ragIndexChecks.filter((item) => !item.exists || item.declaredChunks <= 0 || item.actualChunks <= 0);

addCheck({
  id: "rag-grounding-indexes",
  status: ragIndexes.length >= 5 && ragProblems.length === 0 ? "pass" : "fail",
  summary: "RAG indexes exist and contain retrievable chunks.",
  evidence: ragIndexChecks.map((item) => `${item.id}: declared=${item.declaredChunks}, actual=${item.actualChunks}, sources=${item.declaredSources}`),
  remediation: "Run npm run rag:build before relying on RAG answers.",
});

addCheck({
  id: "runtime-answer-guardrails",
  status:
    /antiHallucinationGuardrails/.test(frontendText) &&
    /幻觉防护/.test(frontendText) &&
    /antiHallucinationPolicy/.test(localDeepSeekText) &&
    /groundingStatusLine/.test(localDeepSeekText)
      ? "pass"
      : "fail",
  summary: "Frontend and local DeepSeek proxy carry anti-hallucination guardrails into chat answers.",
  evidence: ["src/App.tsx", "scripts/deepseek-chat-server.mjs"],
  remediation: "Restore request guardrails and answer grounding status before enabling chat demos.",
});

addCheck({
  id: "cloud-answer-guardrail-visibility",
  status: /reflection\.sufficient|missingSignals|防幻觉|hallucination|evidence is weak/i.test(lambdaText) ? "pass" : "warn",
  severity: "info",
  summary: "Lambda source contains retrieval-reflection or weak-evidence guardrail wording.",
  evidence: ["infra/lambda/draftops-ai-api/index.mjs"],
  remediation: "Keep cloud prompt and local proxy aligned before the next deploy.",
});

const blockerFailures = checks.filter((check) => check.status === "fail" && check.severity === "blocker");
const warnings = checks.filter((check) => check.status === "warn" || check.severity === "warning");
const status = blockerFailures.length ? "fail" : warnings.length ? "pass_with_warnings" : "pass";

const report = {
  schemaVersion: "draftops.system_grounding_audit.v1",
  generatedAt: new Date().toISOString(),
  generatedBy: "scripts/audit-grounding.mjs",
  status,
  summary: {
    checks: checks.length,
    blockers: blockerFailures.length,
    warnings: warnings.length,
    boardPickCount: board.length,
    selectedProspects: new Set(board.map((pick) => nameKey(pick.prospect?.name)).filter(Boolean)).size,
    localPoolCount: arrayLength(localPool?.prospects),
    featureReferenceCount: arrayLength(featureReference?.players),
    onlineOfficialProspectCount: officialProspectRows,
    milestoneAnswerCount: milestoneRows.length,
    ragIndexCount: ragIndexes.length,
  },
  evidenceFiles: {
    agents: "AGENTS.md",
    readme: "README.md",
    collaborationGuide: "多Agent协作指导.md",
    board: draftOpsManifest.data?.boardPath,
    bundle: draftOpsManifest.data?.bundlePath,
    localPool: "data/normalized/normalized_2026_local_player_pool_124.json",
    featureReference: "data/normalized/normalized_2026_player_feature_reference_124.json",
    onlineVerification: "data/normalized/normalized_2026_online_player_list_reverification_20260623.json",
    milestoneAnswers: "data/final/milestone_answers.json",
    ragManifest: "data/rag/rag-manifest.json",
  },
  checks,
};

const markdown = [
  "# DraftOps System Grounding Audit",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  `Status: ${status}`,
  "",
  "## Summary",
  "",
  `- Checks: ${report.summary.checks}`,
  `- Blockers: ${report.summary.blockers}`,
  `- Warnings: ${report.summary.warnings}`,
  `- Board picks: ${report.summary.boardPickCount}`,
  `- Unique selected prospects: ${report.summary.selectedProspects}`,
  `- Local answer-card pool: ${report.summary.localPoolCount}`,
  `- Feature reference players: ${report.summary.featureReferenceCount}`,
  `- Online official prospect rows: ${report.summary.onlineOfficialProspectCount}`,
  `- Milestone answers: ${report.summary.milestoneAnswerCount}`,
  `- RAG indexes: ${report.summary.ragIndexCount}`,
  "",
  "## Checks",
  "",
  ...checks.flatMap((check) => [
    `### ${statusIcon(check.status)} ${check.id}`,
    "",
    `Severity: ${check.severity}`,
    "",
    check.summary,
    "",
    "Evidence:",
    ...(check.evidence.length ? check.evidence.map((item) => `- ${item}`) : ["- none"]),
    "",
    check.remediation ? `Remediation: ${check.remediation}` : "",
    "",
  ]),
].join("\n");

await mkdir(reportsDir, { recursive: true });
await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(reportMdPath, `${markdown}\n`, "utf8");

console.log(`System grounding audit: ${status}`);
console.log(`JSON: ${reportJsonPath}`);
console.log(`Markdown: ${reportMdPath}`);

if (blockerFailures.length) {
  for (const failure of blockerFailures) {
    console.error(`BLOCKER ${failure.id}: ${failure.summary}`);
  }
  process.exitCode = 1;
}
