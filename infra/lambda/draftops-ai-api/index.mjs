import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const region = process.env.AWS_REGION ?? "us-east-1";
const secrets = new SecretsManagerClient({ region });
const bedrock = new BedrockRuntimeClient({ region });
const s3 = new S3Client({ region });
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const provider = (process.env.MODEL_PROVIDER ?? "deepseek").toLowerCase();
const deepSeekBaseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const deepSeekModel = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";
const deepSeekModelLabel = process.env.DEEPSEEK_MODEL_LABEL ?? `${deepSeekModel}[1m]`;
const bedrockModelId = process.env.BEDROCK_MODEL_ID ?? "amazon.nova-lite-v1:0";
const maxTokens = Number(process.env.CHAT_MAX_TOKENS ?? "1800");
const csv = (value) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const unique = (items) => [...new Set(items)];
const defaultRagS3Keys = [
  "public-data/expanded_import_bundle.json",
  "public-data/agent_expanded_recommended_board.json",
  "public-data/agent_expanded_board.json",
  "public-data/agent_balanced_board.json",
  "public-data/final_import_bundle.json",
  "data/final/milestone_answers.json",
  "data/final/expanded_import_bundle.json",
  "data/final/final_import_bundle.json",
  "public-data/prospect_media.json",
  "data/documents/README.md",
  "data/documents/document_index.json",
  "data/documents/milestone-questions/DraftCode24里程碑事件预测.md",
  "data/normalized/normalized_china_nba_draft_board_20260623.json",
  "data/normalized/normalized_2026_official_prospects_101.json",
  "data/normalized/normalized_2026_official_team_profiles_30.json",
  "data/normalized/normalized_2026_team_context.json",
  "data/normalized/normalized_2026_prospect_big_board.json",
  "data/normalized/normalized_2026_mock_lottery.json",
  "data/clean/data_quality_report.md",
  "data/clean/clean_prospects.json",
  "data/clean/clean_teams.json",
  "data/clean/official_prospect_reconciliation.json",
  "data/reports/milestone_prediction_evidence_20260623.json",
  "data/reports/milestone_deepseek_discussion_20260623.json",
  "data/reports/milestone_deepseek_discussion_20260623.md",
  "data/reports/milestone_answer_card_write_report_20260623.json",
  "data/reports/team_preference_research_20260623.json",
  "data/reports/team_preference_research_20260623.md",
  "data/reports/integrated_scoring_framework.json",
  "data/reports/integrated_parameter_debate_summary.md",
  "data/reports/main_parameter_board_simulation.json",
  "data/reports/main_parameter_board_simulation_report.md",
  "data/reports/multi_agent_top30_prediction_consensus_20260623.md",
  "data/reports/prediction_strategy_audit_and_agent_rerun_20260623.md",
  "data/reports/official_prospect_reconciliation_report.md",
  "data/reports/official_double_agent_roster_audit_summary.md",
  "data/reports/raw_sources_registry_report.md",
  "data/reports/current_data_source_audit_20260623.md",
  "data/reports/current_external_data_update_summary.md",
  "data/reports/nba_official_expanded_data_audit_20260623.md",
  "data/reports/nba_china_draft_verification_20260623.md",
  "data/reports/china_nba_draft_scrape_report_20260623.md",
  "data/reports/d8_source_quality_debate.md",
  "data/raw/raw_sources.json",
  "data/raw/external_source_inventory.json",
  "data/raw/nba-official-2026-prospects-live.md",
  "data/raw/nba-official-2026-draft-order-live.md",
  "data/raw/china-nba-draft-20260623.md",
];
const ragS3Bucket = process.env.DRAFTOPS_RAG_S3_BUCKET ?? "";
const ragS3Keys = csv(process.env.DRAFTOPS_RAG_S3_KEYS ?? defaultRagS3Keys.join(","));
const ragDynamoTables = unique([
  ...csv(process.env.DRAFTOPS_RAG_DYNAMODB_TABLES),
  ...csv(process.env.DRAFTOPS_RAG_DYNAMODB_TABLE),
  ...csv(process.env.DRAFTOPS_RAG_DDB_TABLE),
]);
const ragDynamoLimit = Number(process.env.DRAFTOPS_RAG_DYNAMODB_LIMIT ?? "160");
const ragCacheTtlMs = Number(process.env.DRAFTOPS_RAG_CACHE_TTL_MS ?? "300000");
const ragEmbeddingProvider = (process.env.DRAFTOPS_RAG_EMBEDDING_PROVIDER ?? "local").toLowerCase();
const ragBedrockEmbeddingModelId = process.env.DRAFTOPS_RAG_BEDROCK_EMBEDDING_MODEL_ID ?? "amazon.titan-embed-text-v2:0";
const ragBedrockEmbeddingMaxChars = Number(process.env.DRAFTOPS_RAG_BEDROCK_EMBEDDING_MAX_CHARS ?? "6000");
const ragDashScopeSecretId = process.env.DRAFTOPS_RAG_DASHSCOPE_SECRET_ID ?? process.env.DASHSCOPE_SECRET_ID ?? "";
const ragDashScopeBaseUrl = process.env.DRAFTOPS_RAG_DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
const ragDashScopeEmbeddingModel = process.env.DRAFTOPS_RAG_DASHSCOPE_EMBEDDING_MODEL ?? "text-embedding-v4";
const ragDashScopeEmbeddingMaxChars = Number(process.env.DRAFTOPS_RAG_DASHSCOPE_EMBEDDING_MAX_CHARS ?? "6000");
const ragDashScopeBatchSize = Math.min(Math.max(Number(process.env.DRAFTOPS_RAG_DASHSCOPE_BATCH_SIZE ?? "10"), 1), 10);
const ragEmbeddingDimensions = Number(process.env.DRAFTOPS_RAG_EMBEDDING_DIMENSIONS ?? "256");
const ragRerankPoolSize = Number(process.env.DRAFTOPS_RAG_RERANK_POOL ?? "36");
const ragRemoteEmbeddingPoolSize = Math.min(Math.max(Number(process.env.DRAFTOPS_RAG_REMOTE_EMBEDDING_POOL ?? "8"), 1), ragRerankPoolSize);
const ragTopK = Number(process.env.DRAFTOPS_RAG_TOP_K ?? "12");
const ragS3LoadConcurrency = Math.min(Math.max(Number(process.env.DRAFTOPS_RAG_S3_LOAD_CONCURRENCY ?? "8"), 1), 16);
const ragMaxChunks = Math.max(Number(process.env.DRAFTOPS_RAG_MAX_CHUNKS ?? "5000"), ragTopK);
const ragMaxS3KeysPerQuery = Math.max(Number(process.env.DRAFTOPS_RAG_MAX_S3_KEYS_PER_QUERY ?? "18"), 1);
const allowedOrigins = csv(process.env.CORS_ALLOWED_ORIGINS);

