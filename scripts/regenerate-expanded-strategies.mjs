import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = process.cwd();
const predictionPath = resolve(rootDir, "src", "lib", "prediction.ts");
const expandedBundlePath = resolve(rootDir, "data", "final", "expanded_import_bundle.json");
const scenariosPath = resolve(rootDir, "data", "reports", "weight_scenarios.json");
const previousBoardPath = resolve(rootDir, "public", "data", "agent_balanced_board.json");
const tempModulePath = resolve(rootDir, "node_modules", ".tmp", "prediction.expanded-strategies.mjs");

const strategyOutputPath = resolve(rootDir, "data", "boards", "expanded_strategy_boards_20260623.json");
const recommendedOutputPath = resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json");
const reportPath = resolve(rootDir, "data", "reports", "expanded_strategy_full_rerun_20260623.md");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

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

const isFallbackProspect = (prospect) => prospect.risks?.includes("Expanded-pool fallback profile");

const boardRows = (board) =>
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
    fallbackProfile: isFallbackProspect(pick.prospect),
    warnings: pick.warnings,
    alternatives: pick.alternatives,
    breakdown: pick.breakdown,
  }));

const summarizeBoard = (board, previousBoard = []) => {
  const rows = boardRows(board);
  const previousByPick = new Map(previousBoard.map((pick) => [pick.pick, pick]));
  const changedVsPrevious = rows
    .filter((row) => {
      const previous = previousByPick.get(row.pick);
      return (previous?.prospect?.id ?? previous?.prospectId) !== row.prospectId;
    })
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      previous: previousByPick.get(row.pick)?.prospect?.name ?? previousByPick.get(row.pick)?.player ?? "N/A",
      next: row.player,
      fallbackProfile: row.fallbackProfile,
    }));

  const lowConfidence = rows
    .filter((row) => row.confidence < 65)
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      player: row.player,
      confidence: row.confidence,
      fallbackProfile: row.fallbackProfile,
    }));
  const narrowMargins = rows
    .filter((row) => row.margin <= 1)
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      player: row.player,
      margin: row.margin,
      confidence: row.confidence,
      fallbackProfile: row.fallbackProfile,
    }));
  const fallbackPicks = rows
    .filter((row) => row.fallbackProfile)
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      player: row.player,
      confidence: row.confidence,
      consensusRank: row.consensusRank,
    }));

  return {
    pickCount: board.length,
    uniqueProspects: new Set(board.map((pick) => pick.prospect.id)).size,
    averageConfidence: Math.round(board.reduce((sum, pick) => sum + pick.confidence, 0) / board.length),
    averageScore: Math.round(board.reduce((sum, pick) => sum + pick.score, 0) / board.length),
    lowConfidence,
    narrowMargins,
    fallbackPicks,
    changedVsPrevious,
  };
};

const strategyAuditScore = (summary) =>
  summary.averageConfidence -
  summary.lowConfidence.length * 8 -
  summary.fallbackPicks.length * 6 -
  summary.narrowMargins.length * 0.8 -
  summary.changedVsPrevious.length * 0.25;

