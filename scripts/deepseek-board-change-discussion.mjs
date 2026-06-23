import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = process.cwd();
const localEnvPath = resolve(rootDir, ".env.local");
const envPath = resolve(rootDir, ".env");
const dynamicBoardPath = resolve(rootDir, "data", "boards", "sequential_dynamic_board_123_audit.json");
const baselineBoardPath = resolve(rootDir, "data", "boards", "local_pool_124_baseline_board.json");
const teamPreferencePath = resolve(rootDir, "data", "reports", "team_preference_research_20260623.json");
const outputJsonPath = resolve(rootDir, "data", "reports", "deepseek_board_change_discussion_20260623.json");
const outputTextPath = resolve(rootDir, "data", "reports", "deepseek_board_change_discussion_20260623.md");

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

const normalizeModelId = (value) => String(value ?? "").replace(/\s*\[1M\]\s*$/i, "").trim();

const getModelLabel = (model) => {
  const configuredLabel = process.env.DEEPSEEK_MODEL_LABEL?.trim();
  if (configuredLabel) return configuredLabel;
  return /\[1M\]$/i.test(model) ? model : `${model}[1m]`;
};

const compact = (value, maxLength = 12000) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
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

const roundNumber = (value, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round(Number(value ?? 0) * factor) / factor;
};

const selectedScoreRow = (candidate) =>
  candidate
    ? {
        rankWithinPick: candidate.rankWithinPick,
        prospectId: candidate.prospectId,
        name: candidate.name,
        localNameZh: candidate.localNameZh,
        positions: candidate.positions,
        consensusRank: candidate.consensusRank,
        finalScore: roundNumber(candidate.finalScore),
        rawModelScore: roundNumber(candidate.rawModelScore),
        dynamicPreferenceAdjustment: roundNumber(candidate.dynamicPreferenceAdjustment),
        featureAdjustment: roundNumber(candidate.featureAdjustment),
        sequencingAdjustment: roundNumber(candidate.sequencingAdjustment),
        schoolStateAdjustment: roundNumber(candidate.schoolStateAdjustment),
        riskPenalty: roundNumber(candidate.riskPenalty),
        pickValueAdjustment: roundNumber(candidate.pickValueAdjustment),
        overlapFamilies: candidate.preference?.overlapFamilies ?? [],
        missingPreferenceFamilies: candidate.preference?.missingPreferenceFamilies ?? [],
        families: candidate.families ?? [],
        featureReference: candidate.featureReference
          ? {
              referenceScore: candidate.featureReference.referenceScore,
              referenceTier: candidate.featureReference.referenceTier,
              physicalToolsScore: candidate.featureReference.physicalToolsScore,
              explosivenessScore: candidate.featureReference.explosivenessScore,
              shootingDrillScore: candidate.featureReference.shootingDrillScore,
              tags: candidate.featureReference.tags,
            }
          : null,
      }
    : null;

const buildChangeCases = ({ dynamicBoard, baselineBoard }) => {
  const baselineByPick = new Map((baselineBoard.boardRows ?? []).map((row) => [row.pick, row]));
  const auditByPick = new Map((dynamicBoard.pickAudits ?? []).map((audit) => [audit.pick, audit]));

  return (dynamicBoard.changedVsBaseline ?? []).map((change) => {
    const audit = auditByPick.get(change.pick);
    const baseline = baselineByPick.get(change.pick);
    const baselineCandidate = audit?.allScores?.find((candidate) => candidate.prospectId === baseline?.prospectId);
    const dynamicCandidate = audit?.allScores?.find((candidate) => candidate.prospectId === change.dynamicProspectId);
    return {
      pick: change.pick,
      team: change.team,
      baselinePlayer: change.baselinePlayer,
      baselineProspectId: change.baselineProspectId,
      dynamicPlayer: change.dynamicPlayer,
      dynamicProspectId: change.dynamicProspectId,
      scoreGapVsNext: audit?.margin ?? null,
      confidence: dynamicBoard.boardRows?.find((row) => row.pick === change.pick)?.confidence ?? null,
      tieBreakApplied: dynamicBoard.boardRows?.find((row) => row.pick === change.pick)?.scoreTiebreakApplied ?? false,
      dynamicParameters: audit?.dynamicParameters ?? null,
      selectedDynamicCandidate: selectedScoreRow(dynamicCandidate),
      previousBaselineCandidateScoreUnderDynamicModel: selectedScoreRow(baselineCandidate),
      topCandidates: (audit?.topCandidates ?? []).slice(0, 6).map(selectedScoreRow),
    };
  });
};