let cachedSecret;
let cachedDashScopeSecret;
let cachedRagChunks;
let cachedRagCacheKey = "";
let cachedRagLoadedAt = 0;
const bedrockEmbeddingCache = new Map();
const dashScopeEmbeddingCache = new Map();

const isDashScopeEmbeddingProvider = () => ["dashscope", "qwen", "tongyi", "aliyun"].includes(ragEmbeddingProvider);

const retrievalModeLabel = () => {
  if (ragEmbeddingProvider === "bedrock") {
    return "Bedrock Titan candidate embeddings + lexical hybrid score + MMR rerank; local hash fallback";
  }
  if (isDashScopeEmbeddingProvider()) {
    return "Qwen/DashScope candidate embeddings + lexical hybrid score + MMR rerank; local hash fallback";
  }
  return "hashed-token-embedding + lexical hybrid score + MMR rerank";
};

const embeddingProviderLabel = () => {
  if (ragEmbeddingProvider === "bedrock") return "bedrock";
  if (isDashScopeEmbeddingProvider()) return "dashscope";
  return "local-hash";
};

const isPlaceholder = (value) => /replace|placeholder|change-me|changeme|your-/i.test(String(value ?? ""));

const systemPrompt = [
  "You are the DraftOps read-only AI assistant.",
  "You answer questions about the current DraftOps draft board, milestone answers, architecture, and presentation context.",
  "Use retrieved AWS RAG snippets first when they are provided. They may come from S3 objects or DynamoDB records in the deployed environment.",
  "Selected pick context is a retrieval anchor, not a hard answer boundary. When focus mode is direct, answer around that pick/team/player. When focus mode is background, answer the user's global or broader question and mention the selected pick only if it helps.",
  "You must not create, modify, reorder, or replace draft predictions.",
  "If the user asks you to change the draft board, refuse briefly and explain that the deployed assistant is read-only.",
  "Do not reveal secrets, environment variables, credentials, or internal AWS policy details.",
  "Answer in the user's language. Keep answers concise and directly useful for a demo.",
].join("\n");

const getOrigin = (event) => event.headers?.origin ?? event.headers?.Origin ?? "";

const getCorsOrigin = (event) => {
  const origin = getOrigin(event);
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes("*"))) return origin;
  return allowedOrigins[0] ?? "*";
};

const json = (event, statusCode, body) => ({
  statusCode,
  headers: {
    "access-control-allow-origin": getCorsOrigin(event),
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "content-type": "application/json; charset=utf-8",
  },
  body: JSON.stringify(body),
});

const parseBody = (event) => {
  if (!event.body) return {};
  const body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(body);
};

const readDeepSeekKey = async () => {
  if (process.env.DEEPSEEK_API_KEY && !isPlaceholder(process.env.DEEPSEEK_API_KEY)) {
    return process.env.DEEPSEEK_API_KEY;
  }

  const secretId = process.env.DEEPSEEK_SECRET_ID;
  if (!secretId) return "";
  if (cachedSecret !== undefined) return cachedSecret;

  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  const value = result.SecretString ?? "";
  try {
    const parsed = JSON.parse(value);
    cachedSecret = parsed.DEEPSEEK_API_KEY ?? parsed.apiKey ?? parsed.key ?? "";
  } catch {
    cachedSecret = value;
  }

  if (isPlaceholder(cachedSecret)) cachedSecret = "";
  return cachedSecret;
};

const readDashScopeKey = async () => {
  if (process.env.DASHSCOPE_API_KEY && !isPlaceholder(process.env.DASHSCOPE_API_KEY)) {
    return process.env.DASHSCOPE_API_KEY;
  }

  if (!ragDashScopeSecretId) return "";
  if (cachedDashScopeSecret !== undefined) return cachedDashScopeSecret;

  const result = await secrets.send(new GetSecretValueCommand({ SecretId: ragDashScopeSecretId }));
  const value = result.SecretString ?? "";
  try {
    const parsed = JSON.parse(value);
    cachedDashScopeSecret =
      parsed.DASHSCOPE_API_KEY ??
      parsed.dashscopeApiKey ??
      parsed.DRAFTOPS_RAG_DASHSCOPE_API_KEY ??
      parsed.apiKey ??
      parsed.key ??
      "";
  } catch {
    cachedDashScopeSecret = value;
  }

  cachedDashScopeSecret = String(cachedDashScopeSecret ?? "").trim();
  if (isPlaceholder(cachedDashScopeSecret)) cachedDashScopeSecret = "";
  return cachedDashScopeSecret;
};

const compactHistory = (history) =>
  Array.isArray(history)
    ? history.slice(-8).map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content ?? "").slice(0, 1200),
      }))
    : [];

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
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
  return [...new Set([...ascii, ...cjkTerms].filter((term) => term.length >= 2))].slice(0, 32);
};

