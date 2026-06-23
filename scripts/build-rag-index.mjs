import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { rootDir } from "./lib/draftops-manifest.mjs";

const outputDir = resolve(rootDir, "data", "rag");
const embeddingProvider = (process.env.DRAFTOPS_RAG_INDEX_EMBEDDING_PROVIDER ?? "dashscope").toLowerCase();
const embeddingDimensions = Number(process.env.DRAFTOPS_RAG_EMBEDDING_DIMENSIONS ?? "1024");
const embeddingModel = process.env.DRAFTOPS_RAG_DASHSCOPE_EMBEDDING_MODEL ?? "text-embedding-v4";
const dashScopeBaseUrl = process.env.DRAFTOPS_RAG_DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
const dashScopeBatchSize = Math.min(Math.max(Number(process.env.DRAFTOPS_RAG_DASHSCOPE_BATCH_SIZE ?? "10"), 1), 10);
const maxChunksPerSource = Number(process.env.DRAFTOPS_RAG_INDEX_MAX_CHUNKS_PER_SOURCE ?? "24");
const chunkSize = Number(process.env.DRAFTOPS_RAG_INDEX_CHUNK_SIZE ?? "1100");
const maxEmbeddingChars = Number(process.env.DRAFTOPS_RAG_DASHSCOPE_EMBEDDING_MAX_CHARS ?? "6000");
const sourceChunkLimit = (relativePath) => {
  if (/normalized_2026_local_player_pool_124\.json$/.test(relativePath)) return 160;
  if (/normalized_2026_player_feature_reference_124\.json$/.test(relativePath)) return 180;
  if (/normalized_2026_online_player_list_reverification_20260623\.json$/.test(relativePath)) return 180;
  if (/normalized_2026_official_prospects_101\.json$/.test(relativePath)) return 130;
  return maxChunksPerSource;
};

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
  const limit = sourceChunkLimit(relativePath);
  const content = await readFile(absolutePath, "utf8");
  const trimmed = content.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return collectStructuredChunks(parsed, { source: relativePath, category, limit }).slice(0, limit);
  } catch {
    return chunkText(content)
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

const buildIndex = async (spec) => {
  const sourceChunks = (
    await Promise.all(spec.sources.map((source) => readSourceChunks(source, spec.id)))
  ).flat();
  const embeddings = await dashScopeEmbedTexts(sourceChunks.map((chunk) => [chunk.source, chunk.path, chunk.text].join("\n")));
  const chunks = sourceChunks.map((chunk, index) => ({
    ...chunk,
    embeddingProvider,
    embeddingModel: embeddingProvider === "dashscope" ? embeddingModel : null,
    embeddingDimensions: embeddingProvider === "dashscope" ? embeddingDimensions : null,
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
    embeddingModel: embeddingProvider === "dashscope" ? embeddingModel : null,
    embeddingDimensions: embeddingProvider === "dashscope" ? embeddingDimensions : null,
    sourceCount: spec.sources.length,
    chunkCount: chunks.length,
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
    indexes,
  };
  await writeFile(resolve(outputDir, "rag-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`built rag-manifest.json with ${indexes.reduce((sum, item) => sum + item.chunkCount, 0)} chunks`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
