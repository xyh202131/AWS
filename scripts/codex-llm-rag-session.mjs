import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const runStamp = "20260623";
const cleanRagMode = process.argv.includes("--clean-rag") || process.env.DRAFTOPS_RAG_SCOPE === "clean";
const runSlug = cleanRagMode ? "codex_clean_rag_sequential_123_prediction" : "codex_llm_rag_sequential_123_prediction";
const stateSlug = cleanRagMode ? "codex_clean_rag_prediction" : "codex_llm_rag_prediction";
const statePath = resolve(rootDir, ".draftops-watch", `${stateSlug}_${runStamp}.state.json`);
const outputJsonPath = resolve(rootDir, "data", "boards", `${runSlug}_${runStamp}.json`);
const outputReportPath = resolve(rootDir, "data", "reports", `${runSlug}_${runStamp}.md`);

const paths = {
  localBundle: resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json"),
  teamPreference: resolve(rootDir, "data", "reports", "team_preference_research_20260623.json"),
  featureReference: resolve(rootDir, "data", "normalized", "normalized_2026_player_feature_reference_124.json"),
  currentBoard: resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json"),
  ragDir: resolve(rootDir, "data", "rag"),
};

const familyLabels = {
  guard: "guard",
  wing: "wing",
  frontcourt: "frontcourt",
  shooting: "shooting",
  creation: "creation",
  defense: "defense",
  size: "size",
  upside: "upside",
  feel: "feel",
  international: "international",
};

