import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = process.cwd();
const runStamp = "20260624";

const predictionPath = resolve(rootDir, "src", "lib", "prediction.ts");
const tempModulePath = resolve(rootDir, "node_modules", ".tmp", `prediction.training-${runStamp}.mjs`);
const bundlePath = resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json");
const scenariosPath = resolve(rootDir, "data", "reports", "weight_scenarios.json");
const targetBoardPath = resolve(rootDir, "data", "boards", "sequential_dynamic_board_123_audit_deepseek_mild.json");
const frontendBoardPath = resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json");
const codexBoardPath = resolve(rootDir, "data", "boards", "codex_sequential_123_prediction_20260624.json");

const outputBoardPath = resolve(rootDir, "data", "boards", `trained_prediction_model_board_${runStamp}.json`);
const outputJsonPath = resolve(rootDir, "data", "reports", `prediction_model_training_${runStamp}.json`);
const outputReportPath = resolve(rootDir, "data", "reports", `prediction_model_training_${runStamp}.md`);

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

const sumWeights = (weights) => weights.consensus + weights.need + weights.player + weights.upside + weights.intel;

const normalizeBoardRows = (rows) =>
  rows.map((row) => ({
    pick: row.pick,
    team: row.team,
    prospectId: row.prospectId ?? row.prospect?.id,
    player: row.player ?? row.prospect?.name,
    localNameZh: row.localNameZh ?? row.prospect?.localPool?.nameZh ?? null,
    score: row.score ?? null,
    confidence: row.confidence ?? null,
    margin: row.margin ?? null,
  }));

const boardRowsFromArtifact = (artifact) => {
  if (Array.isArray(artifact.boardRows)) return normalizeBoardRows(artifact.boardRows);
  if (Array.isArray(artifact.board)) return normalizeBoardRows(artifact.board);
  return [];
};

const generatedRows = (board) =>
  board.map((pick) => ({
    pick: pick.pick,
    team: pick.team,
    prospectId: pick.prospect.id,
    player: pick.prospect.name,
    localNameZh: pick.prospect.localPool?.nameZh ?? null,
    positions: pick.prospect.positions,
    consensusRank: pick.prospect.consensusRank,
    score: pick.score,
    confidence: pick.confidence,
    margin: pick.margin,
    breakdown: pick.breakdown,
    effectiveWeights: pick.effectiveWeights,
    warnings: pick.warnings,
    alternatives: pick.alternatives,
  }));

const compareToTarget = (candidateRows, targetRows) => {
  const targetByPick = new Map(targetRows.map((row) => [row.pick, row]));
  const candidateByPick = new Map(candidateRows.map((row) => [row.pick, row]));
  const candidatePickById = new Map(candidateRows.map((row) => [row.prospectId, row.pick]));

  const perPick = targetRows.map((target) => {
    const candidate = candidateByPick.get(target.pick);
    const candidatePick = candidatePickById.get(target.prospectId);
    return {
      pick: target.pick,
      team: target.team,
      targetPlayer: target.player,
      targetProspectId: target.prospectId,
      candidatePlayer: candidate?.player ?? null,
      candidateProspectId: candidate?.prospectId ?? null,
      exact: candidate?.prospectId === target.prospectId,
      targetSelectedElsewhere: candidatePick ?? null,
      absolutePickError: candidatePick ? Math.abs(candidatePick - target.pick) : null,
    };
  });

  const exactMatches = perPick.filter((row) => row.exact).length;
  const targetSelected = perPick.filter((row) => row.targetSelectedElsewhere !== null).length;
  const targetSelectedErrors = perPick
    .map((row) => row.absolutePickError)
    .filter((value) => Number.isFinite(value));
  const missingTargetCount = perPick.length - targetSelectedErrors.length;
  const meanAbsolutePickError =
    targetSelectedErrors.reduce((sum, value) => sum + value, 0) / Math.max(1, targetSelectedErrors.length);
  const weightedPickError =
    perPick.reduce((sum, row) => {
      const weight = row.pick <= 5 ? 3 : row.pick <= 14 ? 2 : 1;
      if (row.exact) return sum;
      if (row.absolutePickError === null) return sum + weight * 35;
      return sum + weight * row.absolutePickError;
    }, 0) / targetRows.reduce((sum, row) => sum + (row.pick <= 5 ? 3 : row.pick <= 14 ? 2 : 1), 0);
  const lowConfidence = candidateRows.filter((row) => Number(row.confidence) < 65).length;
  const narrowMargins = candidateRows.filter((row) => Number(row.margin) <= 1).length;
  const objective =
    exactMatches * 100 +
    perPick.filter((row) => row.exact && row.pick <= 5).length * 25 +
    perPick.filter((row) => row.exact && row.pick <= 14).length * 8 +
    targetSelected * 8 -
    weightedPickError * 4 -
    missingTargetCount * 15 -
    lowConfidence * 1.5 -
    narrowMargins * 0.4;

  return {
    objective: Math.round(objective * 1000) / 1000,
    exactMatches,
    targetSelected,
    meanAbsolutePickError: Math.round(meanAbsolutePickError * 1000) / 1000,
    weightedPickError: Math.round(weightedPickError * 1000) / 1000,
    lowConfidence,
    narrowMargins,
    topFiveExact: perPick.filter((row) => row.exact && row.pick <= 5).length,
    lotteryExact: perPick.filter((row) => row.exact && row.pick <= 14).length,
    lateFirstExact: perPick.filter((row) => row.exact && row.pick >= 15).length,
    mismatches: perPick.filter((row) => !row.exact),
  };
};

