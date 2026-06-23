import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const localEnvPath = resolve(rootDir, ".env.local");
const envPath = resolve(rootDir, ".env");
const localBundlePath = resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json");
const teamPreferencePath = resolve(rootDir, "data", "reports", "team_preference_research_20260623.json");
const featureReferencePath = resolve(rootDir, "data", "normalized", "normalized_2026_player_feature_reference_124.json");
const currentBoardPath = resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json");
const ragDir = resolve(rootDir, "data", "rag");
const outputJsonPath = resolve(rootDir, "data", "boards", `deepseek_agentic_tool_123_prediction_${stamp}.json`);
const outputReportPath = resolve(rootDir, "data", "reports", `deepseek_agentic_tool_123_prediction_${stamp}.md`);
const checkpointPath = resolve(rootDir, ".draftops-watch", `deepseek_agentic_tool_123_prediction_${stamp}.checkpoint.json`);

const loadEnvFile = async (path) => {
  const content = await readFile(path, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readJsonIfExists = async (path) => {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value ?? 0)));
const round = (value, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round(Number(value ?? 0) * factor) / factor;
};

const normalizeModelId = (value) => String(value ?? "").replace(/\s*\[1M\]\s*$/i, "").trim();
const getModelLabel = (model) => process.env.DEEPSEEK_MODEL_LABEL?.trim() || (/\[1M\]$/i.test(model) ? model : `${model}[1m]`);

