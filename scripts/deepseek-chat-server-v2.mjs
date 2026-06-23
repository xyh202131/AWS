import http from "node:http";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { spawn } from "node:child_process";
import { draftOpsManifest, resolveManifestPath, rootDir } from "./lib/draftops-manifest.mjs";

// ==================== 配置 ====================
const localEnvPath = resolve(rootDir, ".env.local");
const envPath = resolve(rootDir, ".env");
const boardPath = resolveManifestPath(draftOpsManifest.data?.boardPath, "public/data/agent_expanded_recommended_board.json");
const bundlePath = resolveManifestPath(draftOpsManifest.data?.bundlePath, "public/data/final_import_bundle.json");
const documentIndexPath = resolve(rootDir, "data", "documents", "document_index.json");
const milestoneReferencePath = resolve(rootDir, "data", "documents", "milestone-questions", "DraftCode24里程碑事件预测.md");
const milestoneAnswersPath = resolve(rootDir, "data", "final", "milestone_answers.json");

const knowledgePaths = [
  "data/README.md",
  "data/documents/README.md",
  "data/documents/milestone-questions/DraftCode24里程碑事件预测.md",
  "data/reports/official_prospect_reconciliation_report.md",
  "data/reports/official_double_agent_roster_audit_summary.md",
  "data/reports/a13_official_local_table_audit.md",
  "data/reports/a14_official_live_refresh_audit.md",
  "data/reports/d8_source_quality_debate.md",
  "data/reports/raw_sources_registry_report.md",
  "data/reports/china_nba_draft_scrape_report_20260623.md",
  "data/reports/player_feature_parameter_reference_124_20260623.md",
  "data/reports/online_full_player_list_reverification_20260623.md",
  "data/reports/relative_scoring_prediction_20260624.md",
  "data/reports/team_preference_research_20260623.json",
  "data/raw/nba-official-2026-prospects-live.md",
  "data/raw/nba-official-2026-draft-order-live.md",
  "data/raw/china-nba-draft-20260623.md",
];

const structuredKnowledgePaths = [
  "data/rag/rag-core-board.json",
  "data/rag/rag-team-preference.json",
  "data/rag/rag-prospect-evidence.json",
  "data/rag/rag-milestone.json",
  "data/rag/rag-architecture.json",
  "data/documents/document_index.json",
  "data/clean/data_quality_report.md",
  "data/clean/official_prospect_reconciliation.json",
  "data/raw/raw_sources.json",
  "data/raw/china-nba-draft-links-20260623.json",
  "data/normalized/normalized_2026_mock_lottery.json",
  "data/normalized/normalized_china_nba_draft_board_20260623.json",
  "data/normalized/normalized_2026_local_player_pool_124.json",
  "data/normalized/normalized_2026_player_feature_reference_124.json",
  "data/normalized/normalized_2026_online_player_list_reverification_20260623.json",
  "data/normalized/normalized_2026_official_prospects_101.json",
  "data/normalized/normalized_2026_official_team_profiles_30.json",
  "data/normalized/normalized_2026_team_context.json",
  "data/normalized/normalized_2026_prospect_big_board.json",
  "data/final/milestone_answers.json",
  "data/reports/milestone_prediction_evidence_20260623.json",
  "data/reports/milestone_answer_card_write_report_20260623.json",
  "public/data/prospect_media.json",
  draftOpsManifest.data?.bundlePath ?? "public/data/final_import_bundle.json",
  draftOpsManifest.data?.boardPath ?? "public/data/agent_expanded_recommended_board.json",
];

const officialWebSources = (draftOpsManifest.sourceLinks ?? []).map((source) => ({
  name: source.label?.en ?? source.label?.zh ?? source.url,
  url: source.url,
}));

// RAG参数优化
const ragEmbeddingDimensions = 256;
const ragRerankPoolSize = 60; // 扩大重排序池
const ragSnippetLimit = 12; // 更聚焦的片段数
const ragInitialRetrievalK = 80; // 初始召回更多

// 缓存配置
const CACHE_MAX_SIZE = 200;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10分钟缓存
const responseCache = new Map();

// ==================== 工具函数 ====================
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
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
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
    for (const size of [2, 3, 4]) {
      for (let index = 0; index <= sequence.length - size; index += 1) {
        terms.push(sequence.slice(index, index + size));
      }
    }
    return terms;
  });
  return [...new Set([...ascii, ...cjkTerms].filter((term) => term.length >= 2))];
};

const compactText = (value, maxLength = 8000) => {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
};

const compactJson = (value, maxLength = 2000) => {
  const text = JSON.stringify(value, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
};

const hashString = (str) => crypto.createHash("md5").update(str).digest("hex");

// ==================== 缓存机制 ====================
const getCachedResponse = (cacheKey) => {
  const entry = responseCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(cacheKey);
    return null;
  }
  return entry.data;
};

const setCachedResponse = (cacheKey, data) => {
  if (responseCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
  responseCache.set(cacheKey, { data, timestamp: Date.now() });
};

// ==================== 问题分类与动态参数 ====================
const classifyQuestion = (question) => {
  const text = String(question ?? "").toLowerCase();

  // 事实性问题：顺位、数据、统计
  const factual = /第几|多少|几个|谁是|是哪位|排名|顺位|分数|数据|统计|年龄|身高|学校|位置|pick\s*\d+|#\d+|第\s*\d+\s*顺位|first|second|third|how many|which|who|what (pick|number|score|rank)/.test(text);

  // 解释性问题：为什么、理由、依据
  const explanatory = /为什么|为何|理由|依据|怎么看|分析|解释|说明|why|reason|explain|analysis|fit|risk|alternative/.test(text);

  // 创造性/策略问题：战术、如果、假设
  const creative = /如果|假如|假设|战术|策略|要是|建议|可以|会怎样|if|strategy|suggest|what if|could|would/.test(text);

  if (factual && !explanatory && !creative) return "factual";
  if (creative) return "creative";
  return "explanatory";
};

const getTemperatureForQuestion = (questionType) => {
  switch (questionType) {
    case "factual": return 0.15; // 事实性问题低温确保准确
    case "creative": return 0.7; // 创造性问题稍高温
    default: return 0.35; // 解释性问题中等
  }
};

// ==================== 查询改写（Query Rewrite） ====================
const rewriteQuery = (question, selectedPick, selectedPickMode) => {
  const text = String(question ?? "").trim();
  if (!text) return text;

  // 简单的查询扩展：基于问题类型添加相关关键词
  const intentTerms = [];
  const lower = text.toLowerCase();

  if (/顺位|签位|pick/.test(lower)) intentTerms.push("draft board prediction consensus ranking pick number");
  if (/为什么|why|reason/.test(lower)) intentTerms.push("rationale evidence fit score confidence margin");
  if (/风险|risk/.test(lower)) intentTerms.push("warning fallback injury concern medical risk profile");
  if (/备选|alternative|runner|备选人/.test(lower)) intentTerms.push("alternatives candidates next best runner-up");
  if (/球队|team|适配|fit/.test(lower)) intentTerms.push("team need roster rebuild contend preference position");
  if (/球员|player|prospect/.test(lower)) intentTerms.push("prospect profile measurements position school strengths weaknesses");
  if (/学校|school|大学|college/.test(lower)) intentTerms.push("college university school class year freshman sophomore");
  if (/分数|score|评分|相对分/.test(lower)) intentTerms.push("consensus need player upside feature source relative min-max pool scoring");

  // 添加选中球员上下文
  if (selectedPickMode === "direct" && selectedPick) {
    intentTerms.push(
      selectedPick.team,
      selectedPick.prospect?.name,
      selectedPick.prospect?.school,
      ...(selectedPick.prospect?.positions ?? [])
    );
  }

  return [...new Set([text, ...intentTerms].filter(Boolean))].join(" ").slice(0, 1200);
};

// ==================== 选中球员上下文 ====================
const toDeepSeekSelectedPick = (selectedPick) =>
  selectedPick
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
        score: selectedPick.score,
        confidence: selectedPick.confidence,
        margin: selectedPick.margin,
      }
    : null;

const includesAlias = (text, alias) => {
  const normalizedAlias = String(alias ?? "").toLowerCase().trim();
  return normalizedAlias.length >= 2 && text.includes(normalizedAlias);
};

const chineseNumberValue = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const digits = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (text === "十") return 10;
  if (/^十[一二两三四五六七八九]$/.test(text)) return 10 + digits[text[1]];
  if (/^[一二两三四五六七八九]十$/.test(text)) return digits[text[0]] * 10;
  if (/^[一二两三四五六七八九]十[一二两三四五六七八九]$/.test(text)) return digits[text[0]] * 10 + digits[text[2]];
  return digits[text] ?? null;
};