const evaluateWeights = ({ generateBoard, teams, prospects, targetRows, weights }) => {
  const board = generateBoard(teams, prospects, weights);
  const rows = generatedRows(board);
  const metrics = compareToTarget(rows, targetRows);
  return { weights, board, boardRows: rows, metrics };
};

function* coarseGrid(step = 5) {
  for (let consensus = 10; consensus <= 60; consensus += step) {
    for (let need = 5; need <= 55; need += step) {
      for (let player = 5; player <= 45; player += step) {
        for (let upside = 1; upside <= 35; upside += step) {
          const intel = 100 - consensus - need - player - upside;
          if (intel < 1 || intel > 40) continue;
          yield { consensus, need, player, upside, intel };
        }
      }
    }
  }
}

function* refineGrid(center, radius = 5) {
  for (let consensus = center.consensus - radius; consensus <= center.consensus + radius; consensus += 1) {
    for (let need = center.need - radius; need <= center.need + radius; need += 1) {
      for (let player = center.player - radius; player <= center.player + radius; player += 1) {
        for (let upside = center.upside - radius; upside <= center.upside + radius; upside += 1) {
          const intel = 100 - consensus - need - player - upside;
          if (consensus < 1 || need < 1 || player < 1 || upside < 1 || intel < 1) continue;
          if (consensus > 70 || need > 70 || player > 70 || upside > 70 || intel > 70) continue;
          yield { consensus, need, player, upside, intel };
        }
      }
    }
  }
}

const weightKey = (weights) => `${weights.consensus}|${weights.need}|${weights.player}|${weights.upside}|${weights.intel}`;

const rankEvaluations = (evaluations) =>
  evaluations.sort(
    (left, right) =>
      right.metrics.objective - left.metrics.objective ||
      right.metrics.exactMatches - left.metrics.exactMatches ||
      left.metrics.weightedPickError - right.metrics.weightedPickError ||
      left.metrics.lowConfidence - right.metrics.lowConfidence ||
      left.metrics.narrowMargins - right.metrics.narrowMargins,
  );

const markdownTable = (rows) => {
  if (!rows.length) return "";
  const [header, ...body] = rows;
  const separator = header.map(() => "---");
  return [header, separator, ...body].map((row) => `| ${row.map((cell) => String(cell ?? "")).join(" | ")} |`).join("\n");
};

const formatWeights = (weights) =>
  `consensus ${weights.consensus} / need ${weights.need} / player ${weights.player} / upside ${weights.upside} / intel ${weights.intel}`;

