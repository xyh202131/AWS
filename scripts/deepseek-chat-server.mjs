import http from "node:http";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { draftOpsManifest, resolveManifestPath, rootDir } from "./lib/draftops-manifest.mjs";

const localEnvPath = resolve(rootDir, ".env.local");
const envPath = resolve(rootDir, ".env");
const boardPath = resolveManifestPath(draftOpsManifest.data?.boardPath, "public/data/agent_balanced_board.json");
const bundlePath = resolveManifestPath(draftOpsManifest.data?.bundlePath, "public/data/final_import_bundle.json");
const documentIndexPath = resolve(rootDir, "data", "documents", "document_index.json");
const milestoneReferencePath = resolve(rootDir, "data", "documents", "milestone-questions", "DraftCode24里程碑事件预测.md");
const examReportPath = resolve(rootDir, "data", "reports", "deepseek_exam_answers.json");
const knowledgePaths = [
  "data/README.md",
  "data/documents/README.md",
  "data/documents/document_index.json",
  "data/documents/milestone-questions/DraftCode24里程碑事件预测.md",
  "data/clean/data_quality_report.md",
  "data/clean/official_prospect_reconciliation.json",
  "data/reports/official_prospect_reconciliation_report.md",
  "data/reports/official_double_agent_roster_audit_summary.md",
  "data/reports/a13_official_local_table_audit.md",
  "data/reports/a14_official_live_refresh_audit.md",
  "data/reports/d8_source_quality_debate.md",
  "data/reports/raw_sources_registry_report.md",
  "data/raw/raw_sources.json",
  "data/raw/nba-official-2026-prospects-live.md",
  "data/raw/nba-official-2026-draft-order-live.md",
  "data/normalized/normalized_2026_mock_lottery.json",
  "data/normalized/normalized_2026_team_context.json",
  "data/normalized/normalized_2026_prospect_big_board.json",
  draftOpsManifest.data?.bundlePath ?? "public/data/final_import_bundle.json",
  draftOpsManifest.data?.boardPath ?? "public/data/agent_balanced_board.json",
];
const officialWebSources = (draftOpsManifest.sourceLinks ?? []).map((source) => ({
  name: source.label?.en ?? source.label?.zh ?? source.url,
  url: source.url,
}));

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

const normalizeModelId = (value) => value.replace(/\s*\[1M\]\s*$/i, "").trim();

const getModelLabel = (model) => {
  const configuredLabel = process.env.DEEPSEEK_MODEL_LABEL?.trim();
  if (configuredLabel) return configuredLabel;
  return /\[1M\]$/i.test(model) ? model : `${model}[1m]`;
};

const readJson = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
};

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
  return [...new Set([...ascii, ...cjkTerms].filter((term) => term.length >= 2))];
};

const compactText = (value, maxLength = 9000) => {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
};

const getSearchTerms = ({ question, selectedPick }) => {
  const selectedTerms = selectedPick
    ? [
        selectedPick.team,
        selectedPick.prospect?.name,
        selectedPick.prospect?.school,
        selectedPick.prospect?.origin,
        ...(selectedPick.prospect?.positions ?? []),
      ]
    : [];
  return tokenize([question, ...selectedTerms].join(" ")).slice(0, 32);
};

const chunkText = (text, size = 1100) => {
  const clean = normalizeText(text);
  if (!clean) return [];
  const chunks = [];
  for (let index = 0; index < clean.length; index += size) {
    chunks.push(clean.slice(index, index + size));
  }
  return chunks;
};

const scoreText = (text, terms) => {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term.toLowerCase()) ? 1 : 0), 0);
};

const readKnowledgeFile = async (relativePath) => {
  const absolutePath = resolve(rootDir, relativePath);
  const content = await readFile(absolutePath, "utf8").catch(() => "");
  if (!content) return [];

  const sourceRank =
    relativePath.includes("milestone-questions") || relativePath.includes("document_index")
      ? "question-reference"
      : relativePath.includes("official") || relativePath.includes("nba-official")
      ? "official-local"
      : relativePath.includes("raw_sources") || relativePath.includes("source_quality")
        ? "source-registry"
        : "local-knowledge";

  return chunkText(content).map((text) => ({
    source: relativePath,
    sourceRank,
    text,
  }));
};