const explicitPickNumberFromQuestion = (question) => {
  const text = String(question ?? "").toLowerCase();
  const digitMatch = text.match(/(?:#|pick\s*)\s*(\d{1,2})|(?:第\s*)?(\d{1,2})\s*(?:顺位|签位|号签)/i);
  if (digitMatch) {
    const value = Number(digitMatch[1] ?? digitMatch[2]);
    if (Number.isFinite(value) && value >= 1 && value <= 60) return value;
  }
  const chineseMatch = text.match(/第?\s*([一二两三四五六七八九十]{1,3})\s*(?:顺位|签位|号签)/);
  const chineseValue = chineseNumberValue(chineseMatch?.[1]);
  return Number.isFinite(chineseValue) && chineseValue >= 1 && chineseValue <= 60 ? chineseValue : null;
};

const selectedPickAliases = (selectedPick) => {
  if (!selectedPick) return [];
  const player = String(selectedPick.prospect?.name ?? "");
  const team = String(selectedPick.team ?? "");
  const school = String(selectedPick.prospect?.school ?? "");
  const origin = String(selectedPick.prospect?.origin ?? "");
  const aliases = [player, team, school, origin];
  for (const value of [player, team]) {
    const parts = value.split(/\s+/).filter((part) => part.length >= 3);
    aliases.push(...parts);
  }
  return [...new Set(aliases.filter(Boolean))];
};

const questionNamesSelectedPick = (question, selectedPick) => {
  const text = String(question ?? "").toLowerCase();
  if (!selectedPick || !text) return false;
  const explicitPickNumber = explicitPickNumberFromQuestion(text);
  if (explicitPickNumber === Number(selectedPick.pick)) return true;
  return selectedPickAliases(selectedPick).some((alias) => includesAlias(text, alias));
};

const shouldUseSelectedPickContext = (question, selectedPick) => {
  if (!selectedPick) return false;
  const text = String(question ?? "").toLowerCase();
  if (!text) return false;
  const selectedContextPatterns = [
    /当前\s*(顺位|签位|球队|球员|栏目|选中)/,
    /(这个|该|此)\s*(顺位|签位|球队|球员|栏目)/,
    /(选中|点击|右侧|详情页|详情栏|当前页).*(顺位|签位|球队|球员|栏目)/,
    /(顺位|签位|球队|球员|栏目).*(选中|点击|右侧|详情页|详情栏|当前页)/,
    /\b(this|selected|current)\s+(pick|team|player|slot|panel|card)\b/,
    /\b(pick|team|player|slot|panel|card)\s+(selected|current)\b/,
  ];
  return selectedContextPatterns.some((pattern) => pattern.test(text)) || questionNamesSelectedPick(question, selectedPick);
};

const questionAsksGlobalScope = (question) => {
  const text = String(question ?? "").toLowerCase();
  return /整体|全局|全部|所有|整轮|首轮|前\s*30|30\s*(顺位|签|队|人)|三十|排名|榜单|统计|数量|多少|几个|哪所|哪支|哪个大学|哪个学校|里程碑|答题卡|比赛|赛题|规则|提交|演示|视频|架构|aws|部署|系统|平台|agent|rag|embedding|数据库|前端|后端|lambda|s3|cloudfront|dynamodb|deepseek|bedrock|qwen|dashscope/.test(text);
};

const questionRejectsSelectedOnlyScope = (question) => {
  const text = String(question ?? "").toLowerCase();
  return /不要.*(只|仅).*当前|别.*(只|仅).*当前|不.*(只|仅).*当前|不要只回答|不要仅回答|not\s+only.*current|don't\s+only.*current|do\s+not\s+only.*current/.test(text);
};

const questionLooksLikeSelectedFollowUp = (question) => {
  const text = String(question ?? "").toLowerCase().trim();
  if (!text) return false;
  return /^(为什么|为何|理由|依据|证据|风险|备选|替代|适配|fit|risk|why|reason|evidence|alternative|runner-up|详细|展开|分析|说明|解释)/.test(text) ||
    /为什么.*(选|这样|这么)|这么选|这样选|适配吗|合适吗|风险呢|还有谁|备选是谁|理由是什么|依据是什么/.test(text);
};

const selectedPickFocusMode = ({ question, selectedPick, selectedPickFocusActive = false }) => {
  if (selectedPickFocusActive && (questionAsksGlobalScope(question) || questionRejectsSelectedOnlyScope(question))) return "background";
  if (shouldUseSelectedPickContext(question, selectedPick)) return "direct";
  if (!selectedPickFocusActive) return "inactive";
  if (questionLooksLikeSelectedFollowUp(question) && !questionAsksGlobalScope(question)) return "direct";
  return "background";
};

const getSearchTerms = ({ question, selectedPick, useSelectedPickContext = false }) => {
  const selectedTerms = useSelectedPickContext && selectedPick
    ? [
        selectedPick.team,
        selectedPick.prospect?.name,
        selectedPick.prospect?.school,
        selectedPick.prospect?.origin,
        ...(selectedPick.prospect?.positions ?? []),
      ]
    : [];
  return tokenize([question, ...selectedTerms].join(" ")).slice(0, 40);
};

const localQuestionIntent = (question, selectedPickMode = "inactive") => {
  const text = String(question ?? "").toLowerCase();
  const intent = {
    milestone: /里程碑|题目|答题|答案|字段|a\d|b\d|c\d|d\d|question|milestone|field|answer/.test(text),
    team: /球队|适配|需求|阵容|签位|team|fit|need|roster|pick/.test(text),
    prospect: /球员|候选|学校|身高|体重|位置|prospect|player|school|height|weight|position/.test(text),
    evidence: /来源|证据|官方|验证|审计|source|evidence|official|audit|verify/.test(text),
    board: /预测|榜单|首轮|顺位|board|mock|draft|rank|prediction|相对评分|min-max/.test(text),
    architecture: /架构|aws|部署|系统|平台|agent|rag|embedding|数据库|前端|后端|lambda|s3|cloudfront|dynamodb|deepseek|bedrock|qwen|dashscope/.test(text),
  };
  if (selectedPickMode === "direct") {
    intent.team = true;
    intent.prospect = true;
    intent.board = true;
  }
  return intent;
};

const activeIntentLabels = (intent) =>
  Object.entries(intent).filter(([, active]) => active).map(([label]) => label);

// ==================== RAG 优化版分块与检索 ====================
const chunkText = (text, size = 900) => { // 更小的chunk提升检索精度
  const clean = String(text ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];
  const chunks = [];
  const paragraphs = clean.split(/(?:(?:\r?\n){2,}|(?=#+\s+))/).map((part) => part.trim()).filter(Boolean);
  let current = "";
  for (const paragraph of paragraphs.length ? paragraphs : [clean]) {
    if (paragraph.length > size) {
      if (current) { chunks.push(current); current = ""; }
      const overlap = 150;
      for (let index = 0; index < paragraph.length; index += size - overlap) {
        chunks.push(paragraph.slice(index, index + size));
      }
      continue;
    }
    if (!current) current = paragraph;
    else if (`${current}\n\n${paragraph}`.length <= size) current = `${current}\n\n${paragraph}`;
    else { chunks.push(current); current = paragraph; }
  }
  if (current) chunks.push(current);
  return chunks;
};

const scoreText = (text, terms) => {
  const lower = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const normalized = term.toLowerCase();
    if (lower.includes(normalized)) {
      // 更长的term权重更高
      score += normalized.length >= 4 ? 2 : 1;
    }
  }
  return score;
};

const sourceBoostForRank = (sourceRank) => ({
  "official-local": 0.18,
  "official-web": 0.16,
  "structured-data": 0.15,
  "milestone-data": 0.14,
  "question-reference": 0.10,
  "source-registry": 0.08,
  "local-knowledge": 0.05,
})[sourceRank] ?? 0.04;

const hashToken = (token) => {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const embedText = (value, dimensions = ragEmbeddingDimensions) => {
  const vector = new Float32Array(dimensions);
  const terms = tokenize(value);
  if (!terms.length) return vector;
  for (const term of terms) {
    const hash = hashToken(term);
    const index = (hash >>> 1) % dimensions;
    const sign = hash & 1 ? -1 : 1;
    vector[index] += sign * (1 + Math.log2(term.length + 1));
  }
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (!norm) return vector;
  for (let index = 0; index < vector.length; index += 1) vector[index] /= norm;
  return vector;
};

const cosineSimilarity = (left, right) => {
  const length = Math.min(left?.length ?? 0, right?.length ?? 0);
  if (!length) return 0;
  let score = 0;
  for (let index = 0; index < length; index += 1) score += left[index] * right[index];
  return score;
};

const scoreChunkForRetrieval = (chunk, { terms, queryEmbedding }) => {
  const searchableText = [chunk.source, chunk.path, chunk.sourceName, chunk.text].filter(Boolean).join("\n");
  const embedding = chunk.embedding ?? embedText(searchableText);
  const exactMatches = scoreText(searchableText, terms);
  const lexicalScore = terms.length ? Math.min(exactMatches / (terms.length * 1.5), 1) : 0;
  const semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, embedding));
  const sourceBoost = sourceBoostForRank(chunk.sourceRank);
  // 位置偏置：包含顺位号或球员名的片段加分
  const positionBonus = /第?\d+顺位|#\d+|pick\s*\d+/.test(searchableText) && terms.some(t => /\d/.test(t)) ? 0.06 : 0;
  const score = semanticScore * 0.50 + lexicalScore * 0.38 + sourceBoost + positionBonus + (exactMatches >= 3 ? 0.05 : 0);
  return { ...chunk, embedding, exactMatches, lexicalScore, semanticScore, score };
};

const rerankChunks = (candidates, limit = ragSnippetLimit, poolSize = ragRerankPoolSize) => {
  const pool = [...candidates].sort((left, right) => right.score - left.score).slice(0, poolSize);
  const selected = [];
  while (selected.length < limit && pool.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      const redundancy = selected.length
        ? Math.max(...selected.map((item) => cosineSimilarity(candidate.embedding, item.embedding)))
        : 0;
      // MMR (Maximal Marginal Relevance) 调整：相关性0.75，多样性0.25
      const mmrScore = candidate.score * 0.75 - redundancy * 0.25;
      if (mmrScore > bestScore) { bestScore = mmrScore; bestIndex = index; }
    }
    selected.push(pool.splice(bestIndex, 1)[0]);
  }
  return selected;
};

const retrievalSnippet = ({ embedding, lexicalScore, semanticScore, score, exactMatches, ...chunk }) => ({
  ...chunk,
  retrievalScore: Number(score.toFixed(4)),
  semanticScore: Number(semanticScore.toFixed(4)),
  lexicalScore: Number(lexicalScore.toFixed(4)),
  exactMatches,
});

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
        : relativePath.includes("relative_scoring")
          ? "structured-data"
          : "local-knowledge";
  return chunkText(content).map((text) => ({ source: relativePath, sourceRank, text }));
};

const sourceRankForStructuredPath = (relativePath) =>
  relativePath.includes("board") || relativePath.includes("bundle") || relativePath.includes("normalized") || relativePath.includes("team_preference")
    ? "structured-data"
    : relativePath.includes("milestone")
      ? "milestone-data"
      : relativePath.includes("official") || relativePath.includes("nba-official")
        ? "official-local"
        : relativePath.includes("raw_sources") || relativePath.includes("source_quality")
          ? "source-registry"
          : "local-knowledge";

const makeStructuredChunk = ({ source, sourceRank, path, value, label }) => ({
  source, sourceRank, path,
  text: [label ? `Record: ${label}` : null, `Path: ${path}`, compactJson(value)].filter(Boolean).join("\n"),
});

const labelForRecord = (item, fallback) => {
  if (!item || typeof item !== "object") return fallback;
  const pick = item.pick ?? item.draft_pick ?? item.draftPick ?? item.rank ?? item.source_rank;
  const team = item.team ?? item.team_name ?? item.teamName ?? item.team_abbreviation;
  const player = item.player ?? item.name ?? item.prospect?.name ?? item.prospect_name ?? item.prospectName ?? item.sourceName ?? item.title;
  return [pick ? `pick/rank ${pick}` : null, team, player].filter(Boolean).join(" | ") || fallback;
};

const collectStructuredChunks = (value, { source, sourceRank, path = "$", chunks = [], depth = 0 }) => {
  if (chunks.length >= 1000 || depth > 7 || value == null) return chunks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (item && typeof item === "object") {
        chunks.push(makeStructuredChunk({ source, sourceRank, path: itemPath, value: item, label: labelForRecord(item, itemPath) }));
        collectStructuredChunks(item, { source, sourceRank, path: itemPath, chunks, depth: depth + 1 });
      }
    });
    return chunks;
  }
  if (typeof value !== "object") return chunks;
  const keys = Object.keys(value);
  if (depth > 0 && keys.length <= 20 && JSON.stringify(value).length <= 2400) {
    chunks.push(makeStructuredChunk({ source, sourceRank, path, value, label: labelForRecord(value, path) }));
  }
  for (const [key, child] of Object.entries(value)) {
    if (Array.isArray(child)) {
      collectStructuredChunks(child, { source, sourceRank, path: `${path}.${key}`, chunks, depth: depth + 1 });
    } else if (child && typeof child === "object" && depth < 4) {
      collectStructuredChunks(child, { source, sourceRank, path: `${path}.${key}`, chunks, depth: depth + 1 });
    }
  }
  return chunks;
};

