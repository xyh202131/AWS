import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = process.cwd();
const localEnvPath = resolve(rootDir, ".env.local");
const envPath = resolve(rootDir, ".env");
const evidencePath = resolve(rootDir, "data", "reports", "milestone_prediction_evidence_20260623.json");
const outputJsonPath = resolve(rootDir, "data", "reports", "milestone_deepseek_discussion_20260623.json");
const outputTextPath = resolve(rootDir, "data", "reports", "milestone_deepseek_discussion_20260623.md");

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

const compact = (value, maxLength = 2600) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
};

const buildRoundPrompt = ({ round, evidence, previousRounds }) => {
  const sharedRules = [
    "你是 DraftOps 里程碑答题审核 Agent，只能基于 input.evidence 和当前预测板事实讨论。",
    "绝对禁止人工预测、脑补名单、改动前30顺位、替换球员或引入外部未给出的球员。",
    "如果题目涉及字段口径，优先级为：答题卡题目原文 > 答题卡球员池字段 > 官方体测/敏捷表 > 当前预测板 JSON。",
    "本轮必须给出可审计结论：是否同意机器初值、最大风险、是否需要改动答案。",
    "只输出严格 JSON，不要 Markdown，不要密钥，不要代码块。",
  ];

  const roundFocus = [
    {
      id: 1,
      title: "Q1/Q2 体测口径审计",
      ask: "审查 Q1 臂展-赤脚身高 >=5 英寸的计算，以及 Q2 助跑最大弹跳前3名入首轮人数。重点检查缺失体测、并列名次、误差范围是否会改变答案。",
      evidenceSubset: {
        Q1: evidence.questionEvidence.Q1,
        Q2: evidence.questionEvidence.Q2,
        proposedAnswers: { Q1: evidence.proposedAnswers.Q1, Q2: evidence.proposedAnswers.Q2 },
      },
    },
    {
      id: 2,
      title: "Q3/Q4 中锋定义审计",
      ask: "审查 Q3 主打位置为中锋总数、Q4 第4-30顺位首个中锋。重点比较答题卡主位置字段与 JSON PF/C 副位置字段，决定最终口径。",
      evidenceSubset: {
        Q3: evidence.questionEvidence.Q3,
        Q4: evidence.questionEvidence.Q4,
        proposedAnswers: { Q3: evidence.proposedAnswers.Q3, Q4: evidence.proposedAnswers.Q4 },
      },
    },
    {
      id: 3,
      title: "Q5/Q6 国际球员与机构审计",
      ask: "审查 Q5 国际球员总数、Q6 贡献首轮最多的大学/培养机构。重点检查非美国本土成长口径、俱乐部/国家/大学字段、下拉选项可用性。",
      evidenceSubset: {
        Q5: evidence.questionEvidence.Q5,
        Q6: evidence.questionEvidence.Q6,
        proposedAnswers: { Q5: evidence.proposedAnswers.Q5, Q6: evidence.proposedAnswers.Q6 },
      },
    },
    {
      id: 4,
      title: "Q7 手长前5与并列审计",
      ask: "审查 Q7 手掌长度前5名中入首轮人数。重点检查 9.5 英寸多人并列时，严格前5与并列扩展口径是否会改变答案。",
      evidenceSubset: {
        Q7: evidence.questionEvidence.Q7,
        proposedAnswers: { Q7: evidence.proposedAnswers.Q7 },
      },
    },
    {
      id: 5,
      title: "最终总审与答题 JSON",
      ask: "综合前4轮，给出最终 7 题答案。若同意机器初值，直接输出；若不同意，必须指出哪条 evidence 支持改动。不能使用人工预测。",
      evidenceSubset: {
        allQuestionEvidence: evidence.questionEvidence,
        proposedAnswers: evidence.proposedAnswers,
        previousRounds,
      },
    },
  ][round - 1];

  return [
    ...sharedRules,
    "",
    `本轮：${roundFocus.title}`,
    roundFocus.ask,
    "",
    "必须返回 JSON schema:",
    JSON.stringify({
      round: "number",
      title: "string",
      agreesWithMachineValue: "boolean",
      recommendedChanges: [{ question: "Q1", from: "any", to: "any", reason: "string" }],
      conclusions: [{ question: "Q1", answer: "any", reason: "string", risk: "string" }],
      finalAnswers: { Q1: "number", Q2: "number", Q3: "number", Q4: "number", Q5: "number", Q6: "string", Q7: "number" },
    }),
    "",
    "input.evidence:",
    JSON.stringify(roundFocus.evidenceSubset),
  ].join("\n");
};