const main = async () => {
  const [{ generateBoard, getBoardHealth }, bundle, scenariosFile, targetBoard, frontendBoard, codexBoard] =
    await Promise.all([
      loadPredictionModule(),
      readJson(bundlePath),
      readJson(scenariosPath),
      readJson(targetBoardPath),
      readJson(frontendBoardPath),
      readJson(codexBoardPath),
    ]);

  const teams = bundle.teams ?? [];
  const prospects = bundle.prospects ?? [];
  const targetRows = boardRowsFromArtifact(targetBoard);
  const frontendRows = boardRowsFromArtifact(frontendBoard);
  const codexRows = boardRowsFromArtifact(codexBoard);
  const seen = new Set();
  const evaluations = [];

  const evaluateOnce = (weights, label = null) => {
    if (sumWeights(weights) !== 100) return null;
    const key = weightKey(weights);
    if (seen.has(key)) return null;
    seen.add(key);
    const result = evaluateWeights({ generateBoard, teams, prospects, targetRows, weights });
    result.label = label;
    evaluations.push(result);
    return result;
  };

  for (const scenario of scenariosFile.scenarios ?? []) {
    evaluateOnce(scenario.weights, scenario.id);
  }

  for (const weights of coarseGrid(10)) evaluateOnce(weights);
  const topCoarse = rankEvaluations([...evaluations]).slice(0, 5);
  for (const item of topCoarse) {
    for (const weights of refineGrid(item.weights, 2)) evaluateOnce(weights);
  }

  const ranked = rankEvaluations(evaluations);
  const best = ranked[0];
  const baseline = evaluations.find((item) => item.label === "baseline") ?? null;
  const frontendMetrics = compareToTarget(frontendRows, targetRows);
  const codexMetrics = compareToTarget(codexRows, targetRows);
  const health = getBoardHealth(best.board);

  const changedVsFrontend = best.boardRows
    .filter((row) => frontendRows.find((front) => front.pick === row.pick)?.prospectId !== row.prospectId)
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      frontendPlayer: frontendRows.find((front) => front.pick === row.pick)?.player ?? null,
      trainedPlayer: row.player,
      targetPlayer: targetRows.find((target) => target.pick === row.pick)?.player ?? null,
    }));

  const changedVsTarget = best.metrics.mismatches.map((row) => ({
    pick: row.pick,
    team: row.team,
    targetPlayer: row.targetPlayer,
    trainedPlayer: row.candidatePlayer,
    targetSelectedElsewhere: row.targetSelectedElsewhere,
    absolutePickError: row.absolutePickError,
  }));

  const scenario = {
    id: "trained-final-delivery-calibrated",
    label: "trained final-delivery calibrated",
    weights: best.weights,
    whenToUse: "Use for offline reruns calibrated to the 2026-06-24 final delivery board; not a substitute for official result labels.",
    risk: "Weak-label training target comes from the selected delivery board, not completed official 1-30 draft results.",
    expectedImpactRange: "1-30",
  };

  const boardArtifact = {
    schemaVersion: "draftops.trained_prediction_model_board.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/train-prediction-model.mjs",
    method: "Grid-search and local refinement of prediction.ts base weights against the final delivery board weak label.",
    scenario,
    health,
    target: {
      label: "deepseek-mild final delivery board",
      path: "data/boards/sequential_dynamic_board_123_audit_deepseek_mild.json",
    },
    metrics: best.metrics,
    boardRows: best.boardRows,
    board: best.board,
  };

  const trainingReport = {
    schemaVersion: "draftops.prediction_model_training.v1",
    generatedAt: boardArtifact.generatedAt,
    generatedBy: "scripts/train-prediction-model.mjs",
    scope:
      "Train/calibrate the existing deterministic prediction.ts weight layer against the final delivery board weak label. This does not overwrite frontend output.",
    inputFiles: [
      "src/lib/prediction.ts",
      "data/final/local_pool_124_import_bundle.json",
      "data/reports/weight_scenarios.json",
      "data/boards/sequential_dynamic_board_123_audit_deepseek_mild.json",
      "public/data/agent_expanded_recommended_board.json",
      "data/boards/codex_sequential_123_prediction_20260624.json",
    ],
    trainingTarget: {
      kind: "weak-label-final-delivery-board",
      targetBoardPath: "data/boards/sequential_dynamic_board_123_audit_deepseek_mild.json",
      targetPickCount: targetRows.length,
      note: "No completed official 1-30 result labels were used.",
    },
    search: {
      coarseGridStep: 10,
      refineRadius: 2,
      evaluatedWeightSets: evaluations.length,
      fixedWeightSum: 100,
    },
    bestScenario: scenario,
    health,
    metrics: {
      trained: best.metrics,
      baseline: baseline?.metrics ?? null,
      frontendCurrent: frontendMetrics,
      codexSequential20260624: codexMetrics,
    },
    topWeightSets: ranked.slice(0, 20).map((item, index) => ({
      rank: index + 1,
      label: item.label,
      weights: item.weights,
      metrics: item.metrics,
    })),
    changedVsFrontend,
    changedVsTarget,
    outputFiles: [
      "data/boards/trained_prediction_model_board_20260624.json",
      "data/reports/prediction_model_training_20260624.json",
      "data/reports/prediction_model_training_20260624.md",
    ],
  };

  await Promise.all([
    mkdir(dirname(outputBoardPath), { recursive: true }),
    mkdir(dirname(outputJsonPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(outputBoardPath, `${JSON.stringify(boardArtifact, null, 2)}\n`, "utf8"),
    writeFile(outputJsonPath, `${JSON.stringify(trainingReport, null, 2)}\n`, "utf8"),
  ]);

  const topRows = ranked.slice(0, 10).map((item, index) => [
    index + 1,
    item.label ?? "search",
    formatWeights(item.weights),
    item.metrics.exactMatches,
    item.metrics.topFiveExact,
    item.metrics.lotteryExact,
    item.metrics.lateFirstExact,
    item.metrics.targetSelected,
    item.metrics.meanAbsolutePickError,
    item.metrics.lowConfidence,
    item.metrics.narrowMargins,
  ]);

  const compareRows = [
    ["模型", "权重", "slot命中", "Top5命中", "乐透命中", "目标球员入选", "平均顺位误差", "低置信", "窄边际"],
    [
      "trained",
      formatWeights(best.weights),
      best.metrics.exactMatches,
      best.metrics.topFiveExact,
      best.metrics.lotteryExact,
      best.metrics.targetSelected,
      best.metrics.meanAbsolutePickError,
      best.metrics.lowConfidence,
      best.metrics.narrowMargins,
    ],
    baseline
      ? [
          "baseline",
          formatWeights(baseline.weights),
          baseline.metrics.exactMatches,
          baseline.metrics.topFiveExact,
          baseline.metrics.lotteryExact,
          baseline.metrics.targetSelected,
          baseline.metrics.meanAbsolutePickError,
          baseline.metrics.lowConfidence,
          baseline.metrics.narrowMargins,
        ]
      : null,
    [
      "frontend-current",
      frontendBoard.scenario?.id ?? "artifact",
      frontendMetrics.exactMatches,
      frontendMetrics.topFiveExact,
      frontendMetrics.lotteryExact,
      frontendMetrics.targetSelected,
      frontendMetrics.meanAbsolutePickError,
      frontendMetrics.lowConfidence,
      frontendMetrics.narrowMargins,
    ],
    [
      "codex-sequential",
      "separate scorer",
      codexMetrics.exactMatches,
      codexMetrics.topFiveExact,
      codexMetrics.lotteryExact,
      codexMetrics.targetSelected,
      codexMetrics.meanAbsolutePickError,
      codexMetrics.lowConfidence,
      codexMetrics.narrowMargins,
    ],
  ].filter(Boolean);

  const mismatchRows = changedVsTarget.map((row) => [
    row.pick,
    row.team,
    row.targetPlayer,
    row.trainedPlayer,
    row.targetSelectedElsewhere ?? "未入选",
    row.absolutePickError ?? "",
  ]);

  const reportMd = `# Prediction Model Training (${runStamp})

## Conclusion

- Trained the existing \`src/lib/prediction.ts\` base-weight layer by grid search plus local refinement.
- Training target: the final delivery board \`deepseek-mild\`, treated as a weak label. This is **not** official-result training.
- Best trained scenario: \`${scenario.id}\`.
- Trained weights: \`${formatWeights(best.weights)}\`.
- Exact slot matches vs final delivery target: **${best.metrics.exactMatches}/30**.
- Target players selected somewhere in the first round: **${best.metrics.targetSelected}/30**.
- Mean absolute pick error for selected target players: **${best.metrics.meanAbsolutePickError}** picks.
- Frontend was not overwritten.

## Comparison

${markdownTable(compareRows)}

## Top Weight Sets

${markdownTable([
  ["Rank", "Label", "Weights", "Slot", "Top5", "Lottery", "Late", "Target In", "MAE", "Low Conf", "Narrow"],
  ...topRows,
])}

## Remaining Mismatches Vs Target

${mismatchRows.length ? markdownTable([["Pick", "Team", "Target", "Trained", "Target Elsewhere", "Abs Error"], ...mismatchRows]) : "No mismatches."}

## Outputs

- Trained board: \`data/boards/trained_prediction_model_board_${runStamp}.json\`
- Training JSON: \`data/reports/prediction_model_training_${runStamp}.json\`
- Training report: \`data/reports/prediction_model_training_${runStamp}.md\`

## Usage Note

The trained scenario can be added to \`weight_scenarios.json\` or used in an offline rerun, but it should be labeled as delivery-board calibration because the training labels are model consensus, not completed official draft results.
`;

  await writeFile(outputReportPath, reportMd, "utf8");

  console.log(
    JSON.stringify(
      {
        outputFiles: trainingReport.outputFiles,
        evaluatedWeightSets: evaluations.length,
        bestScenario: scenario,
        health,
        metrics: trainingReport.metrics,
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