const writeReport = async ({ artifact, recommended }) => {
  const lines = [
    "# Expanded 101-Candidate Full Strategy Rerun",
    "",
    `Generated: ${artifact.generatedAt}`,
    "",
    "## Scope",
    "",
    "This run reselects picks 1-30 from the expanded NBA.com official 101-player candidate pool across every configured strategy. No player was manually selected, replaced, locked, or reordered.",
    "",
    "## Strategy Recommendation Rule",
    "",
    "The recommended strategy is selected by an audit score that rewards average confidence and penalizes low-confidence picks, fallback-profile picks, narrow margins, and excessive drift from the previous published board. This is a strategy-selection rule, not a manual player override.",
    "",
    "```text",
    "strategyAuditScore = averageConfidence - 8*lowConfidence - 6*fallbackPicks - 0.8*narrowMargins - 0.25*changedVsPrevious",
    "```",
    "",
    "## Strategy Summary",
    "",
    "| Strategy | Weights | Audit score | Avg confidence | Low confidence | Fallback picks | Narrow margins | Changed vs old 30-pool board |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
    ...artifact.scenarios.map((item) => {
      const weights = item.scenario.weights;
      return `| ${item.scenario.id} | C${weights.consensus}/N${weights.need}/P${weights.player}/U${weights.upside}/I${weights.intel} | ${item.auditScore.toFixed(2)} | ${item.summary.averageConfidence} | ${item.summary.lowConfidence.length} | ${item.summary.fallbackPicks.length} | ${item.summary.narrowMargins.length} | ${item.summary.changedVsPrevious.length} |`;
    }),
    "",
    `Recommended strategy: **${recommended.scenario.id} / ${recommended.scenario.label}**`,
    "",
    "## Recommended Board",
    "",
    "| Pick | Team | Player | Rank | Confidence | Margin | Fallback |",
    "|---:|---|---|---:|---:|---:|---|",
    ...recommended.boardRows.map(
      (row) =>
        `| ${row.pick} | ${row.team} | ${row.player} | ${row.consensusRank} | ${row.confidence} | ${row.margin} | ${row.fallbackProfile} |`,
    ),
    "",
    "## Low-Confidence Picks In Recommended Board",
    "",
    recommended.summary.lowConfidence.length
      ? [
          "| Pick | Team | Player | Confidence | Fallback |",
          "|---:|---|---|---:|---|",
          ...recommended.summary.lowConfidence.map(
            (row) => `| ${row.pick} | ${row.team} | ${row.player} | ${row.confidence} | ${row.fallbackProfile} |`,
          ),
        ].join("\n")
      : "None.",
    "",
    "## Fallback Picks In Recommended Board",
    "",
    recommended.summary.fallbackPicks.length
      ? [
          "| Pick | Team | Player | Rank | Confidence |",
          "|---:|---|---|---:|---:|",
          ...recommended.summary.fallbackPicks.map(
            (row) => `| ${row.pick} | ${row.team} | ${row.player} | ${row.consensusRank} | ${row.confidence} |`,
          ),
        ].join("\n")
      : "None.",
    "",
    "## Changed Slots Vs Old 30-Player Board",
    "",
    recommended.summary.changedVsPrevious.length
      ? [
          "| Pick | Team | Old 30-player board | Expanded recommended | Fallback |",
          "|---:|---|---|---|---|",
          ...recommended.summary.changedVsPrevious.map(
            (row) => `| ${row.pick} | ${row.team} | ${row.previous} | ${row.next} | ${row.fallbackProfile} |`,
          ),
        ].join("\n")
      : "No selected-player slots changed.",
    "",
    "## Lock-Gate Warning",
    "",
    "This is the correct candidate-pool rerun boundary. Any fallback-profile pick still requires source/profile enrichment before final lock.",
    "",
  ];

  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
};

const main = async () => {
  const [{ generateBoard, getBoardHealth }, expandedBundle, scenariosFile, previousArtifact] = await Promise.all([
    loadPredictionModule(),
    readJson(expandedBundlePath),
    readJson(scenariosPath),
    readJson(previousBoardPath),
  ]);

  const teams = expandedBundle.teams ?? [];
  const prospects = expandedBundle.prospects ?? [];
  const previousBoard = previousArtifact.board ?? [];
  const generatedAt = new Date().toISOString();
  const scenarioRuns = scenariosFile.scenarios.map((scenario) => {
    const board = generateBoard(teams, prospects, scenario.weights);
    const summary = summarizeBoard(board, previousBoard);
    return {
      scenario,
      health: getBoardHealth(board),
      summary,
      auditScore: strategyAuditScore(summary),
      board,
      boardRows: boardRows(board),
    };
  });

  const recommended = [...scenarioRuns].sort((left, right) => right.auditScore - left.auditScore)[0];
  const artifact = {
    schemaVersion: "draftops.expanded_strategy_boards.v1",
    generatedAt,
    generatedBy: "DraftOps Expanded Strategy Rerun Script",
    method:
      "Run every configured strategy against data/final/expanded_import_bundle.json, then select the highest audit-score strategy.",
    inputFiles: [
      "data/final/expanded_import_bundle.json",
      "data/reports/weight_scenarios.json",
      "src/lib/prediction.ts",
    ],
    candidatePool: expandedBundle.metadata?.expandedCandidatePool,
    scenarios: scenarioRuns,
    recommendedScenarioId: recommended.scenario.id,
    noManualOverride: true,
  };
  const recommendedArtifact = {
    schemaVersion: "draftops.expanded_recommended_board.v1",
    generatedAt,
    generatedBy: "DraftOps Expanded Strategy Rerun Script",
    method: "Recommended strategy selected by audit score from expanded 101-candidate strategy runs.",
    inputFiles: artifact.inputFiles,
    candidatePool: artifact.candidatePool,
    scenario: recommended.scenario,
    auditScore: recommended.auditScore,
    health: recommended.health,
    summary: recommended.summary,
    board: recommended.board,
    boardRows: recommended.boardRows,
    noManualOverride: true,
  };

  await Promise.all([
    writeFile(strategyOutputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(recommendedOutputPath, `${JSON.stringify(recommendedArtifact, null, 2)}\n`, "utf8"),
    writeReport({ artifact, recommended }),
  ]);

  console.log(
    JSON.stringify(
      {
        output: [
          "data/boards/expanded_strategy_boards_20260623.json",
          "public/data/agent_expanded_recommended_board.json",
          "data/reports/expanded_strategy_full_rerun_20260623.md",
        ],
        candidatePool: artifact.candidatePool,
        recommendedScenario: recommended.scenario,
        auditScore: Number(recommended.auditScore.toFixed(2)),
        health: recommended.health,
        summary: recommended.summary,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
