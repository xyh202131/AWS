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
  "data/reports/team_preference_research_20260623.json",
  "data/reports/milestone_prediction_evidence_20260623.json",
  "data/reports/milestone_answer_card_write_report_20260623.json",
  "public/data/prospect_media.json",
  draftOpsManifest.data?.bundlePath ?? "public/data/final_import_bundle.json",
  draftOpsManifest.data?.boardPath ?? "public/data/agent_balanced_board.json",
];
const officialWebSources = (draftOpsManifest.sourceLinks ?? []).map((source) => ({
  name: source.label?.en ?? source.label?.zh ?? source.url,
  url: source.url,
}));
const ragEmbeddingDimensions = 256;
const ragRerankPoolSize = 42;
const ragSnippetLimit = 14;
const antiHallucinationPolicy = [
  "Only state player, team, pick, score, source, risk, image, and submission-field claims when they are grounded in deepSeekContext or retrievedKnowledge.",
  "Separate grounded facts from model inference and unresolved gaps.",
  "If retrieval reflection is insufficient or missingSignals is non-empty, lower certainty and name the missing evidence class.",
  "Do not use model memory to fill missing DraftOps roster, draft-order, milestone, or team-preference facts.",
];
const missingSignalLabels = {
  "too-few-snippets": "检索片段过少",
  "weak-direct-match": "直接匹配弱",
  "low-source-diversity": "来源类型单一",
  "missing-milestone-source": "缺少里程碑资料",
  "missing-evidence-source": "缺少来源/审计资料",
  "missing-team-source": "缺少球队偏好资料",
  "missing-prospect-source": "缺少球员画像资料",
  "missing-board-source": "缺少预测板资料",
  "missing-architecture-source": "缺少架构资料",
};

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

const compactJson = (value, maxLength = 2200) => {
  const text = JSON.stringify(value, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
};

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
      }
    : null;

const includesAlias = (text, alias) => {
  const normalizedAlias = String(alias ?? "").toLowerCase().trim();
  return normalizedAlias.length >= 3 && text.includes(normalizedAlias);
};

const chineseNumberValue = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const digits = {
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
  if (text === "十") return 10;
  if (/^十[一二两三四五六七八九]$/.test(text)) return 10 + digits[text[1]];
  if (/^[一二两三四五六七八九]十$/.test(text)) return digits[text[0]] * 10;
  if (/^[一二两三四五六七八九]十[一二两三四五六七八九]$/.test(text)) {
    return digits[text[0]] * 10 + digits[text[2]];
  }
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
    const parts = value.split(/\s+/).filter((part) => part.length >= 4);
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
  return tokenize([question, ...selectedTerms].join(" ")).slice(0, 32);
};

const localQuestionIntent = (question, selectedPickMode = "inactive") => {
  const text = String(question ?? "").toLowerCase();
  const intent = {
    milestone: /里程碑|题目|答题|答案|字段|a\d|b\d|c\d|d\d|question|milestone|field|answer/.test(text),
    team: /球队|适配|需求|阵容|签位|team|fit|need|roster|pick/.test(text),
    prospect: /球员|候选|学校|身高|体重|位置|prospect|player|school|height|weight|position/.test(text),
    evidence: /来源|证据|官方|验证|审计|source|evidence|official|audit|verify/.test(text),
    board: /预测|榜单|首轮|顺位|board|mock|draft|rank|prediction/.test(text),
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
  Object.entries(intent)
    .filter(([, active]) => active)
    .map(([label]) => label);

const selectedPickRetrievalValues = (selectedPick) => {
  if (!selectedPick) return [];
  const pick = Number(selectedPick.pick ?? 0);
  return [
    Number.isFinite(pick) && pick > 0 ? `pick ${pick}` : "",
    Number.isFinite(pick) && pick > 0 ? `#${pick}` : "",
    Number.isFinite(pick) && pick > 0 ? `第${pick}顺位` : "",
    selectedPick.team,
    selectedPick.acquiredFrom,
    selectedPick.prospect?.name,
    selectedPick.prospect?.school,
    selectedPick.prospect?.origin,
    selectedPick.roleFit,
    ...(selectedPick.prospect?.positions ?? []),
    ...(selectedPick.evidence ?? []),
    ...(selectedPick.warnings ?? []),
    ...(selectedPick.alternatives ?? []).flatMap((item) => [item.name, item.roleFit]),
  ].filter(Boolean);
};

const chunkText = (text, size = 1100) => {
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
      if (current) {
        chunks.push(current);
        current = "";
      }
      const overlap = 180;
      for (let index = 0; index < paragraph.length; index += size - overlap) {
        chunks.push(paragraph.slice(index, index + size));
      }
      continue;
    }

    if (!current) {
      current = paragraph;
    } else if (`${current}\n\n${paragraph}`.length <= size) {
      current = `${current}\n\n${paragraph}`;
    } else {
      chunks.push(current);
      current = paragraph;
    }
  }

  if (current) chunks.push(current);
  return chunks;
};

