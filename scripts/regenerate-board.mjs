import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = process.cwd();
const predictionPath = resolve(rootDir, "src", "lib", "prediction.ts");
const bundlePath = resolve(rootDir, "public", "data", "final_import_bundle.json");
const scenariosPath = resolve(rootDir, "data", "reports", "weight_scenarios.json");
const publicBoardPath = resolve(rootDir, "public", "data", "agent_balanced_board.json");
const dataBoardPath = resolve(rootDir, "data", "boards", "board_balanced_parameter_test.json");
const reportPath = resolve(rootDir, "data", "reports", "model_v2_regeneration_report.md");
const tempModulePath = resolve(rootDir, "node_modules", ".tmp", "prediction.regenerated.mjs");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const readHeadJson = (gitPath) => {
  const result = spawnSync("git", ["show", `HEAD:${gitPath}`], {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.status !== 0 || !result.stdout.trim()) return undefined;
  return JSON.parse(result.stdout);
};

const loadPredictionModule = async () => {
  const source = await readFile(predictionPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: predictionPath,
  });

  await mkdir(dirname(tempModulePath), { recursive: true });
  await writeFile(tempModulePath, transpiled.outputText, "utf8");
  return import(`${pathToFileURL(tempModulePath).href}?t=${Date.now()}`);
};

const summarizeBoard = (board) => {
  const uniqueProspects = new Set(board.map((pick) => pick.prospect.id));
  const lowConfidencePicks = board
    .filter((pick) => pick.confidence < 65)
    .map((pick) => ({
      pick: pick.pick,
      team: pick.team,
      prospect: pick.prospect.name,
      confidence: pick.confidence,
    }));

  return {
    pickCount: board.length,
    uniqueProspects: uniqueProspects.size,
    averageConfidence: Math.round(board.reduce((sum, pick) => sum + pick.confidence, 0) / board.length),
    averageScore: Math.round(board.reduce((sum, pick) => sum + pick.score, 0) / board.length),
    lowConfidencePicks,
  };
};

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = (sorted.length - 1) / 2;
  return (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
};

const standardDeviation = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const summarizeIntelDistribution = (board, limit = 14) => {
  const values = board.slice(0, limit).map((pick) => pick.breakdown.intel);
  return {
    min: Math.min(...values),
    median: Math.round(median(values)),
    max: Math.max(...values),
    stddev: Math.round(standardDeviation(values) * 10) / 10,
    values: [...values].sort((left, right) => left - right),
  };
};

const topFiveRows = (previousBoard = [], nextBoard = []) => {
  const previousByPick = new Map(previousBoard.map((pick) => [pick.pick, pick]));
  return nextBoard.slice(0, 5).map((next) => {
    const previous = previousByPick.get(next.pick);
    return {
      pick: next.pick,
      team: next.team,
      previousPlayer: previous?.prospect?.name ?? previous?.player ?? "N/A",
      nextPlayer: next.prospect.name,
      changed: (previous?.prospect?.id ?? previous?.prospectId) !== next.prospect.id,
    };
  });
};

const toBoardRows = (board) =>
  board.map((pick) => ({
    pick: pick.pick,
    team: pick.team,
    acquiredFrom: pick.acquiredFrom ?? null,
    player: pick.prospect.name,
    prospectId: pick.prospect.id,
    school: pick.prospect.school,
    origin: pick.prospect.origin,
    position: pick.prospect.positions.join("/"),
    consensusRank: pick.prospect.consensusRank,
    score: pick.score,
    confidence: pick.confidence,
    margin: pick.margin,
    zone: pick.zone,
    effectiveWeights: pick.effectiveWeights,
    roleFit: pick.roleFit,
    breakdown: pick.breakdown,
    alternatives: pick.alternatives,
    warnings: pick.warnings,
  }));

const compareBoards = (previousBoard = [], nextBoard = []) => {
  const previousByPick = new Map(previousBoard.map((pick) => [pick.pick, pick]));
  return nextBoard.map((next) => {
    const previous = previousByPick.get(next.pick);
    return {
      pick: next.pick,
      team: next.team,
      previousPlayer: previous?.prospect?.name ?? previous?.player ?? "N/A",
      nextPlayer: next.prospect.name,
      changedPlayer: (previous?.prospect?.id ?? previous?.prospectId) !== next.prospect.id,
      scoreDelta: next.score - (previous?.score ?? 0),
      confidenceDelta: next.confidence - (previous?.confidence ?? 0),
      intelDelta: next.breakdown.intel - (previous?.breakdown?.intel ?? 0),
    };
  });
};

