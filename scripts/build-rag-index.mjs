import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { rootDir } from "./lib/draftops-manifest.mjs";

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

await loadEnvFile(resolve(rootDir, ".env.local"));
await loadEnvFile(resolve(rootDir, ".env"));

const outputDir = resolve(rootDir, "data", "rag");
const requestedEmbeddingProvider =
  process.env.DRAFTOPS_RAG_INDEX_EMBEDDING_PROVIDER ?? (process.env.DASHSCOPE_API_KEY ? "dashscope" : "local-hash");
const embeddingProvider = requestedEmbeddingProvider.toLowerCase();
const embeddingDimensions = Number(
  process.env.DRAFTOPS_RAG_EMBEDDING_DIMENSIONS ?? (embeddingProvider === "dashscope" ? "1024" : "256"),
);
const embeddingModel = process.env.DRAFTOPS_RAG_DASHSCOPE_EMBEDDING_MODEL ?? "text-embedding-v4";
const dashScopeBaseUrl = process.env.DRAFTOPS_RAG_DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
const dashScopeBatchSize = Math.min(Math.max(Number(process.env.DRAFTOPS_RAG_DASHSCOPE_BATCH_SIZE ?? "10"), 1), 10);
const maxChunksPerSource = Number(process.env.DRAFTOPS_RAG_INDEX_MAX_CHUNKS_PER_SOURCE ?? "24");
const chunkSize = Number(process.env.DRAFTOPS_RAG_INDEX_CHUNK_SIZE ?? "1100");
const maxEmbeddingChars = Number(process.env.DRAFTOPS_RAG_DASHSCOPE_EMBEDDING_MAX_CHARS ?? "6000");
const reportStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const reportsDir = resolve(rootDir, "data", "reports");
const cleaningReportJsonPath = resolve(reportsDir, `rag_source_cleaning_${reportStamp}.json`);
const cleaningReportMdPath = resolve(reportsDir, `rag_source_cleaning_${reportStamp}.md`);
const sourceChunkLimit = (relativePath) => {
  if (/normalized_2026_local_player_pool_124\.json$/.test(relativePath)) return 160;
  if (/normalized_2026_player_feature_reference_124\.json$/.test(relativePath)) return 180;
  if (/normalized_2026_online_player_list_reverification_20260623\.json$/.test(relativePath)) return 180;
  if (/normalized_2026_official_prospects_101\.json$/.test(relativePath)) return 130;
  return maxChunksPerSource;
};

const excludedRagSources = new Map([
  [
    "data/reports/deepseek_exam_answers.json",
    "model-output-answer-file: final milestone_answers.json and evidence reports are the source of truth",
  ],
  [
    "data/reports/deepseek_exam_answers.txt",
    "model-output-answer-file: final milestone_answers.json and evidence reports are the source of truth",
  ],
  [
    "data/reports/milestone_deepseek_discussion_20260623.json",
    "superseded-model-discussion: final milestone_answers.json and tolerance reports are the source of truth",
  ],
  [
    "data/reports/milestone_deepseek_discussion_20260623.md",
    "superseded-model-discussion: final milestone_answers.json and tolerance reports are the source of truth",
  ],
]);

const cleaningStats = [];

