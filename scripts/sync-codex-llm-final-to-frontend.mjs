import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();

const paths = {
  sourceBoard: resolve(rootDir, "data", "boards", "relative_scoring_prediction_codex_as_llm_20260624_031340.json"),
  bundle: resolve(rootDir, "public", "data", "expanded_import_bundle.json"),
  frontendBoard: resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json"),
  manifest: resolve(rootDir, "src", "config", "draftops-manifest.json"),
  combine: resolve(rootDir, "data", "normalized", "normalized_china_nba_draftcombine_20260624.json"),
  milestoneAnswers: resolve(rootDir, "data", "final", "milestone_answers.json"),
  reportJson: resolve(rootDir, "data", "reports", "codex_llm_final_frontend_sync_20260624.json"),
  reportMd: resolve(rootDir, "data", "reports", "codex_llm_final_frontend_sync_20260624.md"),
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const average = (values) => {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
};

const nameKey = (value) => String(value ?? "").toLowerCase().replace(/\s+/g, "");

const getZone = (pick) => {
  if (pick <= 5) return "top-five";
  if (pick <= 14) return "lottery";
  return "late-first";
};

const hasLocalPhoto = async (media) => {
  if (!media?.photoUrl) return false;
  const relativePath = media.photoUrl.replace(/^\/+/, "").replaceAll("/", "\\");
  try {
    await access(resolve(rootDir, "public", relativePath), constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const isFallbackProspect = (prospect) => (prospect.risks ?? []).some((risk) => /fallback/i.test(risk));

const mapBreakdown = (breakdown = {}) => ({
  consensus: round(breakdown.consensus),
  need: round(breakdown.need),
  player: round(breakdown.player),
  upside: round(breakdown.upside),
  intel: round(average([breakdown.feature, breakdown.source])),
});

const mapWeights = (weights = {}) => ({
  consensus: round(weights.consensus ?? 0, 4),
  need: round(weights.need ?? 0, 4),
  player: round(weights.player ?? 0, 4),
  upside: round(weights.upside ?? 0, 4),
  intel: round((Number(weights.feature ?? 0) + Number(weights.source ?? 0)), 4),
});

const roleFitForRow = (row, prospect) => {
  if (row.preferenceOverlap?.length) return row.preferenceOverlap[0];
  if (row.overlapFamilies?.length) return row.overlapFamilies[0];
  return prospect.roleTags?.[0] ?? "relative team fit";
};

const buildAlternatives = (auditRow, selectedId, prospectsById) =>
  (auditRow?.topCandidates ?? auditRow?.allScores ?? [])
    .filter((candidate) => candidate.prospectId !== selectedId)
    .slice(0, 3)
    .map((candidate) => {
      const prospect = prospectsById.get(candidate.prospectId);
      return {
        prospectId: candidate.prospectId,
        name: candidate.name ?? candidate.player ?? prospect?.name ?? candidate.prospectId,
        score: round(candidate.score ?? candidate.weightedScore ?? candidate.averageScore),
        roleFit: prospect?.roleTags?.[0] ?? candidate.need?.overlapFamilies?.[0] ?? "relative runner-up",
      };
    });

const buildEvidence = (row, auditRow, team, prospect) => {
  const weights = auditRow?.dynamicParameters?.weights ?? {};
  const evidence = [
    `Codex LLM relative score ${round(row.scoreExact, 3)}/100 after reviewing ${row.reviewedCandidates} remaining candidates.`,
    `Sequential removal check: ${row.remainingBefore} before pick, ${row.remainingAfter} after pick.`,
    `Team needs: ${(team.needs ?? auditRow?.dynamicParameters?.needs ?? []).join(", ") || "not specified"}.`,
    `Primary fit signal: ${roleFitForRow(row, prospect)}.`,
    `Margin over next available candidate: ${round(row.margin, 3)}.`,
    `Relative weights: consensus ${round(weights.consensus, 3)}, need ${round(weights.need, 3)}, player ${round(weights.player, 3)}, upside ${round(weights.upside, 3)}, feature ${round(weights.feature, 3)}, source ${round(weights.source, 3)}.`,
  ];

  if (row.reason) evidence.push(row.reason);
  if (auditRow?.selected?.sourceEvidence?.snippets?.length) {
    evidence.push(`RAG matches retained: ${auditRow.selected.sourceEvidence.snippets.length}.`);
  }
  return evidence;
};

const validateSourceBoard = (sourceBoard) => {
  const failures = [];
  const validation = sourceBoard.validation ?? {};
  for (const [key, value] of Object.entries(validation)) {
    if (value === false) failures.push(`${key}=false`);
    if (key === "duplicateSelectedProspectIds" && Array.isArray(value) && value.length) {
      failures.push(`duplicateSelectedProspectIds=${value.join(",")}`);
    }
  }
  if ((sourceBoard.boardRows ?? []).length !== 30) failures.push("boardRows length is not 30");
  if (new Set((sourceBoard.boardRows ?? []).map((row) => row.prospectId)).size !== 30) {
    failures.push("selected prospects are not unique");
  }
  if (failures.length) throw new Error(`Codex LLM source board validation failed: ${failures.join("; ")}`);
};

const buildFrontendBoard = async ({ sourceBoard, bundle, previousFrontend }) => {
  const prospectsById = new Map((bundle.prospects ?? []).map((prospect) => [prospect.id, prospect]));
  const teamsByPick = new Map((bundle.teams ?? []).map((team) => [Number(team.pick), team]));
  const previousRowsByPick = new Map((previousFrontend.boardRows ?? []).map((row) => [Number(row.pick), row]));
  const auditsByPick = new Map((sourceBoard.pickAudits ?? []).map((auditRow) => [Number(auditRow.pick), auditRow]));
  const board = [];
  const mediaRows = [];

  for (const row of sourceBoard.boardRows) {
    const pick = Number(row.pick);
    const prospect = prospectsById.get(row.prospectId);
    const team = teamsByPick.get(pick);
    const auditRow = auditsByPick.get(pick);
    if (!prospect) throw new Error(`Prospect not found in expanded_import_bundle: ${row.prospectId}`);
    if (!team) throw new Error(`Team not found for pick ${pick}`);

    const localPhotoExists = await hasLocalPhoto(prospect.media);
    mediaRows.push({
      pick,
      prospectId: prospect.id,
      player: prospect.name,
      photoUrl: prospect.media?.photoUrl ?? null,
      mediaStatus: prospect.media?.status ?? "missing",
      localPhotoExists,
    });

    const warnings = [
      ...(row.margin < 2 ? ["Narrow relative margin; keep under review."] : []),
      ...(row.confidence < 70 ? ["Codex LLM confidence is below target; verify supporting evidence."] : []),
      ...(isFallbackProspect(prospect) ? ["Expanded-pool fallback profile; source coverage is thinner than seeded profiles."] : []),
      ...(!prospect.media?.photoUrl ? ["No verified local player photo; frontend will use generated initials placeholder."] : []),
      ...(prospect.media?.photoUrl && !localPhotoExists ? ["Player photo path is present but local file was not found."] : []),
    ];

    board.push({
      pick,
      team: row.team,
      acquiredFrom: row.acquiredFrom ?? null,
      prospect,
      score: round(row.scoreExact ?? row.score),
      confidence: Math.round(row.confidence ?? auditRow?.confidence ?? 0),
      margin: round(row.margin ?? auditRow?.margin),
      zone: getZone(pick),
      effectiveWeights: mapWeights(auditRow?.selected?.weights ?? auditRow?.dynamicParameters?.weights),
      roleFit: roleFitForRow(row, prospect),
      breakdown: mapBreakdown(row.breakdown ?? auditRow?.selected?.breakdown),
      alternatives: buildAlternatives(auditRow, row.prospectId, prospectsById),
      evidence: buildEvidence(row, auditRow, team, prospect),
      warnings,
    });
  }

  const boardRows = board.map((pick) => ({
    pick: pick.pick,
    team: pick.team,
    acquiredFrom: pick.acquiredFrom,
    player: pick.prospect.name,
    prospectId: pick.prospect.id,
    localNameZh: pick.prospect.localPool?.nameZh ?? null,
    localOrdinal: pick.prospect.localPool?.ordinal ?? null,
    school: pick.prospect.school,
    origin: pick.prospect.origin,
    position: pick.prospect.positions.join("/"),
    consensusRank: pick.prospect.consensusRank,
    score: pick.score,
    confidence: pick.confidence,
    margin: pick.margin,
    reviewedCandidates: sourceBoard.boardRows.find((row) => row.pick === pick.pick)?.reviewedCandidates ?? null,
    remainingBefore: sourceBoard.boardRows.find((row) => row.pick === pick.pick)?.remainingBefore ?? null,
    remainingAfter: sourceBoard.boardRows.find((row) => row.pick === pick.pick)?.remainingAfter ?? null,
    fallbackProfile: isFallbackProspect(pick.prospect),
    matchStatus: pick.prospect.localPool?.matchStatus ?? null,
    warnings: pick.warnings,
    alternatives: pick.alternatives,
    breakdown: pick.breakdown,
    media: {
      photoUrl: pick.prospect.media?.photoUrl ?? null,
      status: pick.prospect.media?.status ?? "missing",
    },
  }));

  const changedVsPrevious = boardRows
    .filter((row) => previousRowsByPick.get(row.pick)?.prospectId !== row.prospectId)
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      previous: previousRowsByPick.get(row.pick)?.player ?? null,
      next: row.player,
      prospectId: row.prospectId,
    }));
  const missingMedia = mediaRows.filter((row) => !row.photoUrl || !row.localPhotoExists);
  const localPhotoCount = mediaRows.filter((row) => row.photoUrl && row.localPhotoExists).length;

  return {
    artifact: {
      schemaVersion: "draftops.expanded_recommended_board.codex_llm_relative.v1",
      generatedAt: new Date().toISOString(),
      generatedBy: "scripts/sync-codex-llm-final-to-frontend.mjs",
      method:
        "Frontend board synced from the Codex-as-LLM relative scoring run. Each pick is scored only against the current team's remaining candidate pool after prior selected prospects are removed.",
      inputFiles: [
        "data/boards/relative_scoring_prediction_codex_as_llm_20260624_031340.json",
        "public/data/expanded_import_bundle.json",
        "data/normalized/normalized_china_nba_draftcombine_20260624.json",
      ],
      candidatePool: {
        uniqueCandidates: sourceBoard.candidatePool?.uniqueCandidates ?? bundle.prospects?.length ?? 0,
        noManualOverride: true,
        scoringMode: "codex-llm-relative-within-current-team-and-remaining-candidate-pool",
      },
      scenario: {
        id: "codex-llm-relative-final",
        label: "Codex LLM relative final",
        weights: {
          consensus: 0,
          need: 0,
          player: 0,
          upside: 0,
          intel: 0,
        },
        whenToUse: "Final deploy board selected by the user after four-version comparison.",
        risk: "Narrow-margin and late-board picks should be explained with retained RAG evidence rather than model memory.",
        expectedImpactRange: "1-30",
      },
      health: {
        hasThirtyPicks: board.length === 30,
        noDuplicates: new Set(board.map((pick) => pick.prospect.id)).size === board.length,
        lowConfidence: board.filter((pick) => pick.confidence < 70).length,
        missingLocalPhotos: missingMedia.length,
        ready: board.length === 30 && new Set(board.map((pick) => pick.prospect.id)).size === board.length,
      },
      summary: {
        pickCount: board.length,
        uniqueProspects: new Set(board.map((pick) => pick.prospect.id)).size,
        averageConfidence: Math.round(average(board.map((pick) => pick.confidence))),
        averageScore: round(average(board.map((pick) => pick.score))),
        changedVsPrevious,
        media: {
          localPhotoCount,
          missingLocalPhotoCount: missingMedia.length,
          missingMedia,
        },
        sourceRun: sourceBoard.summary,
        validation: sourceBoard.validation,
      },
      board,
      boardRows,
      audit: {
        sourceBoardPath: "data/boards/relative_scoring_prediction_codex_as_llm_20260624_031340.json",
        validation: sourceBoard.validation,
        guardrails: sourceBoard.guardrails,
        totalCandidateReviews: sourceBoard.summary?.totalCandidateReviews,
      },
      mediaMetadata: {
        matchedProspects: localPhotoCount,
        missingMedia,
        note: "Missing photo rows intentionally render via PlayerPhoto initials fallback instead of broken image links.",
      },
      noManualOverride: true,
      revisions: [
        ...(previousFrontend.revisions ?? []),
        {
          generatedAt: new Date().toISOString(),
          type: "frontend-board-sync",
          source: "data/boards/relative_scoring_prediction_codex_as_llm_20260624_031340.json",
          note: "User selected Codex LLM as the final deployed prediction board after four-version comparison.",
        },
      ],
    },
    changedVsPrevious,
    missingMedia,
  };
};

const topNWithTies = (rows, key, n) => {
  const sorted = rows.filter((row) => Number.isFinite(row[key])).sort((left, right) => right[key] - left[key]);
  const threshold = sorted[n - 1]?.[key];
  return sorted.filter((row) => row[key] >= threshold);
};

const buildMilestones = ({ boardRows, combine, manifest, previousMilestoneAnswers }) => {
  const combineByName = new Map((combine.players ?? []).map((player) => [nameKey(player.nameZh), player]));
  const selectedKeys = new Set(boardRows.map((row) => nameKey(row.localNameZh)));
  const pickByKey = new Map(boardRows.map((row) => [nameKey(row.localNameZh), row.pick]));
  const selectedCombineRows = boardRows.map((row) => ({
    ...row,
    combine: combineByName.get(nameKey(row.localNameZh)),
  }));

  const wingspanRows = selectedCombineRows
    .filter((row) => row.pick >= 4 && row.pick <= 14)
    .map((row) => {
      const measurements = row.combine?.measurements ?? {};
      const diff =
        Number.isFinite(measurements.wingspanIn) && Number.isFinite(measurements.barefootHeightIn)
          ? measurements.wingspanIn - measurements.barefootHeightIn
          : null;
      return { ...row, wingspanDiff: diff };
    });
  const longWingspan = wingspanRows.filter((row) => Number(row.wingspanDiff) >= 5);

  const allCombineRows = (combine.players ?? []).map((player) => ({
    nameZh: player.nameZh,
    key: nameKey(player.nameZh),
    handLengthIn: player.measurements?.handLengthIn,
    maxVerticalIn: player.athleticAgility?.maxVerticalIn,
  }));
  const topVertical = topNWithTies(allCombineRows, "maxVerticalIn", 3);
  const topHand = topNWithTies(allCombineRows, "handLengthIn", 5);
  const selectedTopVertical = topVertical.filter((row) => selectedKeys.has(row.key));
  const selectedTopHand = topHand.filter((row) => selectedKeys.has(row.key));
  const primaryCenters = selectedCombineRows.filter((row) => row.combine?.candidateProfile?.positionZh === "中锋");
  const firstCenterFrom4 = primaryCenters.filter((row) => row.pick >= 4).sort((left, right) => left.pick - right.pick)[0];
  const internationalRows = boardRows.filter((row) => row.international || row.origin !== "United States");
  const schoolCounts = new Map();
  for (const row of boardRows) schoolCounts.set(row.school, (schoolCounts.get(row.school) ?? 0) + 1);
  const schoolLeader = [...schoolCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];

  const strategic = {
    longWingspan: longWingspan.length + 1,
    topVertical: selectedTopVertical.length + 1,
    primaryCenters: primaryCenters.length + 1,
    firstCenter: firstCenterFrom4?.pick ?? "",
    international: internationalRows.length + 1,
    school: "密歇根大学",
    topHand: selectedTopHand.length + 1,
  };

  const definitionsById = new Map((manifest.milestones ?? []).map((definition) => [definition.id, definition]));
  const previousAnswersById = new Map((previousMilestoneAnswers.answers ?? []).map((answer) => [answer.id, answer]));
  const answerRows = [
    {
      id: "long-wingspan-picks-4-14",
      answer: strategic.longWingspan,
      point: longWingspan.length,
      type: "integer",
      tolerance: "±1",
      evidenceZh: [
        `Codex LLM最终板第4-14顺位中，臂展差>=5英寸的球员为${longWingspan.map((row) => `第${row.pick}顺位${row.localNameZh}`).join("、") || "无"}，点估计${longWingspan.length}人。`,
        `容错策略：提交值${strategic.longWingspan}，覆盖${longWingspan.length}-${longWingspan.length + 2}；第7顺位达柳斯 阿卡夫臂展差4.5英寸接近阈值，保留上行空间。`,
      ],
      evidenceEn: [
        `On the Codex LLM final board, the pick 4-14 players clearing a 5-inch wingspan delta are ${longWingspan.map((row) => `pick ${row.pick} ${row.player}`).join(", ") || "none"}, point estimate ${longWingspan.length}.`,
        `Tolerance strategy: submit ${strategic.longWingspan}, covering ${longWingspan.length}-${longWingspan.length + 2}; Darius Acuff Jr. is close at 4.5 inches, so upside uncertainty is retained.`,
      ],
    },
    {
      id: "max-vertical-top-three-first-round",
      answer: strategic.topVertical,
      point: selectedTopVertical.length,
      type: "integer",
      tolerance: "0-3, ±1",
      evidenceZh: [
        `助跑最大弹跳前三含并列为${topVertical.map((row) => row.nameZh).join("、")}；其中进入Codex LLM首轮的是${selectedTopVertical.map((row) => `第${pickByKey.get(row.key)}顺位${row.nameZh}`).join("、") || "无"}，点估计${selectedTopVertical.length}人。`,
        `容错策略：提交值${strategic.topVertical}，覆盖${selectedTopVertical.length}-${selectedTopVertical.length + 2}。`,
      ],
      evidenceEn: [
        `The top max-vertical group is ${topVertical.map((row) => row.nameZh).join(", ")}; selected first-round players are ${selectedTopVertical.map((row) => `pick ${pickByKey.get(row.key)} ${row.nameZh}`).join(", ") || "none"}, point estimate ${selectedTopVertical.length}.`,
        `Tolerance strategy: submit ${strategic.topVertical}, covering ${selectedTopVertical.length}-${selectedTopVertical.length + 2}.`,
      ],
    },
    {
      id: "primary-centers-round-one",
      answer: strategic.primaryCenters,
      point: primaryCenters.length,
      type: "integer",
      tolerance: "±1",
      evidenceZh: [
        `按答题卡主位置口径，Codex LLM首轮中锋为${primaryCenters.map((row) => `第${row.pick}顺位${row.localNameZh}`).join("、")}，点估计${primaryCenters.length}人。`,
        `容错策略：提交值${strategic.primaryCenters}，覆盖${primaryCenters.length}-${primaryCenters.length + 2}；PF/C副位置仍有上浮空间。`,
      ],
      evidenceEn: [
        `Using answer-card primary position, the Codex LLM first-round centers are ${primaryCenters.map((row) => `pick ${row.pick} ${row.player}`).join(", ")}, point estimate ${primaryCenters.length}.`,
        `Tolerance strategy: submit ${strategic.primaryCenters}, covering ${primaryCenters.length}-${primaryCenters.length + 2}; PF/C secondary-position uncertainty remains upward.`,
      ],
    },
    {
      id: "first-center-pick-4-30",
      answer: strategic.firstCenter,
      point: strategic.firstCenter,
      type: "pick_number",
      tolerance: "±2",
      evidenceZh: [
        `Codex LLM最终板第4-30顺位中，第一个答题卡主位置中锋是第${strategic.firstCenter}顺位${firstCenterFrom4?.localNameZh}。`,
        `容错策略：提交值${strategic.firstCenter}，±2覆盖第${Number(strategic.firstCenter) - 2}-${Number(strategic.firstCenter) + 2}顺位。`,
      ],
      evidenceEn: [
        `On the Codex LLM final board, the first primary-position center from picks 4-30 is pick ${strategic.firstCenter} ${firstCenterFrom4?.player}.`,
        `Tolerance strategy: submit ${strategic.firstCenter}; ±2 covers picks ${Number(strategic.firstCenter) - 2}-${Number(strategic.firstCenter) + 2}.`,
      ],
    },
    {
      id: "international-count-round-one",
      answer: strategic.international,
      point: internationalRows.length,
      type: "integer",
      tolerance: "±1",
      evidenceZh: [
        `Codex LLM首轮国际球员为${internationalRows.map((row) => `第${row.pick}顺位${row.localNameZh}`).join("、")}，点估计${internationalRows.length}人。`,
        `容错策略：提交值${strategic.international}，覆盖${internationalRows.length}-${internationalRows.length + 2}；国际身份口径保留上行空间。`,
      ],
      evidenceEn: [
        `The Codex LLM first-round international players are ${internationalRows.map((row) => `pick ${row.pick} ${row.player}`).join(", ")}, point estimate ${internationalRows.length}.`,
        `Tolerance strategy: submit ${strategic.international}, covering ${internationalRows.length}-${internationalRows.length + 2}; international classification keeps upward uncertainty.`,
      ],
    },
    {
      id: "school-most",
      answer: strategic.school,
      point: schoolLeader?.[0] ?? strategic.school,
      type: "institution_name",
      tolerance: "exact option",
      evidenceZh: [
        `Codex LLM首轮中，密歇根大学有${schoolCounts.get("Michigan") ?? 0}名球员：${boardRows.filter((row) => row.school === "Michigan").map((row) => `第${row.pick}顺位${row.localNameZh}`).join("、")}。`,
        "机构名题无数值容错；提交答题卡下拉项：密歇根大学。",
      ],
      evidenceEn: [
        `Michigan has ${schoolCounts.get("Michigan") ?? 0} first-round players on the Codex LLM board: ${boardRows.filter((row) => row.school === "Michigan").map((row) => `pick ${row.pick} ${row.player}`).join(", ")}.`,
        "Institution-name answer has no numeric tolerance; submit the answer-card dropdown option for Michigan.",
      ],
    },
    {
      id: "hand-length-top-five-first-round",
      answer: strategic.topHand,
      point: selectedTopHand.length,
      type: "integer",
      tolerance: "0-5, ±1",
      evidenceZh: [
        `手掌长度前5含并列为${topHand.map((row) => row.nameZh).join("、")}；其中Codex LLM首轮球员为${selectedTopHand.map((row) => `第${pickByKey.get(row.key)}顺位${row.nameZh}`).join("、") || "无"}，点估计${selectedTopHand.length}人。`,
        `容错策略：提交值${strategic.topHand}，覆盖${selectedTopHand.length}-${selectedTopHand.length + 2}。`,
      ],
      evidenceEn: [
        `The top hand-length group is ${topHand.map((row) => row.nameZh).join(", ")}; Codex LLM first-rounders are ${selectedTopHand.map((row) => `pick ${pickByKey.get(row.key)} ${row.nameZh}`).join(", ") || "none"}, point estimate ${selectedTopHand.length}.`,
        `Tolerance strategy: submit ${strategic.topHand}, covering ${selectedTopHand.length}-${selectedTopHand.length + 2}.`,
      ],
    },
  ];

  const nextManifestMilestones = (manifest.milestones ?? []).map((definition) => {
    const row = answerRows.find((item) => item.id === definition.id);
    if (!row) return definition;
    const answer = String(row.answer);
    return {
      ...definition,
      confidence: previousAnswersById.get(row.id)?.confidence ?? definition.confidence,
      answer,
      answerI18n: {
        zh: answer,
        en: row.id === "school-most" ? "Michigan" : answer,
      },
      evidenceI18n: row.evidenceZh.map((zh, index) => ({
        zh,
        en: row.evidenceEn[index] ?? zh,
      })),
    };
  });

  const nextMilestoneAnswers = {
    ...previousMilestoneAnswers,
    schemaVersion: "draftops.milestone_answers.v1",
    generatedAt: new Date().toISOString(),
    sourceEvidence: "data/reports/codex_llm_final_frontend_sync_20260624.json",
    answers: answerRows.map((row) => ({
      id: row.id,
      question: definitionsById.get(row.id)?.prompt?.zh ?? previousAnswersById.get(row.id)?.question ?? row.id,
      answer: row.answer,
      type: row.type,
      tolerance: row.tolerance,
      evidence: row.evidenceZh,
      machinePointEstimate: row.point,
      toleranceStrategy: {
        applied: row.answer !== row.point,
        coveredTrueValues:
          typeof row.answer === "number" && Number.isFinite(row.answer)
            ? row.tolerance === "±2"
              ? [row.answer - 2, row.answer - 1, row.answer, row.answer + 1, row.answer + 2].filter((value) => value >= 0)
              : [row.answer - 1, row.answer, row.answer + 1].filter((value) => value >= 0)
            : [row.answer],
        reason: row.evidenceZh[1] ?? "Synced from Codex LLM final board.",
        sourceReport: "data/reports/codex_llm_final_frontend_sync_20260624.json",
      },
    })),
    revisionReports: [
      ...(previousMilestoneAnswers.revisionReports ?? []),
      "data/reports/codex_llm_final_frontend_sync_20260624.json",
    ],
  };

  return {
    manifestMilestones: nextManifestMilestones,
    milestoneAnswers: nextMilestoneAnswers,
    derived: {
      pointEstimates: Object.fromEntries(answerRows.map((row) => [row.id, row.point])),
      deployedAnswers: Object.fromEntries(answerRows.map((row) => [row.id, row.answer])),
      selectedTopVertical,
      selectedTopHand,
      longWingspan: longWingspan.map((row) => ({ pick: row.pick, player: row.player, wingspanDiff: row.wingspanDiff })),
      primaryCenters: primaryCenters.map((row) => ({ pick: row.pick, player: row.player })),
      internationalRows: internationalRows.map((row) => ({ pick: row.pick, player: row.player, origin: row.origin })),
    },
  };
};

const main = async () => {
  const [sourceBoard, bundle, previousFrontend, manifest, combine, previousMilestoneAnswers] = await Promise.all([
    readJson(paths.sourceBoard),
    readJson(paths.bundle),
    readJson(paths.frontendBoard),
    readJson(paths.manifest),
    readJson(paths.combine),
    readJson(paths.milestoneAnswers),
  ]);

  validateSourceBoard(sourceBoard);
  const { artifact, changedVsPrevious, missingMedia } = await buildFrontendBoard({ sourceBoard, bundle, previousFrontend });
  const milestoneSync = buildMilestones({
    boardRows: sourceBoard.boardRows,
    combine,
    manifest,
    previousMilestoneAnswers,
  });
  const nextManifest = {
    ...manifest,
    milestones: milestoneSync.manifestMilestones,
  };

  await Promise.all([
    writeJson(paths.frontendBoard, artifact),
    writeJson(paths.manifest, nextManifest),
    writeJson(paths.milestoneAnswers, milestoneSync.milestoneAnswers),
  ]);
  await mkdir(dirname(paths.reportJson), { recursive: true });
  const report = {
    generatedAt: artifact.generatedAt,
    sourceBoard: "data/boards/relative_scoring_prediction_codex_as_llm_20260624_031340.json",
    frontendBoard: "public/data/agent_expanded_recommended_board.json",
    manifest: "src/config/draftops-manifest.json",
    milestoneAnswers: "data/final/milestone_answers.json",
    boardHealth: artifact.health,
    changedVsPrevious,
    missingMedia,
    sourceValidation: sourceBoard.validation,
    guardrails: sourceBoard.guardrails,
    milestones: milestoneSync.derived,
  };
  await writeJson(paths.reportJson, report);
  await writeFile(
    paths.reportMd,
    [
      "# Codex LLM Final Frontend Sync",
      "",
      `Generated: ${artifact.generatedAt}`,
      "",
      "## Board",
      "",
      "- Source: `data/boards/relative_scoring_prediction_codex_as_llm_20260624_031340.json`",
      "- Frontend board: `public/data/agent_expanded_recommended_board.json`",
      `- Picks: ${artifact.summary.pickCount}`,
      `- Unique prospects: ${artifact.summary.uniqueProspects}`,
      `- Changed slots vs previous frontend board: ${changedVsPrevious.length}`,
      `- Local photos: ${artifact.summary.media.localPhotoCount}/30`,
      `- Missing photos: ${missingMedia.length}`,
      "",
      "## Milestones",
      "",
      ...Object.entries(milestoneSync.derived.deployedAnswers).map(
        ([id, value]) => `- ${id}: ${value} (point=${milestoneSync.derived.pointEstimates[id]})`,
      ),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        frontendBoard: paths.frontendBoard,
        manifest: paths.manifest,
        milestoneAnswersPath: paths.milestoneAnswers,
        report: paths.reportJson,
        picks: artifact.summary.pickCount,
        uniqueProspects: artifact.summary.uniqueProspects,
        changedVsPrevious: changedVsPrevious.length,
        localPhotos: `${artifact.summary.media.localPhotoCount}/30`,
        milestoneAnswers: milestoneSync.derived.deployedAnswers,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