const buildRoundPrompt = ({ round, cases, dynamicBoard, previousRounds }) => {
  const sharedRules = [
    "你是 DraftOps 选秀预测参数审计 Agent，正在与 Codex 讨论 123 人池逐顺位动态重跑后的变动是否合理。",
    "硬性边界：绝对禁止人工预测。你不能凭直觉新增球员、删球员、手工重排、手工指定最终名单。",
    "你只能审计 input 中的模型输出和参数影响：若认为某变动不稳，只能建议调整参数、降低权重、重新跑模型，不能直接给人工替换名单。",
    "候选池是 123 名，逐顺位逻辑是：当前顺位审视所有剩余球员，选中后剔除，再进入下一顺位。",
    "学校/州偏好当前没有可靠数据-backed priors，默认不得加分；如你认为应加入，也只能标注为未来数据需求。",
    "请返回严格 JSON，不要 Markdown，不要代码块，不要输出密钥。",
  ];

  const roundConfigs = {
    1: {
      title: "Lottery and near-lottery changed slots",
      focus:
        "重点审计第7、10、11、12顺位变动是否由球队偏好、球员族群、体测/投篮参考、窄差破同分合理推出。",
      payload: cases.filter((item) => item.pick <= 12),
    },
    2: {
      title: "Middle and late first changed slots",
      focus:
        "重点审计第15-29顺位变动是否存在级联效应过强、同队第二签互补逻辑过强、或动态偏好权重过度的问题。",
      payload: cases.filter((item) => item.pick >= 13),
    },
    3: {
      title: "Final parameter verdict",
      focus:
        "综合前两轮，只输出参数级结论：哪些变动可接受，哪些需要重新跑参数敏感性测试，哪些应降低动态权重。不要人工给新名单。务必简短，caseReviews 最多 8 条，每条 evidence 最多 2 个短句。",
      payload: {
        allChangedCases: cases.map((item) => ({
          pick: item.pick,
          team: item.team,
          baselinePlayer: item.baselinePlayer,
          dynamicPlayer: item.dynamicPlayer,
          scoreGapVsNext: item.scoreGapVsNext,
          confidence: item.confidence,
          tieBreakApplied: item.tieBreakApplied,
          selectedAdjustment: {
            dynamicPreferenceAdjustment: item.selectedDynamicCandidate?.dynamicPreferenceAdjustment,
            featureAdjustment: item.selectedDynamicCandidate?.featureAdjustment,
            sequencingAdjustment: item.selectedDynamicCandidate?.sequencingAdjustment,
            overlapFamilies: item.selectedDynamicCandidate?.overlapFamilies,
          },
        })),
        previousRounds,
      },
    },
  };
  const config = roundConfigs[round];

  return [
    ...sharedRules,
    "",
    `本轮：${config.title}`,
    config.focus,
    "",
    "必须返回 JSON schema:",
    JSON.stringify({
      round: "number",
      title: "string",
      overallVerdict: "string",
      caseReviews: [
        {
          pick: "number",
          team: "string",
          changedFrom: "string",
          changedTo: "string",
          reasonability: "reasonable | fragile | parameter-risk | needs-rerun",
          evidence: ["string"],
          parameterConcern: "string",
          rerunSuggestion: "string",
        },
      ],
      parameterRecommendations: [
        {
          scope: "string",
          recommendation: "string",
          reason: "string",
        },
      ],
      noManualPredictionConfirmation: true,
    }),
    "",
    "globalContext:",
    JSON.stringify({
      dynamicBoardSummary: dynamicBoard.summary,
      guardrails: dynamicBoard.guardrails,
      candidatePool: dynamicBoard.candidatePool,
    }),
    "",
    "input.changedCases:",
    compact(config.payload, round === 3 ? 16000 : 18000),
  ].join("\n");
};