const retrieveLocalKnowledge = async ({ question, selectedPick }) => {
  const terms = getSearchTerms({ question, selectedPick });
  const allChunks = (await Promise.all(knowledgePaths.map(readKnowledgeFile))).flat();
  const ranked = allChunks
    .map((chunk) => ({
      ...chunk,
      score: scoreText(chunk.text, terms) + (chunk.sourceRank === "official-local" ? 2 : 0),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);

  return {
    terms,
    snippets: ranked,
    hasStrongLocalMatch: ranked.some((item) => item.score >= 4 || item.sourceRank === "official-local"),
  };
};

const fetchOfficialWebKnowledge = async (terms) => {
  const results = [];
  for (const source of officialWebSources) {
    try {
      const response = await fetch(source.url, {
        headers: {
          "User-Agent": "DraftOps local DeepSeek proxy/1.0",
          Accept: "text/html,text/plain,application/json",
        },
      });
      if (!response.ok) continue;
      const text = await response.text();
      const chunks = chunkText(text)
        .map((chunk) => ({
          source: source.url,
          sourceName: source.name,
          sourceRank: "official-web",
          text: chunk,
          score: scoreText(chunk, terms) + 3,
        }))
        .filter((chunk) => chunk.score > 3)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3);
      results.push(...chunks);
    } catch {
      // Network search is a fallback. If it fails, DeepSeek still receives local knowledge and the failure stays silent.
    }
  }
  return results.slice(0, 6);
};

const defaultClientOrigin = process.env.DRAFTOPS_CLIENT_ORIGIN ?? "http://127.0.0.1:3002";

const getCorsOrigin = (request) => {
  const origin = request.headers.origin;
  if (!origin) return defaultClientOrigin;

  try {
    const parsed = new URL(origin);
    if ((parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") && /^https?:$/.test(parsed.protocol)) {
      return origin;
    }
  } catch {
    // Fall back to the configured local client origin.
  }

  return defaultClientOrigin;
};

const sendJson = (request, response, statusCode, value) => {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": getCorsOrigin(request),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
};

const readRequestJson = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const boardRows = (board = []) =>
  board.map((pick) => ({
    pick: pick.pick,
    team: pick.team,
    acquiredFrom: pick.acquiredFrom ?? null,
    player: pick.prospect?.name,
    positions: pick.prospect?.positions ?? [],
    position: pick.prospect?.positions?.join("/"),
    school: pick.prospect?.school,
    origin: pick.prospect?.origin,
    classYear: pick.prospect?.classYear,
    international: Boolean(pick.prospect?.international),
    consensusRank: pick.prospect?.consensusRank,
  }));

const schoolCounts = (board = []) => {
  const firstSeen = new Map();
  const counts = {};

  board.forEach((pick, index) => {
    const school = pick.prospect?.school ?? "Unknown";
    if (!firstSeen.has(school)) firstSeen.set(school, index);
    counts[school] = (counts[school] ?? 0) + 1;
  });

  return Object.entries(counts).sort(
    (left, right) => right[1] - left[1] || (firstSeen.get(left[0]) ?? 0) - (firstSeen.get(right[0]) ?? 0),
  );
};

const buildExamFacts = (board = []) => {
  const rows = boardRows(board);
  const firstFive = rows.slice(0, 5);
  const firstInternational = rows.find((pick) => pick.international) ?? null;
  const schoolCountRows = schoolCounts(board).map(([school, count]) => ({ school, count }));
  const schoolLeader = schoolCountRows[0] ?? null;
  const lotteryGuards = rows
    .slice(0, 14)
    .filter((pick) => pick.positions.some((position) => position === "PG" || position === "SG"));
  const firstCenter = rows.find((pick) => pick.positions.includes("C")) ?? null;
  const freshmen = rows.filter((pick) => pick.classYear === "Freshman");
  const tradedPicks = rows.filter((pick) => pick.acquiredFrom);
  const examQuestions = [
    {
      id: "intl-top-five",
      prompt: "前 5 位是否包含国际球员？",
      answer: firstFive.some((pick) => pick.international) ? "是" : "否",
      evidence: firstFive.map((pick) => `第 ${pick.pick} 顺位 ${pick.player}，${pick.origin}`),
    },
    {
      id: "first-intl",
      prompt: "第一位被选中的国际球员是几顺位？",
      answer: firstInternational ? String(firstInternational.pick) : "首轮无国际球员",
      evidence: firstInternational
        ? [`第 ${firstInternational.pick} 顺位 ${firstInternational.player}，${firstInternational.origin}`]
        : ["当前锁定板首轮没有国际球员"],
    },
    {
      id: "school-most",
      prompt: "哪所学校贡献最多首轮秀？",
      answer: schoolLeader ? `${schoolLeader.school} (${schoolLeader.count} 人)` : "N/A",
      evidence: rows
        .filter((pick) => pick.school === schoolLeader?.school)
        .map((pick) => `第 ${pick.pick} 顺位 ${pick.player}`),
    },
    {
      id: "lottery-guards",
      prompt: "乐透区会有多少名后卫？",
      answer: String(lotteryGuards.length),
      evidence: lotteryGuards.map((pick) => `第 ${pick.pick} 顺位 ${pick.player}，${pick.position}`),
    },
    {
      id: "first-center",
      prompt: "第一位中锋是几顺位？",
      answer: firstCenter ? String(firstCenter.pick) : "首轮无中锋",
      evidence: firstCenter ? [`第 ${firstCenter.pick} 顺位 ${firstCenter.player}`] : ["当前锁定板首轮没有中锋"],
    },
    {
      id: "freshmen-count",
      prompt: "首轮 Freshman 数量是多少？",
      answer: String(freshmen.length),
      evidence: freshmen.map((pick) => `第 ${pick.pick} 顺位 ${pick.player}`),
    },
    {
      id: "traded-picks",
      prompt: "首轮来自交易的顺位数量是多少？",
      answer: String(tradedPicks.length),
      evidence: tradedPicks.map((pick) => `第 ${pick.pick} 顺位 ${pick.team} from ${pick.acquiredFrom}`),
    },
  ];

  return {
    scope: "当前 DeepSeek 是只读问答 Agent：可回答应试题、参考文档口径和预测主题问题，但只能读取当前锁定预测板，不能生成或改动预测球员。",
    predictionLockRules: [
      "当前 DeepSeek 禁止生成预测球员。",
      "当前 DeepSeek 禁止修改、增删、交换、重排任何预测球员。",
      "当前 DeepSeek 禁止建议某队改选其他球员。",
      "涉及预测主题的问题只能读取当前锁定预测板并回答，不得参与预测改动。",
    ],
    questionCount: examQuestions.length,
    examQuestions,
    computedFacts: {
      firstFive,
      firstInternational,
      schoolCounts: schoolCountRows,
      schoolLeader,
      lotteryGuards,
      firstCenter,
      freshmen,
      tradedPicks,
    },
    lockedBoardRows: rows,
  };
};

const buildContext = async (selectedPickNumber) => {
  const [boardArtifact, bundle, previousExamRun, documentIndex, milestoneReference] = await Promise.all([
    readJson(boardPath, {}),
    readJson(bundlePath, {}),
    readJson(examReportPath, null),
    readJson(documentIndexPath, null),
    readFile(milestoneReferencePath, "utf8").catch(() => ""),
  ]);
  const board = boardArtifact.board ?? [];
  const selectedPick = board.find((pick) => pick.pick === selectedPickNumber) ?? board[0] ?? null;
  const examFacts = buildExamFacts(board);

  return {
    board,
    selectedPick,
    deepSeekContext: {
      modelContext: {
        boardHealth: boardArtifact.health,
        boardSummary: boardArtifact.summary,
        scenario: boardArtifact.scenario,
        sourceMetadata: boardArtifact.sourceMetadata ?? bundle.metadata,
        previousDeepSeekExamGeneratedAt: previousExamRun?.generatedAt ?? null,
      },
      referenceDocuments: {
        documentIndex,
        milestoneQuestionDesignReference: compactText(milestoneReference),
        usagePolicy:
          "DraftCode24里程碑事件预测.md 可用于题意、字段口径、评分口径参考；不是官方赛果，不能用于调整预测球员。",
      },
      selectedPick: selectedPick
        ? {
            pick: selectedPick.pick,
            team: selectedPick.team,
            acquiredFrom: selectedPick.acquiredFrom ?? null,
            player: selectedPick.prospect?.name,
            positions: selectedPick.prospect?.positions ?? [],
            school: selectedPick.prospect?.school,
            origin: selectedPick.prospect?.origin,
            classYear: selectedPick.prospect?.classYear,
            international: Boolean(selectedPick.prospect?.international),
          }
        : null,
      examFacts,
    },
  };
};

const buildRetrievedKnowledge = async ({ question, selectedPick }) => {
  const local = await retrieveLocalKnowledge({ question, selectedPick });
  const officialWeb = local.hasStrongLocalMatch ? [] : await fetchOfficialWebKnowledge(local.terms);

  return {
    retrievalPolicy:
      "优先使用本地知识库与官方本地数据；本地证据不足时才使用官方联网网页；官方数据优先于媒体和模型全局知识；模型全局知识只作最后兜底。",
    localSnippets: local.snippets.map(({ source, sourceRank, text }) => ({ source, sourceRank, text })),
    officialWebSnippets: officialWeb.map(({ source, sourceName, sourceRank, text }) => ({
      source,
      sourceName,
      sourceRank,
      text,
    })),
    usedWebFallback: officialWeb.length > 0,
  };
};

const sanitizeAnswer = (value) =>
  String(value ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^#{1,6}\s*/g, "")
        .replace(/^\s*[-*+]\s+/g, "")
        .replace(/^\s*\d+\.\s+/g, "")
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .replace(/#/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join("\n")
    .trim();

const promptTokens = (value) => tokenize(value).filter((term) => term.length >= 2);

const matchesConfiguredExamPrompt = (question, context) => {
  const questionTerms = new Set(promptTokens(question));
  if (!questionTerms.size) return false;

  return (context?.deepSeekContext?.examFacts?.examQuestions ?? []).some((item) => {
    const promptTerms = promptTokens([item.id, item.prompt, item.answer].join(" "));
    const overlap = promptTerms.filter((term) => questionTerms.has(term)).length;
    return overlap >= 2;
  });
};

const isExamQuestion = (question, context) => {
  const text = String(question ?? "").toLowerCase();
  if (matchesConfiguredExamPrompt(question, context)) return true;

  const strongExamPatterns = [
    /应试|里程碑|milestone|题目|答题卡|提交题|考题|问题答案/,
    /draftcode24|combine|体测|臂展|弹跳|手掌|长度溢价|位置稀缺|人才来源|国际化率|大手天赋/,
    /\b[a-d][1-9]\b/i,
    /国际|海外|非美国|international/,
    /大学|学校|school|college|贡献|最多首轮/,
    /乐透|前\s*14|后卫|guard|pg|sg/,
    /中锋|center|首个\s*c\b|第一位\s*c\b/,
    /freshman|大一|新生|一年级/,
    /交易|traded|acquired|from/,
  ];
  if (strongExamPatterns.some((pattern) => pattern.test(text))) return true;

  const aggregateExamPattern = /统计|数量|多少|几个|几名|哪所|哪支|哪个学校|哪个大学|贡献最多|最多|最少|是否|占比|count|how many|which/;
  return aggregateExamPattern.test(text) && !isPredictionQuestion(question);
};

const isPredictionQuestion = (question) => {
  const text = String(question ?? "").toLowerCase();
  return [
    /预测|最可能|会选|选谁|选择谁|谁会被选|球员预测/,
    /当前顺位|第\s*\d+\s*顺位|\d+\s*顺位|pick\s*\d+/,
    /第一顺位|第二顺位|第三顺位|状元|榜眼|探花/,
    /为什么|理由|依据|证据|风险|替代|备选|人选|适配|fit|risk|alternative|runner-up/,
    /完整.*首轮|全部.*首轮|30.*顺位|三十.*顺位/,
  ].some((pattern) => pattern.test(text));
};

const isPlayerPredictionQuestion = (question) => {
  const text = String(question ?? "").toLowerCase();
  const asksPlayerIdentity = /谁|哪位|哪个球员|player|prospect/.test(text);
  const asksPickSlot = /当前顺位|第\s*\d+\s*顺位|\d+\s*顺位|pick\s*\d+|第一顺位|第二顺位|第三顺位|状元|榜眼|探花/.test(text);
  const asksPrediction = /最可能|预测|会选|选谁|选择谁|谁会被选|球员预测/.test(text);
  const asksPickReasoning = /为什么|理由|依据|证据|风险|替代|备选|人选|适配|fit|risk|alternative|runner-up/.test(text);
  const asksFullBoard = /完整.*首轮|全部.*首轮|所有.*首轮|30.*顺位|三十.*顺位|full.*board/.test(text);
  const asksReferenceOnly = /字段|口径|评分|计分|题意|需要哪些|数据项|draftcode24|combine|体测|臂展|弹跳|手掌|\b[a-d][1-9]\b/i.test(text);

  if (asksReferenceOnly) return false;
  if (asksFullBoard) return true;
  if (asksPlayerIdentity && (asksPickSlot || asksPrediction)) return true;
  if (asksPickSlot && asksPrediction) return true;
  if (asksPickReasoning && /当前|顺位|pick|球员|预测板|选择|选/.test(text)) return true;
  return false;
};

const chineseDigits = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const parseChineseNumber = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [tensText, onesText] = text.split("十");
    const tens = tensText ? chineseDigits[tensText] : 1;
    const ones = onesText ? chineseDigits[onesText] : 0;
    if (typeof tens !== "number" || typeof ones !== "number") return null;
    return tens * 10 + ones;
  }
  return typeof chineseDigits[text] === "number" ? chineseDigits[text] : null;
};

const getRequestedPickNumber = (question, selectedPickNumber) => {
  const text = String(question ?? "");
  const lower = text.toLowerCase();
  if (/状元|第一顺位|第\s*一\s*顺位/.test(text)) return 1;
  if (/榜眼|第二顺位|第\s*二\s*顺位/.test(text)) return 2;
  if (/探花|第三顺位|第\s*三\s*顺位/.test(text)) return 3;

  const numericMatch =
    lower.match(/(?:第\s*)?(\d{1,2})\s*(?:顺位|号签)/) ?? lower.match(/pick\s*#?\s*(\d{1,2})/);
  if (numericMatch) {
    const pick = Number(numericMatch[1]);
    if (pick >= 1 && pick <= 30) return pick;
  }

  const chineseMatch = text.match(/(?:第\s*)?([一二两三四五六七八九十]{1,3})\s*(?:顺位|号签)/);
  if (chineseMatch) {
    const pick = parseChineseNumber(chineseMatch[1]);
    if (pick && pick >= 1 && pick <= 30) return pick;
  }

  return selectedPickNumber;
};

const buildReadOnlyPredictionAnswer = ({ question, context, selectedPickNumber }) => {
  const text = String(question ?? "").toLowerCase();
  const board = context.board ?? [];
  const asksFullBoard = /完整.*首轮|全部.*首轮|所有.*首轮|30.*顺位|三十.*顺位|full.*board/.test(text);

  if (asksFullBoard) {
    const lines = board.map(
      (pick) => `第 ${pick.pick} 顺位 ${pick.team} 选择 ${pick.prospect?.name ?? "N/A"}`,
    );
    return `当前锁定首轮预测：\n${lines.join("\n")}`;
  }

  const requestedPickNumber = getRequestedPickNumber(question, selectedPickNumber);
  const pick = board.find((item) => item.pick === requestedPickNumber) ?? context.selectedPick ?? board[0];
  if (!pick) return "当前没有可用的锁定预测板。";

  const base = `当前锁定预测：第 ${pick.pick} 顺位 ${pick.team} 选择 ${pick.prospect?.name ?? "N/A"}。`;
  if (/风险|risk|warning|隐患/.test(text)) {
    const risks = [...(pick.warnings ?? []), ...(pick.prospect?.risks ?? [])].filter(Boolean);
    return `${base}主要风险：${risks.slice(0, 3).join("；") || "当前锁定板未标注主要风险。"}。`;
  }

  if (/替代|备选|人选|alternative|runner-up/.test(text)) {
    const alternatives = (pick.alternatives ?? []).slice(0, 3).map((item) => item.name);
    return `${base}备选人选：${alternatives.join("；") || "当前锁定板未保留备选人选。"}。`;
  }

  if (/为什么|理由|依据|证据|适配|fit|why/.test(text)) {
    const evidence = (pick.evidence ?? []).slice(0, 3);
    return `${base}主要依据：${evidence.join("；") || pick.roleFit || "当前锁定板未保留依据。"}。`;
  }

  return base;
};

const buildScopeGuardAnswer = () =>
  "当前 DeepSeek 只负责只读问答：可以回答应试题、参考文档口径和预测主题问题，但只能读取当前锁定预测板，不能生成、修改、交换、重排或建议调整预测球员。";

const callDeepSeek = async ({ question, history, selectedPickNumber, context: providedContext }) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY. Put it in .env.local before using the chat window.");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
  const modelLabel = getModelLabel(model);
  const maxTokens = Number(process.env.DEEPSEEK_CHAT_MAX_TOKENS ?? 1800);
  const context = providedContext ?? (await buildContext(selectedPickNumber));
  const retrievedKnowledge = await buildRetrievedKnowledge({
    question,
    selectedPick: context.selectedPick,
  });
  const compactHistory = Array.isArray(history)
    ? history.slice(-8).map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content ?? "").slice(0, 1600),
      }))
    : [];

  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content: [
          "你是 DraftOps 当前 DeepSeek 只读问答 Agent，不是预测生成 Agent，不是预测修改 Agent。",
          "你可以回答当前本地应试题集合、参考文档里的里程碑题意/字段口径/评分口径，也可以回答预测主题问题。",
          "预测主题问题只允许基于当前锁定预测板做只读回答；不得产生新的预测，不得替换预测球员，不得建议改动。",
          "硬性边界 1：当前 DeepSeek 禁止生成预测球员，禁止新增预测球员，禁止删除预测球员。",
          "硬性边界 2：当前 DeepSeek 禁止修改、交换、重排、复核或建议调整任何 30 顺位球员预测。",
          "硬性边界 3：当前 DeepSeek 禁止建议某队改选其他球员，禁止输出替代预测板。",
          "硬性边界 4：30 顺位球员预测由当前锁定预测管线提供；该管线未来可以是 Codex、另一个 DeepSeek 或其他指定模块，但不是当前这个只读问答 DeepSeek。",
          "参考文档边界：DraftCode24里程碑事件预测.md 可用于回答题意、字段口径、评分口径和参考题目说明，不能作为官方赛果或预测球员调整依据。",
          "如果用户问参考文档里的 A1/B1/C1/D1 等题目设计，按参考文档回答字段和口径；如果问当前最终答案，必须以当前本地 examFacts 为准。",
          "如果参考文档与当前本地 examFacts 冲突，必须以当前本地 examFacts 为准；不能因为参考文档而改预测球员。",
          "如果问题涉及具体球员预测、预测理由、风险或备选人选，只能基于当前锁定预测板中已有字段回答；如果用户要求改动、重排、替换或推荐新预测，必须拒绝改动并说明当前 DeepSeek 只读。",
          "再次确认：你只能回答问题；你不能调整预测球员；你不能输出新的选秀预测。",
          "必须按以下优先级回答：1 本地知识库和当前锁定板应试题事实；2 官方本地数据和 NBA.com 官方材料；3 如果本地证据不足，使用提供的官方联网检索片段；4 仍不足时才使用模型全局知识。",
          "官方来源优先级高于媒体、社区、传闻和模型记忆。",
          "最终只输出当前问题最可能正确的答案。",
          "只回答用户当前问题，不要给额外建议，不要扩展无关背景，不要列来源清单，不要免责声明。",
          "不要输出 Markdown，不要标题，不要 # 号，不要项目符号，不要代码块。",
          "不要输出任何密钥。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "预测边界重复说明：当前 DeepSeek 禁止调整预测球员；禁止生成、修改、交换、重排 30 顺位预测；预测主题问题只能读取当前锁定预测板回答。",
          "当前应试题上下文如下，题目数量以 questionCount 和 examQuestions 数组为准：",
          JSON.stringify(context.deepSeekContext),
          "已按优先级检索到的知识如下：",
          JSON.stringify(retrievedKnowledge),
          "最近对话：",
          JSON.stringify(compactHistory),
          "用户新问题：",
          String(question ?? "").slice(0, 3000),
        ].join("\n\n"),
      },
    ],
    max_tokens: maxTokens,
    temperature: 0.25,
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
    throw new Error(`DeepSeek request failed: ${response.status} ${response.statusText} ${responseText}`);
  }

  const completion = JSON.parse(responseText);
  const answer = sanitizeAnswer(completion.choices?.[0]?.message?.content);
  if (!answer) throw new Error("DeepSeek response did not include message content.");

  return {
    answer,
    model,
    modelLabel,
    mode: "deepseek-exam",
    usage: completion.usage ?? null,
  };
};