const scoreText = (text, terms) => {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term.toLowerCase()) ? 1 : 0), 0);
};

const sourceBoostForRank = (sourceRank) =>
  ({
    "official-local": 0.14,
    "official-web": 0.14,
    "structured-data": 0.12,
    "milestone-data": 0.12,
    "question-reference": 0.1,
    "source-registry": 0.08,
    "local-knowledge": 0.04,
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
  const lexicalScore = terms.length ? Math.min(exactMatches / terms.length, 1) : 0;
  const semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, embedding));
  const sourceBoost = sourceBoostForRank(chunk.sourceRank);
  const score = semanticScore * 0.58 + lexicalScore * 0.32 + sourceBoost + (exactMatches >= 2 ? 0.05 : 0);

  return {
    ...chunk,
    embedding,
    exactMatches,
    lexicalScore,
    semanticScore,
    score,
  };
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
      const mmrScore = candidate.score * 0.78 - redundancy * 0.22;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = index;
      }
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
        : "local-knowledge";

  return chunkText(content).map((text) => ({
    source: relativePath,
    sourceRank,
    text,
  }));
};

const sourceRankForStructuredPath = (relativePath) =>
  relativePath.includes("board") || relativePath.includes("bundle") || relativePath.includes("normalized")
    ? "structured-data"
    : relativePath.includes("milestone")
      ? "milestone-data"
      : relativePath.includes("official") || relativePath.includes("nba-official")
        ? "official-local"
        : relativePath.includes("raw_sources") || relativePath.includes("source_quality")
          ? "source-registry"
          : "local-knowledge";

const makeStructuredChunk = ({ source, sourceRank, path, value, label }) => ({
  source,
  sourceRank,
  path,
  text: [
    label ? `Record: ${label}` : null,
    `Path: ${path}`,
    compactJson(value),
  ]
    .filter(Boolean)
    .join("\n"),
});

const labelForRecord = (item, fallback) => {
  if (!item || typeof item !== "object") return fallback;
  const pick = item.pick ?? item.draft_pick ?? item.draftPick ?? item.rank ?? item.source_rank;
  const team = item.team ?? item.team_name ?? item.teamName ?? item.team_abbreviation;
  const player =
    item.player ??
    item.name ??
    item.prospect?.name ??
    item.prospect_name ??
    item.prospectName ??
    item.sourceName ??
    item.title;
  return [pick ? `pick/rank ${pick}` : null, team, player].filter(Boolean).join(" | ") || fallback;
};

const collectStructuredChunks = (value, { source, sourceRank, path = "$", chunks = [], depth = 0 }) => {
  if (chunks.length >= 800 || depth > 6 || value == null) return chunks;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (item && typeof item === "object") {
        chunks.push(
          makeStructuredChunk({
            source,
            sourceRank,
            path: itemPath,
            value: item,
            label: labelForRecord(item, itemPath),
          }),
        );
        collectStructuredChunks(item, { source, sourceRank, path: itemPath, chunks, depth: depth + 1 });
      }
    });
    return chunks;
  }

  if (typeof value !== "object") return chunks;

  const keys = Object.keys(value);
  if (depth > 0 && keys.length <= 18 && JSON.stringify(value).length <= 2600) {
    chunks.push(
      makeStructuredChunk({
        source,
        sourceRank,
        path,
        value,
        label: labelForRecord(value, path),
      }),
    );
  }

  for (const [key, child] of Object.entries(value)) {
    if (Array.isArray(child)) {
      collectStructuredChunks(child, { source, sourceRank, path: `${path}.${key}`, chunks, depth: depth + 1 });
    } else if (child && typeof child === "object" && depth < 3) {
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
    return chunkText(content).map((text, index) => ({
      source: relativePath,
      sourceRank,
      path: `$text[${index}]`,
      text,
    }));
  }
};