const compactJson = (value, maxLength = 2200) => {
  const text = JSON.stringify(value, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
};

const chunkText = (text, size = 1200) => {
  const clean = normalizeText(text);
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
  const lower = String(text ?? "").toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term.toLowerCase()) ? 1 : 0), 0);
};

const sourceBoostForRank = (sourceRank) =>
  ({
    "aws-dynamodb": 0.16,
    "aws-s3-json": 0.13,
    "aws-s3-text": 0.09,
  })[sourceRank] ?? 0.04;

const questionIntent = (question) => {
  const text = String(question ?? "").toLowerCase();
  return {
    milestone: /里程碑|题目|答题|答案|字段|a\d|b\d|c\d|d\d|question|milestone|field|answer/.test(text),
    team: /球队|适配|需求|阵容|签位|team|fit|need|roster|pick/.test(text),
    prospect: /球员|候选|学校|身高|体重|位置|prospect|player|school|height|weight|position/.test(text),
    evidence: /来源|证据|官方|验证|审计|source|evidence|official|audit|verify/.test(text),
    board: /预测|榜单|首轮|顺位|board|mock|draft|rank/.test(text),
  };
};

const sourceIntentBoost = (source, question) => {
  const lower = String(source ?? "").toLowerCase();
  const intent = questionIntent(question);
  let boost = 0;

  if (
    intent.milestone &&
    /milestone|documents|answer|deepseek_exam|draftcode24|答题|里程碑/.test(lower)
  ) {
    boost += 0.34;
  }
  if (intent.evidence && /audit|source|official|nba-official|raw_sources|reconciliation|verification/.test(lower)) {
    boost += 0.22;
  }
  if (intent.team && /team|team_context|team_preference|official_team_profiles|needs/.test(lower)) {
    boost += 0.2;
  }
  if (intent.prospect && /prospect|official_prospects|big_board|clean_prospects|china_nba_draft/.test(lower)) {
    boost += 0.2;
  }
  if (intent.board && /board|bundle|mock|prediction|consensus|draft/.test(lower)) {
    boost += 0.16;
  }
  return Math.min(boost, 0.42);
};

const sourceKeyMatchesIntent = (key, intent) => {
  const lower = String(key ?? "").toLowerCase();
  if (/expanded_import_bundle|final_import_bundle|agent_expanded_recommended_board|agent_balanced_board/.test(lower)) return true;
  if (/team_preference|integrated_scoring|parameter|prediction_strategy|multi_agent|main_parameter|consensus/.test(lower)) return true;
  if (intent.milestone && /milestone|answer|draftcode24|deepseek_discussion|answer_card/.test(lower)) return true;
  if (intent.team && /team|team_context|team_profiles|team_preference|needs/.test(lower)) return true;
  if (intent.prospect && /prospect|big_board|mock_lottery|china_nba_draft|clean_prospects/.test(lower)) return true;
  if (intent.evidence && /audit|source|official|raw|reconciliation|verification|quality/.test(lower)) return true;
  if (intent.board && /board|mock|draft|prediction|consensus|strategy/.test(lower)) return true;
  return false;
};

const selectRagS3KeysForQuestion = (question) => {
  const intent = questionIntent(question);
  const selected = ragS3Keys.filter((key) => sourceKeyMatchesIntent(key, intent));
  const fallback = selected.length ? selected : ragS3Keys;
  return fallback.slice(0, ragMaxS3KeysPerQuery);
};

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

const normalizeVector = (values) => {
  const vector = Float32Array.from(values ?? []);
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (!norm) return vector;
  for (let index = 0; index < vector.length; index += 1) vector[index] /= norm;
  return vector;
};

const bedrockEmbedText = async (text) => {
  const inputText = String(text ?? "").slice(0, ragBedrockEmbeddingMaxChars);
  const result = await bedrock.send(
    new InvokeModelCommand({
      modelId: ragBedrockEmbeddingModelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        inputText,
        dimensions: ragEmbeddingDimensions,
        normalize: true,
      }),
    }),
  );
  const payload = JSON.parse(new TextDecoder().decode(result.body));
  const embedding = payload.embedding ?? payload.embeddings?.[0];
  if (!Array.isArray(embedding)) throw new Error("Bedrock embedding response did not include an embedding array.");
  return normalizeVector(embedding);
};

const getBedrockChunkEmbedding = async (chunk) => {
  const cacheKey = [chunk.source, chunk.path, chunk.text?.slice(0, 160)].filter(Boolean).join("|");
  if (bedrockEmbeddingCache.has(cacheKey)) return bedrockEmbeddingCache.get(cacheKey);
  const embedding = await bedrockEmbedText([chunk.source, chunk.path, chunk.text].filter(Boolean).join("\n"));
  bedrockEmbeddingCache.set(cacheKey, embedding);
  return embedding;
};