const writeReport = async ({ previousSummary, nextSummary, changes, health, scenario, intelDistribution, topFive }) => {
  const changedRows = changes.filter((change) => change.changedPlayer);
  const biggestScoreMoves = [...changes]
    .sort((left, right) => Math.abs(right.scoreDelta) - Math.abs(left.scoreDelta))
    .slice(0, 8);

  const lines = [
    "# Model V2 Regeneration Report",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Scenario: ${scenario.id} / ${scenario.label}`,
    "- Changes: consensus-overlap intel adjustment, pick-value guardrail, narrow-race consensus tiebreaker, phase-aware risk penalty, evidence wording.",
    "",
    "## Health",
    "",
    `- 30 picks: ${health.hasThirtyPicks}`,
    `- No duplicates: ${health.noDuplicates}`,
    `- Low-confidence picks: ${health.lowConfidence}`,
    `- Ready: ${health.ready}`,
    "",
    "## Summary Delta",
    "",
    `- Average confidence: ${previousSummary.averageConfidence} -> ${nextSummary.averageConfidence}`,
    `- Average score: ${previousSummary.averageScore} -> ${nextSummary.averageScore}`,
    `- Low-confidence picks: ${previousSummary.lowConfidencePicks.length} -> ${nextSummary.lowConfidencePicks.length}`,
    `- Changed player slots: ${changedRows.length}`,
    "",
    "## Top Five Check",
    "",
    "| Pick | Team | Previous | Next | Changed |",
    "|---:|---|---|---|---|",
    ...topFive.map(
      (row) => `| ${row.pick} | ${row.team} | ${row.previousPlayer} | ${row.nextPlayer} | ${row.changed} |`,
    ),
    "",
    "## Top-14 Intel Distribution",
    "",
    `- Min / median / max: ${intelDistribution.min} / ${intelDistribution.median} / ${intelDistribution.max}`,
    `- Stddev: ${intelDistribution.stddev}`,
    `- Values: ${intelDistribution.values.join(", ")}`,
    "",
    "## Changed Player Slots",
    "",
    changedRows.length
      ? "| Pick | Team | Previous | Next |\n|---:|---|---|---|\n" +
        changedRows
          .map((change) => `| ${change.pick} | ${change.team} | ${change.previousPlayer} | ${change.nextPlayer} |`)
          .join("\n")
      : "No pick changed selected player.",
    "",
    "## Biggest Score Moves",
    "",
    "| Pick | Team | Player | Score Delta | Confidence Delta | Intel Delta |",
    "|---:|---|---|---:|---:|---:|",
    ...biggestScoreMoves.map(
      (change) =>
        `| ${change.pick} | ${change.team} | ${change.nextPlayer} | ${change.scoreDelta} | ${change.confidenceDelta} | ${change.intelDelta} |`,
    ),
    "",
  ];

  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
};

const main = async () => {
  const [{ generateBoard, getBoardHealth }, bundle, scenarios, currentArtifact] = await Promise.all([
    loadPredictionModule(),
    readJson(bundlePath),
    readJson(scenariosPath),
    readJson(publicBoardPath).catch(() => ({ board: [] })),
  ]);

  const scenario = scenarios.scenarios.find((item) => item.id === "baseline") ?? scenarios.scenarios[0];
  const teams = bundle.teams ?? [];
  const prospects = bundle.prospects ?? [];
  const board = generateBoard(teams, prospects, scenario.weights);
  const health = getBoardHealth(board);
  const previousArtifact = readHeadJson("public/data/agent_balanced_board.json") ?? currentArtifact;
  const previousBoard = previousArtifact.board ?? [];
  const previousSummary = summarizeBoard(previousBoard);
  const nextSummary = summarizeBoard(board);
  const changes = compareBoards(previousBoard, board);
  const intelDistribution = summarizeIntelDistribution(board);
  const topFive = topFiveRows(previousBoard, board);
  const artifact = {
    schemaVersion: "draftops.parameter_test_board.v2",
    generatedAt: new Date().toISOString(),
    generatedBy: "DraftOps Model V2 Regeneration Script",
    method: "Transpile src/lib/prediction.ts, then run generateBoard against public/data/final_import_bundle.json.",
    inputFiles: [
      "public/data/final_import_bundle.json",
      "data/reports/weight_scenarios.json",
      "src/lib/prediction.ts",
    ],
    modelChanges: [
      "intel score uses mockHeat movement against consensus-rank baseline",
      "risk penalty is adjusted by team phase, risk tolerance, and prospect upside",
      "pick-value guardrail penalizes large top-five/lottery reaches and rewards major value falls",
      "near-tie candidate sorting uses consensus rank before need/upside tiebreakers",
      "evidence text now explains intel overlap and risk/value controls",
    ],
    scenario,
    sourceMetadata: bundle.metadata,
    health,
    diagnostics: {
      topFourteenIntelDistribution: intelDistribution,
      topFiveComparison: topFive,
    },
    summary: nextSummary,
    board,
    boardRows: toBoardRows(board),
  };

  await Promise.all([
    writeFile(publicBoardPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(dataBoardPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeReport({ previousSummary, nextSummary, changes, health, scenario, intelDistribution, topFive }),
  ]);

  console.log(JSON.stringify({
    output: [
      "public/data/agent_balanced_board.json",
      "data/boards/board_balanced_parameter_test.json",
      "data/reports/model_v2_regeneration_report.md",
    ],
    health,
    topFourteenIntelDistribution: intelDistribution,
    changedPlayerSlots: changes.filter((change) => change.changedPlayer).length,
    averageConfidence: nextSummary.averageConfidence,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