const retrieveLocalKnowledge = async ({ question, selectedPick, useSelectedPickContext = false }) => {
  const terms = getSearchTerms({ question, selectedPick, useSelectedPickContext });
  const queryEmbedding = embedText([question, ...terms].join(" "));
  const allChunks = (
    await Promise.all([
      ...knowledgePaths.map(readKnowledgeFile),
      ...structuredKnowledgePaths.map(readStructuredKnowledgeFile),
    ])
  ).flat();
  const scored = allChunks.map((chunk) => scoreChunkForRetrieval(chunk, { terms, queryEmbedding }));
  const matching = scored.filter((chunk) => chunk.exactMatches > 0 || chunk.semanticScore >= 0.08);
  const ranked = rerankChunks(matching.length ? matching : scored, ragSnippetLimit, ragRerankPoolSize);

  return {
    terms,
    retrievalMode: "hashed-token-embedding + lexical hybrid score + MMR rerank",
    snippets: ranked,
    hasStrongLocalMatch: ranked.some(
      (item) =>
        item.exactMatches >= 3 ||
        item.score >= 0.52 ||
        (["official-local", "structured-data"].includes(item.sourceRank) && item.exactMatches > 0),
    ),
  };
};

const snippetSourceText = (snippet) => [snippet?.source, snippet?.path, snippet?.sourceName].filter(Boolean).join("\n").toLowerCase();

const hasSnippetSource = (snippets, pattern) => snippets.some((snippet) => pattern.test(snippetSourceText(snippet)));

const isStrongLocalSnippet = (snippet) =>
  Number(snippet.exactMatches ?? 0) >= 2 ||
  Number(snippet.lexicalScore ?? 0) >= 0.16 ||
  Number(snippet.semanticScore ?? 0) >= 0.24 ||
  Number(snippet.score ?? 0) >= 0.42 ||
  (["official-local", "structured-data", "milestone-data"].includes(snippet.sourceRank) && Number(snippet.exactMatches ?? 0) > 0);