const dashScopeEmbedTexts = async (texts) => {
  const apiKey = await readDashScopeKey();
  if (!apiKey) throw new Error("DashScope embedding API key is not configured in AWS Secrets Manager.");

  const endpoint = `${ragDashScopeBaseUrl.replace(/\/$/, "")}/embeddings`;
  const normalizedTexts = texts.map((text) => String(text ?? "").slice(0, ragDashScopeEmbeddingMaxChars));
  const embeddings = [];

  for (let index = 0; index < normalizedTexts.length; index += ragDashScopeBatchSize) {
    const batch = normalizedTexts.slice(index, index + ragDashScopeBatchSize);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ragDashScopeEmbeddingModel,
        input: batch,
        dimensions: ragEmbeddingDimensions,
        encoding_format: "float",
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`DashScope embedding request failed: ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
    }

    const payload = JSON.parse(text);
    const data = Array.isArray(payload.data) ? payload.data : [];
    const batchEmbeddings = batch.map((_, batchIndex) => {
      const item = data.find((entry) => entry.index === batchIndex) ?? data[batchIndex];
      return item?.embedding;
    });

    for (const embedding of batchEmbeddings) {
      if (!Array.isArray(embedding)) throw new Error("DashScope embedding response did not include an embedding array.");
      embeddings.push(normalizeVector(embedding));
    }
  }

  return embeddings;
};

const dashScopeChunkCacheKey = (chunk) =>
  [ragDashScopeEmbeddingModel, ragEmbeddingDimensions, chunk.source, chunk.path, chunk.text?.slice(0, 160)]
    .filter(Boolean)
    .join("|");

const getDashScopeChunkEmbeddings = async (chunks) => {
  const missing = [];
  for (const chunk of chunks) {
    const cacheKey = dashScopeChunkCacheKey(chunk);
    if (!dashScopeEmbeddingCache.has(cacheKey)) {
      missing.push({
        cacheKey,
        text: [chunk.source, chunk.path, chunk.text].filter(Boolean).join("\n"),
      });
    }
  }

  if (missing.length) {
    const embeddings = await dashScopeEmbedTexts(missing.map((item) => item.text));
    embeddings.forEach((embedding, index) => {
      dashScopeEmbeddingCache.set(missing[index].cacheKey, embedding);
    });
  }

  return chunks.map((chunk) => dashScopeEmbeddingCache.get(dashScopeChunkCacheKey(chunk)));
};

const scoreChunkForRetrieval = (chunk, { question, terms, queryEmbedding, focusTerms = [], focusWeight = 0 }) => {
  const searchableText = [chunk.source, chunk.path, chunk.text].filter(Boolean).join("\n");
  const embedding = chunk.embedding ?? embedText(searchableText);
  chunk.embedding = embedding;
  const exactMatches = scoreText(searchableText, terms);
  const lexicalScore = terms.length ? Math.min(exactMatches / terms.length, 1) : 0;
  const focusMatches = focusTerms.length ? scoreText(searchableText, focusTerms) : 0;
  const focusScore = focusTerms.length ? Math.min(focusMatches / Math.min(focusTerms.length, 8), 1) : 0;
  const semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, embedding));
  const sourceBoost = sourceBoostForRank(chunk.sourceRank);
  const intentBoost = sourceIntentBoost(chunk.source, question);
  const score =
    semanticScore * 0.46 +
    lexicalScore * 0.24 +
    focusScore * focusWeight +
    sourceBoost +
    intentBoost +
    (exactMatches >= 2 ? 0.05 : 0);

  return {
    ...chunk,
    exactMatches,
    focusMatches,
    focusScore,
    focusWeight,
    intentBoost,
    lexicalScore,
    semanticScore,
    score,
  };
};

const rerankChunks = (candidates, limit = ragTopK, poolSize = ragRerankPoolSize) => {
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

const maybeRerankWithBedrockEmbeddings = async ({ question, terms, candidates }) => {
  if (ragEmbeddingProvider !== "bedrock" || !candidates.length) return null;

  try {
    const queryEmbedding = await bedrockEmbedText([question, ...terms].join(" "));
    const rescored = [];
    for (const candidate of candidates.slice(0, ragRemoteEmbeddingPoolSize)) {
      const embedding = await getBedrockChunkEmbedding(candidate);
      const semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, embedding));
      const sourceBoost = sourceBoostForRank(candidate.sourceRank);
      const score =
        semanticScore * 0.6 +
        candidate.lexicalScore * 0.18 +
        (candidate.focusScore ?? 0) * Math.min(candidate.focusWeight ?? 0, 0.18) +
        sourceBoost +
        (candidate.exactMatches >= 2 ? 0.05 : 0);
      rescored.push({
        ...candidate,
        embedding,
        embeddingProvider: "bedrock",
        semanticScore,
        score,
      });
    }
    return rerankChunks(rescored, ragTopK, ragRerankPoolSize);
  } catch (error) {
    console.warn("Bedrock embedding rerank failed; falling back to local hashed embeddings:", error instanceof Error ? error.message : error);
    return null;
  }
};

const maybeRerankWithDashScopeEmbeddings = async ({ question, terms, candidates }) => {
  if (!isDashScopeEmbeddingProvider() || !candidates.length) return null;

  try {
    const [queryEmbedding] = await dashScopeEmbedTexts([[question, ...terms].join(" ")]);
    const rerankCandidates = candidates.slice(0, ragRemoteEmbeddingPoolSize);
    const candidateEmbeddings = await getDashScopeChunkEmbeddings(rerankCandidates);
    const rescored = rerankCandidates.map((candidate, index) => {
      const embedding = candidateEmbeddings[index];
      const semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, embedding));
      const sourceBoost = sourceBoostForRank(candidate.sourceRank);
      const score =
        semanticScore * 0.6 +
        candidate.lexicalScore * 0.18 +
        (candidate.focusScore ?? 0) * Math.min(candidate.focusWeight ?? 0, 0.18) +
        sourceBoost +
        (candidate.exactMatches >= 2 ? 0.05 : 0);
      return {
        ...candidate,
        embedding,
        embeddingProvider: "dashscope",
        semanticScore,
        score,
      };
    });
    return rerankChunks(rescored, ragTopK, ragRerankPoolSize);
  } catch (error) {
    console.warn("DashScope embedding rerank failed; falling back to local hashed embeddings:", error instanceof Error ? error.message : error);
    return null;
  }
};

const compactString = (value, maxLength = 180) => String(value ?? "").trim().slice(0, maxLength);

const compactStringArray = (value, limit = 8) =>
  (Array.isArray(value) ? value : [])
    .map((item) => compactString(item))
    .filter(Boolean)
    .slice(0, limit);

const compactObjectArray = (value, limit = 4) =>
  (Array.isArray(value) ? value : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      name: compactString(item.name ?? item.player ?? item.prospectName),
      score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
      roleFit: compactString(item.roleFit),
    }))
    .filter((item) => item.name || item.roleFit)
    .slice(0, limit);

const normalizeSelectedPickContext = (value, selectedPickNumber) => {
  if (!value || typeof value !== "object") {
    const pick = Number(selectedPickNumber ?? 0);
    return Number.isFinite(pick) && pick > 0 ? { pick } : null;
  }

  const pick = Number(value.pick ?? selectedPickNumber ?? 0);
  const context = {
    pick: Number.isFinite(pick) && pick > 0 ? pick : null,
    team: compactString(value.team),
    teamCode: compactString(value.teamCode),
    acquiredFrom: compactString(value.acquiredFrom),
    player: compactString(value.player ?? value.prospectName ?? value.name),
    positions: compactStringArray(value.positions, 4),
    school: compactString(value.school),
    origin: compactString(value.origin),
    classYear: compactString(value.classYear),
    international: Boolean(value.international),
    roleFit: compactString(value.roleFit, 360),
    score: Number.isFinite(Number(value.score)) ? Number(value.score) : null,
    confidence: Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : null,
    margin: Number.isFinite(Number(value.margin)) ? Number(value.margin) : null,
    teamNeeds: compactStringArray(value.teamNeeds, 8),
    teamPriorityTags: compactStringArray(value.teamPriorityTags, 8),
    teamPhase: compactString(value.teamPhase),
    teamNotes: compactString(value.teamNotes, 360),
    evidence: compactStringArray(value.evidence, 6),
    warnings: compactStringArray(value.warnings, 5),
    alternatives: compactObjectArray(value.alternatives, 3),
  };

  return Object.fromEntries(Object.entries(context).filter(([, item]) => {
    if (Array.isArray(item)) return item.length > 0;
    return item !== null && item !== "" && item !== false;
  }));
};

const selectedPickFocusValues = (context, selectedPickNumber) => {
  if (!context) return [];
  const pick = Number(context.pick ?? selectedPickNumber ?? 0);
  return [
    Number.isFinite(pick) && pick > 0 ? `pick ${pick}` : "",
    Number.isFinite(pick) && pick > 0 ? `#${pick}` : "",
    Number.isFinite(pick) && pick > 0 ? `第${pick}顺位` : "",
    context.team,
    context.teamCode,
    context.acquiredFrom,
    context.player,
    context.school,
    context.origin,
    context.classYear,
    context.roleFit,
    context.teamPhase,
    context.teamNotes,
    ...(context.positions ?? []),
    ...(context.teamNeeds ?? []),
    ...(context.teamPriorityTags ?? []),
    ...(context.evidence ?? []),
    ...(context.warnings ?? []),
    ...(context.alternatives ?? []).flatMap((item) => [item.name, item.roleFit]),
  ].filter(Boolean);
};

