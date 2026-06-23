import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const rootDir = process.cwd();
const localEnvPath = resolve(rootDir, ".env.local");
const envPath = resolve(rootDir, ".env");
const boardsDir = resolve(rootDir, "data", "analysis", "prediction-reruns-20260623", "boards");
const reportsDir = resolve(rootDir, "data", "reports");
const outputDir = resolve(rootDir, "data", "agent_variants");
const rawFailureDir = resolve(reportsDir, "llm_variant_raw_failures");
const outputReportJsonPath = resolve(reportsDir, "llm_variant_generation_20260623.json");
const outputReportMdPath = resolve(reportsDir, "llm_variant_generation_20260623.md");

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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const compact = (value, maxLength = 14000) => {
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

    throw new Error("Model response was not valid JSON.");
  }
};

const timestampForPath = () => new Date().toISOString().replace(/[:.]/g, "-");

const saveRawFailure = ({ agent, modelLabel, rawContent, stdout, stderr, error }) => {
  mkdirSync(rawFailureDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const path = resolve(rawFailureDir, `${timestampForPath()}_${agent}_raw_failure.json`);
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schemaVersion: "draftops.llm_variant_raw_failure.v1",
        generatedAt,
        agent,
        modelLabel,
        error: String(error?.message ?? error ?? ""),
        rawContent: rawContent ?? null,
        stdout: stdout ?? null,
        stderr: stderr ?? null,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return path;
};

const boardRows = (board) =>
  (board.boardRows ?? []).map((row) => ({
    pick: row.pick,
    team: row.team,
    player: row.player,
    prospectId: row.prospectId,
    score: row.scoreExact ?? row.score,
    confidence: row.confidence,
    scoreGap: row.margin,
    tieBreak: row.scoreTiebreakApplied ?? false,
  }));

const diffRows = ({ oldBoard, dynamicBoard, mildBoard, guardBoard }) => {
  const maps = {
    old: new Map(boardRows(oldBoard).map((row) => [row.pick, row])),
    dynamic: new Map(boardRows(dynamicBoard).map((row) => [row.pick, row])),
    mild: new Map(boardRows(mildBoard).map((row) => [row.pick, row])),
    guard: new Map(boardRows(guardBoard).map((row) => [row.pick, row])),
  };

  const rows = [];
  for (let pick = 1; pick <= 30; pick += 1) {
    const values = {
      old: maps.old.get(pick),
      dynamic: maps.dynamic.get(pick),
      mild: maps.mild.get(pick),
      guard: maps.guard.get(pick),
    };
    const playerSet = new Set(Object.values(values).map((row) => row?.player));
    if (playerSet.size <= 1) continue;
    rows.push({
      pick,
      team: values.mild?.team ?? values.dynamic?.team,
      old: values.old?.player,
      dynamic: values.dynamic?.player,
      mild: values.mild?.player,
      guard: values.guard?.player,
      mildConfidence: values.mild?.confidence,
      mildScoreGap: values.mild?.scoreGap,
      mildTieBreak: values.mild?.tieBreak,
    });
  }
  return rows;
};

const getTopCandidates = (board, picks) =>
  picks.map((pick) => {
    const audit = (board.pickAudits ?? []).find((item) => item.pick === pick);
    return {
      pick,
      team: audit?.team,
      selected: audit?.selected?.name,
      margin: audit?.margin,
      confidence: board.boardRows?.find((row) => row.pick === pick)?.confidence,
      topCandidates: (audit?.topCandidates ?? []).slice(0, 5).map((candidate) => ({
        rank: candidate.rankWithinPick,
        name: candidate.name,
        consensusRank: candidate.consensusRank,
        finalScore: candidate.finalScore,
        rawModelScore: candidate.rawModelScore,
        pickValueAdjustment: candidate.pickValueAdjustment,
        dynamicPreferenceAdjustment: candidate.dynamicPreferenceAdjustment,
        featureAdjustment: candidate.featureAdjustment,
        sequencingAdjustment: candidate.sequencingAdjustment,
        overlapFamilies: candidate.preference?.overlapFamilies ?? [],
        variantAdjustments: candidate.variantAdjustments ?? [],
      })),
    };
  });

const buildPrompt = ({ agentName, context, contextCharLimit = 14000 }) => [
  `你是 DraftOps ${agentName} 参数预测 Agent。`,
  "",
  "任务：基于给定的 123 人池多版预测差异，给出一版新的参数配置 JSON。注意：你不能手工指定任何球员，不能输出选秀名单，不能替换某个顺位的人选。",
  "",
  "允许你输出的只有参数。随后本地脚本会用这些参数重新从第 1 顺位开始逐个评分、选中、剔除，再预测到第 30 顺位。",
  "",
  "可用参数字段和含义：",
  "- weakPreferencePickValueCap: number|null，弱球队偏好时限制顺位价值加成，建议 2.5-4.5。",
  "- featurePositiveCap: number|null，体测/投篮特征正向加分上限，建议 1.0-1.5。",
  "- dTierAdditionalPenalty: number，D 级或数据不完整球员额外扣分，建议 0.0-0.8。",
  "- athleticDeficitPenalty: number，低爆发前场/锋线扣分，建议 0.0-1.5。",
  "- athleticDeficitThreshold: number，触发低爆发扣分阈值，建议 8-15。",
  "- athleticDeficitMaxRiskTolerance: number|null，仅当球队 riskTolerance <= 此值时触发低爆发扣分，建议 55-70。",
  "",
  "硬约束：",
  "- 必须返回严格 JSON 对象。",
  "- 不得输出球员预测名单。",
  "- 不得输出密钥。",
  "- 参数要保守，避免强 guardrail 那样打散 27-30。",
  "- 可以和 mild 版相近，但必须有你自己的参数取舍理由。",
  "",
  "JSON schema:",
  JSON.stringify({
    id: "string",
    label: "string",
    sourceAgent: "string",
    weakPreferencePickValueCap: 3.25,
    featurePositiveCap: 1.15,
    dTierAdditionalPenalty: 0.35,
    athleticDeficitPenalty: 1,
    athleticDeficitThreshold: 10,
    athleticDeficitMaxRiskTolerance: 60,
    rationale: ["string"],
    fragilePicksToWatch: [10, 12, 15, 21, 26, 30],
  }),
  "",
  "Context:",
  compact(context, contextCharLimit),
].join("\n");

const normalizeVariant = ({ parsed, id, label, sourceAgent }) => {
  const numberOrNull = (value, min, max, fallback) => {
    if (value === null || value === undefined || value === "" || value === false) return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? clamp(number, min, max) : fallback;
  };

  return {
    id,
    label,
    sourceAgent,
    weakPreferencePickValueCap: numberOrNull(parsed.weakPreferencePickValueCap, 1.5, 5.5, null),
    featurePositiveCap: numberOrNull(parsed.featurePositiveCap, 0.8, 2.0, null),
    dTierAdditionalPenalty: numberOrNull(parsed.dTierAdditionalPenalty, 0, 1.2, 0),
    athleticDeficitPenalty: numberOrNull(parsed.athleticDeficitPenalty, 0, 2, 0),
    athleticDeficitThreshold: numberOrNull(parsed.athleticDeficitThreshold, 0, 25, 10),
    athleticDeficitMaxRiskTolerance: numberOrNull(parsed.athleticDeficitMaxRiskTolerance, 40, 90, null),
    rationale: Array.isArray(parsed.rationale) ? parsed.rationale.map(String).slice(0, 8) : [],
    fragilePicksToWatch: Array.isArray(parsed.fragilePicksToWatch)
      ? parsed.fragilePicksToWatch.map(Number).filter(Number.isFinite).slice(0, 12)
      : [],
  };
};

const normalizeModelId = (value) => String(value ?? "").replace(/\s*\[1M\]\s*$/i, "").trim();

const getModelLabel = (model) => {
  const configuredLabel = process.env.DEEPSEEK_MODEL_LABEL?.trim();
  if (configuredLabel) return configuredLabel;
  return /\[1M\]$/i.test(model) ? model : `${model}[1m]`;
};

const callDeepSeek = async (prompt) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY. Put it in .env.local or the shell environment.");

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
        {
          role: "system",
          content: "Return only strict JSON. Do not output draft-player lists or secrets.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: Number(process.env.DEEPSEEK_MAX_TOKENS ?? 3600),
      temperature: 0.12,
      stream: false,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status} ${response.statusText}`);
  const completion = JSON.parse(responseText);
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek response did not include content.");
  let parsed = null;
  try {
    parsed = extractJson(content);
  } catch (error) {
    const failurePath = saveRawFailure({
      agent: "deepseek",
      modelLabel: getModelLabel(model),
      rawContent: content,
      error,
    });
    throw new Error(`DeepSeek response parse failed; raw output saved to ${failurePath}: ${error.message}`);
  }
  return {
    model,
    modelLabel: getModelLabel(model),
    usage: completion.usage ?? null,
    rawContent: content,
    parsed,
  };
};

const callClaude = (prompt) => {
  const command = process.platform === "win32" ? "claude.cmd" : "claude";
  const args = [
    "-p",
    "--model",
    process.env.CLAUDE_AGENT_MODEL ?? "opus",
    "--effort",
    process.env.CLAUDE_AGENT_EFFORT ?? "max",
    "--tools",
    "",
    "--output-format",
    "json",
    "--no-session-persistence",
  ];
  const result = spawnSync(command, args, {
    input: prompt,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: Number(process.env.CLAUDE_AGENT_TIMEOUT_MS ?? 600000),
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });

  if (result.error) throw result.error;
  const stdout = String(result.stdout ?? "").trim();
  const stderr = String(result.stderr ?? "").trim();
  if (result.status !== 0) {
    const failurePath = saveRawFailure({
      agent: "claude",
      modelLabel: `claude-${process.env.CLAUDE_AGENT_MODEL ?? "opus"}:${process.env.CLAUDE_AGENT_EFFORT ?? "max"}`,
      stdout,
      stderr,
      error: `Claude CLI failed, exit=${result.status}`,
    });
    throw new Error(`Claude CLI failed, exit=${result.status}; raw output saved to ${failurePath}\n${stdout}\n${stderr}`.trim());
  }
  let wrapper = null;
  try {
    wrapper = JSON.parse(stdout);
  } catch {
    wrapper = null;
  }
  const content = typeof wrapper?.result === "string" ? wrapper.result.trim() : stdout;
  let parsed = null;
  try {
    parsed = extractJson(content);
  } catch (error) {
    const failurePath = saveRawFailure({
      agent: "claude",
      modelLabel: `claude-${process.env.CLAUDE_AGENT_MODEL ?? "opus"}:${process.env.CLAUDE_AGENT_EFFORT ?? "max"}`,
      rawContent: content,
      stdout,
      stderr,
      error,
    });
    throw new Error(`Claude response parse failed; raw output saved to ${failurePath}: ${error.message}`);
  }
  return {
    model: process.env.CLAUDE_AGENT_MODEL ?? "opus",
    modelLabel: `claude-${process.env.CLAUDE_AGENT_MODEL ?? "opus"}:${process.env.CLAUDE_AGENT_EFFORT ?? "max"}`,
    usage: wrapper?.usage ?? null,
    rawContent: content,
    parsed,
  };
};

const toMarkdown = ({ generatedAt, variants, calls }) => [
  "# LLM Variant Generation",
  "",
  `Generated: ${generatedAt}`,
  "",
  "## Outputs",
  "",
  ...variants.map((variant) => `- \`${variant.pathLabel}\`: ${variant.label}`),
  "",
  "## Variants",
  "",
  ...variants.flatMap((variant) => [
    `### ${variant.label}`,
    "",
    "```json",
    JSON.stringify(variant.config, null, 2),
    "```",
    "",
  ]),
  "## Calls",
  "",
  ...calls.map((call) => `- ${call.agent}: ${call.modelLabel}; usage=${call.usage ? JSON.stringify(call.usage) : "not returned"}`),
  "",
].join("\n");