const indexSpecs = [
  {
    id: "core-board",
    output: "rag-core-board.json",
    description: "Locked draft boards, final import bundles, and scoring framework.",
    sources: [
      "public/data/agent_expanded_recommended_board.json",
      "public/data/agent_expanded_board.json",
      "public/data/agent_balanced_board.json",
      "public/data/final_import_bundle.json",
      "public/data/expanded_import_bundle.json",
      "data/final/final_import_bundle.json",
      "data/final/expanded_import_bundle.json",
      "data/reports/integrated_scoring_framework.json",
      "data/reports/main_parameter_board_simulation.json",
      "data/reports/main_parameter_board_simulation_report.md",
      "data/reports/multi_agent_top30_prediction_consensus_20260623.md",
      "data/reports/prediction_strategy_audit_and_agent_rerun_20260623.md",
    ],
  },
  {
    id: "team-preference",
    output: "rag-team-preference.json",
    description: "Team needs, preference research, and roster-context records.",
    sources: [
      "data/normalized/normalized_2026_official_team_profiles_30.json",
      "data/normalized/normalized_2026_team_context.json",
      "data/clean/clean_teams.json",
      "data/reports/team_preference_research_20260623.json",
      "data/reports/team_preference_research_20260623.md",
      "data/reports/a5_team_preference_report.md",
      "data/reports/a5_web_team_context_report.md",
      "data/reports/a5_team_fit_parameter_debate.md",
    ],
  },
  {
    id: "prospect-evidence",
    output: "rag-prospect-evidence.json",
    description: "Prospect boards, official reconciliation, media, and raw-source evidence.",
    sources: [
      "data/normalized/normalized_2026_official_prospects_101.json",
      "data/normalized/normalized_2026_local_player_pool_124.json",
      "data/normalized/normalized_2026_player_feature_reference_124.json",
      "data/normalized/normalized_2026_online_player_list_reverification_20260623.json",
      "data/normalized/normalized_2026_prospect_big_board.json",
      "data/normalized/normalized_2026_mock_lottery.json",
      "data/normalized/normalized_china_nba_draft_board_20260623.json",
      "data/clean/clean_prospects.json",
      "data/clean/official_prospect_reconciliation.json",
      "public/data/prospect_media.json",
      "data/reports/official_prospect_reconciliation_report.md",
      "data/reports/official_double_agent_roster_audit_summary.md",
      "data/reports/nba_official_expanded_data_audit_20260623.md",
      "data/reports/china_nba_draft_scrape_report_20260623.md",
      "data/reports/player_feature_parameter_reference_124_20260623.md",
      "data/reports/online_full_player_list_reverification_20260623.md",
      "data/raw/nba-official-2026-prospects-live.md",
      "data/raw/china-nba-draft-20260623.md",
    ],
  },
  {
    id: "milestone",
    output: "rag-milestone.json",
    description: "Milestone questions, answer card evidence, and discussion logs.",
    sources: [
      "data/final/milestone_answers.json",
      "data/documents/milestone-questions/DraftCode24里程碑事件预测.md",
      "data/reports/milestone_prediction_evidence_20260623.json",
      "data/reports/milestone_deepseek_discussion_20260623.json",
      "data/reports/milestone_deepseek_discussion_20260623.md",
      "data/reports/milestone_answer_card_write_report_20260623.json",
      "data/reports/deepseek_exam_answers.json",
      "data/reports/deepseek_exam_answers.txt",
    ],
  },
  {
    id: "architecture",
    output: "rag-architecture.json",
    description: "Project architecture, AWS deployment, data-source, and demo documentation.",
    sources: [
      "README.md",
      "data/README.md",
      "data/documents/README.md",
      "data/documents/document_index.json",
      "data/reports/current_data_source_audit_20260623.md",
      "data/reports/current_external_data_update_summary.md",
      "data/reports/raw_sources_registry_report.md",
      "data/raw/raw_sources.json",
      "data/raw/external_source_inventory.json",
    ],
  },
];

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const secretLikePatterns = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bASIA[0-9A-Z]{16}\b/g,
  /\b(?:api[_-]?key|secret|token|authorization|bearer)\s*[:=]\s*["']?[^"'\s,;]{12,}/gi,
];