const selectedPickReferenceContext = (context) => {
  if (!context) return null;
  return {
    pick: context.pick ?? null,
    team: context.team ?? "",
    teamCode: context.teamCode ?? "",
    player: context.player ?? "",
    positions: context.positions ?? [],
    school: context.school ?? "",
  };
};

const questionDirectlyTargetsSelectedPick = (question) => {
  const text = String(question ?? "").toLowerCase();
  const asksCurrentContext =
    /(当前|选中|这个|该|此|右侧|详情|栏目|selected|current|this)/.test(text) &&
    /(顺位|签位|球队|球员|pick|team|player|slot|panel|card)/.test(text);
  const namesExplicitSlot = /(?:#|pick\s*)\s*\d{1,2}|(?:第\s*)?\d{1,2}\s*(?:顺位|签位|号签)/i.test(text);
  return asksCurrentContext || namesExplicitSlot;
};

const questionAsksGlobalScope = (question) => {
  const text = String(question ?? "").toLowerCase();
  return /整体|全局|全部|所有|整轮|首轮|前\s*30|30\s*(顺位|签|队|人)|三十|排名|榜单|统计|数量|多少|几个|哪所|哪支|哪个大学|哪个学校|里程碑|答题卡|比赛|赛题|规则|提交|演示|视频|架构|aws|部署|系统|平台|agent|rag|embedding|数据库|前端|后端|lambda|s3|cloudfront|dynamodb|deepseek|bedrock|qwen|dashscope/.test(text);
};

const questionLooksLikeSelectedFollowUp = (question) => {
  const text = String(question ?? "").toLowerCase().trim();
  if (!text) return false;
  return /^(为什么|为何|理由|依据|证据|风险|备选|替代|适配|fit|risk|why|reason|evidence|alternative|runner-up|详细|展开|分析|说明|解释)/.test(text) ||
    /为什么.*(选|这样|这么)|这么选|这样选|适配吗|合适吗|风险呢|还有谁|备选是谁|理由是什么|依据是什么/.test(text);
};

const selectedPickFocusMode = ({ question, selectedPickFocusActive = false }) => {
  if (questionDirectlyTargetsSelectedPick(question)) return "direct";
  if (!selectedPickFocusActive) return "inactive";
  if (questionLooksLikeSelectedFollowUp(question) && !questionAsksGlobalScope(question)) return "direct";
  return "background";
};

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

const structuredChunk = ({ source, sourceRank, path, value, label }) => ({
  source,
  sourceRank,
  path,
  text: [label ? `Record: ${label}` : null, `Path: ${path}`, compactJson(value)].filter(Boolean).join("\n"),
});

const collectStructuredChunks = (value, { source, sourceRank, path = "$", chunks = [], depth = 0 }) => {
  if (chunks.length >= 1000 || depth > 6 || value == null) return chunks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item && typeof item === "object") {
        const itemPath = `${path}[${index}]`;
        chunks.push(structuredChunk({ source, sourceRank, path: itemPath, value: item, label: labelForRecord(item, itemPath) }));
        collectStructuredChunks(item, { source, sourceRank, path: itemPath, chunks, depth: depth + 1 });
      }
    });
    return chunks;
  }
  if (typeof value !== "object") return chunks;

  for (const [key, child] of Object.entries(value)) {
    if (Array.isArray(child) || (child && typeof child === "object" && depth < 3)) {
      collectStructuredChunks(child, { source, sourceRank, path: `${path}.${key}`, chunks, depth: depth + 1 });
    }
  }
  return chunks;
};

