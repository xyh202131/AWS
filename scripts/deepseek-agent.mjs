import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { draftOpsManifest, resolveManifestPath, rootDir } from "./lib/draftops-manifest.mjs";

const localEnvPath = resolve(rootDir, ".env.local");
const envPath = resolve(rootDir, ".env");
const boardPath = resolveManifestPath(draftOpsManifest.data?.boardPath, "public/data/agent_balanced_board.json");
const bundlePath = resolveManifestPath(draftOpsManifest.data?.bundlePath, "public/data/final_import_bundle.json");
const documentIndexPath = resolve(rootDir, "data", "documents", "document_index.json");
const milestoneReferencePath = resolve(rootDir, "data", "documents", "milestone-questions", "DraftCode24里程碑事件预测.md");
const outputJsonPath = resolve(rootDir, "data", "reports", "deepseek_exam_answers.json");
const outputTextPath = resolve(rootDir, "data", "reports", "deepseek_exam_answers.txt");

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

const compactText = (value, maxLength = 9000) => {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n...[truncated]` : value;
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

const normalizeModelId = (value) => value.replace(/\s*\[1M\]\s*$/i, "").trim();

const getModelLabel = (model) => {
  const configuredLabel = process.env.DEEPSEEK_MODEL_LABEL?.trim();
  if (configuredLabel) return configuredLabel;
  return /\[1M\]$/i.test(model) ? model : `${model}[1m]`;
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
    scope: "当前 DeepSeek 是只读问答 Agent：可回答当前应试题集合，也可参考文档中的里程碑题意、字段口径、评分口径；30 顺位球员预测由当前锁定预测板给出。",
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

const buildPrompt = ({ boardArtifact, bundle, documentIndex, milestoneReference }) => {
  const payload = {
    generatedAt: new Date().toISOString(),
    boardHealth: boardArtifact.health,
    boardSummary: boardArtifact.summary,
    scenario: boardArtifact.scenario,
    sourceMetadata: boardArtifact.sourceMetadata ?? bundle.metadata,
    referenceDocuments: {
      documentIndex,
      milestoneQuestionDesignReference: compactText(milestoneReference),
      usagePolicy:
        "This reference is for milestone/exam-question design, wording, field intent, and scoring rules. It is not official draft result data and must not change predicted players.",
    },
    examFacts: buildExamFacts(boardArtifact.board ?? []),
  };

  return [
    "你是 DraftOps 当前 DeepSeek 只读问答 Agent，不是预测生成 Agent，不是预测修改 Agent。",
    "你只处理当前本地应试题集合，也可参考 DraftCode24里程碑事件预测.md 理解里程碑题意、字段口径、评分口径。",
    "当前题目数量按 input.examFacts.questionCount 和 input.examFacts.examQuestions 动态变化。",
    "硬性边界 1：当前 DeepSeek 禁止生成预测球员，禁止新增预测球员，禁止删除预测球员。",
    "硬性边界 2：当前 DeepSeek 禁止修改、交换、重排、复核或建议调整任何 30 顺位球员预测。",
    "硬性边界 3：当前 DeepSeek 禁止建议某队改选其他球员，禁止输出替代预测板。",
    "硬性边界 4：30 顺位球员预测由当前锁定预测管线提供；该管线未来可以是 Codex、另一个 DeepSeek 或其他指定模块，但不是当前这个只读问答 DeepSeek。",
    "参考文档边界：DraftCode24里程碑事件预测.md 可作为应试题设计、题意理解、字段口径、评分口径参考，不能作为官方赛果或预测球员调整依据。",
    "如果参考文档与当前本地 examFacts 冲突，必须以当前本地 examFacts 为准；不能因为参考文档而改预测球员。",
    "再次确认：你只能回答问题；你不能调整预测球员；你不能输出新的选秀预测。",
    "只输出当前应试题答案，不要给额外建议，不要 Markdown，不要代码块，不要 # 号，不要输出任何密钥。",
    "必须返回严格 JSON 对象。",
    "JSON schema:",
    JSON.stringify({
      scopeNote: "string",
      answers: [
        {
          id: "string",
          prompt: "string",
          answer: "string",
          evidence: ["string"],
        },
      ],
    }),
    "Input:",
    JSON.stringify(payload),
  ].join("\n\n");
};

const callDeepSeek = async (prompt) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY. Put it in .env.local or the shell environment.");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = normalizeModelId(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro");
  const modelLabel = getModelLabel(model);
  const maxTokens = Number(process.env.DEEPSEEK_MAX_TOKENS ?? 5200);
  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content: "You are a careful exam-answer agent. Return only valid JSON.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    temperature: 0.1,
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
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek response did not include message content.");

  return {
    model,
    modelLabel,
    usage: completion.usage ?? null,
    exam: extractJson(content),
  };
};

const toText = ({ model, modelLabel, usage, exam }) =>
  [
    `Generated: ${new Date().toISOString()}`,
    `Model: ${modelLabel}`,
    `API model id: ${model}`,
    `Usage: ${usage ? JSON.stringify(usage) : "not returned"}`,
    "",
    exam.scopeNote ?? "当前 DeepSeek 是只读问答 Agent，可回答当前应试题集合并参考里程碑文档理解字段口径；30 顺位球员预测由当前锁定预测板负责，当前 DeepSeek 禁止调整预测球员。",
    "",
    ...(exam.answers ?? []).flatMap((item) => [
      `${item.prompt}`,
      `${item.answer}`,
      ...(item.evidence?.length ? [`依据：${item.evidence.join("；")}`] : []),
      "",
    ]),
  ].join("\n");

const main = async () => {
  await loadEnvFile(localEnvPath);
  await loadEnvFile(envPath);

  const [boardArtifact, bundle, documentIndex, milestoneReference] = await Promise.all([
    readJson(boardPath),
    readJson(bundlePath),
    readJson(documentIndexPath),
    readFile(milestoneReferencePath, "utf8"),
  ]);
  const prompt = buildPrompt({ boardArtifact, bundle, documentIndex, milestoneReference });
  const result = await callDeepSeek(prompt);
  const artifact = {
    schemaVersion: "draftops.deepseek_exam_answers.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "DeepSeek Exam Answer Agent",
    model: result.model,
    modelLabel: result.modelLabel,
    usage: result.usage,
    inputFiles: [
      draftOpsManifest.data?.boardPath ?? "public/data/agent_balanced_board.json",
      draftOpsManifest.data?.bundlePath ?? "public/data/final_import_bundle.json",
      "data/documents/document_index.json",
      "data/documents/milestone-questions/DraftCode24里程碑事件预测.md",
    ],
    exam: result.exam,
  };

  await mkdir(resolve(rootDir, "data", "reports"), { recursive: true });
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(outputTextPath, toText(result), "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        output: [
          "data/reports/deepseek_exam_answers.json",
          "data/reports/deepseek_exam_answers.txt",
        ],
        model: result.model,
        modelLabel: result.modelLabel,
        answerCount: result.exam.answers?.length ?? 0,
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