const callDeepSeek = async ({ prompt, round }) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY. Put it in .env.local or the shell environment.");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
  const maxTokens = Number(process.env.DEEPSEEK_MAX_TOKENS ?? 3600);
  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a strict data-audit discussion agent. Return only valid JSON. Never reveal secrets. Do not invent players or change the draft board.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    temperature: round === 5 ? 0.05 : 0.15,
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

  return {
    round,
    model,
    modelLabel: getModelLabel(model),
    usage: completion.usage ?? null,
    rawContent: content,
    parsed: extractJson(content),
  };
};

const normalizeFinalAnswers = (value) => {
  const answers = value ?? {};
  return {
    Q1: Number(answers.Q1),
    Q2: Number(answers.Q2),
    Q3: Number(answers.Q3),
    Q4: Number(answers.Q4),
    Q5: Number(answers.Q5),
    Q6: String(answers.Q6 ?? "").trim(),
    Q7: Number(answers.Q7),
  };
};

const validateFinalAnswers = (answers) => {
  const errors = [];
  for (const key of ["Q1", "Q2", "Q3", "Q4", "Q5", "Q7"]) {
    if (!Number.isFinite(answers[key])) errors.push(`${key} must be numeric`);
  }
  if (!answers.Q6) errors.push("Q6 must be non-empty");
  if (answers.Q2 < 0 || answers.Q2 > 3) errors.push("Q2 must be 0-3");
  if (answers.Q7 < 0 || answers.Q7 > 5) errors.push("Q7 must be 0-5");
  if (answers.Q4 < 4 || answers.Q4 > 30) errors.push("Q4 must be pick 4-30");
  return errors;
};

const toMarkdown = ({ generatedAt, modelLabel, model, evidencePath: inputEvidencePath, rounds, finalAnswers }) => {
  const lines = [
    "# Milestone DeepSeek API Discussion",
    "",
    `Generated: ${generatedAt}`,
    `Model: ${modelLabel}`,
    `API model id: ${model}`,
    `Evidence: ${inputEvidencePath}`,
    "",
    "## Final Answers",
    "",
    `- Q1: ${finalAnswers.Q1}`,
    `- Q2: ${finalAnswers.Q2}`,
    `- Q3: ${finalAnswers.Q3}`,
    `- Q4: ${finalAnswers.Q4}`,
    `- Q5: ${finalAnswers.Q5}`,
    `- Q6: ${finalAnswers.Q6}`,
    `- Q7: ${finalAnswers.Q7}`,
    "",
    "## Rounds",
    "",
  ];

  for (const round of rounds) {
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
  const evidence = await readJson(evidencePath);
  const rounds = [];
  const previousRounds = [];

  for (let round = 1; round <= 5; round += 1) {
    const prompt = buildRoundPrompt({ round, evidence, previousRounds });
    const result = await callDeepSeek({ prompt, round });
    rounds.push(result);
    previousRounds.push({
      round,
      parsed: result.parsed,
      promptDigest: compact(prompt, 1800),
    });
    console.log(`DeepSeek round ${round}/5 complete`);
  }

  const finalRound = rounds.at(-1)?.parsed;
  const finalAnswers = normalizeFinalAnswers(finalRound?.finalAnswers ?? evidence.proposedAnswers);
  const validationErrors = validateFinalAnswers(finalAnswers);
  if (validationErrors.length) {
    throw new Error(`Final answers failed validation: ${validationErrors.join("; ")}`);
  }

  const generatedAt = new Date().toISOString();
  const artifact = {
    schemaVersion: "draftops.milestone_deepseek_discussion.v1",
    generatedAt,
    generatedBy: "DeepSeek API milestone discussion script",
    inputFiles: [
      "data/reports/milestone_prediction_evidence_20260623.json",
      "public/data/agent_expanded_recommended_board.json",
      "数据/NBA选秀大会_26-27赛季数据.xlsx",
      "数据/上传此文件即可（选秀+里程碑问题选手答题卡_模板）.xlsx",
    ],
    model: rounds[0]?.model ?? normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro"),
    modelLabel: rounds[0]?.modelLabel ?? getModelLabel(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro"),
    roundCount: rounds.length,
    finalAnswers,
    rounds,
  };

  await mkdir(resolve(rootDir, "data", "reports"), { recursive: true });
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(
      outputTextPath,
      toMarkdown({
        generatedAt,
        modelLabel: artifact.modelLabel,
        model: artifact.model,
        evidencePath: "data/reports/milestone_prediction_evidence_20260623.json",
        rounds,
        finalAnswers,
      }),
      "utf8",
    ),
  ]);

  console.log(
    JSON.stringify(
      {
        roundCount: rounds.length,
        finalAnswers,
        output: [
          "data/reports/milestone_deepseek_discussion_20260623.json",
          "data/reports/milestone_deepseek_discussion_20260623.md",
        ],
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