const bodyToText = async (body) => {
  if (!body) return "";
  if (typeof body.transformToString === "function") return body.transformToString();
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

const chunksFromS3Object = async (key) => {
  const result = await s3.send(new GetObjectCommand({ Bucket: ragS3Bucket, Key: key }));
  const content = await bodyToText(result.Body);
  const source = `s3://${ragS3Bucket}/${key}`;
  try {
    return collectStructuredChunks(JSON.parse(content), { source, sourceRank: "aws-s3-json" });
  } catch {
    return chunkText(content).map((text, index) => ({ source, sourceRank: "aws-s3-text", path: `$text[${index}]`, text }));
  }
};

const chunksFromDynamoDb = async (tableName) => {
  if (!tableName) return [];
  const chunks = [];
  let ExclusiveStartKey;
  let remaining = Math.max(0, ragDynamoLimit);

  while (remaining > 0) {
    const result = await dynamodb.send(
      new ScanCommand({
        TableName: tableName,
        Limit: Math.min(100, remaining),
        ExclusiveStartKey,
      }),
    );
    for (const item of result.Items ?? []) {
      const path = `$[${chunks.length}]`;
      chunks.push(
        structuredChunk({
          source: `dynamodb://${tableName}`,
          sourceRank: "aws-dynamodb",
          path,
          value: item,
          label: labelForRecord(item, path),
        }),
      );
    }
    remaining -= result.Items?.length ?? 0;
    ExclusiveStartKey = result.LastEvaluatedKey;
    if (!ExclusiveStartKey || !(result.Items?.length)) break;
  }

  return chunks;
};

const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
};

const loadRagChunks = async (question) => {
  const now = Date.now();
  const selectedS3Keys = selectRagS3KeysForQuestion(question);
  const cacheKey = [selectedS3Keys.join(","), ragDynamoTables.join(",")].join("|");
  if (cachedRagChunks && cachedRagCacheKey === cacheKey && now - cachedRagLoadedAt < ragCacheTtlMs) return cachedRagChunks;

  const chunks = [];
  if (ragS3Bucket && selectedS3Keys.length) {
    const loadedObjects = await mapWithConcurrency(selectedS3Keys, ragS3LoadConcurrency, async (key) => {
      try {
        return await chunksFromS3Object(key);
      } catch (error) {
        console.warn(`Failed to load RAG S3 object ${key}:`, error instanceof Error ? error.message : error);
        return [];
      }
    });
    chunks.push(...loadedObjects.flat());
  }

  for (const tableName of ragDynamoTables) {
    try {
      chunks.push(...(await chunksFromDynamoDb(tableName)));
    } catch (error) {
      console.warn(`Failed to load RAG DynamoDB records from ${tableName}:`, error instanceof Error ? error.message : error);
    }
  }

  cachedRagChunks = chunks.slice(0, ragMaxChunks);
  cachedRagCacheKey = cacheKey;
  cachedRagLoadedAt = now;
  return cachedRagChunks;
};