const main = async () => {
  await loadEnvFile(localEnvPath);
  await loadEnvFile(envPath);
  const onlyArgIndex = process.argv.indexOf("--only");
  const only = onlyArgIndex >= 0 && process.argv[onlyArgIndex + 1] ? process.argv[onlyArgIndex + 1] : "all";
  const runClaude = only === "all" || only === "claude";
  const runDeepSeek = only === "all" || only === "deepseek";
  if (!["all", "claude", "deepseek"].includes(only)) {
    throw new Error('Unknown --only value. Use "all", "claude", or "deepseek".');
  }

  const [oldBoard, dynamicBoard, guardBoard, mildBoard] = await Promise.all([
    readJson(resolve(boardsDir, "local_pool_124_baseline_board.json")),
    readJson(resolve(boardsDir, "sequential_dynamic_board_123_audit.json")),
    readJson(resolve(boardsDir, "sequential_dynamic_board_123_audit_deepseek_guardrails.json")),
    readJson(resolve(boardsDir, "sequential_dynamic_board_123_audit_deepseek_mild.json")),
  ]);

  const context = {
    summaries: {
      old: oldBoard.summary,
      dynamic: dynamicBoard.summary,
      guard: guardBoard.summary,
      mild: mildBoard.summary,
    },
    variants: {
      guard: guardBoard.variant,
      mild: mildBoard.variant,
    },
    diffRows: diffRows({ oldBoard, dynamicBoard, mildBoard, guardBoard }),
    fragileCandidateDetailsFromMild: getTopCandidates(mildBoard, [10, 12, 15, 18, 19, 21, 26, 30]),
  };

  const claudeContext = {
    summaries: context.summaries,
    variants: context.variants,
    diffRows: context.diffRows,
    fragileCandidateDetailsFromMild: context.fragileCandidateDetailsFromMild.filter((item) =>
      [10, 12, 15, 18, 21, 26, 30].includes(item.pick),
    ),
  };
  const claudePrompt = buildPrompt({ agentName: "Claude Code Opus/max", context: claudeContext, contextCharLimit: 9000 });
  const deepSeekPrompt = buildPrompt({ agentName: "DeepSeek LLM", context, contextCharLimit: 16000 });

  const variants = [];
  const calls = [];

  if (runClaude) {
    console.log("Calling Claude for parameter variant...");
    const claude = callClaude(claudePrompt);
    calls.push({ agent: "claude", model: claude.model, modelLabel: claude.modelLabel, usage: claude.usage, rawContent: claude.rawContent });
    variants.push({
      pathLabel: "data/agent_variants/claude_agent_variant_20260623.json",
      path: resolve(outputDir, "claude_agent_variant_20260623.json"),
      label: "Claude Opus agent parameter rerun",
      config: normalizeVariant({
        parsed: claude.parsed,
        id: "claude-agent",
        label: "Claude Opus agent parameter rerun",
        sourceAgent: "claude-opus-max",
      }),
    });
  }

  if (runDeepSeek) {
    console.log("Calling DeepSeek for parameter variant...");
    const deepseek = await callDeepSeek(deepSeekPrompt);
    calls.push({ agent: "deepseek", model: deepseek.model, modelLabel: deepseek.modelLabel, usage: deepseek.usage, rawContent: deepseek.rawContent });
    variants.push({
      pathLabel: "data/agent_variants/deepseek_llm_variant_20260623.json",
      path: resolve(outputDir, "deepseek_llm_variant_20260623.json"),
      label: "DeepSeek LLM parameter rerun",
      config: normalizeVariant({
        parsed: deepseek.parsed,
        id: "deepseek-llm",
        label: "DeepSeek LLM parameter rerun",
        sourceAgent: "deepseek-v4-pro",
      }),
    });
  }

  const generatedAt = new Date().toISOString();
  const artifact = {
    schemaVersion: "draftops.llm_variant_generation.v1",
    generatedAt,
    generatedBy: "LLM variant config generator",
    inputBoards: [
      "data/analysis/prediction-reruns-20260623/boards/local_pool_124_baseline_board.json",
      "data/analysis/prediction-reruns-20260623/boards/sequential_dynamic_board_123_audit.json",
      "data/analysis/prediction-reruns-20260623/boards/sequential_dynamic_board_123_audit_deepseek_guardrails.json",
      "data/analysis/prediction-reruns-20260623/boards/sequential_dynamic_board_123_audit_deepseek_mild.json",
    ],
    guardrails: {
      noManualPrediction: true,
      modelsOnlyOutputParameters: true,
      localSequentialScorerProducesBoards: true,
    },
    calls,
    variants: variants.map((variant) => ({
      path: variant.pathLabel,
      config: variant.config,
    })),
  };

  await Promise.all([mkdir(outputDir, { recursive: true }), mkdir(reportsDir, { recursive: true })]);
  await Promise.all([
    ...variants.map((variant) => writeFile(variant.path, `${JSON.stringify(variant.config, null, 2)}\n`, "utf8")),
    writeFile(outputReportJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(outputReportMdPath, toMarkdown({ generatedAt, variants, calls: artifact.calls }), "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        outputs: variants.map((variant) => variant.pathLabel),
        report: "data/reports/llm_variant_generation_20260623.md",
        variants: variants.map((variant) => variant.config),
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