const readStructuredKnowledgeFile = async (relativePath) => {
  const absolutePath = resolve(rootDir, relativePath);
  const content = await readFile(absolutePath, "utf8").catch(() => "");
  if (!content) return [];
  const sourceRank = sourceRankForStructuredPath(relativePath);
  const trimmed = content.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.schemaVersion === "draftops.rag.index.v1" && Array.isArray(parsed.chunks)) {
      return parsed.chunks.map((chunk, index) => ({
        source: `${relativePath}#${chunk.source ?? "chunk"}`,
        sourceRank,
        path: chunk.path ?? `$rag[${index}]`,
        text: String(chunk.text ?? ""),
      }));
    }
    return collectStructuredChunks(parsed, { source: relativePath, sourceRank });
  } catch {
    return chunkText(content).map((text, index) => ({ source: relativePath, sourceRank, path: `$text[${index}]`, text }));
  }
};

// ==================== 优化版RAG检索（带查询改写和Agentic Loop） ====================
const retrieveLocalKnowledge = async ({ question, selectedPick, useSelectedPickContext = false, rewrittenQuery = null }) => {
  const effectiveQuery = rewrittenQuery ?? question;
  const terms = getSearchTerms({ question: effectiveQuery, selectedPick, useSelectedPickContext });
  const queryEmbedding = embedText([effectiveQuery, ...terms].join(" "));
  const allChunks = (
    await Promise.all([
      ...knowledgePaths.map(readKnowledgeFile),
      ...structuredKnowledgePaths.map(readStructuredKnowledgeFile),
    ])
  ).flat();
  const scored = allChunks.map((chunk) => scoreChunkForRetrieval(chunk, { terms, queryEmbedding }));
  const matching = scored.filter((chunk) => chunk.exactMatches > 0 || chunk.semanticScore >= 0.06);
  const candidates = matching.length >= ragInitialRetrievalK / 2 ? matching : scored;
  const ranked = rerankChunks(candidates, ragSnippetLimit, ragRerankPoolSize);
  return {
    terms,
    retrievalMode: "optimized-hybrid: lexical(BM25-like) + semantic(hash-embedding) + source-boost + position-bonus + MMR-rerank",
    snippets: ranked,
    hasStrongLocalMatch: ranked.some(
      (item) => item.exactMatches >= 3 || item.score >= 0.50 || (["official-local", "structured-data"].includes(item.sourceRank) && item.exactMatches > 0),
    ),
  };
};

const snippetSourceText = (snippet) => [snippet?.source, snippet?.path, snippet?.sourceName].filter(Boolean).join("\n").toLowerCase();
const hasSnippetSource = (snippets, pattern) => snippets.some((snippet) => pattern.test(snippetSourceText(snippet)));

const isStrongLocalSnippet = (snippet) =>
  Number(snippet.exactMatches ?? 0) >= 2 ||
  Number(snippet.lexicalScore ?? 0) >= 0.14 ||
  Number(snippet.semanticScore ?? 0) >= 0.22 ||
  Number(snippet.score ?? 0) >= 0.40 ||
  (["official-local", "structured-data", "milestone-data"].includes(snippet.sourceRank) && Number(snippet.exactMatches ?? 0) > 0);

const reflectLocalRetrieval = ({ question, selectedPickMode, local, attemptCount }) => {
  const intent = localQuestionIntent(question, selectedPickMode);
  const snippets = local?.snippets ?? [];
  const sourceDiversity = new Set(snippets.map((snippet) => String(snippet.source ?? "").split("#")[0])).size;
  const strongSnippetCount = snippets.filter(isStrongLocalSnippet).length;
  const maxScore = snippets.reduce((score, snippet) => Math.max(score, Number(snippet.score ?? 0)), 0);
  const coverage = {
    board: hasSnippetSource(snippets, /board|mock|draft|prediction|consensus|strategy|agent_(balanced|expanded)|final_import_bundle|expanded_import_bundle|relative_scoring/),
    team: hasSnippetSource(snippets, /team|team_context|team_preference|official_team_profiles|clean_teams|needs/),
    prospect: hasSnippetSource(snippets, /prospect|player|local_player_pool|feature_reference|official_prospects|clean_prospects|china_nba_draft|big_board/),
    milestone: hasSnippetSource(snippets, /milestone|draftcode24|answer|答题|里程碑/),
    evidence: hasSnippetSource(snippets, /audit|source|official|raw|verification|reconciliation|quality/),
    architecture: hasSnippetSource(snippets, /architecture|aws|lambda|s3|cloudfront|dynamodb|rag|readme/),
  };
  const missingSignals = [];
  if (snippets.length < 4) missingSignals.push("too-few-snippets");
  if (strongSnippetCount < 2) missingSignals.push("weak-direct-match");
  if (sourceDiversity < 2 && snippets.length >= 3) missingSignals.push("low-source-diversity");
  if (intent.milestone && !coverage.milestone) missingSignals.push("missing-milestone-source");
  if (intent.evidence && !coverage.evidence) missingSignals.push("missing-evidence-source");
  if (intent.team && !coverage.team) missingSignals.push("missing-team-source");
  if (intent.prospect && !coverage.prospect) missingSignals.push("missing-prospect-source");
  if (intent.board && !coverage.board) missingSignals.push("missing-board-source");
  if (intent.architecture && !coverage.architecture) missingSignals.push("missing-architecture-source");
  const criticalMissing = missingSignals.filter((signal) => signal.startsWith("missing-"));
  const sufficient = snippets.length >= 4 && strongSnippetCount >= 2 && maxScore >= 0.14 && (sourceDiversity >= 2 || criticalMissing.length === 0);
  return {
    attemptCount, sufficient,
    decision: sufficient ? "answer" : attemptCount >= 2 ? "answer-cautiously" : "retrieve-again",
    missingSignals, coverage, snippetCount: snippets.length, strongSnippetCount, sourceDiversity,
    maxScore: Number(maxScore.toFixed(4)),
  };
};

