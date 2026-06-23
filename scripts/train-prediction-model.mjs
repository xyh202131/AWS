import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const runStamp = "20260624";

const targetBoardPath = resolve(rootDir, "data", "boards", "sequential_dynamic_board_123_audit_deepseek_mild.json");
const frontendBoardPath = resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json");
const codexBoardPath = resolve(rootDir, "data", "boards", "codex_sequential_123_prediction_20260624.json");

const outputJsonPath = resolve(rootDir, "data", "reports", `prediction_model_training_${runStamp}.json`);
const outputReportPath = resolve(rootDir, "data", "reports", `prediction_model_training_${runStamp}.md`);
const outputBoardPath = resolve(rootDir, "data", "boards", `trained_prediction_model_board_${runStamp}.json`);

const signalKeys = ["consensus", "need", "player", "upside", "intel"];

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const round = (value, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const markdownTable = (rows) => {
  if (!rows.length) return "";
  const [header, ...body] = rows;
  const separator = header.map(() => "---");
  return [header, separator, ...body].map((row) => `| ${row.map((cell) => String(cell ?? "")).join(" | ")} |`).join("\n");
};

const boardRowsFromArtifact = (artifact) => {
  if (Array.isArray(artifact.boardRows)) return artifact.boardRows;
  if (Array.isArray(artifact.board)) {
    return artifact.board.map((pick) => ({
      pick: pick.pick,
      team: pick.team,
      prospectId: pick.prospectId ?? pick.prospect?.id,
      player: pick.player ?? pick.prospect?.name,
      localNameZh: pick.localNameZh ?? pick.prospect?.localPool?.nameZh ?? null,
      score: pick.score ?? null,
      confidence: pick.confidence ?? null,
      margin: pick.margin ?? null,
    }));
  }
  return [];
};

const weightKey = (weights) => signalKeys.map((key) => weights[key]).join("|");

function* weightGrid(step = 5) {
  for (let consensus = 5; consensus <= 65; consensus += step) {
    for (let need = 5; need <= 60; need += step) {
      for (let player = 5; player <= 55; player += step) {
        for (let upside = 1; upside <= 40; upside += step) {
          const intel = 100 - consensus - need - player - upside;
          if (intel < 1 || intel > 45) continue;
          yield { consensus, need, player, upside, intel };
        }
      }
    }
  }
}

function* refineGrid(center, radius = 4) {
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

const scoreCandidate = (candidate, weights, adjustmentCoefficients) => {
  const breakdown = candidate.breakdown ?? {};
  const raw =
    signalKeys.reduce((sum, key) => sum + (Number(breakdown[key]) || 0) * weights[key], 0) / 100;

  return (
    raw +
    (Number(candidate.dynamicPreferenceAdjustment) || 0) * adjustmentCoefficients.preference +
    (Number(candidate.featureAdjustment) || 0) * adjustmentCoefficients.feature +
    (Number(candidate.sequencingAdjustment) || 0) * adjustmentCoefficients.sequencing +
    (Number(candidate.schoolStateAdjustment) || 0) * adjustmentCoefficients.schoolState +
    (Number(candidate.pickValueAdjustment) || 0) * adjustmentCoefficients.pickValue -
    (Number(candidate.riskPenalty) || 0) * adjustmentCoefficients.risk
  );
};

const rankPick = (pickAudit, weights, adjustmentCoefficients) => {
  const selectedId = pickAudit.selected?.prospectId ?? pickAudit.removedProspectId;
  const ranked = [...(pickAudit.allScores ?? [])]
    .map((candidate) => ({
      ...candidate,
      trainedScore: scoreCandidate(candidate, weights, adjustmentCoefficients),
    }))
    .sort(
      (left, right) =>
        right.trainedScore - left.trainedScore ||
        (left.consensusRank ?? 999) - (right.consensusRank ?? 999) ||
        String(left.name).localeCompare(String(right.name)),
    );
  const selectedIndex = ranked.findIndex((candidate) => candidate.prospectId === selectedId);
  const selected = ranked[selectedIndex] ?? null;
  const winner = ranked[0] ?? null;

  return {
    pick: pickAudit.pick,
    team: pickAudit.team,
    selectedId,
    selectedName: pickAudit.selected?.name ?? null,
    selectedLocalNameZh: pickAudit.selected?.localNameZh ?? null,
    selectedRank: selectedIndex >= 0 ? selectedIndex + 1 : null,
    selectedScore: selected ? round(selected.trainedScore) : null,
    winnerId: winner?.prospectId ?? null,
    winnerName: winner?.name ?? null,
    winnerLocalNameZh: winner?.localNameZh ?? null,
    winnerScore: winner ? round(winner.trainedScore) : null,
    marginToWinner: selected && winner ? round(selected.trainedScore - winner.trainedScore) : null,
    exactTop: winner?.prospectId === selectedId,
    topFive: selectedIndex >= 0 && selectedIndex < 5,
    topTen: selectedIndex >= 0 && selectedIndex < 10,
    rankedTopFive: ranked.slice(0, 5).map((candidate) => ({
      prospectId: candidate.prospectId,
      name: candidate.name,
      localNameZh: candidate.localNameZh,
      trainedScore: round(candidate.trainedScore),
      originalFinalScore: candidate.finalScore,
      consensusRank: candidate.consensusRank,
    })),
  };
};

const evaluate = (pickAudits, weights, adjustmentCoefficients) => {
  const perPick = pickAudits.map((pickAudit) => rankPick(pickAudit, weights, adjustmentCoefficients));
  const exactTop = perPick.filter((row) => row.exactTop).length;
  const selectedTopFive = perPick.filter((row) => row.topFive).length;
  const selectedTopTen = perPick.filter((row) => row.topTen).length;
  const rankPenalty = perPick.reduce((sum, row) => sum + Math.max(0, (row.selectedRank ?? 999) - 1), 0);
  const topWeighted = perPick.reduce((sum, row) => {
    const weight = row.pick <= 5 ? 3 : row.pick <= 14 ? 2 : 1;
    return sum + (row.exactTop ? weight : 0);
  }, 0);
  const objective = exactTop * 100 + topWeighted * 6 + selectedTopFive * 12 + selectedTopTen * 4 - rankPenalty * 2;

  return {
    weights,
    adjustmentCoefficients,
    metrics: {
      objective: round(objective),
      exactTop,
      selectedTopFive,
      selectedTopTen,
      rankPenalty,
      averageSelectedRank: round(perPick.reduce((sum, row) => sum + (row.selectedRank ?? 999), 0) / perPick.length),
      topFiveExact: perPick.filter((row) => row.exactTop && row.pick <= 5).length,
      lotteryExact: perPick.filter((row) => row.exactTop && row.pick <= 14).length,
      lateFirstExact: perPick.filter((row) => row.exactTop && row.pick >= 15).length,
    },
    perPick,
  };
};

const rankEvaluations = (evaluations) =>
  evaluations.sort(
    (left, right) =>
      right.metrics.objective - left.metrics.objective ||
      right.metrics.exactTop - left.metrics.exactTop ||
      right.metrics.selectedTopFive - left.metrics.selectedTopFive ||
      left.metrics.rankPenalty - right.metrics.rankPenalty,
  );

const compareBoards = (candidateRows, targetRows) => {
  const candidateByPick = new Map(candidateRows.map((row) => [row.pick, row]));
  return targetRows.map((target) => {
    const candidate = candidateByPick.get(target.pick);
    return {
      pick: target.pick,
      team: target.team,
      targetPlayer: target.player,
      candidatePlayer: candidate?.player ?? candidate?.winnerName ?? null,
      exact: (candidate?.prospectId ?? candidate?.winnerId) === target.prospectId,
    };
  });
};

const formatWeights = (weights) =>
  `consensus ${weights.consensus} / need ${weights.need} / player ${weights.player} / upside ${weights.upside} / intel ${weights.intel}`;

const main = async () => {
  const [targetBoard, frontendBoard, codexBoard] = await Promise.all([
    readJson(targetBoardPath),
    readJson(frontendBoardPath),
    readJson(codexBoardPath),
  ]);

  const pickAudits = targetBoard.pickAudits ?? [];
  const targetRows = boardRowsFromArtifact(targetBoard);
  const frontendRows = boardRowsFromArtifact(frontendBoard);
  const codexRows = boardRowsFromArtifact(codexBoard);
  const adjustmentCoefficients = {
    preference: 1,
    feature: 1,
    sequencing: 1,
    schoolState: 1,
    pickValue: 1,
    risk: 1,
  };

  const evaluated = [];
  const seen = new Set();
  const evaluateOnce = (weights, label = null) => {
    const key = weightKey(weights);
    if (seen.has(key)) return null;
    seen.add(key);
    const result = evaluate(pickAudits, weights, adjustmentCoefficients);
    result.label = label;
    evaluated.push(result);
    return result;
  };

  evaluateOnce(targetBoard.scenario?.weights ?? { consensus: 35, need: 25, player: 20, upside: 10, intel: 10 }, "target-baseline");
  for (const weights of weightGrid(5)) evaluateOnce(weights);

  const topCoarse = rankEvaluations([...evaluated]).slice(0, 8);
  for (const item of topCoarse) {
    for (const weights of refineGrid(item.weights, 4)) evaluateOnce(weights);
  }

  const ranked = rankEvaluations(evaluated);
  const best = ranked[0];
  const baseline = evaluated.find((item) => item.label === "target-baseline");
  const frontendComparison = compareBoards(frontendRows, targetRows);
  const codexComparison = compareBoards(codexRows, targetRows);

  const trainedBoardRows = best.perPick.map((row) => ({
    pick: row.pick,
    team: row.team,
    prospectId: row.selectedId,
    player: row.selectedName,
    localNameZh: row.selectedLocalNameZh,
    trainedScore: row.selectedScore,
    targetSelectedRank: row.selectedRank,
    exactTargetTop: row.exactTop,
    trainedWinner: {
      prospectId: row.winnerId,
      player: row.winnerName,
      localNameZh: row.winnerLocalNameZh,
      trainedScore: row.winnerScore,
    },
    topFive: row.rankedTopFive,
  }));

  const scenario = {
    id: "trained-audit-rerank",
    label: "trained audit rerank",
    weights: best.weights,
    adjustmentCoefficients,
    whenToUse:
      "Offline reranking of recorded sequential candidate states. Use as a calibrated scoring-layer result, not as official draft-result training.",
    risk:
      "Training labels are the final delivery board and recorded candidate states; it does not regenerate new candidate states from scratch.",
  };

  const output = {
    schemaVersion: "draftops.prediction_model_training.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/train-prediction-model.mjs",
    scope:
      "Train the scoring-layer weights using final delivery pickAudits.allScores. Objective: rank the final-delivery selection first within each recorded pick state.",
    trainingTarget: {
      targetBoardPath: "data/boards/sequential_dynamic_board_123_audit_deepseek_mild.json",
      targetKind: "weak-label-final-delivery-board",
      pickCount: pickAudits.length,
      candidateScoreRows: pickAudits.reduce((sum, pick) => sum + (pick.allScores?.length ?? 0), 0),
      officialResultLabelsUsed: false,
    },
    search: {
      coarseStep: 5,
      refineRadius: 4,
      evaluatedWeightSets: evaluated.length,
      fixedWeightSum: 100,
    },
    bestScenario: scenario,
    metrics: {
      trained: best.metrics,
      baseline: baseline?.metrics ?? null,
      frontendCurrentExactVsTarget: frontendComparison.filter((row) => row.exact).length,
      codexSequentialExactVsTarget: codexComparison.filter((row) => row.exact).length,
    },
    topWeightSets: ranked.slice(0, 20).map((item, index) => ({
      rank: index + 1,
      label: item.label,
      weights: item.weights,
      metrics: item.metrics,
    })),
    perPick: best.perPick,
    mismatches: best.perPick.filter((row) => !row.exactTop),
    outputFiles: [
      "data/reports/prediction_model_training_20260624.json",
      "data/reports/prediction_model_training_20260624.md",
      "data/boards/trained_prediction_model_board_20260624.json",
    ],
  };

  const boardArtifact = {
    schemaVersion: "draftops.trained_prediction_model_rerank.v1",
    generatedAt: output.generatedAt,
    generatedBy: output.generatedBy,
    method:
      "Diagnostic rerank artifact: boardRows keep the final-delivery selected player and attach that player's trained rank/winner diagnostics. It is not a new sequential board.",
    scenario,
    metrics: best.metrics,
    boardRows: trainedBoardRows,
    noManualOverride: true,
  };

  await Promise.all([mkdir(dirname(outputJsonPath), { recursive: true }), mkdir(dirname(outputBoardPath), { recursive: true })]);
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8"),
    writeFile(outputBoardPath, `${JSON.stringify(boardArtifact, null, 2)}\n`, "utf8"),
  ]);

  const comparisonRows = [
    ["Model", "Weights", "Exact top", "Selected top5", "Selected top10", "Avg selected rank", "Rank penalty"],
    [
      "trained",
      formatWeights(best.weights),
      best.metrics.exactTop,
      best.metrics.selectedTopFive,
      best.metrics.selectedTopTen,
      best.metrics.averageSelectedRank,
      best.metrics.rankPenalty,
    ],
    baseline
      ? [
          "baseline",
          formatWeights(baseline.weights),
          baseline.metrics.exactTop,
          baseline.metrics.selectedTopFive,
          baseline.metrics.selectedTopTen,
          baseline.metrics.averageSelectedRank,
          baseline.metrics.rankPenalty,
        ]
      : null,
    ["frontend-current", "artifact board", frontendComparison.filter((row) => row.exact).length, "", "", "", ""],
    ["codex-sequential", "separate scorer", codexComparison.filter((row) => row.exact).length, "", "", "", ""],
  ].filter(Boolean);

  const topRows = ranked.slice(0, 10).map((item, index) => [
    index + 1,
    item.label ?? "search",
    formatWeights(item.weights),
    item.metrics.exactTop,
    item.metrics.selectedTopFive,
    item.metrics.selectedTopTen,
    item.metrics.averageSelectedRank,
    item.metrics.rankPenalty,
  ]);

  const mismatchRows = output.mismatches.map((row) => [
    row.pick,
    row.team,
    row.selectedName,
    row.winnerName,
    row.selectedRank,
    row.marginToWinner,
  ]);

  const report = `# Prediction Model Training (${runStamp})

## Conclusion

- Training completed using \`pickAudits.allScores\` from the final delivery board.
- Training samples: **${output.trainingTarget.candidateScoreRows}** candidate-score rows across **${output.trainingTarget.pickCount}** picks.
- Label type: weak label from \`deepseek-mild\`, not completed official draft results.
- Best trained scoring weights: \`${formatWeights(best.weights)}\`.
- The trained scoring layer ranks the final-delivery selection first in **${best.metrics.exactTop}/30** recorded pick states.
- It places the final-delivery selection inside top 5 in **${best.metrics.selectedTopFive}/30** states and top 10 in **${best.metrics.selectedTopTen}/30** states.
- Frontend artifact exact match vs final delivery remains **${output.metrics.frontendCurrentExactVsTarget}/30**; Codex sequential exact match vs final delivery is **${output.metrics.codexSequentialExactVsTarget}/30**.

## Comparison

${markdownTable(comparisonRows)}

## Top Weight Sets

${markdownTable([["Rank", "Label", "Weights", "Exact top", "Top5", "Top10", "Avg rank", "Penalty"], ...topRows])}

## Remaining Non-Top Picks

${mismatchRows.length ? markdownTable([["Pick", "Team", "Target selection", "Trained winner", "Target rank", "Target minus winner score"], ...mismatchRows]) : "All recorded pick states rank the target selection first."}

## Outputs

- Training JSON: \`data/reports/prediction_model_training_${runStamp}.json\`
- Trained rerank board: \`data/boards/trained_prediction_model_board_${runStamp}.json\`
- Training report: \`data/reports/prediction_model_training_${runStamp}.md\`

## Boundary

This trains the scoring layer on recorded sequential candidate states. It is suitable for parameter calibration and evidence review, but it does not replace a fresh end-to-end sequential rerun unless those trained weights are later wired into the generating script.
`;

  await writeFile(outputReportPath, report, "utf8");

  console.log(
    JSON.stringify(
      {
        outputFiles: output.outputFiles,
        evaluatedWeightSets: output.search.evaluatedWeightSets,
        bestScenario: scenario,
        metrics: output.metrics,
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