const retrieveKnowledge = async ({ question, selectedPickNumber, selectedPickContext, selectedPickFocusActive }) => {
  const normalizedSelectedPickContext = normalizeSelectedPickContext(selectedPickContext, selectedPickNumber);
  const focusMode = selectedPickFocusMode({ question, selectedPickFocusActive });
  const selectedPickContextUsed = focusMode !== "inactive";
  const selectedPickDirectScope = focusMode === "direct";
  const focusValues = selectedPickContextUsed ? selectedPickFocusValues(normalizedSelectedPickContext, selectedPickNumber) : [];
  const focusTerms = selectedPickContextUsed ? tokenize(focusValues.join(" ")) : [];
  const questionTerms = tokenize(question);
  const terms = unique([...questionTerms, ...(selectedPickDirectScope ? focusTerms : [])]).slice(0, 48);
  const queryEmbedding = embedText([question, ...(selectedPickDirectScope ? focusValues : [])].join(" "));
  const selectedS3Keys = selectRagS3KeysForQuestion(question);
  const chunks = await loadRagChunks(question);
  const focusWeight = selectedPickDirectScope ? 0.2 : selectedPickContextUsed ? 0.06 : 0;
  const scored = chunks.map((chunk) => scoreChunkForRetrieval(chunk, { question, terms, queryEmbedding, focusTerms, focusWeight }));
  const focused = selectedPickContextUsed ? scored.filter((chunk) => chunk.focusMatches > 0) : [];
  const matching = scored.filter((chunk) => chunk.exactMatches > 0 || chunk.semanticScore >= 0.08);
  const seedOrder = selectedPickDirectScope ? [...focused, ...matching, ...scored] : [...matching, ...focused, ...scored];
  const candidateSeed = unique(seedOrder.map((chunk) => `${chunk.source}\n${chunk.path}`))
    .map((key) => {
      const [source, path] = key.split("\n");
      return scored.find((chunk) => chunk.source === source && chunk.path === path);
    })
    .filter(Boolean);
  const localCandidates = rerankChunks(candidateSeed.length ? candidateSeed : scored, ragRerankPoolSize, Math.max(ragRerankPoolSize, ragTopK));
  const allowRemoteEmbeddingRerank = focusMode === "direct" || (focusMode === "inactive" && !questionAsksGlobalScope(question));
  const effectiveTopK = selectedPickDirectScope ? Math.min(ragTopK, 8) : Math.min(ragTopK, 5);
  const finalRanked = allowRemoteEmbeddingRerank
    ? ((await maybeRerankWithBedrockEmbeddings({ question, terms, candidates: localCandidates })) ??
      (await maybeRerankWithDashScopeEmbeddings({ question, terms, candidates: localCandidates })) ??
      rerankChunks(localCandidates, effectiveTopK, ragRerankPoolSize))
    : rerankChunks(localCandidates, effectiveTopK, ragRerankPoolSize);
  const snippetTextLimit = selectedPickDirectScope ? 1000 : 600;
  const snippets = finalRanked
    .map((chunk) => ({
      source: chunk.source,
      sourceRank: chunk.sourceRank,
      path: chunk.path,
      embeddingProvider: chunk.embeddingProvider ?? "local-hash",
      retrievalScore: Number(chunk.score.toFixed(4)),
      semanticScore: Number(chunk.semanticScore.toFixed(4)),
      lexicalScore: Number(chunk.lexicalScore.toFixed(4)),
      focusScore: Number((chunk.focusScore ?? 0).toFixed(4)),
      intentBoost: Number((chunk.intentBoost ?? 0).toFixed(4)),
      exactMatches: chunk.exactMatches,
      focusMatches: chunk.focusMatches ?? 0,
      text: String(chunk.text ?? "").slice(0, snippetTextLimit),
    }));

  return {
    terms,
    retrievalMode: retrievalModeLabel(),
    configuredSources: {
      s3: Boolean(ragS3Bucket && ragS3Keys.length),
      dynamodb: ragDynamoTables.length > 0,
    },
    selectedPickContextUsed,
    selectedPickFocusMode: focusMode,
    selectedPickFocusActive: Boolean(selectedPickFocusActive),
    remoteEmbeddingRerankUsed: allowRemoteEmbeddingRerank && embeddingProviderLabel() !== "local-hash",
    selectedPickContext: selectedPickDirectScope
      ? normalizedSelectedPickContext
      : selectedPickContextUsed
        ? selectedPickReferenceContext(normalizedSelectedPickContext)
        : null,
    focusTerms: selectedPickDirectScope ? focusTerms.slice(0, 24) : [],
    embeddingProvider: embeddingProviderLabel(),
    bedrockEmbeddingModelId: ragEmbeddingProvider === "bedrock" ? ragBedrockEmbeddingModelId : null,
    dashScopeEmbeddingModel: isDashScopeEmbeddingProvider() ? ragDashScopeEmbeddingModel : null,
    embeddingDimensions: ragEmbeddingDimensions,
    rerankPoolSize: ragRerankPoolSize,
    effectiveTopK,
    remoteEmbeddingPoolSize: ragRemoteEmbeddingPoolSize,
    maxChunks: ragMaxChunks,
    configuredS3KeyCount: ragS3Keys.length,
    selectedS3KeyCount: selectedS3Keys.length,
    maxS3KeysPerQuery: ragMaxS3KeysPerQuery,
    loadedChunkCount: chunks.length,
    snippetCount: snippets.length,
    snippets,
  };
};

const buildUserPrompt = ({ question, selectedPickNumber, retrievedKnowledge }) =>
  [
    `Selected pick number: ${Number(selectedPickNumber ?? 1) || 1}`,
    `Selected pick focus mode: ${retrievedKnowledge?.selectedPickFocusMode ?? "inactive"}`,
    retrievedKnowledge?.selectedPickFocusMode === "direct"
      ? "Selected pick scope: direct. The user is asking about this pick/team/player, so answer around the selected context and its evidence."
      : retrievedKnowledge?.selectedPickFocusMode === "background"
        ? "Selected pick scope: background. The user has a clicked context, but the answer must follow the question scope; do not limit global/aggregate/system questions to the selected pick."
        : "Selected pick scope: inactive front-end default. Use global evidence unless the user explicitly asks about the current/selected slot or an exact pick number.",
    "Selected pick context:",
    JSON.stringify(retrievedKnowledge?.selectedPickContext ?? null),
    "Retrieved AWS RAG knowledge:",
    JSON.stringify(retrievedKnowledge),
    "User question:",
    String(question ?? "").slice(0, 3000),
  ].join("\n");

const buildEmptyAnswerFallback = ({ question, retrievedKnowledge }) => {
  const isZh = /[\u4e00-\u9fff]/.test(String(question ?? ""));
  const context = retrievedKnowledge?.selectedPickContext;
  if (retrievedKnowledge?.selectedPickFocusMode === "direct" && context?.team && context?.player) {
    const pick = context.pick ? `#${context.pick} ` : "";
    const positions = Array.isArray(context.positions) && context.positions.length ? ` (${context.positions.join("/")})` : "";
    const needs = Array.isArray(context.teamNeeds) && context.teamNeeds.length ? context.teamNeeds.join(", ") : "";
    const roleFit = context.roleFit ? String(context.roleFit) : "";
    if (isZh) {
      return [
        `当前点击项是 ${pick}${context.team} 选择 ${context.player}${positions}。`,
        needs ? `球队需求侧重点：${needs}。` : "",
        roleFit ? `角色匹配依据：${roleFit}。` : "",
        "这是基于当前 DraftOps 已检索上下文生成的兜底回答；DeepSeek 本次返回了空内容。",
      ].filter(Boolean).join("\n");
    }
    return [
      `The selected slot is ${pick}${context.team} selecting ${context.player}${positions}.`,
      needs ? `Team needs: ${needs}.` : "",
      roleFit ? `Role fit: ${roleFit}.` : "",
      "This fallback answer is based on the retrieved DraftOps context because DeepSeek returned empty content.",
    ].filter(Boolean).join("\n");
  }
  return isZh
    ? "已完成 RAG 检索，但 DeepSeek 本次返回了空内容。请换一种更具体的问法重试。"
    : "RAG retrieval completed, but DeepSeek returned empty content. Please retry with a more specific question.";
};