const tagAliases = {
  "alpha scorer": "creation",
  "wing creator": "creation",
  "shot creator": "creation",
  "self creation": "creation",
  "secondary creation": "creation",
  "secondary ball handling": "creation",
  "primary guard": "guard",
  "point guard": "guard",
  "lead guard": "guard",
  "combo guard": "guard",
  "big guard": "guard",
  shooter: "shooting",
  spacing: "shooting",
  "floor spacing": "shooting",
  "movement shooting": "shooting",
  "pull up shooting": "shooting",
  "pull-up shooting": "shooting",
  forward: "wing",
  "big wing": "wing",
  "physical wing": "wing",
  "3-and-D": "wing",
  big: "frontcourt",
  "center depth": "frontcourt",
  "frontcourt depth": "frontcourt",
  "frontcourt scoring": "frontcourt",
  "rim protection": "defense",
  "defensive size": "defense",
  "defensive playmaking": "defense",
  "team defense": "defense",
  "two-way": "defense",
  "two way": "defense",
  "star upside": "upside",
  "fan-facing upside": "upside",
  "fan facing upside": "upside",
  connector: "feel",
  toughness: "feel",
  maturity: "feel",
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
const round = (value, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};
const average = (values) => {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
};

const normalizeName = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeTag = (value) => {
  const clean = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return tagAliases[clean] ?? clean;
};

const signalSet = (values) => {
  const set = new Set();
  values.filter(Boolean).forEach((value) => {
    const clean = normalizeTag(value);
    if (familyLabels[clean]) set.add(clean);
    clean.split(" ").forEach((part) => {
      if (familyLabels[part]) set.add(part);
    });
    if (clean.includes("guard")) set.add("guard");
    if (clean.includes("wing")) set.add("wing");
    if (clean.includes("shoot")) set.add("shooting");
    if (clean.includes("defen")) set.add("defense");
    if (clean.includes("size")) set.add("size");
    if (clean.includes("upside")) set.add("upside");
    if (clean.includes("international")) set.add("international");
  });
  return set;
};

const intersect = (left, right) => [...left].filter((item) => right.has(item));

const cleanRagExcludedSource = (source) =>
  /(^|[\\/])public[\\/]data[\\/]agent_/i.test(source) ||
  /prediction|sequential|codex|deepseek|multi_agent|milestone|answer_card|main_parameter_board|simulation|prediction-reruns/i.test(source);

const loadRagChunks = async () => {
  const files = cleanRagMode
    ? ["rag-team-preference.json", "rag-prospect-evidence.json"]
    : [
        "rag-core-board.json",
        "rag-team-preference.json",
        "rag-prospect-evidence.json",
        "rag-milestone.json",
        "rag-architecture.json",
      ];
  const chunks = [];
  for (const file of files) {
    const path = resolve(paths.ragDir, file);
    if (!existsSync(path)) continue;
    const artifact = await readJson(path);
    for (const chunk of artifact.chunks ?? []) {
      if (cleanRagMode && cleanRagExcludedSource(String(chunk.source ?? ""))) continue;
      chunks.push({
        indexId: artifact.id,
        source: chunk.source,
        path: chunk.path,
        trustTier: chunk.sourceTrustTier,
        text: String(chunk.text ?? ""),
      });
    }
  }
  return chunks;
};

const loadContext = async () => {
  const [localBundle, teamPreference, featureReference, currentBoard, ragChunks] = await Promise.all([
    readJson(paths.localBundle),
    readJson(paths.teamPreference),
    readJson(paths.featureReference),
    readJson(paths.currentBoard),
    loadRagChunks(),
  ]);
  const prospectsById = new Map((localBundle.prospects ?? []).map((prospect) => [prospect.id, prospect]));
  const featureByOrdinal = new Map((featureReference.players ?? []).map((player) => [player.poolOrdinal, player]));
  const teamPreferenceByPick = new Map((teamPreference.entries ?? []).map((entry) => [Number(entry.pick), entry]));
  return { localBundle, teamPreference, featureReference, currentBoard, ragChunks, prospectsById, featureByOrdinal, teamPreferenceByPick };
};

const prospectFamilies = (prospect, feature) => {
  const families = new Set();
  const positions = prospect.positions ?? [];
  if (positions.some((position) => position === "PG" || position === "SG")) families.add("guard");
  if (positions.some((position) => position === "SF" || position === "PF")) families.add("wing");
  if (positions.some((position) => position === "PF" || position === "C")) families.add("frontcourt");
  if (positions.includes("C")) families.add("size");

  const profile = prospect.profile ?? {};
  if (profile.shooting >= 80) families.add("shooting");
  if (profile.creation >= 80) families.add("creation");
  if (profile.defense >= 80) families.add("defense");
  if (profile.size >= 82) families.add("size");
  if (profile.upside >= 84 || profile.athleticism >= 86) families.add("upside");
  if (profile.feel >= 82) families.add("feel");

  const derived = feature?.derived ?? {};
  if (derived.shootingDrillScore >= 70) families.add("shooting");
  if (derived.physicalToolsScore >= 72) {
    families.add("size");
    families.add("defense");
  }
  if (derived.explosivenessScore >= 75 || derived.agilitySpeedScore >= 75) families.add("upside");
  signalSet(prospect.roleTags ?? []).forEach((family) => families.add(family));
  if (prospect.international) families.add("international");
  return families;
};

const ragForProspect = (prospect, ragChunks) => {
  const terms = [
    normalizeName(prospect.name),
    String(prospect.localPool?.nameZh ?? "").trim().toLowerCase(),
    String(prospect.id ?? "").replace(/-/g, " ").toLowerCase(),
  ].filter((term) => term.length >= 3 || /[\u4e00-\u9fff]/.test(term));
  const trustWeights = { "locked-artifact": 4, "official-or-reverified": 3.5, "normalized-data": 2.5 };
  const matches = ragChunks
    .filter((chunk) => {
      const haystack = `${chunk.source}\n${chunk.path}\n${chunk.text}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    })
    .map((chunk) => ({ ...chunk, weight: trustWeights[chunk.trustTier] ?? 1 }))
    .sort((left, right) => right.weight - left.weight);
  return {
    matchCount: matches.length,
    trustWeight: round(matches.reduce((sum, match) => sum + match.weight, 0)),
    snippets: matches.slice(0, 4).map((match) => ({
      indexId: match.indexId,
      source: match.source,
      path: match.path,
      trustTier: match.trustTier,
      text: match.text.slice(0, 520),
    })),
  };
};

const ragForTeam = (team, ragChunks) => {
  const terms = [team.team, ...(team.needs ?? []), ...(team.priorityTags ?? [])]
    .map((term) => String(term ?? "").toLowerCase())
    .filter((term) => term.length > 3);
  return ragChunks
    .map((chunk) => {
      const haystack = `${chunk.source}\n${chunk.path}\n${chunk.text}`.toLowerCase();
      return {
        ...chunk,
        score: terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0),
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((chunk) => ({
      indexId: chunk.indexId,
      source: chunk.source,
      path: chunk.path,
      trustTier: chunk.trustTier,
      text: chunk.text.slice(0, 520),
    }));
};

const dynamicWeights = (team) => {
  const pick = Number(team.pick);
  const weights = { consensus: 28, need: 24, player: 18, upside: 13, feature: 8, source: 9 };
  if (pick <= 5) {
    weights.consensus += 4;
    weights.upside += 6;
    weights.need -= 3;
  } else if (pick <= 14) {
    weights.need += 4;
    weights.player += 2;
    weights.consensus -= 2;
  } else {
    weights.need += 7;
    weights.player += 3;
    weights.feature += 2;
    weights.consensus -= 5;
    weights.upside -= 3;
  }
  if (team.phase === "rebuild") {
    weights.upside += 4;
    weights.consensus += 2;
  } else if (team.phase === "contend") {
    weights.need += 4;
    weights.player += 4;
    weights.source += 2;
    weights.upside -= 4;
  } else if (team.phase === "asset") {
    weights.upside += 3;
    weights.source += 2;
  }
  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(1, value), 0);
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.max(1, value) / total]));
};

const scoreCandidate = ({ team, prospect, preferenceEntry, feature, rag, previousTeamSelections }) => {
  const pick = Number(team.pick);
  const rank = Number(prospect.consensusRank ?? 160);
  const families = prospectFamilies(prospect, feature);
  const preferenceFamilies = new Set((preferenceEntry?.preferenceFamilies ?? []).map(normalizeTag).filter((family) => familyLabels[family]));
  const teamSignals = signalSet([...(team.needs ?? []), ...(team.priorityTags ?? []), ...preferenceFamilies]);
  const overlapFamilies = intersect(families, teamSignals);
  const preferenceOverlap = intersect(families, preferenceFamilies);
  const coefficient = clamp(preferenceEntry?.needConfidenceCoefficient ?? 0.55, 0, 1);
  const profile = prospect.profile ?? {};
  const derived = feature?.derived ?? {};
  const reach = rank - pick;
  const fall = pick - rank;
  const consensus = clamp(100 - Math.abs(rank - pick) * 3.4 - (pick <= 14 && reach > 9 ? (reach - 9) * 0.9 : 0) + (pick >= 10 && fall > 7 ? Math.min(7, (fall - 7) * 0.8) : 0));
  const positionFit =
    (teamSignals.has("guard") && families.has("guard") ? 8 : 0) +
    (teamSignals.has("wing") && families.has("wing") ? 8 : 0) +
    ((teamSignals.has("frontcourt") || teamSignals.has("size")) && families.has("frontcourt") ? 8 : 0) +
    (teamSignals.has("international") && families.has("international") ? 4 : 0);
  const skillFit =
    (teamSignals.has("shooting") ? clamp((Math.max(profile.shooting ?? 0, derived.shootingDrillScore ?? 0) - 68) * 0.32, -3, 8) : 0) +
    (teamSignals.has("creation") ? clamp(((profile.creation ?? 0) - 68) * 0.32, -3, 8) : 0) +
    (teamSignals.has("defense") ? clamp((Math.max(profile.defense ?? 0, derived.physicalToolsScore ?? 0) - 68) * 0.28, -3, 8) : 0) +
    (teamSignals.has("size") ? clamp((Math.max(profile.size ?? 0, derived.physicalToolsScore ?? 0) - 70) * 0.28, -3, 8) : 0);
  const rawNeed = clamp(45 + overlapFamilies.length * 7 + (preferenceFamilies.size ? (preferenceOverlap.length / preferenceFamilies.size) * 20 : 0) + positionFit + skillFit);
  const need = clamp(50 + (rawNeed - 50) * (0.45 + coefficient * 0.55));
  const player = clamp(average([profile.shooting, profile.creation, profile.defense, profile.athleticism, profile.feel, profile.size]) * 0.62 + average([profile.shooting, profile.defense, profile.feel, profile.creation]) * 0.38);
  const age = Number.isFinite(Number(prospect.age)) ? Number(prospect.age) : 22;
  const upside = clamp((profile.upside ?? 60) + clamp((22.4 - age) * 3.1, -6, 10) + (Number(team.riskTolerance ?? 55) - 55) * 0.12);
  const featureScore = feature
    ? clamp(
        average([
          derived.referenceScore ?? 50,
          teamSignals.has("shooting") ? derived.shootingDrillScore ?? 50 : null,
          teamSignals.has("guard") ? derived.agilitySpeedScore ?? 50 : null,
          teamSignals.has("size") || teamSignals.has("frontcourt") ? derived.physicalToolsScore ?? 50 : null,
          teamSignals.has("upside") ? derived.explosivenessScore ?? 50 : null,
        ].filter((value) => value !== null)),
      )
    : 45;
  const source = clamp(43 + Math.min(18, (prospect.sourceNotes ?? []).length * 2.2) + Math.min(18, rag.trustWeight * 0.55) - (prospect.localPool?.matchStatus === "fallback-local-only" ? 10 : 0));
  const previousFamilies = new Set(previousTeamSelections.flatMap((selection) => selection.families ?? []));
  const sequencing = clamp(intersect(families, preferenceFamilies).filter((family) => !previousFamilies.has(family)).length * 1.2 - intersect(families, previousFamilies).length * 0.9, -4, 4);
  const risks = (prospect.risks ?? []).map((risk) => String(risk).toLowerCase());
  const riskPenalty = clamp(
    (prospect.localPool?.matchStatus === "fallback-local-only" ? (team.phase === "contend" ? 7 : 5) : 0) +
      (risks.some((risk) => risk.includes("medical") || risk.includes("health")) ? (team.phase === "contend" ? 10 : 6) : 0) +
      (risks.some((risk) => risk.includes("shoot")) && teamSignals.has("shooting") ? 5 : 0),
    0,
    18,
  );
  const pickValueAdjustment = clamp((pick >= 10 && fall >= 8 ? Math.min(7, (fall - 7) * 0.8) : 0) - (pick <= 14 && reach > 9 ? Math.min(6, (reach - 9) * 0.75) : 0), -9, 8);
  const weights = dynamicWeights(team);
  const weighted =
    consensus * weights.consensus +
    need * weights.need +
    player * weights.player +
    upside * weights.upside +
    featureScore * weights.feature +
    source * weights.source;
  const score = clamp(weighted + pickValueAdjustment + sequencing - riskPenalty);
  return {
    prospectId: prospect.id,
    name: prospect.name,
    localNameZh: prospect.localPool?.nameZh ?? null,
    localOrdinal: prospect.localPool?.ordinal ?? null,
    positions: prospect.positions ?? [],
    position: (prospect.positions ?? []).join("/"),
    school: prospect.school,
    origin: prospect.origin,
    classYear: prospect.classYear,
    international: Boolean(prospect.international),
    consensusRank: prospect.consensusRank,
    mockHeat: prospect.mockHeat,
    matchStatus: prospect.localPool?.matchStatus ?? "unknown",
    families: [...families].sort(),
    score: round(score),
    breakdown: { consensus: round(consensus), need: round(need), player: round(player), upside: round(upside), feature: round(featureScore), source: round(source) },
    adjustments: { pickValueAdjustment: round(pickValueAdjustment), sequencing: round(sequencing), riskPenalty: round(riskPenalty), positionFit: round(positionFit), skillFit: round(skillFit) },
    weights: Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, round(value, 4)])),
    overlapFamilies,
    preferenceFamilies: [...preferenceFamilies],
    preferenceOverlap,
    featureReference: feature?.derived
      ? {
          referenceScore: feature.derived.referenceScore ?? null,
          referenceTier: feature.derived.referenceTier ?? null,
          physicalToolsScore: feature.derived.physicalToolsScore ?? null,
          explosivenessScore: feature.derived.explosivenessScore ?? null,
          agilitySpeedScore: feature.derived.agilitySpeedScore ?? null,
          shootingDrillScore: feature.derived.shootingDrillScore ?? null,
          tags: feature.derived.tags ?? [],
        }
      : null,
    sourceEvidence: { sourceNotes: (prospect.sourceNotes ?? []).slice(0, 5), rag },
    risks: (prospect.risks ?? []).slice(0, 4),
    strengths: (prospect.strengths ?? []).slice(0, 4),
  };
};

const scoreCurrentPick = async (state, context) => {
  const pickIndex = state.boardRows.length;
  if (pickIndex >= 30) throw new Error("All 30 picks are already selected.");
  const team = context.localBundle.teams[pickIndex];
  const preferenceEntry = context.teamPreferenceByPick.get(Number(team.pick)) ?? null;
  const previousTeamSelections = state.boardRows
    .filter((row) => row.team === team.team)
    .map((row) => ({ pick: row.pick, prospectId: row.prospectId, name: row.player, families: row.families ?? [] }));
  const scored = state.remainingProspectIds
    .map((id) => {
      const prospect = context.prospectsById.get(id);
      const feature = context.featureByOrdinal.get(prospect.localPool?.ordinal);
      return scoreCandidate({
        team,
        prospect,
        preferenceEntry,
        feature,
        rag: ragForProspect(prospect, context.ragChunks),
        previousTeamSelections,
      });
    })
    .sort((left, right) => right.score - left.score || Number(left.consensusRank ?? 999) - Number(right.consensusRank ?? 999) || left.name.localeCompare(right.name))
    .map((candidate, index) => ({ ...candidate, rankWithinPick: index + 1 }));
  return {
    pick: Number(team.pick),
    team,
    preferenceEntry,
    previousTeamSelections,
    reviewedCandidates: scored.length,
    scored,
    teamRagSnippets: ragForTeam(team, context.ragChunks),
  };
};

const makeBoardRow = ({ packet, selected, runnerUp, note }) => ({
  pick: packet.pick,
  team: packet.team.team,
  acquiredFrom: packet.team.acquiredFrom ?? null,
  prospectId: selected.prospectId,
  player: selected.name,
  localNameZh: selected.localNameZh,
  localOrdinal: selected.localOrdinal,
  positions: selected.positions,
  position: selected.position,
  school: selected.school,
  origin: selected.origin,
  classYear: selected.classYear,
  international: selected.international,
  consensusRank: selected.consensusRank,
  mockHeat: selected.mockHeat,
  score: Math.round(selected.score),
  scoreExact: selected.score,
  confidence: Math.round(clamp(selected.score - Math.abs(Number(selected.consensusRank ?? 100) - packet.pick) * 0.45 + (runnerUp ? Math.min(8, (selected.score - runnerUp.score) * 1.5) : 8) - (selected.matchStatus === "fallback-local-only" ? 4 : 0))),
  margin: runnerUp ? round(selected.score - runnerUp.score) : null,
  reviewedCandidates: packet.reviewedCandidates,
  remainingBefore: packet.reviewedCandidates,
  remainingAfter: packet.reviewedCandidates - 1,
  families: selected.families,
  overlapFamilies: selected.overlapFamilies,
  breakdown: selected.breakdown,
  adjustments: selected.adjustments,
  codexLlmDecisionNote: note,
});

const compareWithCurrentBoard = (boardRows, currentBoard) => {
  const currentRows =
    currentBoard.boardRows ??
    (currentBoard.board ?? []).map((pick) => ({
      pick: pick.pick,
      player: pick.prospect?.name ?? pick.player,
      prospectId: pick.prospect?.id ?? pick.prospectId,
      localNameZh: pick.prospect?.localPool?.nameZh ?? pick.localNameZh,
    }));
  const currentByPick = new Map(currentRows.map((row) => [Number(row.pick), row]));
  return boardRows
    .filter((row) => currentByPick.get(Number(row.pick))?.prospectId !== row.prospectId)
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      currentPlayer: currentByPick.get(Number(row.pick))?.player ?? null,
      currentLocalNameZh: currentByPick.get(Number(row.pick))?.localNameZh ?? null,
      codexPlayer: row.player,
      codexLocalNameZh: row.localNameZh,
    }));
};

const makeReport = (artifact) => {
  const boardRows = artifact.boardRows.map(
    (row) => `| ${row.pick} | ${row.team} | ${row.player} | ${row.localNameZh ?? ""} | ${row.position} | ${row.consensusRank} | ${row.scoreExact} | ${row.confidence} | ${row.reviewedCandidates} |`,
  );
  const changedRows = artifact.changedVsCurrentBoard.map(
    (row) => `| ${row.pick} | ${row.team} | ${row.currentPlayer ?? ""} | ${row.currentLocalNameZh ?? ""} | ${row.codexPlayer} | ${row.codexLocalNameZh ?? ""} |`,
  );
  return [
    cleanRagMode
      ? "# Codex Clean-RAG Sequential 123-Player Prediction"
      : "# Codex LLM + RAG Sequential 123-Player Prediction",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Script: \`${artifact.generatedBy}\``,
    "",
    "## Method",
    "",
    cleanRagMode
      ? "- Current Codex LLM session made one decision per pick after reading generated local clean-RAG packets."
      : "- Current Codex LLM session made one decision per pick after reading the generated local tool/RAG packet.",
    "- The helper script did not contain a static pick list. It scored all remaining candidates, exposed the packet, validated the Codex-selected id, removed the selected player, and continued.",
    "- Candidate boundary: `data/final/local_pool_124_import_bundle.json`, validated as 123 unique candidates.",
    cleanRagMode
      ? "- Clean-RAG boundary: only `rag-team-preference.json` and `rag-prospect-evidence.json` were loaded, with prior prediction, milestone, answer-card, simulation, DeepSeek/Codex, and agent-board sources excluded."
      : "- Full-RAG boundary: all local RAG indexes were available to the packet generator.",
    "- `public/data` was read only to compute differences against the current frontend board.",
    "",
    "## Summary",
    "",
    `- Picks: ${artifact.summary.pickCount}`,
    `- Unique selected players: ${artifact.summary.uniqueSelectedProspects}`,
    `- Remaining prospects: ${artifact.summary.remainingProspects}`,
    `- Total candidate reviews: ${artifact.summary.totalCandidateReviews}`,
    `- Changed vs current frontend board: ${artifact.summary.changedVsCurrentBoardCount}`,
    "",
    "## Board",
    "",
    "| Pick | Team | Player | Local name | Pos | Rank | Score | Confidence | Reviewed |",
    "|---:|---|---|---|---|---:|---:|---:|---:|",
    ...boardRows,
    "",
    "## Changed Vs Current Frontend Board",
    "",
    artifact.changedVsCurrentBoard.length
      ? ["| Pick | Team | Current frontend | Current local name | Codex LLM rerun | Codex local name |", "|---:|---|---|---|---|---|", ...changedRows].join("\n")
      : "No selected-player slots changed.",
    "",
  ].join("\n");
};

const writeFinalArtifacts = async (state, context) => {
  const changedVsCurrentBoard = compareWithCurrentBoard(state.boardRows, context.currentBoard);
  const artifact = {
    schemaVersion: cleanRagMode
      ? "draftops.codex_clean_rag_sequential_123_prediction.v1"
      : "draftops.codex_llm_rag_sequential_123_prediction.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/codex-llm-rag-session.mjs",
    decisionMaker: cleanRagMode
      ? "current Codex LLM session using local clean-RAG packets"
      : "current Codex LLM session using local tool/RAG packets",
    inputFiles: [
      "data/final/local_pool_124_import_bundle.json",
      "data/reports/team_preference_research_20260623.json",
      "data/normalized/normalized_2026_player_feature_reference_124.json",
      cleanRagMode
        ? "data/rag/rag-team-preference.json and data/rag/rag-prospect-evidence.json only, with polluted sources filtered"
        : "data/rag/*.json",
      "public/data/agent_expanded_recommended_board.json (read-only comparison)",
    ],
    ragPolicy: cleanRagMode
      ? {
          mode: "clean-rag",
          includedIndexes: ["rag-team-preference.json", "rag-prospect-evidence.json"],
          excludedIndexes: ["rag-core-board.json", "rag-milestone.json", "rag-architecture.json"],
          excludedSourcePattern:
            "public/data/agent_*, prediction, sequential, codex, deepseek, multi_agent, milestone, answer_card, main_parameter_board, simulation, prediction-reruns",
        }
      : {
          mode: "full-rag",
          includedIndexes: ["rag-core-board.json", "rag-team-preference.json", "rag-prospect-evidence.json", "rag-milestone.json", "rag-architecture.json"],
        },
    guardrails: {
      noStaticPickListInScript: true,
      noManualFrontendMutation: true,
      candidateBoundary: "123 unique candidates from data/final/local_pool_124_import_bundle.json",
      sequentialRemoval: true,
      allRemainingCandidatesReviewedEachPick: true,
    },
    summary: {
      pickCount: state.boardRows.length,
      uniqueSelectedProspects: new Set(state.boardRows.map((row) => row.prospectId)).size,
      remainingProspects: state.remainingProspectIds.length,
      totalCandidateReviews: state.pickAudits.reduce((sum, pick) => sum + pick.reviewedCandidates, 0),
      changedVsCurrentBoardCount: changedVsCurrentBoard.length,
    },
    validation: {
      pickCountIs30: state.boardRows.length === 30,
      uniqueSelectedIs30: new Set(state.boardRows.map((row) => row.prospectId)).size === 30,
      remainingIs93: state.remainingProspectIds.length === 93,
      noDuplicateSelectedProspects: new Set(state.boardRows.map((row) => row.prospectId)).size === state.boardRows.length,
      reviewedAllRemainingEachPick: state.pickAudits.reduce((sum, pick) => sum + pick.reviewedCandidates, 0) === 3255,
      expectedReviewCount: 3255,
      actualReviewCount: state.pickAudits.reduce((sum, pick) => sum + pick.reviewedCandidates, 0),
    },
    boardRows: state.boardRows,
    changedVsCurrentBoard,
    pickAudits: state.pickAudits,
    remainingProspects: state.remainingProspectIds.map((id) => {
      const prospect = context.prospectsById.get(id);
      return {
        prospectId: prospect.id,
        name: prospect.name,
        localNameZh: prospect.localPool?.nameZh ?? null,
        consensusRank: prospect.consensusRank,
      };
    }),
  };
  await Promise.all([mkdir(dirname(outputJsonPath), { recursive: true }), mkdir(dirname(outputReportPath), { recursive: true })]);
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(outputReportPath, `${makeReport(artifact)}\n`, "utf8"),
  ]);
  return artifact;
};