const weakModelChatterPatterns = [
  /\bas an ai\b/i,
  /\bi (?:do not|don't) have (?:access|real-time access)\b/i,
  /\bi cannot browse\b/i,
  /\bi can't browse\b/i,
  /无法访问(?:互联网|外部|实时)/,
  /作为(?:一个)?ai/,
];

const hardNoisePatterns = [
  /lorem ipsum/i,
  /\bundefined\b/i,
  /\bNaN\b/,
  /待补充|占位符|placeholder/i,
];

const sourceTrustTier = (relativePath) => {
  if (/^public\/data\/|^data\/final\//.test(relativePath)) return "locked-artifact";
  if (/nba-official|official|online_player_list_reverification|china-nba-draft/i.test(relativePath)) return "official-or-reverified";
  if (/^data\/normalized\/|^data\/clean\//.test(relativePath)) return "normalized-data";
  if (/milestone_answers|milestone_prediction_evidence|answer_card|system_grounding_audit/i.test(relativePath)) {
    return "evidence-report";
  }
  if (/deepseek|discussion|debate|consensus/i.test(relativePath)) return "model-discussion-secondary";
  if (/README|document|raw_sources|external_source/i.test(relativePath)) return "architecture-or-source-registry";
  return "project-report";
};

const redactSensitiveText = (text) => {
  let redacted = String(text ?? "");
  let count = 0;
  for (const pattern of secretLikePatterns) {
    redacted = redacted.replace(pattern, () => {
      count += 1;
      return "[REDACTED_SECRET]";
    });
  }
  return { text: redacted, count };
};

const cleanModelChatterLines = (text) =>
  String(text ?? "")
    .split(/\r?\n/)
    .filter((line) => !weakModelChatterPatterns.some((pattern) => pattern.test(line)))
    .join("\n")
    .trim();

const evaluateChunkQuality = ({ text, source }) => {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length < 40) return { keep: false, reason: "empty-or-too-short" };
  if (hardNoisePatterns.some((pattern) => pattern.test(normalized))) return { keep: false, reason: "placeholder-or-invalid-token" };
  if (weakModelChatterPatterns.some((pattern) => pattern.test(normalized)) && normalized.length < 260) {
    return { keep: false, reason: "model-chatter-without-grounding" };
  }
  if (/deepseek_exam_answers/i.test(source)) return { keep: false, reason: "excluded-model-answer-file" };
  return { keep: true, reason: "kept" };
};

const sanitizeChunk = (chunk) => {
  const trustTier = sourceTrustTier(chunk.source);
  const noChatter = cleanModelChatterLines(chunk.text);
  const { text: redactedText, count: redactionCount } = redactSensitiveText(noChatter);
  const quality = evaluateChunkQuality({ text: redactedText, source: chunk.source });
  if (!quality.keep) {
    return {
      keep: false,
      reason: quality.reason,
      redactionCount,
      chunk,
    };
  }

  return {
    keep: true,
    reason: quality.reason,
    redactionCount,
    chunk: {
      ...chunk,
      text: [
        `Source trust tier: ${trustTier}`,
        `RAG cleaning: quality-gated${redactionCount ? "; secret-like tokens redacted" : ""}`,
        redactedText,
      ].join("\n"),
      cleaningStatus: "cleaned",
      sourceTrustTier: trustTier,
      qualityTags: [
        trustTier,
        redactionCount ? "secret-like-token-redacted" : "no-secret-like-token",
        "rag-quality-gated",
      ],
    },
  };
};

const tallyReasons = (items) => {
  const counts = {};
  for (const item of items) counts[item.reason] = (counts[item.reason] ?? 0) + 1;
  return counts;
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
  return [...new Set([...ascii, ...cjkTerms].filter((term) => term.length >= 2))];
};

const hashToken = (token) => {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const embedText = (value, dimensions = embeddingDimensions) => {
  const vector = new Float32Array(dimensions);
  const terms = tokenize(value);
  if (!terms.length) return [...vector];

  for (const term of terms) {
    const tokenHash = hashToken(term);
    const index = (tokenHash >>> 1) % dimensions;
    const sign = tokenHash & 1 ? -1 : 1;
    vector[index] += sign * (1 + Math.log2(term.length + 1));
  }

  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (!norm) return [...vector];
  for (let index = 0; index < vector.length; index += 1) vector[index] = Number((vector[index] / norm).toFixed(6));
  return [...vector];
};

const compactJson = (value, maxLength = 2400) => {
  const text = JSON.stringify(value, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
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

const chunkText = (text, size = chunkSize) => {
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
      const overlap = 160;
      for (let index = 0; index < paragraph.length; index += size - overlap) {
        chunks.push(paragraph.slice(index, index + size));
      }
      continue;
    }

    if (!current) current = paragraph;
    else if (`${current}\n\n${paragraph}`.length <= size) current = `${current}\n\n${paragraph}`;
    else {
      chunks.push(current);
      current = paragraph;
    }
  }

  if (current) chunks.push(current);
  return chunks;
};

const structuredChunk = ({ source, category, path, value, label }) => ({
  id: `${category}:${source}:${path}`,
  category,
  source,
  sourceRank: "rag-index",
  path,
  text: [label ? `Record: ${label}` : null, `Path: ${path}`, compactJson(value)].filter(Boolean).join("\n"),
});

const collectStructuredChunks = (value, { source, category, path = "$", chunks = [], depth = 0, limit = maxChunksPerSource }) => {
  if (chunks.length >= limit || depth > 5 || value == null) return chunks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (chunks.length >= limit) return;
      if (item && typeof item === "object") {
        const itemPath = `${path}[${index}]`;
        chunks.push(structuredChunk({ source, category, path: itemPath, value: item, label: labelForRecord(item, itemPath) }));
        collectStructuredChunks(item, { source, category, path: itemPath, chunks, depth: depth + 1, limit });
      }
    });
    return chunks;
  }
  if (typeof value !== "object") return chunks;

  for (const [key, child] of Object.entries(value)) {
    if (chunks.length >= limit) break;
    if (Array.isArray(child) || (child && typeof child === "object" && depth < 3)) {
      collectStructuredChunks(child, { source, category, path: `${path}.${key}`, chunks, depth: depth + 1, limit });
    }
  }
  return chunks;
};