const followUpLocalQuery = ({ question, selectedPick, selectedPickMode, reflection }) => {
  if (reflection?.sufficient || !(reflection?.missingSignals?.length)) return "";
  const intent = localQuestionIntent(question, selectedPickMode);
  const supplements = [];
  if (reflection.missingSignals.includes("too-few-snippets")) supplements.push("broaden recall across indexed local knowledge");
  if (reflection.missingSignals.includes("weak-direct-match")) supplements.push("exact aliases fields evidence records");
  if (reflection.missingSignals.includes("low-source-diversity")) supplements.push("cross check another source family");
  if (intent.milestone || reflection.missingSignals.includes("missing-milestone-source")) supplements.push("milestone answers DraftCode24 answer card required fields");
  if (intent.evidence || reflection.missingSignals.includes("missing-evidence-source")) supplements.push("official source audit verification reconciliation evidence");
  if (intent.team || reflection.missingSignals.includes("missing-team-source")) supplements.push("team preference roster needs fit pick ownership rebuild contend");
  if (intent.prospect || reflection.missingSignals.includes("missing-prospect-source")) supplements.push("prospect profile measurements school position risk upside");
  if (intent.board || reflection.missingSignals.includes("missing-board-source")) supplements.push("draft board relative min-max pool scoring prediction consensus strategy margin confidence");
  if (intent.architecture || reflection.missingSignals.includes("missing-architecture-source")) supplements.push("AWS Lambda S3 CloudFront DynamoDB RAG Bedrock DeepSeek architecture streaming");
  if (selectedPickMode === "direct") {
    supplements.push("selected pick board row team preference prospect profile alternatives evidence score margin confidence");
    supplements.push(...selectedPickRetrievalValues(selectedPick).slice(0, 16));
  }
  return rewriteQuery([...new Set([String(question ?? ""), ...supplements].filter(Boolean))].join(" "), selectedPick, selectedPickMode);
};

const selectedPickRetrievalValues = (selectedPick) => {
  if (!selectedPick) return [];
  const pick = Number(selectedPick.pick ?? 0);
  return [
    Number.isFinite(pick) && pick > 0 ? `pick ${pick}` : "",
    Number.isFinite(pick) && pick > 0 ? `#${pick}` : "",
    Number.isFinite(pick) && pick > 0 ? `第${pick}顺位` : "",
    selectedPick.team, selectedPick.acquiredFrom, selectedPick.prospect?.name, selectedPick.prospect?.school,
    selectedPick.prospect?.origin, selectedPick.roleFit, ...(selectedPick.prospect?.positions ?? []),
    ...(selectedPick.evidence ?? []), ...(selectedPick.warnings ?? []),
    ...(selectedPick.alternatives ?? []).flatMap((item) => [item.name, item.roleFit]),
  ].filter(Boolean);
};

const mergeLocalRetrievalAttempts = (attempts) => {
  const snippetMap = new Map();
  for (const attempt of attempts) {
    for (const snippet of attempt.result?.snippets ?? []) {
      const key = `${snippet.source}\n${snippet.path ?? ""}\n${String(snippet.text ?? "").slice(0, 80)}`;
      const existing = snippetMap.get(key);
      if (!existing || Number(snippet.score ?? 0) > Number(existing.score ?? 0)) snippetMap.set(key, snippet);
    }
  }
  const snippets = [...snippetMap.values()].sort((left, right) => Number(right.score ?? 0) - Number(left.score ?? 0)).slice(0, ragSnippetLimit);
  const terms = [...new Set(attempts.flatMap((attempt) => attempt.result?.terms ?? []))].slice(0, 56);
  return {
    terms,
    retrievalMode: "Optimized Agentic RAG: plan -> query-rewrite -> retrieve -> reflect -> optional second retrieve -> MMR rerank -> decide",
    snippets,
    hasStrongLocalMatch: attempts.some((attempt) => attempt.result?.hasStrongLocalMatch) || snippets.some(isStrongLocalSnippet),
  };
};

// 官方联网检索（仅在本地证据不足时使用）
const fetchOfficialWebKnowledge = async (terms) => {
  const results = [];
  const queryEmbedding = embedText(terms.join(" "));
  for (const source of officialWebSources.slice(0, 3)) { // 限制联网源数量加速
    try {
      const response = await fetch(source.url, {
        headers: { "User-Agent": "DraftOps local DeepSeek proxy/2.0", Accept: "text/html,text/plain,application/json" },
        signal: AbortSignal.timeout(3000), // 3秒超时
      });
      if (!response.ok) continue;
      const text = await response.text();
      const chunks = chunkText(text).map((chunk) => scoreChunkForRetrieval({ source: source.url, sourceName: source.name, sourceRank: "official-web", text: chunk }, { terms, queryEmbedding }));
      results.push(...chunks);
    } catch { /* 静默失败 */ }
  }
  const matching = results.filter((chunk) => chunk.exactMatches > 0 || chunk.semanticScore >= 0.08);
  return rerankChunks(matching.length ? matching : results, 5, 16);
};

// ==================== HTTP服务与CORS ====================
const defaultClientOrigin = process.env.DRAFTOPS_CLIENT_ORIGIN ?? "http://127.0.0.1:3003";