const reflectLocalRetrieval = ({ question, selectedPickMode, local, attemptCount }) => {
  const intent = localQuestionIntent(question, selectedPickMode);
  const snippets = local?.snippets ?? [];
  const sourceDiversity = new Set(snippets.map((snippet) => String(snippet.source ?? "").split("#")[0])).size;
  const strongSnippetCount = snippets.filter(isStrongLocalSnippet).length;
  const maxScore = snippets.reduce((score, snippet) => Math.max(score, Number(snippet.score ?? 0)), 0);
  const coverage = {
    board: hasSnippetSource(snippets, /board|mock|draft|prediction|consensus|strategy|agent_(balanced|expanded)|final_import_bundle|expanded_import_bundle/),
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
  const sufficient =
    snippets.length >= 4 &&
    strongSnippetCount >= 2 &&
    maxScore >= 0.16 &&
    (sourceDiversity >= 2 || criticalMissing.length === 0);

  return {
    attemptCount,
    sufficient,
    decision: sufficient ? "answer" : attemptCount >= 2 ? "answer-cautiously" : "retrieve-again",
    missingSignals,
    coverage,
    snippetCount: snippets.length,
    strongSnippetCount,
    sourceDiversity,
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
  if (intent.milestone || reflection.missingSignals.includes("missing-milestone-source")) {
    supplements.push("milestone answers DraftCode24 answer card required fields");
  }
  if (intent.evidence || reflection.missingSignals.includes("missing-evidence-source")) {
    supplements.push("official source audit verification reconciliation evidence");
  }
  if (intent.team || reflection.missingSignals.includes("missing-team-source")) {
    supplements.push("team preference roster needs fit pick ownership");
  }
  if (intent.prospect || reflection.missingSignals.includes("missing-prospect-source")) {
    supplements.push("prospect profile measurements school position risk");
  }
  if (intent.board || reflection.missingSignals.includes("missing-board-source")) {
    supplements.push("draft board mock consensus prediction rerun strategy");
  }
  if (intent.architecture || reflection.missingSignals.includes("missing-architecture-source")) {
    supplements.push("AWS Lambda S3 CloudFront DynamoDB RAG Bedrock DeepSeek architecture");
  }
  if (selectedPickMode === "direct") {
    supplements.push("selected pick board row team preference prospect profile alternatives evidence");
    supplements.push(...selectedPickRetrievalValues(selectedPick).slice(0, 14));
  }

  return [...new Set([String(question ?? ""), ...supplements].filter(Boolean))].join("\n检索补充: ").slice(0, 1400);
};

const mergeLocalRetrievalAttempts = (attempts) => {
  const snippetMap = new Map();
  for (const attempt of attempts) {
    for (const snippet of attempt.result?.snippets ?? []) {
      const key = `${snippet.source}\n${snippet.path ?? ""}\n${String(snippet.text ?? "").slice(0, 80)}`;
      const existing = snippetMap.get(key);
      if (!existing || Number(snippet.score ?? 0) > Number(existing.score ?? 0)) {
        snippetMap.set(key, snippet);
      }
    }
  }

  const snippets = [...snippetMap.values()]
    .sort((left, right) => Number(right.score ?? 0) - Number(left.score ?? 0))
    .slice(0, ragSnippetLimit);
  const terms = [...new Set(attempts.flatMap((attempt) => attempt.result?.terms ?? []))].slice(0, 48);

  return {
    terms,
    retrievalMode: "Agentic local loop: plan -> retrieve -> reflect -> optional second retrieve -> decide",
    snippets,
    hasStrongLocalMatch:
      attempts.some((attempt) => attempt.result?.hasStrongLocalMatch) ||
      snippets.some(isStrongLocalSnippet),
  };
};

const fetchOfficialWebKnowledge = async (terms) => {
  const results = [];
  const queryEmbedding = embedText(terms.join(" "));
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
      const chunks = chunkText(text).map((chunk) =>
        scoreChunkForRetrieval(
          {
          source: source.url,
          sourceName: source.name,
          sourceRank: "official-web",
          text: chunk,
          },
          { terms, queryEmbedding },
        ),
      );
      results.push(...chunks);
    } catch {
      // Network search is a fallback. If it fails, DeepSeek still receives local knowledge and the failure stays silent.
    }
  }

  const matching = results.filter((chunk) => chunk.exactMatches > 0 || chunk.semanticScore >= 0.08);
  return rerankChunks(matching.length ? matching : results, 6, 18);
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

const readOnlyPredictionRows = (board = []) =>
  board.map((pick) => ({
    pick: pick.pick,
    team: pick.team,
    acquiredFrom: pick.acquiredFrom ?? null,
    player: pick.prospect?.name,
    positions: pick.prospect?.positions ?? [],
    school: pick.prospect?.school,
    origin: pick.prospect?.origin,
    classYear: pick.prospect?.classYear,
    international: Boolean(pick.prospect?.international),
    consensusRank: pick.prospect?.consensusRank,
    score: pick.score,
    confidence: pick.confidence,
    margin: pick.margin,
    roleFit: pick.roleFit,
    evidence: (pick.evidence ?? []).slice(0, 5),
    warnings: pick.warnings ?? [],
    risks: pick.prospect?.risks ?? [],
    alternatives: (pick.alternatives ?? []).slice(0, 3).map((item) => ({
      name: item.name,
      score: item.score,
      roleFit: item.roleFit,
    })),
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

const officialMilestoneQuestions = (milestoneAnswers) =>
  Array.isArray(milestoneAnswers?.answers)
    ? milestoneAnswers.answers.map((item) => ({
        id: item.id,
        prompt: item.question,
        answer: String(item.answer),
        type: item.type,
        tolerance: item.tolerance ?? null,
        evidence: item.evidence ?? [],
      }))
    : [];

const buildExamFacts = (board = [], milestoneAnswers = null) => {
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
  const fallbackExamQuestions = [
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
  const examQuestions = officialMilestoneQuestions(milestoneAnswers);
  const activeExamQuestions = examQuestions.length ? examQuestions : fallbackExamQuestions;

  return {
    scope: "当前 DeepSeek 是比赛相关只读问答 Agent：可回答比赛、数据、里程碑、预测板、AWS/提交、路演和代码说明类问题，但不能直接修改代码、文件或仓库。",
    readOnlyRules: [
      "当前 DeepSeek 可以回答预测主题问题，包括预测结果、理由、风险、备选人选和策略讨论。",
      "当前 DeepSeek 的回答只是文本问答，不会直接改代码、写文件、提交仓库、运行命令或改写锁定预测板。",
      "如果用户要求直接修改代码、写文件、运行命令、提交或推送，必须说明当前 DeepSeek 不能直接执行，只能解释思路或交由代码工作流处理。",
    ],
    questionCount: activeExamQuestions.length,
    examQuestions: activeExamQuestions,
    officialMilestoneAnswers: milestoneAnswers?.answers ?? null,
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
  const [boardArtifact, bundle, documentIndex, milestoneReference, milestoneAnswers] = await Promise.all([
    readJson(boardPath, {}),
    readJson(bundlePath, {}),
    readJson(documentIndexPath, null),
    readFile(milestoneReferencePath, "utf8").catch(() => ""),
    readJson(milestoneAnswersPath, null),
  ]);
  const board = boardArtifact.board ?? [];
  const selectedPick = board.find((pick) => pick.pick === selectedPickNumber) ?? board[0] ?? null;
  const examFacts = buildExamFacts(board, milestoneAnswers);

  return {
    board,
    selectedPick,
    deepSeekContext: {
      modelContext: {
        boardHealth: boardArtifact.health,
        boardSummary: boardArtifact.summary,
        scenario: boardArtifact.scenario,
        sourceMetadata: boardArtifact.sourceMetadata ?? bundle.metadata,
        legacyDeepSeekExamAnswersIgnored: true,
        officialMilestoneAnswersGeneratedAt: milestoneAnswers?.generatedAt ?? null,
      },
      referenceDocuments: {
        documentIndex,
        milestoneQuestionDesignReference: compactText(milestoneReference),
        usagePolicy:
          "DraftCode24里程碑事件预测.md 可用于题意、字段口径、评分口径参考；不是官方赛果，不能用于调整预测球员。",
      },
      predictionBoardForReadOnlyQa: readOnlyPredictionRows(board),
      selectedPick: toDeepSeekSelectedPick(selectedPick),
      examFacts,
    },
  };
};

const buildRetrievedKnowledge = async ({ question, selectedPick, useSelectedPickContext = false, selectedPickMode = "inactive" }) => {
  const intent = localQuestionIntent(question, selectedPickMode);
  const plan = {
    mode: "plan-retrieve-reflect-decide",
    intent: activeIntentLabels(intent).length ? activeIntentLabels(intent) : ["general"],
    selectedPickMode,
    planningHints: [
      useSelectedPickContext
        ? "direct selected-pick questions require board row, team fit, and prospect evidence"
        : selectedPickMode === "background"
          ? "selected pick is background only; preserve the user's broader question scope"
          : "use user question scope first",
    ],
  };
  const attempts = [];
  const firstLocal = await retrieveLocalKnowledge({ question, selectedPick, useSelectedPickContext });
  attempts.push({ query: question, result: firstLocal });

  let local = mergeLocalRetrievalAttempts(attempts);
  let reflection = reflectLocalRetrieval({ question, selectedPickMode, local, attemptCount: attempts.length });

  if (!reflection.sufficient) {
    const nextQuery = followUpLocalQuery({ question, selectedPick, selectedPickMode, reflection });
    if (nextQuery && nextQuery !== question) {
      const secondLocal = await retrieveLocalKnowledge({
        question: nextQuery,
        selectedPick,
        useSelectedPickContext,
      });
      attempts.push({ query: nextQuery, result: secondLocal });
      local = mergeLocalRetrievalAttempts(attempts);
      reflection = reflectLocalRetrieval({ question, selectedPickMode, local, attemptCount: attempts.length });
    }
  }

  const officialWeb = local.hasStrongLocalMatch && reflection.sufficient ? [] : await fetchOfficialWebKnowledge(local.terms);

  return {
    retrievalPolicy:
      "Agentic RAG：先规划查询范围，再检索本地知识库，随后反思证据是否覆盖问题；本地证据不足时改写查询再检索，仍不足才使用官方联网网页；模型全局知识只作最后兜底。",
    retrievalMode: local.retrievalMode,
    selectedPickFocusMode: selectedPickMode,
    selectedPickRetrievalPolicy: useSelectedPickContext
      ? "当前问题直接指向选中栏目；检索词使用当前选中栏目的顺位、球队、球员、学校、位置和球队需求。"
      : selectedPickMode === "background"
        ? "当前有点击栏目，但它只是背景参考；检索和回答优先服从用户问题的全局或更宽范围。"
        : "当前没有明确点击焦点；按用户文字本身和全局比赛问题检索。",
    localSnippets: local.snippets.map(retrievalSnippet),
    officialWebSnippets: officialWeb.map(retrievalSnippet),
    usedWebFallback: officialWeb.length > 0,
    agentic: {
      ...plan,
      attempts: attempts.map((attempt) => ({
        query: String(attempt.query ?? "").slice(0, 420),
        snippetCount: attempt.result?.snippets?.length ?? 0,
        strongLocalMatch: Boolean(attempt.result?.hasStrongLocalMatch),
        topSources: (attempt.result?.snippets ?? []).slice(0, 4).map((snippet) => ({
          source: snippet.source,
          path: snippet.path,
          score: Number(Number(snippet.score ?? 0).toFixed(4)),
          exactMatches: snippet.exactMatches,
        })),
      })),
      reflection,
    },
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

const groundingStatusLine = (retrievedKnowledge) => {
  const reflection = retrievedKnowledge?.agentic?.reflection ?? {};
  const localCount = retrievedKnowledge?.localSnippets?.length ?? 0;
  const webCount = retrievedKnowledge?.officialWebSnippets?.length ?? 0;
  const totalCount = localCount + webCount;
  const missingSignals = Array.isArray(reflection.missingSignals) ? reflection.missingSignals : [];
  const missingText = missingSignals
    .map((signal) => missingSignalLabels[signal] ?? signal)
    .slice(0, 4)
    .join("、");
  const sourceScope = webCount > 0 ? "本地知识库加官方联网兜底" : "本地知识库";

  if (reflection.sufficient) {
    return `证据状态：${sourceScope}已检索 ${totalCount} 条片段，反思结果为可回答。`;
  }

  return missingText
    ? `证据状态：${sourceScope}已检索 ${totalCount} 条片段，仍需复核：${missingText}。`
    : `证据状态：${sourceScope}已检索 ${totalCount} 条片段，仍需复核。`;
};

const attachGroundingStatus = (answer, retrievedKnowledge) => {
  const cleanAnswer = String(answer ?? "").trim();
  if (!cleanAnswer || /^证据状态[:：]/.test(cleanAnswer)) return cleanAnswer;
  return `${groundingStatusLine(retrievedKnowledge)}\n${cleanAnswer}`;
};

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

const isCompetitionRelatedQuestion = (question, context) => {
  const text = String(question ?? "").toLowerCase();
  if (isExamQuestion(question, context) || isPredictionQuestion(question) || isPlayerPredictionQuestion(question)) {
    return true;
  }

  return /比赛|竞赛|赛题|提交|答题|路演|ppt|视频|github|仓库|aws|bedrock|s3|dynamodb|app runner|ecs|nba|选秀|draft|combine|球员|顺位|球队|里程碑|数据|模型|agent|deepseek|codex|界面|前端|代码|部署|运行|readme|架构|成本|评分|规则|deadline|截止/.test(
    text,
  );
};

const isDirectCodeModificationRequest = (question) => {
  const text = String(question ?? "").toLowerCase();
  const asksForExplanation = /怎么|如何|为什么|解释|说明|建议|方案|思路|能不能|是否|可不可以|where|how|why|explain|suggest|plan/.test(
    text,
  );
  if (asksForExplanation) return false;

  const codeTarget = /代码|文件|脚本|组件|css|tsx|ts|js|mjs|json|readme|git|github|仓库|项目|页面|按钮|样式|接口|server|package|commit|push|提交|推送/.test(
    text,
  );
  const directAction = /改|修改|新增|添加|删除|实现|接入|创建|写入|修复|重构|替换|运行|执行|提交|推送|部署|帮我|给我|直接/.test(
    text,
  );

  return codeTarget && directAction;
};

const buildScopeGuardAnswer = () =>
  "当前 DeepSeek 可以回答比赛相关问题，但不能直接修改代码、写文件、运行命令、提交或推送仓库。";

const readPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const localChatMaxTokens = () => readPositiveInteger(process.env.DEEPSEEK_CHAT_MAX_TOKENS, 8192);

const callDeepSeek = async ({
  question,
  history,
  selectedPickNumber,
  selectedPickFocusActive = false,
  context: providedContext,
  antiHallucinationGuardrails = [],
}) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY. Put it in .env.local before using the chat window.");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
  const modelLabel = getModelLabel(model);
  const maxTokens = localChatMaxTokens();
  const context = providedContext ?? (await buildContext(selectedPickNumber));
  const explicitPickNumber = explicitPickNumberFromQuestion(question);
  const selectedPickOverrideUsed =
    Number.isFinite(explicitPickNumber) &&
    explicitPickNumber > 0 &&
    Number(selectedPickNumber) !== explicitPickNumber;
  const pickFocusMode = selectedPickFocusMode({ question, selectedPick: context.selectedPick, selectedPickFocusActive });
  const selectedPickAvailable = pickFocusMode !== "inactive";
  const useSelectedPickContext = pickFocusMode === "direct";
  const deepSeekContext = {
    ...context.deepSeekContext,
    selectedPick: selectedPickAvailable ? toDeepSeekSelectedPick(context.selectedPick) : null,
    selectedPickFocusMode: pickFocusMode,
    selectedPickUsage:
      selectedPickOverrideUsed
        ? `用户文本明确要求第 ${explicitPickNumber} 顺位；已覆盖旧点击顺位上下文，必须围绕第 ${explicitPickNumber} 顺位回答。`
        : pickFocusMode === "direct"
        ? "当前问题直接指向 selectedPick；回答应围绕该顺位、球队、球员、需求和风险。"
        : pickFocusMode === "background"
          ? "当前有点击栏目，但它只是界面背景参考；不要把全局、统计、架构、规则、整体策略问题限制到 selectedPick。"
          : "当前没有明确点击焦点；按用户文字本身和全局比赛问题回答。",
  };
  const retrievedKnowledge = await buildRetrievedKnowledge({
    question,
    selectedPick: context.selectedPick,
    useSelectedPickContext,
    selectedPickMode: pickFocusMode,
  });
  const compactHistory = Array.isArray(history)
    ? history.slice(-8).map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content ?? "").slice(0, 1600),
      }))
    : [];
  const clientGuardrails = Array.isArray(antiHallucinationGuardrails)
    ? antiHallucinationGuardrails.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 8)
    : [];
  const activeGuardrails = [...new Set([...antiHallucinationPolicy, ...clientGuardrails])];

  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content: [
          "你是 DraftOps 当前 DeepSeek 比赛问答 Agent。",
          "你可以回答任何与本次 AWS/NBA 选秀比赛有关的问题，包括赛题规则、数据、里程碑题、参考文档口径、预测板、预测理由、风险、备选人选、AWS 架构、提交、路演、前端界面、代码结构和运行说明。",
          "唯一硬边界：当前 DeepSeek 不能直接修改代码，不能写文件，不能运行命令，不能提交或推送仓库，不能声称已经完成了代码或文件改动。",
          "如果用户要求你直接改代码、写文件、运行命令、提交或推送，你只能说明当前 DeepSeek 不能直接执行，可以用文字解释思路、影响、步骤或让代码工作流处理。",
          "你可以讨论预测主题和可能的预测分析，但输出只是问答文本，不会直接改写锁定预测板、代码或提交文件。",
          "selectedPick 是界面上下文，不是硬性回答范围。selectedPickFocusMode 为 direct 时，围绕该顺位、球队、球员回答；为 background 时，按用户问题的全局或更宽范围回答，selectedPick 只作参考。",
          "如果 selectedPick 为空，按用户文字本身和全局比赛数据回答。",
          "参考文档边界：DraftCode24里程碑事件预测.md 可用于回答题意、字段口径、评分口径和参考题目说明，不能当作官方赛果。",
          "如果用户问参考文档里的 A1/B1/C1/D1 等题目设计，按参考文档回答字段和口径；如果问当前最终答案，优先使用当前本地 examFacts 和锁定预测板。",
          "必须按以下优先级回答：1 本地知识库、当前锁定预测板和当前应试题事实；2 官方本地数据和 NBA.com 官方材料；3 如果本地证据不足，使用提供的官方联网检索片段；4 仍不足时才使用模型全局知识。",
          "官方来源优先级高于媒体、社区、传闻和模型记忆。",
          "防幻觉硬规则：涉及球员、球队、顺位、评分、证据、风险、图片、来源或提交字段时，必须能在当前 deepSeekContext 或 retrievedKnowledge 中找到依据；找不到就明确说本地资料未提供，不能用模型记忆补写。",
          "回答时必须区分三类信息：已由当前资料支持的事实、基于资料的模型推断、仍需复核的缺口。",
          "如果 retrievedKnowledge.agentic.reflection.sufficient 为 false，或者 missingSignals 非空，必须降低确定性，并明确说明缺少哪类证据。",
          "如果需要提到依据，只能使用短标签，例如预测板、球队偏好、球员证据、官方本地资料、官方联网片段；不要编造 URL、媒体名或来源名称。",
          "最终只输出当前问题最可能正确的答案。",
          "只回答用户当前问题，不要给额外建议，不要扩展无关背景，不要冗长列来源清单，不要免责声明。",
          "不要输出 Markdown，不要标题，不要 # 号，不要项目符号，不要代码块。",
          "不要输出任何密钥。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "执行边界重复说明：当前 DeepSeek 只能回答问题，不能直接修改代码、写文件、运行命令、提交或推送仓库。",
          "栏目范围重复说明：selectedPickFocusMode 为 direct 才聚焦当前顺位；为 background 时不要只回答当前顺位。",
          "防幻觉执行策略：",
          JSON.stringify(activeGuardrails),
          "当前比赛上下文如下，题目数量以 questionCount 和 examQuestions 数组为准：",
          JSON.stringify(deepSeekContext),
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
  const choice = completion.choices?.[0];
  const finishReason = choice?.finish_reason ?? null;
  const sanitizedAnswer = sanitizeAnswer(choice?.message?.content);
  if (!sanitizedAnswer) throw new Error("DeepSeek response did not include message content.");
  const answer = attachGroundingStatus(sanitizedAnswer, retrievedKnowledge);

  return {
    answer,
    model,
    modelLabel,
    mode: "deepseek-competition",
    finishReason,
    truncated: finishReason === "length",
    maxTokens,
    grounding: {
      status: groundingStatusLine(retrievedKnowledge),
      reflection: retrievedKnowledge?.agentic?.reflection ?? null,
      usedWebFallback: Boolean(retrievedKnowledge?.usedWebFallback),
    },
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
        maxTokens: localChatMaxTokens(),
        rag: {
          retrievalMode: "Agentic local loop: plan -> retrieve -> reflect -> optional second retrieve -> decide",
          embeddingDimensions: ragEmbeddingDimensions,
          rerankPoolSize: ragRerankPoolSize,
          topK: ragSnippetLimit,
          agenticEnabled: true,
          agenticMaxIterations: 2,
        },
        antiHallucination: {
          enabled: true,
          answerGroundingStatus: true,
          missingEvidencePolicy: "state-gap-instead-of-inventing",
        },
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

      const bodySelectedPickNumber = Number(body.selectedPickNumber ?? 1);
      const explicitPickNumber = explicitPickNumberFromQuestion(question);
      const selectedPickNumber = explicitPickNumber ?? bodySelectedPickNumber;
      const context = await buildContext(selectedPickNumber);
      const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
      const codeModificationRequest = isDirectCodeModificationRequest(question);
      const competitionRelatedQuestion = isCompetitionRelatedQuestion(question, context);

      if (codeModificationRequest) {
        sendJson(request, response, 200, {
          answer: buildScopeGuardAnswer(),
          model,
          modelLabel: getModelLabel(model),
          mode: "local-code-guard",
        });
        return;
      }

      if (!competitionRelatedQuestion) {
        sendJson(request, response, 200, {
          answer: "当前 DeepSeek 只回答本次比赛相关问题。",
          model,
          modelLabel: getModelLabel(model),
          mode: "local-scope-guard",
        });
        return;
      }

      const result = await callDeepSeek({
        question,
        history: body.history,
        selectedPickNumber,
        selectedPickFocusActive: Boolean(body.selectedPickFocusActive) || Boolean(explicitPickNumber),
        antiHallucinationGuardrails: body.antiHallucinationGuardrails,
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