const callDeepSeek = async ({ question, history, selectedPickNumber, selectedPickContext, selectedPickFocusActive }) => {
  const apiKey = await readDeepSeekKey();
  if (!apiKey) {
    return {
      statusCode: 503,
      payload: {
        error: "DeepSeek API key is not configured in AWS Secrets Manager.",
        configured: false,
        provider: "deepseek",
      },
    };
  }
  const retrievedKnowledge = await retrieveKnowledge({ question, selectedPickNumber, selectedPickContext, selectedPickFocusActive });
  const responseMaxTokens =
    retrievedKnowledge.selectedPickFocusMode === "background"
      ? Math.min(maxTokens, 700)
      : Math.min(maxTokens, 1000);

  const response = await fetch(`${deepSeekBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: deepSeekModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...compactHistory(history),
        { role: "user", content: buildUserPrompt({ question, selectedPickNumber, retrievedKnowledge }) },
      ],
      max_tokens: responseMaxTokens,
      temperature: 0.25,
      stream: false,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    return {
      statusCode: response.status,
      payload: { error: `DeepSeek request failed: ${response.status} ${response.statusText}`, details: text.slice(0, 500) },
    };
  }

  const completion = JSON.parse(text);
  const answer = String(completion.choices?.[0]?.message?.content ?? "").trim();
  return {
    statusCode: 200,
    payload: {
      answer: answer || buildEmptyAnswerFallback({ question, retrievedKnowledge }),
      model: deepSeekModel,
      modelLabel: deepSeekModelLabel,
      mode: "deepseek-serverless",
      usage: completion.usage ?? null,
    },
  };
};

const callBedrock = async ({ question, history, selectedPickNumber, selectedPickContext, selectedPickFocusActive }) => {
  const retrievedKnowledge = await retrieveKnowledge({ question, selectedPickNumber, selectedPickContext, selectedPickFocusActive });
  const responseMaxTokens =
    retrievedKnowledge.selectedPickFocusMode === "background"
      ? Math.min(maxTokens, 700)
      : Math.min(maxTokens, 1000);
  const historyText = compactHistory(history)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const command = new ConverseCommand({
    modelId: bedrockModelId,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: "user",
        content: [
          {
            text: [
              historyText ? `Recent history:\n${historyText}` : "",
              buildUserPrompt({ question, selectedPickNumber, retrievedKnowledge }),
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: responseMaxTokens,
      temperature: 0.25,
    },
  });

  const output = await bedrock.send(command);
  const answer = output.output?.message?.content
    ?.map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  return {
    statusCode: 200,
    payload: {
      answer: answer || "Bedrock returned an empty answer.",
      model: bedrockModelId,
      modelLabel: bedrockModelId,
      mode: "bedrock-serverless",
      usage: output.usage ?? null,
    },
  };
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path = event.rawPath ?? event.path ?? "/";

  if (method === "OPTIONS") return json(event, 204, {});

  try {
    if (method === "GET" && path.endsWith("/api/deepseek/health")) {
      const configured = provider === "bedrock" ? true : Boolean(await readDeepSeekKey());
      const dashScopeEmbeddingConfigured = isDashScopeEmbeddingProvider() ? Boolean(await readDashScopeKey()) : false;
      return json(event, 200, {
        ok: true,
        configured,
        provider,
        model: provider === "bedrock" ? bedrockModelId : deepSeekModel,
        modelLabel: provider === "bedrock" ? bedrockModelId : deepSeekModelLabel,
        rag: {
          s3Configured: Boolean(ragS3Bucket && ragS3Keys.length),
          dynamodbConfigured: ragDynamoTables.length > 0,
          dynamodbTableCount: ragDynamoTables.length,
          retrievalMode: retrievalModeLabel(),
          embeddingProvider: embeddingProviderLabel(),
          bedrockEmbeddingModelId: ragEmbeddingProvider === "bedrock" ? ragBedrockEmbeddingModelId : null,
          dashScopeEmbeddingModel: isDashScopeEmbeddingProvider() ? ragDashScopeEmbeddingModel : null,
          dashScopeEmbeddingConfigured,
          embeddingDimensions: ragEmbeddingDimensions,
          rerankPoolSize: ragRerankPoolSize,
          remoteEmbeddingPoolSize: ragRemoteEmbeddingPoolSize,
          topK: ragTopK,
          configuredS3KeyCount: ragS3Keys.length,
          maxS3KeysPerQuery: ragMaxS3KeysPerQuery,
          maxChunks: ragMaxChunks,
          s3LoadConcurrency: ragS3LoadConcurrency,
          cacheTtlMs: ragCacheTtlMs,
        },
      });
    }

    if (method === "POST" && path.endsWith("/api/deepseek/chat")) {
      const body = parseBody(event);
      const question = String(body.question ?? "").trim();
      if (!question) return json(event, 400, { error: "Question is required." });

      const result =
        provider === "bedrock"
          ? await callBedrock(body)
          : await callDeepSeek({
              question,
              history: body.history,
              selectedPickNumber: body.selectedPickNumber,
              selectedPickContext: body.selectedPickContext,
              selectedPickFocusActive: Boolean(body.selectedPickFocusActive),
            });
      return json(event, result.statusCode, result.payload);
    }

    return json(event, 404, { error: "Not found." });
  } catch (error) {
    console.error(error);
    return json(event, 500, {
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
};