const normalizeText = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
const normalizeTag = (value) => normalizeText(value).replace(/\s+/g, " ");
const tokenize = (value) => {
  const normalized = String(value ?? "").toLowerCase();
  const ascii = normalized.match(/[a-z0-9][a-z0-9.'-]{1,}/g) ?? [];
  const cjkSequences = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const cjkTerms = cjkSequences.flatMap((sequence) => {
    const terms = [sequence];
    for (const size of [2, 3, 4, 5, 6]) {
      for (let index = 0; index <= sequence.length - size; index += 1) terms.push(sequence.slice(index, index + size));
    }
    return terms;
  });
  return [...new Set([...ascii, ...cjkTerms].filter((term) => term.length >= 2))].slice(0, 80);
};

const extractJson = (content) => {
  try {
    return JSON.parse(content);
  } catch {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(content.slice(start, end + 1));
    throw new Error("DeepSeek response was not valid JSON.");
  }
};

const positionFamilies = (positions = []) => {
  const families = new Set();
  if (positions.some((position) => ["PG", "SG"].includes(position))) families.add("guard");
  if (positions.some((position) => ["SF", "PF"].includes(position))) families.add("wing");
  if (positions.some((position) => ["PF", "C"].includes(position))) families.add("frontcourt");
  if (positions.includes("C")) families.add("center");
  return families;
};

const signalFamilies = (values = []) => {
  const joined = normalizeTag(values.join(" "));
  const families = new Set();
  if (/guard|handler|playmak|creator|combo|后卫|持球/.test(joined)) families.add("guard");
  if (/wing|forward|3 and d|3-and-d|锋|侧翼/.test(joined)) families.add("wing");
  if (/frontcourt|center|rim|rebound|big|内线|中锋|护框/.test(joined)) families.add("frontcourt");
  if (/shoot|spacing|shooter|投|空间/.test(joined)) families.add("shooting");
  if (/defen|rim protect|防守|护框/.test(joined)) families.add("defense");
  if (/upside|ceiling|star|asset|上限/.test(joined)) families.add("upside");
  if (/feel|connector|decision|maturity|球商|成熟/.test(joined)) families.add("feel");
  if (/international|stash|国际/.test(joined)) families.add("international");
  return families;
};

const buildFeatureByOrdinal = (featureReference) => new Map((featureReference.players ?? []).map((player) => [player.poolOrdinal, player]));
const teamPreferenceForPick = (teamPreference, pick) => (teamPreference.entries ?? []).find((entry) => Number(entry.pick) === Number(pick)) ?? null;

const featureSummary = (feature) =>
  feature
    ? {
        referenceScore: feature.derived?.referenceScore ?? null,
        referenceTier: feature.derived?.referenceTier ?? null,
        physicalToolsScore: feature.derived?.physicalToolsScore ?? null,
        explosivenessScore: feature.derived?.explosivenessScore ?? null,
        agilitySpeedScore: feature.derived?.agilitySpeedScore ?? null,
        shootingDrillScore: feature.derived?.shootingDrillScore ?? null,
        tags: feature.derived?.tags ?? [],
      }
    : null;

const consensusScore = (pick, prospect) => clamp(100 - Math.abs(Number(prospect.consensusRank ?? 99) - pick) * 4.7);
const profileAverage = (profile = {}) => {
  const values = ["shooting", "creation", "defense", "athleticism", "feel", "size", "upside"]
    .map((key) => Number(profile[key]))
    .filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 55;
};

const scoreCandidate = ({ team, prospect, feature, preferenceEntry, previousTeamSelections }) => {
  const teamSignals = signalFamilies([...(team.needs ?? []), ...(team.priorityTags ?? []), ...(preferenceEntry?.preferenceFamilies ?? [])]);
  const prospectSignals = new Set([
    ...positionFamilies(prospect.positions ?? []),
    ...signalFamilies([...(prospect.roleTags ?? []), ...(prospect.strengths ?? []), ...(feature?.derived?.tags ?? [])]),
    ...(prospect.international ? ["international"] : []),
  ]);
  let overlap = 0;
  for (const signal of teamSignals) if (prospectSignals.has(signal)) overlap += 1;
  const needScore = clamp(46 + overlap * 9 + (positionFamilies(prospect.positions ?? []).size ? 2 : 0));
  const playerScore = profileAverage(prospect.profile);
  const featureScore = Number(feature?.derived?.referenceScore ?? 55);
  const upsideScore = Number(prospect.profile?.upside ?? 55);
  const intelScore = clamp(Number(prospect.mockHeat ?? 35) + Math.min(6, (prospect.sourceNotes ?? []).length * 1.2));
  const pickValue = clamp(50 + (team.pick - Number(prospect.consensusRank ?? team.pick)) * 1.8, 25, 75);
  const sameTeamFamilies = new Set(previousTeamSelections.flatMap((item) => [...positionFamilies(item.positions ?? [])]));
  const sequencingPenalty = [...positionFamilies(prospect.positions ?? [])].some((family) => sameTeamFamilies.has(family)) ? -1.2 : 0.8;
  const riskPenalty = (prospect.risks ?? []).some((risk) => /fallback|medical|health|injury/i.test(risk)) ? 3.5 : 0;
  const phaseWeights =
    team.phase === "contend"
      ? { consensus: 0.25, need: 0.26, player: 0.2, feature: 0.14, upside: 0.05, intel: 0.1 }
      : team.phase === "rebuild"
        ? { consensus: 0.31, need: 0.16, player: 0.15, feature: 0.09, upside: 0.19, intel: 0.1 }
        : { consensus: 0.29, need: 0.22, player: 0.17, feature: 0.1, upside: 0.12, intel: 0.1 };
  const finalScore =
    consensusScore(team.pick, prospect) * phaseWeights.consensus +
    needScore * phaseWeights.need +
    playerScore * phaseWeights.player +
    featureScore * phaseWeights.feature +
    upsideScore * phaseWeights.upside +
    intelScore * phaseWeights.intel +
    (pickValue - 50) * 0.16 +
    sequencingPenalty -
    riskPenalty;

  return {
    prospectId: prospect.id,
    name: prospect.name,
    localNameZh: prospect.localPool?.nameZh ?? null,
    localOrdinal: prospect.localPool?.ordinal ?? null,
    positions: prospect.positions ?? [],
    school: prospect.school,
    origin: prospect.origin,
    classYear: prospect.classYear,
    consensusRank: prospect.consensusRank,
    international: Boolean(prospect.international),
    finalScore: round(clamp(finalScore), 3),
    components: {
      consensus: round(consensusScore(team.pick, prospect), 2),
      need: round(needScore, 2),
      player: round(playerScore, 2),
      feature: round(featureScore, 2),
      upside: round(upsideScore, 2),
      intel: round(intelScore, 2),
      pickValue: round(pickValue, 2),
      sequencing: round(sequencingPenalty, 2),
      riskPenalty: round(riskPenalty, 2),
    },
    fitSignals: {
      teamFamilies: [...teamSignals],
      prospectFamilies: [...prospectSignals],
      overlapFamilies: [...teamSignals].filter((signal) => prospectSignals.has(signal)),
    },
    profile: prospect.profile,
    roleTags: prospect.roleTags ?? [],
    strengths: (prospect.strengths ?? []).slice(0, 4),
    risks: (prospect.risks ?? []).slice(0, 4),
    sourceNotes: (prospect.sourceNotes ?? []).slice(0, 4),
    featureReference: featureSummary(feature),
  };
};

const analyzePickCandidates = ({ team, remainingCandidates, featureByOrdinal, preferenceEntry, previousTeamSelections }) => {
  const scored = remainingCandidates
    .map((prospect) =>
      scoreCandidate({
        team,
        prospect,
        feature: featureByOrdinal.get(prospect.localPool?.ordinal),
        preferenceEntry,
        previousTeamSelections,
      }),
    )
    .sort((left, right) => right.finalScore - left.finalScore || Number(left.consensusRank ?? 999) - Number(right.consensusRank ?? 999));
  return {
    toolName: "analyze_pick_candidates",
    reviewedCandidateCount: remainingCandidates.length,
    shortlistPolicy: "DeepSeek may only select from toolShortlist prospectIds.",
    toolShortlist: scored.slice(0, 12),
    allScores: scored,
    topScore: scored[0]?.finalScore ?? null,
    scoreSpreadTop12: scored.length > 1 ? round((scored[0]?.finalScore ?? 0) - (scored[11]?.finalScore ?? scored.at(-1)?.finalScore ?? 0), 3) : null,
  };
};

const loadRagChunks = async () => {
  const chunks = [];
  for (const file of ["rag-core-board.json", "rag-team-preference.json", "rag-prospect-evidence.json", "rag-milestone.json", "rag-architecture.json"]) {
    const path = resolve(ragDir, file);
    if (!existsSync(path)) continue;
    const artifact = await readJson(path);
    for (const chunk of artifact.chunks ?? []) {
      chunks.push({
        indexId: artifact.id,
        source: chunk.source,
        path: chunk.path,
        sourceTrustTier: chunk.sourceTrustTier,
        cleaningStatus: chunk.cleaningStatus,
        text: String(chunk.text ?? "").slice(0, 1200),
      });
    }
  }
  return chunks;
};

const retrieveCleanRag = ({ ragChunks, team, shortlist }) => {
  const terms = tokenize([
    team.pick,
    team.team,
    team.phase,
    team.acquiredFrom,
    ...(team.needs ?? []),
    ...(team.priorityTags ?? []),
    ...shortlist.flatMap((candidate) => [candidate.name, candidate.localNameZh, candidate.school, candidate.origin, ...(candidate.roleTags ?? [])]),
  ].join(" "));
  const snippets = ragChunks
    .map((chunk) => {
      const text = [chunk.indexId, chunk.source, chunk.path, chunk.text].join("\n").toLowerCase();
      const exactMatches = terms.reduce((sum, term) => sum + (text.includes(term.toLowerCase()) ? 1 : 0), 0);
      const trustBoost =
        chunk.sourceTrustTier === "locked-artifact"
          ? 4
          : chunk.sourceTrustTier === "official-or-reverified"
            ? 3
            : chunk.sourceTrustTier === "normalized-data"
              ? 2
              : 0;
      return { ...chunk, score: exactMatches + trustBoost, exactMatches };
    })
    .filter((chunk) => chunk.score > 0 && chunk.cleaningStatus === "cleaned")
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map((chunk) => ({
      indexId: chunk.indexId,
      source: chunk.source,
      path: chunk.path,
      trustTier: chunk.sourceTrustTier,
      exactMatches: chunk.exactMatches,
      text: String(chunk.text ?? "").slice(0, 850),
    }));
  return {
    toolName: "retrieve_clean_rag",
    queryTerms: terms.slice(0, 28),
    snippetCount: snippets.length,
    snippets,
  };
};

const buildDeepSeekPrompt = ({ team, preferenceEntry, boardSoFar, previousTeamSelections, analysis, ragResult, compactMode = false }) => [
  "你是 DraftOps 第三轮预测中的 DeepSeek LLM 决策器。",
  "你不是数据工具。数据分析和 RAG 检索已经由外部工具执行；你只能基于 toolResults 做最终选择。",
  "硬性规则：selectedProspectId 必须来自 toolResults.analysis.toolShortlist；禁止选择 shortlist 外球员；禁止使用模型记忆补事实；禁止编造来源、球队偏好、学校偏好或体测。",
  "如果证据弱，也必须从 shortlist 中选择最稳妥候选，并降低 confidence。",
  "返回严格 JSON，不要 Markdown，不要代码块，不要密钥。",
  "JSON schema:",
  JSON.stringify({
    pick: "number",
    team: "string",
    selectedProspectId: "string",
    selectedName: "string",
    confidence: "number 0-100",
    decisionBasis: "string",
    toolUseAcknowledgement: {
      usedCandidateAnalysis: true,
      usedCleanRag: true,
      selectedFromShortlistOnly: true,
    },
    antiHallucinationCheck: {
      unsupportedClaims: "string",
      schoolInstitutionSignal: "none-data-backed | data-backed",
      evidenceWeakness: "string",
    },
    topCandidateReview: [
      {
        prospectId: "string",
        name: "string",
        keepOrReject: "keep | reject",
        reason: "string",
      },
    ],
    noManualPredictionConfirmation: true,
  }),
  "Input:",
  JSON.stringify({
    pick: team.pick,
    team: {
      name: team.team,
      acquiredFrom: team.acquiredFrom ?? null,
      phase: team.phase,
      needs: team.needs ?? [],
      priorityTags: team.priorityTags ?? [],
      riskTolerance: team.riskTolerance,
      notes: team.notes ?? "",
    },
    teamPreferenceEntry: preferenceEntry,
    boardSoFar,
    previousTeamSelections,
    toolResults: {
      analysis: compactMode
        ? {
            toolName: analysis.toolName,
            reviewedCandidateCount: analysis.reviewedCandidateCount,
            shortlistPolicy: analysis.shortlistPolicy,
            toolShortlist: analysis.toolShortlist.map((candidate) => ({
              prospectId: candidate.prospectId,
              name: candidate.name,
              finalScore: candidate.finalScore,
              positions: candidate.positions,
              consensusRank: candidate.consensusRank,
              overlapFamilies: candidate.fitSignals?.overlapFamilies ?? [],
              mainRisks: candidate.risks,
            })),
          }
        : {
            ...analysis,
            allScores: undefined,
          },
      cleanRag: compactMode
        ? {
            toolName: ragResult.toolName,
            snippetCount: ragResult.snippetCount,
            snippets: ragResult.snippets.slice(0, 4).map((snippet) => ({
              indexId: snippet.indexId,
              trustTier: snippet.trustTier,
              text: String(snippet.text ?? "").slice(0, 360),
            })),
          }
        : ragResult,
    },
  }),
].join("\n\n");

const callDeepSeek = async ({ prompt, pick, retry = 0 }) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY.");
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Return only valid JSON. Select only from supplied shortlist. Never reveal secrets." },
        { role: "user", content: retry ? `${prompt}\n\nRETRY ${retry}: previous output failed validation. Return valid JSON only.` : prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: Number(process.env.DEEPSEEK_AGENTIC_MAX_TOKENS ?? "3600"),
      temperature: 0.08,
      stream: false,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`DeepSeek request failed at pick ${pick}: ${response.status} ${response.statusText} ${text.slice(0, 300)}`);
  const completion = JSON.parse(text);
  const content = completion.choices?.[0]?.message?.content ?? "";
  let parsed = null;
  let parseError = "";
  try {
    parsed = extractJson(content);
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }
  return {
    model,
    modelLabel: getModelLabel(model),
    usage: completion.usage ?? null,
    finishReason: completion.choices?.[0]?.finish_reason ?? null,
    parsed,
    parseError,
  };
};

const validateDecision = ({ parsed, team, shortlist }) => {
  if (!parsed || typeof parsed !== "object") return "invalid JSON object";
  if (Number(parsed.pick) !== Number(team.pick)) return `pick mismatch: ${parsed.pick}`;
  if (parsed.noManualPredictionConfirmation !== true) return "missing noManualPredictionConfirmation";
  if (parsed.toolUseAcknowledgement?.usedCandidateAnalysis !== true) return "missing candidate-analysis acknowledgement";
  if (parsed.toolUseAcknowledgement?.usedCleanRag !== true) return "missing RAG acknowledgement";
  if (parsed.toolUseAcknowledgement?.selectedFromShortlistOnly !== true) return "missing shortlist-only acknowledgement";
  const selectedId = String(parsed.selectedProspectId ?? "");
  if (!shortlist.some((candidate) => candidate.prospectId === selectedId)) return `selected outside shortlist: ${selectedId}`;
  return "";
};

const decideWithDeepSeek = async ({ team, prompt, compactPrompt, shortlist }) => {
  let lastError = "";
  for (let retry = 0; retry < 5; retry += 1) {
    try {
      const activePrompt = retry >= 3 && compactPrompt ? compactPrompt : prompt;
      const result = await callDeepSeek({ prompt: activePrompt, pick: team.pick, retry });
      const validationError = result.parseError || validateDecision({ parsed: result.parsed, team, shortlist });
      if (!validationError) return result;
      lastError = validationError;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000 * Math.min(retry + 1, 3));
  }
  throw new Error(`DeepSeek decision failed validation at pick ${team.pick}: ${lastError}`);
};

const currentBoardRows = (currentBoard) =>
  currentBoard.boardRows ?? (currentBoard.board ?? []).map((pick) => ({
    pick: pick.pick,
    player: pick.prospect?.name ?? pick.player,
    prospectId: pick.prospect?.id ?? pick.prospectId,
  }));

const makeReport = (artifact) => [
  "# DeepSeek Agentic Tool Third-Round Prediction",
  "",
  `Generated: ${artifact.generatedAt}`,
  `Model: ${artifact.modelLabel}`,
  "",
  "## Summary",
  "",
  `- Picks: ${artifact.summary.pickCount}`,
  `- Unique selected players: ${artifact.summary.uniqueSelectedProspects}`,
  `- Total candidate scans: ${artifact.summary.totalCandidateScans}`,
  `- RAG snippets used: ${artifact.summary.totalRagSnippets}`,
  `- Changed vs current frontend board: ${artifact.summary.changedVsCurrentBoardCount}`,
  `- Average confidence: ${artifact.summary.averageConfidence}`,
  "",
  "## Board",
  "",
  "| Pick | Team | Player | Local name | Score | Confidence | Tool reviewed | RAG snippets |",
  "|---:|---|---|---|---:|---:|---:|---:|",
  ...artifact.boardRows.map(
    (row) =>
      `| ${row.pick} | ${row.team} | ${row.player} | ${row.localNameZh ?? ""} | ${row.toolScore} | ${row.confidence} | ${row.reviewedCandidateCount} | ${row.ragSnippetCount} |`,
  ),
  "",
  "## Changed Vs Current Frontend Board",
  "",
  artifact.changedVsCurrentBoard.length
    ? [
        "| Pick | Team | Current | Third round |",
        "|---:|---|---|---|",
        ...artifact.changedVsCurrentBoard.map((row) => `| ${row.pick} | ${row.team} | ${row.previous ?? ""} | ${row.next} |`),
      ].join("\n")
    : "No pick changed.",
  "",
].join("\n");

const run = async () => {
  await loadEnvFile(localEnvPath);
  await loadEnvFile(envPath);
  const [localBundle, teamPreference, featureReference, currentBoard, ragChunks] = await Promise.all([
    readJson(localBundlePath),
    readJson(teamPreferencePath),
    readJson(featureReferencePath),
    readJson(currentBoardPath),
    loadRagChunks(),
  ]);
  const teams = [...(localBundle.teams ?? [])].sort((left, right) => Number(left.pick) - Number(right.pick)).slice(0, 30);
  const remaining = [...(localBundle.prospects ?? [])].sort(
    (left, right) => Number(left.consensusRank ?? 999) - Number(right.consensusRank ?? 999) || left.name.localeCompare(right.name),
  );
  const featureByOrdinal = buildFeatureByOrdinal(featureReference);
  const boardRows = [];
  const pickAudits = [];
  const teamHistory = new Map();
  let model = "";
  let modelLabel = "";
  let promptTokens = 0;
  let completionTokens = 0;
  const resume = process.argv.includes("--resume");

  if (new Set(remaining.map((prospect) => prospect.id)).size !== remaining.length) {
    throw new Error(`Candidate pool has duplicate ids: ${remaining.length}`);
  }

  const checkpoint = resume ? await readJsonIfExists(checkpointPath) : null;
  if (checkpoint?.boardRows?.length) {
    const selectedIds = new Set(checkpoint.boardRows.map((row) => row.prospectId));
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (selectedIds.has(remaining[index].id)) remaining.splice(index, 1);
    }
    boardRows.push(...checkpoint.boardRows);
    pickAudits.push(...(checkpoint.pickAudits ?? []));
    model = checkpoint.model ?? model;
    modelLabel = checkpoint.modelLabel ?? modelLabel;
    promptTokens = Number(checkpoint.promptTokens ?? 0);
    completionTokens = Number(checkpoint.completionTokens ?? 0);
    for (const row of boardRows) {
      const previous = teamHistory.get(row.team) ?? [];
      teamHistory.set(row.team, [
        ...previous,
        { pick: row.pick, prospectId: row.prospectId, name: row.player, positions: row.positions ?? [] },
      ]);
    }
    console.log(`Resumed DeepSeek-agentic checkpoint at ${boardRows.length}/30 picks`);
  }

  for (const team of teams) {
    if (boardRows.some((row) => Number(row.pick) === Number(team.pick))) continue;
    const previousTeamSelections = teamHistory.get(team.team) ?? [];
    const preferenceEntry = teamPreferenceForPick(teamPreference, team.pick);
    const analysis = analyzePickCandidates({ team, remainingCandidates: remaining, featureByOrdinal, preferenceEntry, previousTeamSelections });
    const ragResult = retrieveCleanRag({ ragChunks, team, shortlist: analysis.toolShortlist });
    const prompt = buildDeepSeekPrompt({
      team,
      preferenceEntry,
      boardSoFar: boardRows.map((row) => ({ pick: row.pick, team: row.team, player: row.player, positions: row.positions })),
      previousTeamSelections,
      analysis,
      ragResult,
    });
    const compactPrompt = buildDeepSeekPrompt({
      team,
      preferenceEntry,
      boardSoFar: boardRows.map((row) => ({ pick: row.pick, team: row.team, player: row.player, positions: row.positions })),
      previousTeamSelections,
      analysis,
      ragResult,
      compactMode: true,
    });
    const decision = await decideWithDeepSeek({ team, prompt, compactPrompt, shortlist: analysis.toolShortlist });
    model = decision.model;
    modelLabel = decision.modelLabel;
    promptTokens += Number(decision.usage?.prompt_tokens ?? 0);
    completionTokens += Number(decision.usage?.completion_tokens ?? 0);
    const selectedAnalysis = analysis.toolShortlist.find((candidate) => candidate.prospectId === decision.parsed.selectedProspectId);
    const selectedIndex = remaining.findIndex((prospect) => prospect.id === decision.parsed.selectedProspectId);
    const selected = remaining[selectedIndex];
    remaining.splice(selectedIndex, 1);
    const boardRow = {
      pick: team.pick,
      team: team.team,
      acquiredFrom: team.acquiredFrom ?? null,
      prospectId: selected.id,
      player: selected.name,
      localNameZh: selected.localPool?.nameZh ?? null,
      localOrdinal: selected.localPool?.ordinal ?? null,
      positions: selected.positions ?? [],
      position: (selected.positions ?? []).join("/"),
      school: selected.school,
      origin: selected.origin,
      classYear: selected.classYear,
      international: Boolean(selected.international),
      consensusRank: selected.consensusRank,
      toolScore: selectedAnalysis.finalScore,
      confidence: Math.round(Number(decision.parsed.confidence ?? 0)),
      decisionBasis: decision.parsed.decisionBasis,
      reviewedCandidateCount: analysis.reviewedCandidateCount,
      ragSnippetCount: ragResult.snippetCount,
      remainingAfter: remaining.length,
    };
    boardRows.push(boardRow);
    pickAudits.push({
      pick: team.pick,
      team: team.team,
      toolTrace: [
        { tool: "load_remaining_candidates", candidateCount: analysis.reviewedCandidateCount },
        {
          tool: "analyze_pick_candidates",
          reviewed: analysis.reviewedCandidateCount,
          allScores: analysis.allScores.length,
          shortlistCount: analysis.toolShortlist.length,
        },
        { tool: "retrieve_clean_rag", snippetCount: ragResult.snippetCount },
        { tool: "deepseek_llm_decision", selectedProspectId: decision.parsed.selectedProspectId },
        { tool: "validate_shortlist_only", passed: true },
        { tool: "sequential_remove_selected", remainingAfter: remaining.length },
      ],
      analysis,
      ragResult,
      decision: decision.parsed,
      usage: decision.usage,
      finishReason: decision.finishReason,
      noManualOverride: true,
    });
    teamHistory.set(team.team, [
      ...previousTeamSelections,
      { pick: team.pick, prospectId: selected.id, name: selected.name, positions: selected.positions ?? [] },
    ]);
    await mkdir(dirname(checkpointPath), { recursive: true });
    await writeFile(checkpointPath, `${JSON.stringify({ boardRows, pickAudits, model, modelLabel, promptTokens, completionTokens }, null, 2)}\n`);
    console.log(`DeepSeek-agentic pick ${team.pick}/30: ${team.team} -> ${selected.name} (toolScore=${selectedAnalysis.finalScore})`);
  }

  const currentByPick = new Map(currentBoardRows(currentBoard).map((row) => [Number(row.pick), row]));
  const changedVsCurrentBoard = boardRows
    .filter((row) => currentByPick.get(Number(row.pick))?.prospectId !== row.prospectId)
    .map((row) => ({ pick: row.pick, team: row.team, previous: currentByPick.get(Number(row.pick))?.player ?? null, next: row.player }));
  const artifact = {
    schemaVersion: "draftops.deepseek_agentic_tool_123_prediction.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/deepseek-agentic-tool-prediction.mjs",
    model,
    modelLabel,
    guardrails: {
      deepSeekRole: "LLM decision only after mandatory tool outputs",
      shortlistOnly: true,
      noManualPrediction: true,
      noManualOverride: true,
      noHumanPickInjection: true,
      cleanedRagOnly: true,
      sequentialRemoval: true,
    },
    inputFiles: [
      "data/final/local_pool_124_import_bundle.json",
      "data/reports/team_preference_research_20260623.json",
      "data/normalized/normalized_2026_player_feature_reference_124.json",
      "data/rag/*.json",
    ],
    summary: {
      pickCount: boardRows.length,
      uniqueSelectedProspects: new Set(boardRows.map((row) => row.prospectId)).size,
      remainingProspects: remaining.length,
      totalCandidateScans: pickAudits.reduce((sum, pick) => sum + pick.analysis.reviewedCandidateCount, 0),
      totalRagSnippets: pickAudits.reduce((sum, pick) => sum + pick.ragResult.snippetCount, 0),
      averageConfidence: Math.round(boardRows.reduce((sum, row) => sum + row.confidence, 0) / Math.max(1, boardRows.length)),
      changedVsCurrentBoardCount: changedVsCurrentBoard.length,
      promptTokens: promptTokens || null,
      completionTokens: completionTokens || null,
    },
    boardRows,
    changedVsCurrentBoard,
    pickAudits,
    remainingProspects: remaining.map((prospect) => ({ prospectId: prospect.id, name: prospect.name, consensusRank: prospect.consensusRank })),
  };
  await Promise.all([mkdir(dirname(outputJsonPath), { recursive: true }), mkdir(dirname(outputReportPath), { recursive: true })]);
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(outputReportPath, `${makeReport(artifact)}\n`, "utf8"),
  ]);
  console.log(JSON.stringify({
    output: [
      `data/boards/deepseek_agentic_tool_123_prediction_${stamp}.json`,
      `data/reports/deepseek_agentic_tool_123_prediction_${stamp}.md`,
    ],
    summary: artifact.summary,
  }, null, 2));
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