await loadEnvFile(localEnvPath);
await loadEnvFile(envPath);

const port = Number(process.env.DEEPSEEK_AGENT_PORT ?? 4318);
const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(request, response, 204, {});
    return;
  }

  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    if (request.method === "GET" && url.pathname === "/api/deepseek/health") {
      const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
      sendJson(request, response, 200, {
        ok: true,
        configured: Boolean(process.env.DEEPSEEK_API_KEY),
        model,
        modelLabel: getModelLabel(model),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/deepseek/chat") {
      const body = await readRequestJson(request);
      const question = String(body.question ?? "").trim();
      if (!question) {
        sendJson(request, response, 400, { error: "Question is required." });
        return;
      }

      const selectedPickNumber = Number(body.selectedPickNumber ?? 1);
      const context = await buildContext(selectedPickNumber);
      const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
      const examQuestion = isExamQuestion(question, context);
      const predictionQuestion = isPredictionQuestion(question);
      const playerPredictionQuestion = isPlayerPredictionQuestion(question);

      if (playerPredictionQuestion) {
        sendJson(request, response, 200, {
          answer: buildReadOnlyPredictionAnswer({ question, context, selectedPickNumber }),
          model,
          modelLabel: getModelLabel(model),
          mode: "locked-board-readonly",
        });
        return;
      }

      if (!examQuestion) {
        const answer = predictionQuestion
          ? buildReadOnlyPredictionAnswer({ question, context, selectedPickNumber })
          : buildScopeGuardAnswer();
        sendJson(request, response, 200, {
          answer,
          model,
          modelLabel: getModelLabel(model),
          mode: predictionQuestion ? "locked-board-readonly" : "local-scope-guard",
        });
        return;
      }

      const result = await callDeepSeek({
        question,
        history: body.history,
        selectedPickNumber,
        context,
      });
      sendJson(request, response, 200, result);
      return;
    }

    sendJson(request, response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(request, response, 500, { error: error instanceof Error ? error.message : "Unknown server error." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`DeepSeek chat server listening on http://127.0.0.1:${port}`);
});
