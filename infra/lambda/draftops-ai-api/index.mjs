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
  "public-data/agent_balanced_board.json",
  "data/final/milestone_answers.json",
  "data/normalized/normalized_china_nba_draft_board_20260623.json",
  "public-data/prospect_media.json",
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
const ragTopK = Number(process.env.DRAFTOPS_RAG_TOP_K ?? "12");
const allowedOrigins = csv(process.env.CORS_ALLOWED_ORIGINS);

let cachedSecret;
let cachedDashScopeSecret;
let cachedRagChunks;
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

const scoreChunkForRetrieval = (chunk, { terms, queryEmbedding }) => {
  const searchableText = [chunk.source, chunk.path, chunk.text].filter(Boolean).join("\n");
  const embedding = chunk.embedding ?? embedText(searchableText);
  chunk.embedding = embedding;
  const exactMatches = scoreText(searchableText, terms);
  const lexicalScore = terms.length ? Math.min(exactMatches / terms.length, 1) : 0;
  const semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, embedding));
  const sourceBoost = sourceBoostForRank(chunk.sourceRank);
  const score = semanticScore * 0.58 + lexicalScore * 0.32 + sourceBoost + (exactMatches >= 2 ? 0.05 : 0);

  return {
    ...chunk,
    exactMatches,
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
    for (const candidate of candidates.slice(0, ragRerankPoolSize)) {
      const embedding = await getBedrockChunkEmbedding(candidate);
      const semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, embedding));
      const sourceBoost = sourceBoostForRank(candidate.sourceRank);
      const score = semanticScore * 0.66 + candidate.lexicalScore * 0.24 + sourceBoost + (candidate.exactMatches >= 2 ? 0.05 : 0);
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
    const rerankCandidates = candidates.slice(0, ragRerankPoolSize);
    const candidateEmbeddings = await getDashScopeChunkEmbeddings(rerankCandidates);
    const rescored = rerankCandidates.map((candidate, index) => {
      const embedding = candidateEmbeddings[index];
      const semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, embedding));
      const sourceBoost = sourceBoostForRank(candidate.sourceRank);
      const score = semanticScore * 0.66 + candidate.lexicalScore * 0.24 + sourceBoost + (candidate.exactMatches >= 2 ? 0.05 : 0);
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

const shouldUseSelectedPickNumber = (question) => {
  const text = String(question ?? "").toLowerCase();
  const asksCurrentContext =
    /(当前|选中|这个|该|此|右侧|详情|栏目|selected|current|this)/.test(text) &&
    /(顺位|签位|球队|球员|pick|team|player|slot|panel|card)/.test(text);
  const namesExplicitSlot = /(?:#|pick\s*)\s*\d{1,2}|(?:第\s*)?\d{1,2}\s*(?:顺位|签位|号签)/i.test(text);
  return asksCurrentContext || namesExplicitSlot;
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

const loadRagChunks = async () => {
  const now = Date.now();
  if (cachedRagChunks && now - cachedRagLoadedAt < ragCacheTtlMs) return cachedRagChunks;

  const chunks = [];
  if (ragS3Bucket && ragS3Keys.length) {
    for (const key of ragS3Keys) {
      try {
        chunks.push(...(await chunksFromS3Object(key)));
      } catch (error) {
        console.warn(`Failed to load RAG S3 object ${key}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  for (const tableName of ragDynamoTables) {
    try {
      chunks.push(...(await chunksFromDynamoDb(tableName)));
    } catch (error) {
      console.warn(`Failed to load RAG DynamoDB records from ${tableName}:`, error instanceof Error ? error.message : error);
    }
  }

  cachedRagChunks = chunks;
  cachedRagLoadedAt = now;
  return chunks;
};

const retrieveKnowledge = async ({ question, selectedPickNumber }) => {
  const selectedPickContextUsed = shouldUseSelectedPickNumber(question);
  const terms = tokenize([question, selectedPickContextUsed ? `pick ${Number(selectedPickNumber ?? 1) || 1}` : ""].join(" "));
  const queryEmbedding = embedText([question, ...terms].join(" "));
  const chunks = await loadRagChunks();
  const scored = chunks.map((chunk) => scoreChunkForRetrieval(chunk, { terms, queryEmbedding }));
  const matching = scored.filter((chunk) => chunk.exactMatches > 0 || chunk.semanticScore >= 0.08);
  const localCandidates = rerankChunks(matching.length ? matching : scored, ragRerankPoolSize, Math.max(ragRerankPoolSize, ragTopK));
  const finalRanked = (await maybeRerankWithBedrockEmbeddings({ question, terms, candidates: localCandidates })) ??
    (await maybeRerankWithDashScopeEmbeddings({ question, terms, candidates: localCandidates })) ??
    rerankChunks(localCandidates, ragTopK, ragRerankPoolSize);
  const snippets = finalRanked
    .map((chunk) => ({
      source: chunk.source,
      sourceRank: chunk.sourceRank,
      path: chunk.path,
      embeddingProvider: chunk.embeddingProvider ?? "local-hash",
      retrievalScore: Number(chunk.score.toFixed(4)),
      semanticScore: Number(chunk.semanticScore.toFixed(4)),
      lexicalScore: Number(chunk.lexicalScore.toFixed(4)),
      exactMatches: chunk.exactMatches,
      text: String(chunk.text ?? "").slice(0, 1600),
    }));

  return {
    terms,
    retrievalMode: retrievalModeLabel(),
    configuredSources: {
      s3: Boolean(ragS3Bucket && ragS3Keys.length),
      dynamodb: ragDynamoTables.length > 0,
    },
    selectedPickContextUsed,
    embeddingProvider: embeddingProviderLabel(),
    bedrockEmbeddingModelId: ragEmbeddingProvider === "bedrock" ? ragBedrockEmbeddingModelId : null,
    dashScopeEmbeddingModel: isDashScopeEmbeddingProvider() ? ragDashScopeEmbeddingModel : null,
    embeddingDimensions: ragEmbeddingDimensions,
    rerankPoolSize: ragRerankPoolSize,
    snippetCount: snippets.length,
    snippets,
  };
};

const buildUserPrompt = ({ question, selectedPickNumber, retrievedKnowledge }) =>
  [
    `Selected pick number: ${Number(selectedPickNumber ?? 1) || 1}`,
    retrievedKnowledge?.selectedPickContextUsed
      ? "Selected pick scope: the user explicitly asked about the current/selected slot or an exact pick number."
      : "Selected pick scope: front-end focus only; ignore it unless the user explicitly asks about the current/selected slot or an exact pick number.",
    "Retrieved AWS RAG knowledge:",
    JSON.stringify(retrievedKnowledge),
    "User question:",
    String(question ?? "").slice(0, 3000),
  ].join("\n");

const callDeepSeek = async ({ question, history, selectedPickNumber }) => {
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
  const retrievedKnowledge = await retrieveKnowledge({ question, selectedPickNumber });

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
      max_tokens: maxTokens,
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
      answer: answer || "DeepSeek returned an empty answer.",
      model: deepSeekModel,
      modelLabel: deepSeekModelLabel,
      mode: "deepseek-serverless",
      usage: completion.usage ?? null,
    },
  };
};

const callBedrock = async ({ question, history, selectedPickNumber }) => {
  const retrievedKnowledge = await retrieveKnowledge({ question, selectedPickNumber });
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
      maxTokens,
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
          topK: ragTopK,
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