const getCorsOrigin = (request) => {
  const origin = request.headers.origin;
  if (!origin) return defaultClientOrigin;
  try {
    const parsed = new URL(origin);
    if ((parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") && /^https?:$/.test(parsed.protocol)) return origin;
  } catch {}
  return defaultClientOrigin;
};

const sendSseHeaders = (request, response) => {
  response.writeHead(200, {
    "Access-Control-Allow-Origin": getCorsOrigin(request),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
};

const sendSseEvent = (response, event, data) => {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
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

// ==================== 上下文构建 ====================
const boardRows = (board = []) => board.map((pick) => ({
  pick: pick.pick, team: pick.team, acquiredFrom: pick.acquiredFrom ?? null,
  player: pick.prospect?.name, positions: pick.prospect?.positions ?? [],
  position: pick.prospect?.positions?.join("/"), school: pick.prospect?.school,
  origin: pick.prospect?.origin, classYear: pick.prospect?.classYear,
  international: Boolean(pick.prospect?.international), consensusRank: pick.prospect?.consensusRank,
}));

const readOnlyPredictionRows = (board = []) => board.map((pick) => ({
  pick: pick.pick, team: pick.team, acquiredFrom: pick.acquiredFrom ?? null,
  player: pick.prospect?.name, positions: pick.prospect?.positions ?? [],
  school: pick.prospect?.school, origin: pick.prospect?.origin, classYear: pick.prospect?.classYear,
  international: Boolean(pick.prospect?.international), consensusRank: pick.prospect?.consensusRank,
  score: pick.score, confidence: pick.confidence, margin: pick.margin, roleFit: pick.roleFit,
  evidence: (pick.evidence ?? []).slice(0, 4), warnings: pick.warnings ?? [], risks: pick.prospect?.risks ?? [],
  alternatives: (pick.alternatives ?? []).slice(0, 3).map((item) => ({ name: item.name, score: item.score, roleFit: item.roleFit })),
}));

const schoolCounts = (board = []) => {
  const firstSeen = new Map();
  const counts = {};
  board.forEach((pick, index) => {
    const school = pick.prospect?.school ?? "Unknown";
    if (!firstSeen.has(school)) firstSeen.set(school, index);
    counts[school] = (counts[school] ?? 0) + 1;
  });
  return Object.entries(counts).sort((left, right) => right[1] - left[1] || (firstSeen.get(left[0]) ?? 0) - (firstSeen.get(right[0]) ?? 0));
};

const officialMilestoneQuestions = (milestoneAnswers) =>
  Array.isArray(milestoneAnswers?.answers)
    ? milestoneAnswers.answers.map((item) => ({ id: item.id, prompt: item.question, answer: String(item.answer), type: item.type, tolerance: item.tolerance ?? null, evidence: item.evidence ?? [] }))
    : [];

const buildExamFacts = (board = [], milestoneAnswers = null) => {
  const rows = boardRows(board);
  const firstFive = rows.slice(0, 5);
  const firstInternational = rows.find((pick) => pick.international) ?? null;
  const schoolCountRows = schoolCounts(board).map(([school, count]) => ({ school, count }));
  const schoolLeader = schoolCountRows[0] ?? null;
  const lotteryGuards = rows.slice(0, 14).filter((pick) => pick.positions.some((position) => position === "PG" || position === "SG"));
  const firstCenter = rows.find((pick) => pick.positions.includes("C")) ?? null;
  const freshmen = rows.filter((pick) => pick.classYear === "Freshman");
  const tradedPicks = rows.filter((pick) => pick.acquiredFrom);
  const fallbackExamQuestions = [
    { id: "intl-top-five", prompt: "前 5 位是否包含国际球员？", answer: firstFive.some((pick) => pick.international) ? "是" : "否", evidence: firstFive.map((pick) => `第 ${pick.pick} 顺位 ${pick.player}，${pick.origin}`) },
    { id: "first-intl", prompt: "第一位被选中的国际球员是几顺位？", answer: firstInternational ? String(firstInternational.pick) : "首轮无国际球员", evidence: firstInternational ? [`第 ${firstInternational.pick} 顺位 ${firstInternational.player}，${firstInternational.origin}`] : ["当前锁定板首轮没有国际球员"] },
    { id: "school-most", prompt: "哪所学校贡献最多首轮秀？", answer: schoolLeader ? `${schoolLeader.school} (${schoolLeader.count} 人)` : "N/A", evidence: rows.filter((pick) => pick.school === schoolLeader?.school).map((pick) => `第 ${pick.pick} 顺位 ${pick.player}`) },
    { id: "lottery-guards", prompt: "乐透区会有多少名后卫？", answer: String(lotteryGuards.length), evidence: lotteryGuards.map((pick) => `第 ${pick.pick} 顺位 ${pick.player}，${pick.position}`) },
    { id: "first-center", prompt: "第一位中锋是几顺位？", answer: firstCenter ? String(firstCenter.pick) : "首轮无中锋", evidence: firstCenter ? [`第 ${firstCenter.pick} 顺位 ${firstCenter.player}`] : ["当前锁定板首轮没有中锋"] },
    { id: "freshmen-count", prompt: "首轮 Freshman 数量是多少？", answer: String(freshmen.length), evidence: freshmen.map((pick) => `第 ${pick.pick} 顺位 ${pick.player}`) },
    { id: "traded-picks", prompt: "首轮来自交易的顺位数量是多少？", answer: String(tradedPicks.length), evidence: tradedPicks.map((pick) => `第 ${pick.pick} 顺位 ${pick.team} from ${pick.acquiredFrom}`) },
  ];
  const examQuestions = officialMilestoneQuestions(milestoneAnswers);
  const activeExamQuestions = examQuestions.length ? examQuestions : fallbackExamQuestions;
  return {
    scope: "DraftOps 2026 NBA选秀预测系统：基于min-max池内相对评分的确定性预测引擎 + DeepSeek只读问答层。可回答比赛、数据、里程碑、预测板、AWS/提交、路演和代码说明类问题，但不能直接修改代码、文件或仓库。",
    readOnlyRules: [
      "DeepSeek只提供问答和解释，不会直接改代码、写文件、提交仓库、运行命令或改写锁定预测板。",
      "预测结果100%由确定性相对评分算法生成，DeepSeek不生成或修改预测名单。",
      "如果用户要求直接修改代码、写文件、运行命令、提交或推送，必须说明不能直接执行，只能解释思路。",
    ],
    scoringMethod: "Relative min-max pool scoring: 每个顺位对剩余球员池做6维度min-max归一化（0=池中最差，100=池中最好），加权后选最高分，移除后下一顺位重新归一化。共3255次候选评审。",
    questionCount: activeExamQuestions.length,
    examQuestions: activeExamQuestions,
    officialMilestoneAnswers: milestoneAnswers?.answers ?? null,
    computedFacts: { firstFive, firstInternational, schoolCounts: schoolCountRows, schoolLeader, lotteryGuards, firstCenter, freshmen, tradedPicks },
    lockedBoardRows: rows,
  };
};

const buildContext = async (selectedPickNumber) => {
  const [boardArtifact, bundle, documentIndex, milestoneReference, milestoneAnswers] = await Promise.all([
    readJson(boardPath, {}), readJson(bundlePath, {}), readJson(documentIndexPath, null),
    readFile(milestoneReferencePath, "utf8").catch(() => ""), readJson(milestoneAnswersPath, null),
  ]);
  const board = boardArtifact.board ?? [];
  const selectedPick = board.find((pick) => pick.pick === selectedPickNumber) ?? board[0] ?? null;
  const examFacts = buildExamFacts(board, milestoneAnswers);
  return {
    board, selectedPick,
    deepSeekContext: {
      modelContext: {
        boardHealth: boardArtifact.health, boardSummary: boardArtifact.summary, scenario: boardArtifact.scenario,
        sourceMetadata: boardArtifact.sourceMetadata ?? bundle.metadata,
        scoringEngine: "relative_minmax_pool_v2", legacyDeepSeekExamAnswersIgnored: true,
        officialMilestoneAnswersGeneratedAt: milestoneAnswers?.generatedAt ?? null,
      },
      referenceDocuments: {
        documentIndex, milestoneQuestionDesignReference: compactText(milestoneReference),
        usagePolicy: "DraftCode24里程碑事件预测.md仅用于题意、字段口径、评分口径参考；不是官方赛果，不能用于调整预测球员。",
      },
      predictionBoardForReadOnlyQa: readOnlyPredictionRows(board),
      selectedPick: toDeepSeekSelectedPick(selectedPick), examFacts,
    },
  };
};

// ==================== 优化版RAG检索入口 ====================
const buildRetrievedKnowledge = async ({ question, selectedPick, useSelectedPickContext = false, selectedPickMode = "inactive" }) => {
  const intent = localQuestionIntent(question, selectedPickMode);
  const plan = {
    mode: "optimized-agentic-rag-v2",
    intent: activeIntentLabels(intent).length ? activeIntentLabels(intent) : ["general"],
    selectedPickMode,
    queryRewriteEnabled: true,
    planningHints: [
      useSelectedPickContext ? "direct selected-pick questions require board row, team fit, and prospect evidence"
        : selectedPickMode === "background" ? "selected pick is background only; preserve the user's broader question scope"
        : "use user question scope first",
    ],
  };
  const attempts = [];
  // 第一次检索：使用改写后的查询
  const rewrittenQuery = rewriteQuery(question, selectedPick, selectedPickMode);
  const firstLocal = await retrieveLocalKnowledge({ question, selectedPick, useSelectedPickContext, rewrittenQuery });
  attempts.push({ query: rewrittenQuery, result: firstLocal, queryRewritten: rewrittenQuery !== question });
  let local = mergeLocalRetrievalAttempts(attempts);
  let reflection = reflectLocalRetrieval({ question, selectedPickMode, local, attemptCount: attempts.length });
  // 第二次检索：如果第一次不够，补充查询
  if (!reflection.sufficient) {
    const nextQuery = followUpLocalQuery({ question, selectedPick, selectedPickMode, reflection });
    if (nextQuery && nextQuery !== question) {
      const secondLocal = await retrieveLocalKnowledge({ question, selectedPick, useSelectedPickContext, rewrittenQuery: nextQuery });
      attempts.push({ query: nextQuery, result: secondLocal, queryRewritten: true });
      local = mergeLocalRetrievalAttempts(attempts);
      reflection = reflectLocalRetrieval({ question, selectedPickMode, local, attemptCount: attempts.length });
    }
  }
  const officialWeb = local.hasStrongLocalMatch && reflection.sufficient ? [] : await fetchOfficialWebKnowledge(local.terms);
  return {
    retrievalPolicy: "优化版Agentic RAG：查询改写→混合检索(词法+语义+来源权重)→MMR重排序→反思证据覆盖→不足时二次检索→仍不足才联网兜底。",
    retrievalMode: local.retrievalMode, selectedPickFocusMode: selectedPickMode,
    selectedPickRetrievalPolicy: useSelectedPickContext
      ? "当前问题直接指向选中栏目；检索词包含顺位、球队、球员、学校、位置、球队需求、分数、分差、置信度。"
      : selectedPickMode === "background"
        ? "当前有点击栏目，但它只是背景参考；检索和回答优先服从用户问题的全局或更宽范围。"
        : "当前没有明确点击焦点；按用户文字本身和全局比赛问题检索。",
    localSnippets: local.snippets.map(retrievalSnippet),
    officialWebSnippets: officialWeb.map(retrievalSnippet),
    usedWebFallback: officialWeb.length > 0,
    agentic: {
      ...plan,
      attempts: attempts.map((attempt) => ({
        query: String(attempt.query ?? "").slice(0, 480), queryRewritten: attempt.queryRewritten,
        snippetCount: attempt.result?.snippets?.length ?? 0, strongLocalMatch: Boolean(attempt.result?.hasStrongLocalMatch),
        topSources: (attempt.result?.snippets ?? []).slice(0, 4).map((snippet) => ({ source: snippet.source, path: snippet.path, score: Number(Number(snippet.score ?? 0).toFixed(4)), exactMatches: snippet.exactMatches })),
      })),
      reflection,
    },
  };
};

// ==================== 精细优化的System Prompt ====================
const buildSystemPrompt = (questionType) => {
  const fewShotExamples = `
【Few-shot示例】

示例1（事实性问题-顺位查询）：
用户：第一顺位选谁？
回答：第1顺位华盛顿奇才选择AJ 迪班萨（AJ Dybantsa），位置SF/PF，来自杨百翰大学，19.0岁。综合分97.7，置信度100%，领先下一候选5.9分。依据：相对评分min-max池内归一化后最高分，共识排名第1，奇才作为重建队优先考虑上限。

示例2（解释性问题-为什么选他）：
用户：为什么湖人第25顺位选Koa Peat？
回答：第25顺位洛杉矶湖人选择Koa Peat（科阿 皮特），位置SF/PF。原因：1）在剩余100名球员池中，Peat的尺寸和运动能力相对评分突出；2）湖人争冠阶段需要侧翼深度和即战力防守；3）综合分89.4，置信度97%，领先第二名5.1分，选择确定性高。风险：这是扩展池回退球员，来源覆盖比种子球员薄。

示例3（事实性问题-统计查询）：
用户：乐透区有几个后卫？
回答：乐透区（前14顺位）共有7名后卫（PG/SG位置）。分别是：第2顺位Darryn Peterson、第5顺位Keaton Wagler、第6顺位Kingston Flemings、第7顺位Darius Acuff Jr.、第9顺位Brayden Burries、第10顺位Karim Lopez、第11顺位Labaron Philon Jr.。

示例4（胶着签位说明）：
用户：第22顺位76人为什么选Hannes Steinbach？
回答：第22顺位费城76人选择Hannes Steinbach（汉内斯 施泰因巴赫），位置PF/C。需要说明：这是一个非常胶着的选择，他仅领先第二名0.08分，属于竞争最激烈的签位之一。选择理由：76人需要内线尺寸，Steinbach的体测数据在剩余池中相对评分最高。但由于分差极小，实际选秀中结果可能不同。

示例5（证据不足时诚实回答）：
用户：某某球员的伤病史具体是什么？
回答：根据当前检索到的本地资料，Hannes Steinbach的具体伤病史未在现有证据链中明确记录。系统风险标签未显示阻塞性医疗警告，但如果需要详细医疗信息，建议查阅NBA官方医疗报告。
`;

  return `你是 DraftOps 2026 NBA选秀预测系统的DeepSeek问答助手 v2.0。

## 核心定位
- 你基于一个确定性预测引擎工作：30个签位由"min-max池内相对评分算法"预先计算完成
- 预测结果100%来自算法，你只负责解释、问答和分析，绝不生成或修改预测名单
- 评分机制：每个顺位对剩余球员池做6维度min-max归一化（0=池中最差，100=池中最好），加权求和后选最高分，移除该球员后下一顺位重新归一化
- 总评审次数：3255次候选评估，Top5置信度100%

## 回答原则
1. **证据优先**：所有事实性陈述必须能在deepSeekContext（预测板数据）或retrievedKnowledge（检索到的知识片段）中找到依据
2. **诚实透明**：如果证据不足，明确说"根据现有资料无法确认"或"当前数据未记录"，绝不编造
3. **区分置信度**：高置信度（margin大）用肯定语气，低置信度/胶着签位（margin<1）要明确说明竞争激烈
4. **简洁直接**：先给答案，再补理由；不冗长，不列无关来源清单
5. **数据说话**：提到顺位时附带分数、置信度、margin；提到球员时附带位置、学校

## 评分维度说明（用户问起时使用）
- 共识排名(Consensus)：28%，各大模拟选秀综合排名
- 球队需求(Need)：23%，位置/技术标签/偏好匹配
- 球员能力(Player)：18%，投篮/创造/防守/运动/球商/尺寸
- 潜力(Upside)：14%，年龄/上限/风险承受度
- 体测数据(Feature)：8%，联合试训数据
- 来源热度(Source)：9%，媒体覆盖/RAG证据
权重会根据签位区域（前5/乐透/首轮末）和球队阶段（重建/加速/争冠/资产）动态调整。

## 边界规则（硬约束）
- 不能修改代码、写文件、运行命令、提交仓库（但系统已内置一键重预测API，现场可通过操作员触发）
- 不能预测"如果换人会怎样"以外的修改性建议
- 不能编造URL、媒体名、球员数据
- 不要输出Markdown格式（不用#、不用*列表、不用代码块）
- 不要输出任何密钥或配置信息
- 不要免责声明，不要说"作为AI"之类的话

## 现场演示准备（LIVE READINESS）
- 系统支持现场一键重预测：备份当前板 → 运行3255次候选评估 → 同步到前端 → 自动清空缓存加载新结果
- 重预测流程约需5-15秒，完全确定性算法，结果可复现
- 如果评委要求"现场重新预测"或"重新跑一遍模型"，请直接、清晰地告知以下要点：
  1. 系统已内置一键重预测功能，随时可以执行，专门为现场演示准备
  2. 流程：自动备份当前预测板到 data/boards/backups/（可回滚）→ 逐顺位运行min-max池内相对评分（3255次候选评估）→ 同步到前端 → 清空缓存加载新结果
  3. 耗时约5-15秒，纯本地运行无需联网
  4. 算法100%确定性，没有随机因素，相同输入必定得到相同输出；如果输入数据有更新则结果可能变化
  5. 现场操作员可以通过 npm run live:repredict 命令一键触发
- 严格禁止：不要询问"是否需要触发"、"需要我通知操作员吗"之类的问题；不要说"如果你作为问答助手..."这类元话语；直接面向用户/评委回答，说明系统已具备该能力即可
- 你的角色是解释和说明，不是执行操作；明确但礼貌地说明操作由现场操作员触发

## 关于选中栏目(selectedPick)
- selectedPickFocusMode=direct：围绕当前选中的顺位/球队/球员回答
- selectedPickFocusMode=background：当前选中项只是背景，按用户问题的全局范围回答
- selectedPick为空：按问题本身回答
- 用户明确说"第X顺位"时，覆盖当前选中项

## 回答格式要求
- 事实问题：直接给答案，1-3句话
- 解释问题：先结论，再2-4个理由，最后说风险/备选（如果有）
- 统计问题：给数字，再列关键条目
- 胶着签位（margin<1）：必须提到"这是一个竞争激烈的签位，分差仅X分"
- Fallback球员（来源=fallback）：必须提到"这是扩展池回退球员，来源覆盖相对较薄"

${fewShotExamples}

## 回答语言
使用中文回答。球员中文名优先，英文名附在括号中。学校使用中文翻译（如UCLA=加州大学洛杉矶分校）。`;
};

// ==================== SSE流式调用DeepSeek ====================
const callDeepSeekStream = async ({ question, history, selectedPickNumber, selectedPickFocusActive = false, context: providedContext, antiHallucinationGuardrails = [], response }) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY. Put it in .env.local before using the chat window.");

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
  const modelLabel = getModelLabel(model);
  const questionType = classifyQuestion(question);
  const temperature = getTemperatureForQuestion(questionType);
  const maxTokens = 2048;

  const context = providedContext ?? (await buildContext(selectedPickNumber));
  const explicitPickNumber = explicitPickNumberFromQuestion(question);
  const selectedPickOverrideUsed = Number.isFinite(explicitPickNumber) && explicitPickNumber > 0 && Number(selectedPickNumber) !== explicitPickNumber;
  const pickFocusMode = selectedPickFocusMode({ question, selectedPick: context.selectedPick, selectedPickFocusActive });
  const selectedPickAvailable = pickFocusMode !== "inactive";
  const useSelectedPickContext = pickFocusMode === "direct";

  const deepSeekContext = {
    ...context.deepSeekContext,
    selectedPick: selectedPickAvailable ? toDeepSeekSelectedPick(context.selectedPick) : null,
    selectedPickFocusMode: pickFocusMode,
    selectedPickUsage: selectedPickOverrideUsed
      ? `用户明确要求第 ${explicitPickNumber} 顺位；已覆盖旧点击顺位上下文，必须围绕第 ${explicitPickNumber} 顺位回答。`
      : pickFocusMode === "direct" ? "当前问题直接指向selectedPick；回答应围绕该顺位、球队、球员、需求和风险。"
        : pickFocusMode === "background" ? "当前有点击栏目，但它只是背景参考；不要把全局问题限制到selectedPick。"
        : "当前没有明确点击焦点；按用户文字本身回答。",
    questionType,
  };

  // 先发送检索状态
  sendSseEvent(response, "status", { phase: "retrieving", message: "正在检索知识库..." });

  const retrievedKnowledge = await buildRetrievedKnowledge({ question, selectedPick: context.selectedPick, useSelectedPickContext, selectedPickMode: pickFocusMode });

  // 发送检索完成状态
  sendSseEvent(response, "status", {
    phase: "retrieval_complete",
    message: `检索完成：${retrievedKnowledge.localSnippets.length}条本地片段${retrievedKnowledge.usedWebFallback ? "+联网兜底" : ""}`,
    grounding: {
      snippetCount: retrievedKnowledge.localSnippets.length + retrievedKnowledge.officialWebSnippets.length,
      usedWebFallback: retrievedKnowledge.usedWebFallback,
      reflection: retrievedKnowledge?.agentic?.reflection ?? null,
    },
  });

  const compactHistory = Array.isArray(history)
    ? history.slice(-6).map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content ?? "").slice(0, 1200),
      }))
    : [];

  const systemPrompt = buildSystemPrompt(questionType);

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        "当前比赛上下文（锁定预测板数据）：",
        JSON.stringify(deepSeekContext),
        "检索到的知识片段：",
        JSON.stringify({
          localSnippets: retrievedKnowledge.localSnippets.slice(0, 10),
          officialWebSnippets: retrievedKnowledge.officialWebSnippets.slice(0, 3),
        }),
        "最近对话：",
        JSON.stringify(compactHistory),
        `问题类型：${questionType}，温度参数：${temperature}`,
        "用户新问题：",
        String(question ?? "").slice(0, 2000),
      ].join("\n\n"),
    },
  ];

  const requestBody = {
    model, messages, max_tokens: maxTokens, temperature, stream: true,
    top_p: questionType === "factual" ? 0.85 : 0.95,
    frequency_penalty: questionType === "creative" ? 0.3 : 0.1,
    presence_penalty: 0.1,
  };

  // 发送生成状态
  sendSseEvent(response, "status", { phase: "generating", message: "DeepSeek正在生成回答..." });

  const apiResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
  });

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(`DeepSeek API error: ${apiResponse.status} ${errorText}`);
  }

  const reader = apiResponse.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let finishReason = null;
  let usage = null;
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === "[DONE]") continue;
        try {
          const data = JSON.parse(dataStr);
          const delta = data.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            fullContent += delta;
            sendSseEvent(response, "delta", { content: delta });
          }
          if (data.choices?.[0]?.finish_reason) finishReason = data.choices[0].finish_reason;
          if (data.usage) usage = data.usage;
        } catch { /* 忽略JSON解析错误 */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // 添加证据状态行
  const statusLine = groundingStatusLine(retrievedKnowledge);
  const finalAnswer = `${statusLine}\n${fullContent.trim()}`;

  // 发送完成事件
  sendSseEvent(response, "done", {
    answer: finalAnswer, model, modelLabel, mode: "deepseek-competition-v2-stream",
    questionType, temperature, finishReason, truncated: finishReason === "length",
    maxTokens,
    grounding: {
      status: statusLine, reflection: retrievedKnowledge?.agentic?.reflection ?? null,
      usedWebFallback: Boolean(retrievedKnowledge?.usedWebFallback),
      snippetCount: retrievedKnowledge.localSnippets.length + retrievedKnowledge.officialWebSnippets.length,
    },
    usage,
    cached: false,
  });

  return { answer: finalAnswer, finishReason };
};