const callDeepSeek = async ({ prompt, round }) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY. Put it in .env.local or the shell environment.");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
  const maxTokens = Number(process.env.DEEPSEEK_MAX_TOKENS ?? 5200);
  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a strict model-output audit agent. Return only valid JSON. Never reveal secrets. Do not hand-predict or reorder players.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    temperature: round === 3 ? 0.08 : 0.14,
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
    throw new Error(`DeepSeek request failed at round ${round}: ${response.status} ${response.statusText}`);
  }

  const completion = JSON.parse(responseText);
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error(`DeepSeek round ${round} response did not include message content.`);
  let parsed;
  let parseError = null;
  try {
    parsed = extractJson(content);
  } catch (error) {
    parseError = error.message;
    parsed = {
      round,
      title: `round-${round}-parse-error`,
      overallVerdict: "DeepSeek returned malformed JSON; inspect rawContent in artifact.",
      caseReviews: [],
      parameterRecommendations: [],
      noManualPredictionConfirmation: true,
      parseError,
      rawContentExcerpt: content.slice(0, 2400),
    };
  }

  return {
    round,
    model,
    modelLabel: getModelLabel(model),
    usage: completion.usage ?? null,
    rawContent: content,
    parseError,
    parsed,
  };
};

const toMarkdown = ({ artifact }) => {
  const lines = [
    "# DeepSeek Board Change Discussion",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Model: ${artifact.modelLabel}`,
    `API model id: ${artifact.model}`,
    "",
    "## Inputs",
    "",
    ...artifact.inputFiles.map((file) => `- ${file}`),
    "",
    "## Changed Picks",
    "",
    "| Pick | Team | Baseline | Dynamic | Confidence | Score gap | Tie-break |",
    "|---:|---|---|---|---:|---:|---|",
    ...artifact.changedCases.map(
      (item) =>
        `| ${item.pick} | ${item.team} | ${item.baselinePlayer} | ${item.dynamicPlayer} | ${item.confidence ?? ""} | ${item.scoreGapVsNext ?? ""} | ${item.tieBreakApplied ? "yes" : ""} |`,
    ),
    "",
    "## Rounds",
    "",
  ];

  for (const round of artifact.rounds) {
    lines.push(`### Round ${round.round}`);
    lines.push("");
    lines.push(`Usage: ${round.usage ? JSON.stringify(round.usage) : "not returned"}`);
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(round.parsed, null, 2));
    lines.push("```");
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
};

const main = async () => {
  await loadEnvFile(localEnvPath);
  await loadEnvFile(envPath);

  const [dynamicBoard, baselineBoard, teamPreference] = await Promise.all([
    readJson(dynamicBoardPath),
    readJson(baselineBoardPath),
    readJson(teamPreferencePath),
  ]);

  const changedCases = buildChangeCases({ dynamicBoard, baselineBoard });
  const rounds = [];
  const previousRounds = [];

  for (const round of [1, 2, 3]) {
    const prompt = buildRoundPrompt({ round, cases: changedCases, dynamicBoard, teamPreference, previousRounds });
    const result = await callDeepSeek({ prompt, round });
    rounds.push(result);
    previousRounds.push({
      round,
      parsed: result.parsed,
      promptDigest: compact(prompt, 2600),
    });
    console.log(`DeepSeek board-change round ${round}/3 complete`);
  }

  const generatedAt = new Date().toISOString();
  const artifact = {
    schemaVersion: "draftops.deepseek_board_change_discussion.v1",
    generatedAt,
    generatedBy: "DeepSeek API board-change discussion script",
    inputFiles: [
      "data/boards/sequential_dynamic_board_123_audit.json",
      "data/boards/local_pool_124_baseline_board.json",
      "data/reports/team_preference_research_20260623.json",
    ],
    model: rounds[0]?.model ?? normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro"),
    modelLabel: rounds[0]?.modelLabel ?? getModelLabel(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro"),
    roundCount: rounds.length,
    changedCases,
    rounds,
  };

  await mkdir(resolve(rootDir, "data", "reports"), { recursive: true });
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(outputTextPath, toMarkdown({ artifact }), "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        output: [
          "data/reports/deepseek_board_change_discussion_20260623.json",
          "data/reports/deepseek_board_change_discussion_20260623.md",
        ],
        roundCount: rounds.length,
        model: artifact.model,
        modelLabel: artifact.modelLabel,
        changedPickCount: changedCases.length,
        finalVerdict: rounds.at(-1)?.parsed?.overallVerdict ?? null,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
