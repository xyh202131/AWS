import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { draftOpsManifest, rootDir } from "./lib/draftops-manifest.mjs";

const localEnvPath = resolve(rootDir, ".env.local");
const envPath = resolve(rootDir, ".env");
const localBundlePath = resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json");
const teamPreferencePath = resolve(rootDir, "data", "reports", "team_preference_research_20260623.json");
const featureReferencePath = resolve(rootDir, "data", "normalized", "normalized_2026_player_feature_reference_124.json");
const currentBoardPath = resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json");
const ragDir = resolve(rootDir, "data", "rag");

const stampArgIndex = process.argv.indexOf("--run-stamp");
const defaultRunStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_");
const runStamp = stampArgIndex >= 0 && process.argv[stampArgIndex + 1] ? process.argv[stampArgIndex + 1] : defaultRunStamp;
const outputJsonPath = resolve(rootDir, "data", "boards", `deepseek_sequential_123_prediction_${runStamp}.json`);
const outputReportPath = resolve(rootDir, "data", "reports", `deepseek_sequential_123_prediction_${runStamp}.md`);
const checkpointPath = resolve(rootDir, ".draftops-watch", `deepseek_sequential_123_prediction_${runStamp}.checkpoint.json`);

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

const normalizeModelId = (value) => String(value ?? "").replace(/\s*\[1M\]\s*$/i, "").trim();