// 非流式版本（兼容旧版调用和缓存）
const callDeepSeekNonStream = async ({ question, history, selectedPickNumber, selectedPickFocusActive = false, context: providedContext, antiHallucinationGuardrails = [] }) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
  const modelLabel = getModelLabel(model);
  const questionType = classifyQuestion(question);
  const temperature = getTemperatureForQuestion(questionType);
  const maxTokens = 2048;
  const context = providedContext ?? (await buildContext(selectedPickNumber));
  const explicitPickNumber = explicitPickNumberFromQuestion(question);
  const pickFocusMode = selectedPickFocusMode({ question, selectedPick: context.selectedPick, selectedPickFocusActive });
  const useSelectedPickContext = pickFocusMode === "direct";
  const deepSeekContext = {
    ...context.deepSeekContext,
    selectedPick: pickFocusMode !== "inactive" ? toDeepSeekSelectedPick(context.selectedPick) : null,
    selectedPickFocusMode: pickFocusMode,
    questionType,
  };
  const retrievedKnowledge = await buildRetrievedKnowledge({ question, selectedPick: context.selectedPick, useSelectedPickContext, selectedPickMode: pickFocusMode });
  const compactHistory = Array.isArray(history) ? history.slice(-6).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "").slice(0, 1200) })) : [];
  const systemPrompt = buildSystemPrompt(questionType);
  const requestBody = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: [
        "当前比赛上下文：", JSON.stringify(deepSeekContext),
        "检索到的知识：", JSON.stringify({ localSnippets: retrievedKnowledge.localSnippets.slice(0, 10), officialWebSnippets: retrievedKnowledge.officialWebSnippets.slice(0, 3) }),
        "最近对话：", JSON.stringify(compactHistory),
        `问题类型：${questionType}，温度：${temperature}`,
        "用户问题：", String(question ?? "").slice(0, 2000),
      ].join("\n\n") },
    ],
    max_tokens: maxTokens, temperature, stream: false,
    top_p: questionType === "factual" ? 0.85 : 0.95,
  };
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status} ${responseText}`);
  const completion = JSON.parse(responseText);
  const choice = completion.choices?.[0];
  const finishReason = choice?.finish_reason ?? null;
  const answer = `${groundingStatusLine(retrievedKnowledge)}\n${String(choice?.message?.content ?? "").trim()}`;
  return { answer, model, modelLabel, mode: "deepseek-competition-v2", questionType, temperature, finishReason, truncated: finishReason === "length", maxTokens,
    grounding: { status: groundingStatusLine(retrievedKnowledge), reflection: retrievedKnowledge?.agentic?.reflection ?? null, usedWebFallback: Boolean(retrievedKnowledge?.usedWebFallback) },
    usage: completion.usage ?? null, cached: false };
};

const missingSignalLabels = {
  "too-few-snippets": "检索片段过少", "weak-direct-match": "直接匹配弱", "low-source-diversity": "来源类型单一",
  "missing-milestone-source": "缺少里程碑资料", "missing-evidence-source": "缺少来源/审计资料",
  "missing-team-source": "缺少球队偏好资料", "missing-prospect-source": "缺少球员画像资料",
  "missing-board-source": "缺少预测板资料", "missing-architecture-source": "缺少架构资料",
};

const groundingStatusLine = (retrievedKnowledge) => {
  const reflection = retrievedKnowledge?.agentic?.reflection ?? {};
  const localCount = retrievedKnowledge?.localSnippets?.length ?? 0;
  const webCount = retrievedKnowledge?.officialWebSnippets?.length ?? 0;
  const totalCount = localCount + webCount;
  const missingSignals = Array.isArray(reflection.missingSignals) ? reflection.missingSignals : [];
  const missingText = missingSignals.map((signal) => missingSignalLabels[signal] ?? signal).slice(0, 3).join("、");
  const sourceScope = webCount > 0 ? "本地知识库+官方联网兜底" : "本地知识库";
  if (reflection.sufficient) return `证据状态：${sourceScope}检索${totalCount}条片段，证据充分。`;
  return missingText ? `证据状态：${sourceScope}检索${totalCount}条片段，需复核：${missingText}。` : `证据状态：${sourceScope}检索${totalCount}条片段，需复核。`;
};

// 问题分类（用于边界判断）
const isExamQuestion = (question, context) => {
  const text = String(question ?? "").toLowerCase();
  if (/应试|里程碑|milestone|题目|答题卡|提交题|考题|问题答案/.test(text)) return true;
  if (/draftcode24|combine|体测|臂展|弹跳|手掌|长度溢价|位置稀缺|人才来源|国际化率|大手天赋/.test(text)) return true;
  if (/\b[a-d][1-9]\b/i.test(text)) return true;
  return /国际|海外|非美国|大学|学校|乐透|后卫|中锋|freshman|大一|交易|统计|数量|多少|几个|几名|哪所/.test(text);
};

const isPredictionQuestion = (question) => {
  const text = String(question ?? "").toLowerCase();
  return [/预测|最可能|会选|选谁|选择谁|谁会被选/, /当前顺位|第\s*\d+\s*顺位|pick\s*\d+/, /第一顺位|第二顺位|第三顺位|状元|榜眼|探花/,
    /为什么|理由|依据|证据|风险|替代|备选|人选|适配/, /完整.*首轮|全部.*首轮|30.*顺位/].some((p) => p.test(text));
};

const isCompetitionRelatedQuestion = (question, context) => {
  const text = String(question ?? "").toLowerCase();
  if (isExamQuestion(question, context) || isPredictionQuestion(question)) return true;
  return /比赛|竞赛|赛题|提交|答题|路演|ppt|视频|github|仓库|aws|bedrock|s3|dynamodb|nba|选秀|draft|combine|球员|顺位|球队|里程碑|数据|模型|agent|deepseek|codex|界面|前端|代码|部署|运行|readme|架构|成本|评分|规则|相对|min-max/.test(text);
};

const isDirectCodeModificationRequest = (question) => {
  const text = String(question ?? "").toLowerCase();
  if (/怎么|如何|为什么|解释|说明|建议|方案|思路|能不能|是否|可不可以|where|how|why|explain|suggest|plan/.test(text)) return false;
  const codeTarget = /代码|文件|脚本|组件|css|tsx|ts|js|mjs|json|readme|git|github|仓库|项目|页面|按钮|样式|接口|server|package|commit|push|提交|推送/.test(text);
  const directAction = /改|修改|新增|添加|删除|实现|接入|创建|写入|修复|重构|替换|运行|执行|提交|推送|部署|帮我|给我|直接/.test(text);
  return codeTarget && directAction;
};

const readPositiveInteger = (value, fallback) => { const p = Number(value); return Number.isFinite(p) && p > 0 ? Math.floor(p) : fallback; };

// ==================== 启动服务器 ====================
await loadEnvFile(localEnvPath);
await loadEnvFile(envPath);

const port = Number(process.env.DEEPSEEK_AGENT_PORT ?? 4318);
const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") { sendJson(request, response, 204, {}); return; }

  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

    // 健康检查
    if (request.method === "GET" && url.pathname === "/api/deepseek/health") {
      const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
      sendJson(request, response, 200, {
        ok: true, configured: Boolean(process.env.DEEPSEEK_API_KEY), model, modelLabel: getModelLabel(model),
        version: "v2.0-streaming",
        streamingEnabled: true, cacheEnabled: true, cacheSize: responseCache.size, cacheMaxSize: CACHE_MAX_SIZE,
        liveRepredictEnabled: true,
        liveEndpoints: {
          boardStatus: "GET /api/deepseek/board/status",
          boardReload: "POST /api/deepseek/board/reload",
          triggerRepredict: "POST /api/deepseek/repredict (SSE streaming progress)",
          cacheClear: "POST /api/deepseek/cache/clear",
          cacheStats: "GET /api/deepseek/cache/stats",
        },
        rag: { retrievalMode: "Optimized Agentic RAG v2: query-rewrite + hybrid retrieval + MMR rerank + agentic reflection",
          embeddingDimensions: ragEmbeddingDimensions, rerankPoolSize: ragRerankPoolSize, topK: ragSnippetLimit,
          agenticEnabled: true, agenticMaxIterations: 2, queryRewriteEnabled: true, dynamicTemperature: true },
        antiHallucination: { enabled: true, answerGroundingStatus: true, fewShotPrompting: true, missingEvidencePolicy: "state-gap-instead-of-inventing" },
      });
      return;
    }

    // 流式聊天SSE端点
    if (request.method === "POST" && (url.pathname === "/api/deepseek/chat/stream" || url.pathname === "/api/deepseek/chat")) {
      const useStream = url.pathname === "/api/deepseek/chat/stream" || (url.searchParams.get("stream") !== "false");
      const body = await readRequestJson(request);
      const question = String(body.question ?? "").trim();
      if (!question) { sendJson(request, response, 400, { error: "Question is required." }); return; }

      const bodySelectedPickNumber = Number(body.selectedPickNumber ?? 1);
      const explicitPickNumber = explicitPickNumberFromQuestion(question);
      const selectedPickNumber = explicitPickNumber ?? bodySelectedPickNumber;

      // 边界检查
      if (isDirectCodeModificationRequest(question)) {
        const guardAnswer = "当前DeepSeek可以回答比赛相关问题，但不能直接修改代码、写文件、运行命令、提交或推送仓库。我可以为你解释实现思路、影响范围和步骤建议。";
        if (useStream) {
          sendSseHeaders(request, response);
          sendSseEvent(response, "status", { phase: "complete", message: "边界保护" });
          sendSseEvent(response, "delta", { content: guardAnswer });
          sendSseEvent(response, "done", { answer: guardAnswer, mode: "local-code-guard", cached: false });
          response.end();
        } else {
          sendJson(request, response, 200, { answer: guardAnswer, mode: "local-code-guard" });
        }
        return;
      }

      const context = await buildContext(selectedPickNumber);
      if (!isCompetitionRelatedQuestion(question, context)) {
        const scopeAnswer = "当前DeepSeek只回答本次DraftOps NBA选秀比赛相关问题。你可以问预测结果、球员分析、球队适配、评分机制、AWS架构、里程碑题目等。";
        if (useStream) {
          sendSseHeaders(request, response);
          sendSseEvent(response, "status", { phase: "complete", message: "范围保护" });
          sendSseEvent(response, "delta", { content: scopeAnswer });
          sendSseEvent(response, "done", { answer: scopeAnswer, mode: "local-scope-guard", cached: false });
          response.end();
        } else {
          sendJson(request, response, 200, { answer: scopeAnswer, mode: "local-scope-guard" });
        }
        return;
      }

      // 缓存检查（流式和非流式都支持）
      const cacheKey = hashString(`${question}|${selectedPickNumber}|${body.selectedPickFocusActive ? 1 : 0}|${JSON.stringify(body.history?.slice(-3) ?? [])}`);
      const cached = getCachedResponse(cacheKey);

      if (cached) {
        if (useStream) {
          sendSseHeaders(request, response);
          sendSseEvent(response, "status", { phase: "cache_hit", message: "缓存命中，秒回..." });
          // 按字符流式输出缓存内容，保持打字机效果
          const cachedAnswer = String(cached.answer ?? "");
          let pos = 0;
          const chunkSize = 4;
          const streamCached = () => {
            if (pos >= cachedAnswer.length) {
              sendSseEvent(response, "done", { ...cached, cached: true, fromCache: true });
              response.end();
              return;
            }
            const chunk = cachedAnswer.slice(pos, pos + chunkSize);
            pos += chunkSize;
            sendSseEvent(response, "delta", { content: chunk });
            setTimeout(streamCached, 10);
          };
          setTimeout(streamCached, 50);
          return;
        } else {
          sendJson(request, response, 200, { ...cached, cached: true });
          return;
        }
      }

      if (useStream) {
        sendSseHeaders(request, response);
        try {
          const result = await callDeepSeekStream({
            question, history: body.history, selectedPickNumber,
            selectedPickFocusActive: Boolean(body.selectedPickFocusActive) || Boolean(explicitPickNumber),
            antiHallucinationGuardrails: body.antiHallucinationGuardrails, context, response,
          });
          // 流式完成后也存入缓存
          const cacheEntry = {
            answer: result.answer,
            model: normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro"),
            modelLabel: getModelLabel(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro"),
            mode: "deepseek-competition-v2-stream",
            questionType: classifyQuestion(question),
            cached: false,
          };
          setCachedResponse(cacheKey, cacheEntry);
        } catch (error) {
          sendSseEvent(response, "error", { message: error instanceof Error ? error.message : "Unknown error" });
        } finally {
          response.end();
        }
      } else {
        try {
          const result = await callDeepSeekNonStream({
            question, history: body.history, selectedPickNumber,
            selectedPickFocusActive: Boolean(body.selectedPickFocusActive) || Boolean(explicitPickNumber),
            antiHallucinationGuardrails: body.antiHallucinationGuardrails, context,
          });
          setCachedResponse(cacheKey, result);
          sendJson(request, response, 200, result);
        } catch (error) {
          sendJson(request, response, 500, { error: error instanceof Error ? error.message : "Unknown server error." });
        }
      }
      return;
    }

    // 缓存管理
    if (request.method === "POST" && url.pathname === "/api/deepseek/cache/clear") {
      responseCache.clear();
      sendJson(request, response, 200, { ok: true, message: "Cache cleared", size: 0 });
      return;
    }

    // 缓存统计
    if (request.method === "GET" && url.pathname === "/api/deepseek/cache/stats") {
      sendJson(request, response, 200, {
        ok: true,
        size: responseCache.size,
        maxSize: CACHE_MAX_SIZE,
        ttlMinutes: CACHE_TTL_MS / 60000,
        utilizationPercent: Math.round((responseCache.size / CACHE_MAX_SIZE) * 100),
      });
      return;
    }

    // ==================== 现场重预测相关端点 ====================

    // 获取当前预测板状态
    if (request.method === "GET" && url.pathname === "/api/deepseek/board/status") {
      try {
        const boardArtifact = await readJson(boardPath, {});
        const board = boardArtifact.board ?? [];
        const stats = {
          ok: true,
          generatedAt: boardArtifact.generatedAt ?? null,
          generatedBy: boardArtifact.generatedBy ?? null,
          method: boardArtifact.method ?? null,
          scenario: boardArtifact.scenario?.label ?? null,
          pickCount: board.length,
          uniqueProspects: new Set(board.map((p) => p.prospect?.id)).size,
          health: boardArtifact.health ?? null,
          summary: boardArtifact.summary ? {
            averageConfidence: boardArtifact.summary.averageConfidence,
            averageScore: boardArtifact.summary.averageScore,
            narrowMargins: (boardArtifact.summary.narrowMargins ?? []).length,
            lowConfidence: (boardArtifact.summary.lowConfidence ?? []).length,
          } : null,
          liveReady: board.length === 30,
        };
        sendJson(request, response, 200, stats);
      } catch (error) {
        sendJson(request, response, 500, { ok: false, error: error.message });
      }
      return;
    }

    // 重新加载预测板（清空缓存后下次查询自动读取新文件）
    if (request.method === "POST" && url.pathname === "/api/deepseek/board/reload") {
      responseCache.clear();
      // buildContext每次调用都从磁盘读取，所以清空缓存就够了
      const boardArtifact = await readJson(boardPath, {});
      sendJson(request, response, 200, {
        ok: true,
        message: "Board reloaded, cache cleared",
        generatedAt: boardArtifact.generatedAt ?? null,
        pickCount: (boardArtifact.board ?? []).length,
      });
      return;
    }

    // 触发现场一键重预测（需要子进程执行）
    if (request.method === "POST" && url.pathname === "/api/deepseek/repredict") {
      sendSseHeaders(request, response);
      const runStamp = `live-${Date.now()}`;

      const sendProgress = (phase, message, progress = null) => {
        sendSseEvent(response, "status", { phase, message, progress, stamp: runStamp });
      };

      try {
        sendProgress("starting", "开始现场重预测...", 5);

        await new Promise((resolvePromise, reject) => {
          const child = spawn(process.execPath, [
            resolve(rootDir, "scripts", "live-repredict.mjs"),
            "--stamp", runStamp,
            "--force",
          ], {
            cwd: rootDir,
            stdio: ["ignore", "pipe", "pipe"],
            shell: process.platform === "win32",
          });

          let stdout = "";
          let stderr = "";

          child.stdout.on("data", (data) => {
            const text = data.toString();
            stdout += text;
            // Parse progress from output
            if (text.includes("备份")) sendProgress("backup", "备份当前预测板...", 20);
            if (text.includes("运行相对评分预测")) sendProgress("predicting", "运行3255次候选评估预测...", 40);
            if (text.includes("同步预测结果")) sendProgress("syncing", "同步结果到前端...", 80);
          });

          child.stderr.on("data", (data) => {
            stderr += data.toString();
          });

          child.on("exit", (code) => {
            if (code === 0) resolvePromise();
            else reject(new Error(`Repredict failed with code ${code}: ${stderr}`));
          });

          child.on("error", reject);
        });

        // Clear cache after successful repredict
        responseCache.clear();
        sendProgress("reloading", "清空DeepSeek缓存，加载新预测板...", 90);

        // Verify the new board
        const newBoard = await readJson(boardPath, {});
        sendProgress("complete", "重预测完成！", 100);

        sendSseEvent(response, "done", {
          ok: true,
          stamp: runStamp,
          generatedAt: newBoard.generatedAt ?? null,
          pickCount: (newBoard.board ?? []).length,
          changedPicks: (newBoard.summary?.changedVsPrevious ?? []).length,
          message: "现场重预测完成，请刷新浏览器查看最新结果",
        });
      } catch (error) {
        sendSseEvent(response, "error", {
          ok: false,
          message: error.message,
          stamp: runStamp,
        });
      } finally {
        response.end();
      }
      return;
    }

    sendJson(request, response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(request, response, 500, { error: error instanceof Error ? error.message : "Unknown server error." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`DraftOps DeepSeek Chat Server v2.0 (Streaming+Cache+Optimized RAG+Live Repredict) listening on http://127.0.0.1:${port}`);
  console.log(`  - SSE streaming chat: POST /api/deepseek/chat/stream`);
  console.log(`  - Non-stream chat (with cache): POST /api/deepseek/chat`);
  console.log(`  - Health check: GET /api/deepseek/health`);
  console.log(`  - Board status: GET /api/deepseek/board/status`);
  console.log(`  - [LIVE] Trigger repredict: POST /api/deepseek/repredict (SSE progress)`);
  console.log(`  - [LIVE] Reload board+clear cache: POST /api/deepseek/board/reload`);
  console.log(`  - Cache: ${CACHE_MAX_SIZE} entries, TTL ${CACHE_TTL_MS / 60000}min | Clear: POST /api/deepseek/cache/clear`);
});