const readSourceChunks = async (relativePath, category) => {
  const absolutePath = resolve(rootDir, relativePath);
  if (!existsSync(absolutePath)) return [];
  if (excludedRagSources.has(relativePath)) {
    cleaningStats.push({
      source: relativePath,
      category,
      trustTier: sourceTrustTier(relativePath),
      status: "excluded",
      reason: excludedRagSources.get(relativePath),
      rawChunks: 0,
      keptChunks: 0,
      droppedChunks: 0,
      redactions: 0,
      dropReasons: {},
    });
    return [];
  }
  const limit = sourceChunkLimit(relativePath);
  const content = await readFile(absolutePath, "utf8");
  const trimmed = content.trim();
  if (!trimmed) return [];

  let rawChunks = [];
  try {
    const parsed = JSON.parse(trimmed);
    rawChunks = collectStructuredChunks(parsed, { source: relativePath, category, limit }).slice(0, limit);
  } catch {
    rawChunks = chunkText(content)
      .slice(0, limit)
      .map((text, index) => ({
        id: `${category}:${relativePath}:$text[${index}]`,
        category,
        source: relativePath,
        sourceRank: "rag-index",
        path: `$text[${index}]`,
        text,
      }));
  }

  const seen = new Set();
  const kept = [];
  const dropped = [];
  for (const rawChunk of rawChunks) {
    const sanitized = sanitizeChunk(rawChunk);
    if (!sanitized.keep) {
      dropped.push(sanitized);
      continue;
    }
    const dedupeKey = normalizeText(sanitized.chunk.text).toLowerCase();
    if (seen.has(dedupeKey)) {
      dropped.push({ ...sanitized, keep: false, reason: "duplicate-within-source" });
      continue;
    }
    seen.add(dedupeKey);
    kept.push(sanitized);
  }

  cleaningStats.push({
    source: relativePath,
    category,
    trustTier: sourceTrustTier(relativePath),
    status: "processed",
    rawChunks: rawChunks.length,
    keptChunks: kept.length,
    droppedChunks: dropped.length,
    redactions: kept.reduce((sum, item) => sum + item.redactionCount, 0),
    dropReasons: tallyReasons(dropped),
  });

  return kept.map((item) => item.chunk);
};

const dashScopeEmbedTexts = async (texts) => {
  if (embeddingProvider !== "dashscope") return texts.map(() => null);
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("DASHSCOPE_API_KEY is required to build precomputed DashScope embeddings.");

  const endpoint = `${dashScopeBaseUrl.replace(/\/$/, "")}/embeddings`;
  const embeddings = [];
  for (let index = 0; index < texts.length; index += dashScopeBatchSize) {
    const batch = texts.slice(index, index + dashScopeBatchSize).map((text) => String(text ?? "").slice(0, maxEmbeddingChars));
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: batch,
        dimensions: embeddingDimensions,
        encoding_format: "float",
      }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`DashScope embedding request failed: ${response.status} ${response.statusText}: ${responseText.slice(0, 300)}`);
    }
    const payload = JSON.parse(responseText);
    const data = Array.isArray(payload.data) ? payload.data : [];
    for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
      const item = data.find((entry) => entry.index === batchIndex) ?? data[batchIndex];
      if (!Array.isArray(item?.embedding)) throw new Error("DashScope embedding response did not include an embedding array.");
      embeddings.push(item.embedding.map((value) => Number(Number(value).toFixed(6))));
    }
  }
  return embeddings;
};

const embedTexts = async (texts) => {
  if (embeddingProvider === "dashscope") return dashScopeEmbedTexts(texts);
  if (["local", "local-hash", "hash"].includes(embeddingProvider)) return texts.map((text) => embedText(text));
  return texts.map(() => null);
};