const saveState = async (state) => {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const loadState = async () => readJson(statePath);

const init = async () => {
  const context = await loadContext();
  const prospects = context.localBundle.prospects ?? [];
  const ids = prospects.map((prospect) => prospect.id);
  if (prospects.length !== 123 || new Set(ids).size !== 123) {
    throw new Error(`Expected 123 unique candidates, got rows=${prospects.length}, unique=${new Set(ids).size}.`);
  }
  const state = {
    schemaVersion: "draftops.codex_llm_rag_session_state.v1",
    startedAt: new Date().toISOString(),
    runStamp,
    remainingProspectIds: [...ids].sort((left, right) => {
      const a = context.prospectsById.get(left);
      const b = context.prospectsById.get(right);
      return Number(a.consensusRank ?? 999) - Number(b.consensusRank ?? 999) || a.name.localeCompare(b.name);
    }),
    boardRows: [],
    pickAudits: [],
  };
  await saveState(state);
  console.log(JSON.stringify({ state: `.draftops-watch/${stateSlug}_${runStamp}.state.json`, candidates: prospects.length, unique: new Set(ids).size }, null, 2));
};

const packet = async () => {
  const [state, context] = await Promise.all([loadState(), loadContext()]);
  const packetData = await scoreCurrentPick(state, context);
  const compact = process.argv.includes("--compact");
  if (compact) {
    console.log(
      JSON.stringify(
        {
          progress: `pick ${packetData.pick}/30`,
          team: {
            pick: packetData.pick,
            name: packetData.team.team,
            phase: packetData.team.phase,
            needs: packetData.team.needs ?? [],
            priorityTags: packetData.team.priorityTags ?? [],
            riskTolerance: packetData.team.riskTolerance,
          },
          preference: packetData.preferenceEntry
            ? {
                needConfidenceCoefficient: packetData.preferenceEntry.needConfidenceCoefficient,
                preferenceFamilies: packetData.preferenceEntry.preferenceFamilies,
                sourceEvidenceNotes: packetData.preferenceEntry.sourceEvidenceNotes,
              }
            : null,
          reviewedCandidates: packetData.reviewedCandidates,
          previousTeamSelections: packetData.previousTeamSelections,
          topCandidates: packetData.scored.slice(0, 12).map((candidate) => ({
            rankWithinPick: candidate.rankWithinPick,
            prospectId: candidate.prospectId,
            name: candidate.name,
            localNameZh: candidate.localNameZh,
            position: candidate.position,
            consensusRank: candidate.consensusRank,
            score: candidate.score,
            breakdown: candidate.breakdown,
            overlapFamilies: candidate.overlapFamilies,
            preferenceOverlap: candidate.preferenceOverlap,
            featureReference: candidate.featureReference,
            ragMatchCount: candidate.sourceEvidence.rag.matchCount,
            ragTrustWeight: candidate.sourceEvidence.rag.trustWeight,
            risks: candidate.risks,
            strengths: candidate.strengths,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(
    JSON.stringify(
      {
        progress: `pick ${packetData.pick}/30`,
        team: {
          pick: packetData.pick,
          name: packetData.team.team,
          phase: packetData.team.phase,
          needs: packetData.team.needs ?? [],
          priorityTags: packetData.team.priorityTags ?? [],
          riskTolerance: packetData.team.riskTolerance,
        },
        preference: packetData.preferenceEntry
          ? {
              needConfidenceCoefficient: packetData.preferenceEntry.needConfidenceCoefficient,
              preferenceFamilies: packetData.preferenceEntry.preferenceFamilies,
              sourceEvidenceNotes: packetData.preferenceEntry.sourceEvidenceNotes,
            }
          : null,
        reviewedCandidates: packetData.reviewedCandidates,
        previousTeamSelections: packetData.previousTeamSelections,
        teamRagSnippets: packetData.teamRagSnippets,
        topCandidates: packetData.scored.slice(0, 12),
      },
      null,
      2,
    ),
  );
};

const select = async () => {
  const idIndex = process.argv.indexOf("--id");
  const noteIndex = process.argv.indexOf("--note");
  const selectedId = idIndex >= 0 ? process.argv[idIndex + 1] : "";
  const note = noteIndex >= 0 ? process.argv[noteIndex + 1] : "";
  if (!selectedId) throw new Error("select requires --id <prospectId>.");

  const [state, context] = await Promise.all([loadState(), loadContext()]);
  const packetData = await scoreCurrentPick(state, context);
  const selected = packetData.scored.find((candidate) => candidate.prospectId === selectedId);
  if (!selected) throw new Error(`Selected id is not in remaining pool for pick ${packetData.pick}: ${selectedId}`);
  const runnerUp = packetData.scored.find((candidate) => candidate.prospectId !== selectedId) ?? null;
  const boardRow = makeBoardRow({ packet: packetData, selected, runnerUp, note });
  state.boardRows.push(boardRow);
  state.pickAudits.push({
    pick: packetData.pick,
    team: packetData.team.team,
    reviewedCandidates: packetData.reviewedCandidates,
    remainingBefore: packetData.reviewedCandidates,
    remainingAfter: packetData.reviewedCandidates - 1,
    selected,
    runnerUp,
    topCandidates: packetData.scored.slice(0, 12),
    teamRagSnippets: packetData.teamRagSnippets,
    codexLlmDecisionNote: note,
    noStaticPickList: true,
  });
  state.remainingProspectIds = state.remainingProspectIds.filter((id) => id !== selectedId);
  await saveState(state);
  let artifact = null;
  if (state.boardRows.length === 30) artifact = await writeFinalArtifacts(state, context);
  console.log(
    JSON.stringify(
      {
        progress: `pick ${packetData.pick}/30`,
        selected: selected.name,
        selectedId,
        reviewedCandidates: packetData.reviewedCandidates,
        remaining: state.remainingProspectIds.length,
        finalized: Boolean(artifact),
        output: artifact
          ? [
              `data/boards/${runSlug}_${runStamp}.json`,
              `data/reports/${runSlug}_${runStamp}.md`,
            ]
          : null,
      },
      null,
      2,
    ),
  );
};

const status = async () => {
  const state = await loadState();
  console.log(JSON.stringify({ picks: state.boardRows.length, remaining: state.remainingProspectIds.length, nextPick: state.boardRows.length + 1 }, null, 2));
};

const command = process.argv[2];
if (command === "init") init().catch((error) => {
  console.error(error);
  process.exit(1);
});
else if (command === "packet") packet().catch((error) => {
  console.error(error);
  process.exit(1);
});
else if (command === "select") select().catch((error) => {
  console.error(error);
  process.exit(1);
});
else if (command === "status") status().catch((error) => {
  console.error(error);
  process.exit(1);
});
else {
  console.error("Usage: node scripts/codex-llm-rag-session.mjs <init|packet|select|status> [--clean-rag]");
  process.exit(1);
}