const getModelLabel = (model) => {
  const configuredLabel = process.env.DEEPSEEK_MODEL_LABEL?.trim();
  if (configuredLabel) return configuredLabel;
  return /\[1M\]$/i.test(model) ? model : `${model}[1m]`;
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

const compactString = (value, maxLength = 500) => {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...[truncated]` : text;
};

const tokenize = (value) => {
  const normalized = String(value ?? "").toLowerCase();
  const ascii = normalized.match(/[a-z0-9][a-z0-9.'-]{1,}/g) ?? [];
  const cjkSequences = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const cjkTerms = cjkSequences.flatMap((sequence) => {
    const terms = [sequence];
    for (const size of [2, 3, 4, 5, 6]) {
      for (let index = 0; index <= sequence.length - size; index += 1) {
        terms.push(sequence.slice(index, index + size));
      }
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

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(Number(value ?? 0) * factor) / factor;
};

const buildFeatureByOrdinal = (featureReference) => {
  const byOrdinal = new Map();
  for (const player of featureReference.players ?? []) byOrdinal.set(player.poolOrdinal, player);
  return byOrdinal;
};

const featureSummaryForProspect = (prospect, featureByOrdinal) => {
  const feature = featureByOrdinal.get(prospect.localPool?.ordinal);
  if (!feature) return null;
  return {
    referenceScore: feature.derived?.referenceScore ?? null,
    referenceTier: feature.derived?.referenceTier ?? null,
    physicalToolsScore: feature.derived?.physicalToolsScore ?? null,
    explosivenessScore: feature.derived?.explosivenessScore ?? null,
    agilitySpeedScore: feature.derived?.agilitySpeedScore ?? null,
    shootingDrillScore: feature.derived?.shootingDrillScore ?? null,
    tags: feature.derived?.tags ?? [],
  };
};

const compactCandidate = (prospect, featureByOrdinal) => ({
  id: prospect.id,
  name: prospect.name,
  localNameZh: prospect.localPool?.nameZh ?? null,
  localOrdinal: prospect.localPool?.ordinal ?? null,
  positions: prospect.positions ?? [],
  school: prospect.school,
  origin: prospect.origin,
  classYear: prospect.classYear,
  age: prospect.age,
  consensusRank: prospect.consensusRank,
  mockHeat: prospect.mockHeat,
  international: Boolean(prospect.international),
  roleTags: prospect.roleTags ?? [],
  strengths: (prospect.strengths ?? []).slice(0, 4),
  risks: (prospect.risks ?? []).slice(0, 4),
  profile: prospect.profile,
  sourceNotes: (prospect.sourceNotes ?? []).slice(0, 4),
  localMatchStatus: prospect.localPool?.matchStatus ?? "unknown",
  featureReference: featureSummaryForProspect(prospect, featureByOrdinal),
});

const loadRagChunks = async () => {
  const files = [
    "rag-core-board.json",
    "rag-team-preference.json",
    "rag-prospect-evidence.json",
    "rag-milestone.json",
    "rag-architecture.json",
  ];
  const chunks = [];
  for (const file of files) {
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
        text: String(chunk.text ?? "").slice(0, 1400),
      });
    }
  }
  return chunks;
};

const ragSnippetsForPick = ({ ragChunks, team, candidates, limit = 8 }) => {
  const candidateTerms = candidates
    .slice()
    .sort((left, right) => Number(left.consensusRank ?? 999) - Number(right.consensusRank ?? 999))
    .slice(0, 18)
    .flatMap((prospect) => [prospect.name, prospect.localPool?.nameZh, prospect.school, ...(prospect.roleTags ?? [])]);
  const terms = tokenize([
    `pick ${team.pick}`,
    team.team,
    team.acquiredFrom,
    team.phase,
    ...(team.needs ?? []),
    ...(team.priorityTags ?? []),
    ...candidateTerms,
  ].join(" "));

  return ragChunks
    .map((chunk) => {
      const text = [chunk.indexId, chunk.source, chunk.path, chunk.text].join("\n").toLowerCase();
      const exactMatches = terms.reduce((sum, term) => sum + (text.includes(term.toLowerCase()) ? 1 : 0), 0);
      const sourceBoost =
        chunk.sourceTrustTier === "locked-artifact"
          ? 4
          : chunk.sourceTrustTier === "official-or-reverified"
            ? 3
            : chunk.sourceTrustTier === "normalized-data"
              ? 2
              : 0;
      return { ...chunk, score: exactMatches + sourceBoost };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((chunk) => ({
      indexId: chunk.indexId,
      source: chunk.source,
      path: chunk.path,
      trustTier: chunk.sourceTrustTier,
      text: compactString(chunk.text, 900),
    }));
};

const teamPreferenceForPick = (teamPreference, pick) =>
  (teamPreference.entries ?? []).find((entry) => Number(entry.pick) === Number(pick)) ?? null;

const buildPrompt = ({ team, remainingCandidates, featureByOrdinal, boardSoFar, previousTeamSelections, teamPreferenceEntry, ragSnippets }) => {
  const compactRemaining = remainingCandidates.map((prospect) => compactCandidate(prospect, featureByOrdinal));
  const input = {
    task: "sequential_deepseek_prediction",
    pick: team.pick,
    team: {
      pick: team.pick,
      name: team.team,
      acquiredFrom: team.acquiredFrom ?? null,
      phase: team.phase,
      needs: team.needs ?? [],
      priorityTags: team.priorityTags ?? [],
      riskTolerance: team.riskTolerance,
      notes: team.notes ?? "",
    },
    teamPreferenceEntry,
    boardSoFar,
    previousTeamSelections,
    remainingCandidateCount: compactRemaining.length,
    remainingCandidates: compactRemaining,
    cleanedRagSnippets: ragSnippets,
    decisionRules: [
      "Select exactly one prospectId from remainingCandidates.",
      "Every pick is independent but sequential: selected player will be removed before the next pick.",
      "Use relative scoring only: score candidates against the current remainingCandidate pool for this pick, not against a fixed global grade.",
      "The selected prospect must be the highest relative-scored candidate in topCandidates.",
      "Use current team needs, phase, risk tolerance, prior same-team selections, prospect profile, consensus rank, source notes, cleaned RAG snippets, and feature reference.",
      "You may adjust weights dynamically for position preference, school/institution only if evidence exists, international/status, risk, upside, and pick value.",
      "Do not invent candidates, schools, rumors, measurements, team preferences, sources, or external facts not present in input.",
      "If evidence is weak, choose conservatively and mark lower confidence.",
      "No human prediction is allowed; the model must make the selection from input only.",
    ],
  };

  return [
    "你是 DraftOps 的 DeepSeek 逐顺位预测 Agent。",
    "绝对禁止人工预测。当前选择必须由你基于 input 数据完成，且只能从 remainingCandidates 里选一个 prospectId。",
    "这是逐顺位重跑：本次只预测当前 pick，脚本会把你选中的球员剔除，再进入下一顺位。",
    "你必须审视 remainingCandidates 全体，并只做当前剩余候选池内的相对评分：分数含义是本顺位当前可选球员之间的相对优先级，不是固定全局分。",
    "你输出的 topCandidates 必须按相对分从高到低排序；selectedProspectId 必须等于 topCandidates[0].prospectId。",
    "禁止使用模型记忆补事实；球员、球队、顺位、学校、来源、风险、体测、球队偏好都必须来自 input 或 cleanedRagSnippets。",
    "若学校/州偏好没有数据支撑，写 schoolInstitutionSignal='none-data-backed'，不得幻想偏好。",
    "返回严格 JSON，不要 Markdown，不要代码块，不要输出密钥。",
    "JSON schema:",
    JSON.stringify({
      pick: "number",
      team: "string",
      selectedProspectId: "string",
      selectedName: "string",
      confidence: "number 0-100",
      overallReason: "string",
      dynamicParameters: {
        primaryWeightLogic: "string",
        positionNeedSignal: "string",
        schoolInstitutionSignal: "string",
        riskToleranceSignal: "string",
        sequencingSignal: "string",
        evidenceWeakness: "string",
      },
      topCandidates: [
        {
          prospectId: "string",
          name: "string",
          score: "number 0-100",
          reason: "string",
          mainRisk: "string",
        },
      ],
      rejectedHighSignalCandidates: [
        {
          prospectId: "string",
          name: "string",
          reason: "string",
        },
      ],
      noManualPredictionConfirmation: true,
    }),
    "Input:",
    JSON.stringify(input),
  ].join("\n\n");
};

const callDeepSeek = async ({ prompt, pick, retry = 0 }) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY. Configure it in .env.local or environment.");

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
  const maxTokens = Number(process.env.DEEPSEEK_PREDICTION_MAX_TOKENS ?? process.env.DEEPSEEK_MAX_TOKENS ?? "5600");
  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a strict draft prediction agent. Return only valid JSON. Select exactly one supplied prospectId. Never reveal secrets.",
      },
      {
        role: "user",
        content:
          retry > 0
            ? `${prompt}\n\nRETRY ${retry}: Your previous response was invalid. Return valid JSON and select one exact prospectId from remainingCandidates.`
            : prompt,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    temperature: 0.16,
    stream: false,
  };

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`DeepSeek request failed at pick ${pick}: ${response.status} ${response.statusText} ${responseText.slice(0, 400)}`);
  }

  const completion = JSON.parse(responseText);
  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    return {
      model,
      modelLabel: getModelLabel(model),
      usage: completion.usage ?? null,
      finishReason: completion.choices?.[0]?.finish_reason ?? null,
      parsed: null,
      parseError: "DeepSeek response did not include message content.",
      rawContentExcerpt: responseText.slice(0, 1200),
    };
  }
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
    rawContentExcerpt: parseError ? content.slice(0, 1200) : "",
  };
};

const validatePrediction = ({ parsed, remainingCandidates, pick, team }) => {
  if (!parsed || typeof parsed !== "object") return "DeepSeek response was not valid JSON";
  if (Number(parsed.pick) !== Number(pick)) return `pick mismatch: expected ${pick}, got ${parsed.pick}`;
  if (String(parsed.team ?? "").trim() && String(parsed.team).trim() !== String(team.team).trim()) {
    return `team mismatch: expected ${team.team}, got ${parsed.team}`;
  }
  if (parsed.noManualPredictionConfirmation !== true) return "noManualPredictionConfirmation must be true";
  const selectedId = String(parsed.selectedProspectId ?? "").trim();
  if (!selectedId) return "selectedProspectId is required";
  if (!remainingCandidates.some((prospect) => prospect.id === selectedId)) return `selectedProspectId not in remaining pool: ${selectedId}`;
  if (!Array.isArray(parsed.topCandidates) || parsed.topCandidates.length === 0) return "topCandidates must be non-empty";
  const candidateIds = new Set(remainingCandidates.map((prospect) => prospect.id));
  for (const candidate of parsed.topCandidates) {
    if (!candidateIds.has(String(candidate.prospectId ?? "").trim())) return `topCandidate not in remaining pool: ${candidate.prospectId}`;
    if (!Number.isFinite(Number(candidate.score))) return `topCandidate score is not numeric: ${candidate.prospectId}`;
  }
  const sortedTopCandidates = [...parsed.topCandidates].sort((left, right) => Number(right.score) - Number(left.score));
  if (String(sortedTopCandidates[0]?.prospectId ?? "").trim() !== selectedId) {
    return `selectedProspectId is not the highest relative-scored topCandidate: ${selectedId}`;
  }
  for (let index = 1; index < parsed.topCandidates.length; index += 1) {
    if (Number(parsed.topCandidates[index].score) > Number(parsed.topCandidates[index - 1].score)) {
      return "topCandidates must be sorted by descending relative score";
    }
  }
  return "";
};

const predictPick = async ({ team, remainingCandidates, featureByOrdinal, boardSoFar, previousTeamSelections, teamPreferenceEntry, ragSnippets }) => {
  const prompt = buildPrompt({
    team,
    remainingCandidates,
    featureByOrdinal,
    boardSoFar,
    previousTeamSelections,
    teamPreferenceEntry,
    ragSnippets,
  });

  let lastError = "";
  for (let retry = 0; retry < 3; retry += 1) {
    let result;
    try {
      result = await callDeepSeek({ prompt, pick: team.pick, retry });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(1200 * (retry + 1));
      continue;
    }
    const validationError =
      result.parseError ||
      validatePrediction({ parsed: result.parsed, remainingCandidates, pick: team.pick, team });
    if (!validationError) return result;
    lastError = validationError;
    await sleep(1200 * (retry + 1));
  }

  throw new Error(`DeepSeek prediction for pick ${team.pick} failed validation after retries: ${lastError}`);
};

const toBoardRow = ({ team, selectedProspect, prediction, remainingBefore, remainingAfter }) => ({
  pick: team.pick,
  team: team.team,
  acquiredFrom: team.acquiredFrom ?? null,
  prospectId: selectedProspect.id,
  player: selectedProspect.name,
  localNameZh: selectedProspect.localPool?.nameZh ?? null,
  localOrdinal: selectedProspect.localPool?.ordinal ?? null,
  positions: selectedProspect.positions ?? [],
  position: (selectedProspect.positions ?? []).join("/"),
  school: selectedProspect.school,
  origin: selectedProspect.origin,
  classYear: selectedProspect.classYear,
  international: Boolean(selectedProspect.international),
  consensusRank: selectedProspect.consensusRank,
  mockHeat: selectedProspect.mockHeat,
  confidence: Math.round(Number(prediction.confidence ?? 0)),
  reason: prediction.overallReason ?? "",
  dynamicParameters: prediction.dynamicParameters ?? {},
  remainingBefore,
  remainingAfter,
});

const compareWithCurrentBoard = (boardRows, currentBoard) => {
  const currentRows = currentBoard.boardRows ?? (currentBoard.board ?? []).map((pick) => ({
    pick: pick.pick,
    player: pick.prospect?.name ?? pick.player,
    prospectId: pick.prospect?.id ?? pick.prospectId,
  }));
  const currentByPick = new Map(currentRows.map((row) => [Number(row.pick), row]));
  return boardRows
    .filter((row) => currentByPick.get(Number(row.pick))?.prospectId !== row.prospectId)
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      previous: currentByPick.get(Number(row.pick))?.player ?? null,
      next: row.player,
      nextLocalNameZh: row.localNameZh,
    }));
};

const makeReport = ({ artifact }) => {
  const boardRows = artifact.boardRows.map(
    (row) =>
      `| ${row.pick} | ${row.team} | ${row.player} | ${row.localNameZh ?? ""} | ${row.position} | ${row.consensusRank} | ${row.confidence} | ${row.reason.replace(/\|/g, "/")} |`,
  );
  const changedRows = artifact.changedVsCurrentBoard.map(
    (row) => `| ${row.pick} | ${row.team} | ${row.previous ?? ""} | ${row.next} | ${row.nextLocalNameZh ?? ""} |`,
  );

  return [
    "# DeepSeek Sequential 123-Player Prediction",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Model: ${artifact.modelLabel}`,
    `API model id: ${artifact.model}`,
    "",
    "## Guardrails",
    "",
    "- No manual prediction.",
    "- DeepSeek selected exactly one supplied prospect id per pick.",
    "- DeepSeek was instructed to score candidates only relative to the current remaining pool for that pick.",
    "- Validation required the selected prospect to be the highest-scored returned candidate.",
    "- After every pick, the selected prospect was removed before the next DeepSeek call.",
    "- Candidate boundary is the local 124-row answer-card pool resolved to 123 unique candidates.",
    "- Cleaned RAG snippets were supplied as grounding context.",
    "",
    "## Summary",
    "",
    `- Picks: ${artifact.summary.pickCount}`,
    `- Unique selected players: ${artifact.summary.uniqueSelectedProspects}`,
    `- Total DeepSeek calls: ${artifact.summary.deepSeekCalls}`,
    `- Total candidate reviews declared by prompt: ${artifact.summary.totalRemainingCandidatesShown}`,
    `- Average confidence: ${artifact.summary.averageConfidence}`,
    `- Changed vs current frontend board: ${artifact.summary.changedVsCurrentBoardCount}`,
    "",
    "## Board",
    "",
    "| Pick | Team | Player | Local name | Pos | Consensus | Confidence | Reason |",
    "|---:|---|---|---|---|---:|---:|---|",
    ...boardRows,
    "",
    "## Changed Vs Current Frontend Board",
    "",
    artifact.changedVsCurrentBoard.length
      ? [
          "| Pick | Team | Current | DeepSeek rerun | Local name |",
          "|---:|---|---|---|---|",
          ...changedRows,
        ].join("\n")
      : "No pick changed.",
    "",
  ].join("\n");
};

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
  const remainingCandidates = [...(localBundle.prospects ?? [])].sort(
    (left, right) => Number(left.consensusRank ?? 999) - Number(right.consensusRank ?? 999) || left.name.localeCompare(right.name),
  );
  const featureByOrdinal = buildFeatureByOrdinal(featureReference);
  const boardRows = [];
  const pickAudits = [];
  const teamHistory = new Map();
  let model = "";
  let modelLabel = "";
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalRemainingCandidatesShown = 0;
  const resume = process.argv.includes("--resume");

  if (new Set(remainingCandidates.map((prospect) => prospect.id)).size !== remainingCandidates.length) {
    throw new Error("Candidate pool contains duplicate prospect ids.");
  }

  const checkpoint = resume ? await readJsonIfExists(checkpointPath) : null;
  if (checkpoint?.boardRows?.length) {
    const selectedIds = new Set(checkpoint.boardRows.map((row) => row.prospectId));
    for (let index = remainingCandidates.length - 1; index >= 0; index -= 1) {
      if (selectedIds.has(remainingCandidates[index].id)) remainingCandidates.splice(index, 1);
    }
    boardRows.push(...checkpoint.boardRows);
    pickAudits.push(...(checkpoint.pickAudits ?? []));
    model = checkpoint.model ?? model;
    modelLabel = checkpoint.modelLabel ?? modelLabel;
    totalPromptTokens = Number(checkpoint.totalPromptTokens ?? 0);
    totalCompletionTokens = Number(checkpoint.totalCompletionTokens ?? 0);
    totalRemainingCandidatesShown = Number(checkpoint.totalRemainingCandidatesShown ?? 0);
    for (const row of boardRows) {
      const previous = teamHistory.get(row.team) ?? [];
      teamHistory.set(row.team, [
        ...previous,
        {
          pick: row.pick,
          prospectId: row.prospectId,
          name: row.player,
          positions: row.positions ?? [],
        },
      ]);
    }
    console.log(`Resumed DeepSeek prediction checkpoint at ${boardRows.length}/30 picks`);
  }

  for (const team of teams) {
    if (boardRows.some((row) => Number(row.pick) === Number(team.pick))) continue;
    const previousTeamSelections = teamHistory.get(team.team) ?? [];
    const ragSnippets = ragSnippetsForPick({ ragChunks, team, candidates: remainingCandidates });
    totalRemainingCandidatesShown += remainingCandidates.length;
    const result = await predictPick({
      team,
      remainingCandidates,
      featureByOrdinal,
      boardSoFar: boardRows.map((row) => ({
        pick: row.pick,
        team: row.team,
        player: row.player,
        prospectId: row.prospectId,
        positions: row.positions,
      })),
      previousTeamSelections,
      teamPreferenceEntry: teamPreferenceForPick(teamPreference, team.pick),
      ragSnippets,
    });

    model = result.model;
    modelLabel = result.modelLabel;
    totalPromptTokens += Number(result.usage?.prompt_tokens ?? 0);
    totalCompletionTokens += Number(result.usage?.completion_tokens ?? 0);

    const selectedIndex = remainingCandidates.findIndex((prospect) => prospect.id === result.parsed.selectedProspectId);
    const selectedProspect = remainingCandidates[selectedIndex];
    remainingCandidates.splice(selectedIndex, 1);

    const boardRow = toBoardRow({
      team,
      selectedProspect,
      prediction: result.parsed,
      remainingBefore: remainingCandidates.length + 1,
      remainingAfter: remainingCandidates.length,
    });
    boardRows.push(boardRow);
    pickAudits.push({
      pick: team.pick,
      team: team.team,
      selectedProspectId: selectedProspect.id,
      selectedName: selectedProspect.name,
      selectedLocalNameZh: selectedProspect.localPool?.nameZh ?? null,
      confidence: boardRow.confidence,
      prediction: result.parsed,
      ragSnippets,
      usage: result.usage,
      finishReason: result.finishReason,
      remainingBefore: boardRow.remainingBefore,
      remainingAfter: boardRow.remainingAfter,
      noManualPredictionConfirmation: result.parsed.noManualPredictionConfirmation === true,
    });

    teamHistory.set(team.team, [
      ...previousTeamSelections,
      {
        pick: team.pick,
        prospectId: selectedProspect.id,
        name: selectedProspect.name,
        positions: selectedProspect.positions ?? [],
      },
    ]);

    await mkdir(dirname(checkpointPath), { recursive: true });
    await writeFile(
      checkpointPath,
      `${JSON.stringify(
        {
          schemaVersion: "draftops.deepseek_sequential_checkpoint.v1",
          generatedAt: new Date().toISOString(),
          model,
          modelLabel,
          boardRows,
          pickAudits,
          totalPromptTokens,
          totalCompletionTokens,
          totalRemainingCandidatesShown,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    console.log(`DeepSeek pick ${team.pick}/30: ${team.team} -> ${selectedProspect.name}`);
  }

  const changedVsCurrentBoard = compareWithCurrentBoard(boardRows, currentBoard);
  const generatedAt = new Date().toISOString();
  const artifact = {
    schemaVersion: "draftops.deepseek_sequential_123_prediction.v1",
    generatedAt,
    generatedBy: "scripts/deepseek-sequential-prediction.mjs",
    runStamp,
    model,
    modelLabel,
    inputFiles: [
      "data/final/local_pool_124_import_bundle.json",
      "data/reports/team_preference_research_20260623.json",
      "data/normalized/normalized_2026_player_feature_reference_124.json",
      "data/rag/*.json",
      draftOpsManifest.data?.boardPath ?? "public/data/agent_expanded_recommended_board.json",
    ],
    guardrails: {
      noManualPrediction: true,
      noHumanPickInjection: true,
      selectedProspectRemovedAfterEachPick: true,
      poolRelativeScoring: true,
      selectedMustBeHighestReturnedScore: true,
      candidateBoundary: "local 124-row answer-card pool resolved to 123 unique candidates",
      cleanedRagOnly: true,
    },
    summary: {
      pickCount: boardRows.length,
      uniqueSelectedProspects: new Set(boardRows.map((row) => row.prospectId)).size,
      remainingProspects: remainingCandidates.length,
      deepSeekCalls: pickAudits.length,
      totalRemainingCandidatesShown,
      averageConfidence: Math.round(boardRows.reduce((sum, row) => sum + row.confidence, 0) / Math.max(1, boardRows.length)),
      changedVsCurrentBoardCount: changedVsCurrentBoard.length,
      promptTokens: totalPromptTokens || null,
      completionTokens: totalCompletionTokens || null,
    },
    boardRows,
    changedVsCurrentBoard,
    pickAudits,
    remainingProspects: remainingCandidates.map((prospect) => ({
      prospectId: prospect.id,
      name: prospect.name,
      localNameZh: prospect.localPool?.nameZh ?? null,
      consensusRank: prospect.consensusRank,
    })),
  };

  await Promise.all([mkdir(dirname(outputJsonPath), { recursive: true }), mkdir(dirname(outputReportPath), { recursive: true })]);
  if (existsSync(outputJsonPath) || existsSync(outputReportPath)) {
    throw new Error(`Refusing to overwrite existing output for run stamp ${runStamp}. Use a new --run-stamp value.`);
  }
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(outputReportPath, `${makeReport({ artifact })}\n`, "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        output: [
          `data/boards/deepseek_sequential_123_prediction_${runStamp}.json`,
          `data/reports/deepseek_sequential_123_prediction_${runStamp}.md`,
        ],
        checkpoint: `.draftops-watch/deepseek_sequential_123_prediction_${runStamp}.checkpoint.json`,
        model,
        modelLabel,
        summary: artifact.summary,
        changedVsCurrentBoard,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