const buildIndex = async (spec) => {
  const cleaningStart = cleaningStats.length;
  const sourceChunks = (
    await Promise.all(spec.sources.map((source) => readSourceChunks(source, spec.id)))
  ).flat();
  const embeddings = await embedTexts(sourceChunks.map((chunk) => [chunk.source, chunk.path, chunk.text].join("\n")));
  const chunks = sourceChunks.map((chunk, index) => ({
    ...chunk,
    embeddingProvider,
    embeddingModel: embeddingProvider === "dashscope" ? embeddingModel : embeddingProvider,
    embeddingDimensions,
    embedding: embeddings[index],
  }));

  const outputPath = resolve(outputDir, spec.output);
  const payload = {
    schemaVersion: "draftops.rag.index.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/build-rag-index.mjs",
    id: spec.id,
    description: spec.description,
    embeddingProvider,
    embeddingModel: embeddingProvider === "dashscope" ? embeddingModel : embeddingProvider,
    embeddingDimensions,
    sourceCount: spec.sources.length,
    chunkCount: chunks.length,
    cleaningSummary: {
      qualityGate: "drop placeholders, short/noisy chunks, untrusted model answer files, duplicates, and redact secret-like tokens",
      sourcesProcessed: cleaningStats.slice(cleaningStart).length,
      rawChunks: cleaningStats.slice(cleaningStart).reduce((sum, item) => sum + Number(item.rawChunks ?? 0), 0),
      keptChunks: chunks.length,
      droppedChunks: cleaningStats.slice(cleaningStart).reduce((sum, item) => sum + Number(item.droppedChunks ?? 0), 0),
      redactions: cleaningStats.slice(cleaningStart).reduce((sum, item) => sum + Number(item.redactions ?? 0), 0),
      excludedSources: cleaningStats.slice(cleaningStart).filter((item) => item.status === "excluded").map((item) => item.source),
    },
    sources: spec.sources,
    chunks,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
  return {
    id: spec.id,
    key: `data/rag/${spec.output}`,
    sourceCount: spec.sources.length,
    chunkCount: chunks.length,
    embeddingProvider,
    embeddingModel: payload.embeddingModel,
    embeddingDimensions: payload.embeddingDimensions,
  };
};

const run = async () => {
  await mkdir(outputDir, { recursive: true });
  const indexes = [];
  for (const spec of indexSpecs) {
    indexes.push(await buildIndex(spec));
    console.log(`built ${spec.output}`);
  }
  const manifest = {
    schemaVersion: "draftops.rag.manifest.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/build-rag-index.mjs",
    cleaningSummary: {
      qualityGate: "enabled",
      sourceCount: cleaningStats.length,
      rawChunks: cleaningStats.reduce((sum, item) => sum + Number(item.rawChunks ?? 0), 0),
      keptChunks: indexes.reduce((sum, item) => sum + item.chunkCount, 0),
      droppedChunks: cleaningStats.reduce((sum, item) => sum + Number(item.droppedChunks ?? 0), 0),
      redactions: cleaningStats.reduce((sum, item) => sum + Number(item.redactions ?? 0), 0),
      excludedSources: cleaningStats.filter((item) => item.status === "excluded").map((item) => item.source),
    },
    indexes,
  };
  await writeFile(resolve(outputDir, "rag-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const cleaningReport = {
    schemaVersion: "draftops.rag_source_cleaning.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/build-rag-index.mjs",
    summary: manifest.cleaningSummary,
    sources: cleaningStats,
  };
  const cleaningMarkdown = [
    "# DraftOps RAG Source Cleaning",
    "",
    `Generated: ${cleaningReport.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Quality gate: ${manifest.cleaningSummary.qualityGate}`,
    `- Sources inspected: ${manifest.cleaningSummary.sourceCount}`,
    `- Raw chunks: ${manifest.cleaningSummary.rawChunks}`,
    `- Kept chunks: ${manifest.cleaningSummary.keptChunks}`,
    `- Dropped chunks: ${manifest.cleaningSummary.droppedChunks}`,
    `- Secret-like token redactions: ${manifest.cleaningSummary.redactions}`,
    `- Excluded sources: ${manifest.cleaningSummary.excludedSources.length ? manifest.cleaningSummary.excludedSources.join(", ") : "none"}`,
    "",
    "## Sources",
    "",
    "| Source | Category | Trust tier | Raw | Kept | Dropped | Redactions | Drop reasons |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...cleaningStats.map((item) =>
      [
        item.source,
        item.category,
        item.trustTier,
        item.rawChunks,
        item.keptChunks,
        item.droppedChunks,
        item.redactions,
        Object.entries(item.dropReasons ?? {}).map(([reason, count]) => `${reason}:${count}`).join(", ") || item.reason || "none",
      ].map((cell) => String(cell ?? "").replace(/\|/g, "/")).join(" | "),
    ).map((row) => `| ${row} |`),
  ].join("\n");
  await mkdir(reportsDir, { recursive: true });
  await writeFile(cleaningReportJsonPath, `${JSON.stringify(cleaningReport, null, 2)}\n`, "utf8");
  await writeFile(cleaningReportMdPath, `${cleaningMarkdown}\n`, "utf8");
  console.log(`built rag-manifest.json with ${indexes.reduce((sum, item) => sum + item.chunkCount, 0)} chunks`);
  console.log(`wrote ${cleaningReportMdPath}`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
