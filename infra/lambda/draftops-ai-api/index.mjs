import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const region = process.env.AWS_REGION ?? "us-east-1";
const secrets = new SecretsManagerClient({ region });
const bedrock = new BedrockRuntimeClient({ region });

const provider = (process.env.MODEL_PROVIDER ?? "deepseek").toLowerCase();
const deepSeekBaseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const deepSeekModel = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";
const deepSeekModelLabel = process.env.DEEPSEEK_MODEL_LABEL ?? `${deepSeekModel}[1m]`;
const bedrockModelId = process.env.BEDROCK_MODEL_ID ?? "amazon.nova-lite-v1:0";
const maxTokens = Number(process.env.CHAT_MAX_TOKENS ?? "1800");
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

let cachedSecret;

const isPlaceholder = (value) => /replace|placeholder|change-me|changeme|your-/i.test(String(value ?? ""));

const systemPrompt = [
  "You are the DraftOps read-only AI assistant.",
  "You answer questions about the current DraftOps draft board, milestone answers, architecture, and presentation context.",
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

const compactHistory = (history) =>
  Array.isArray(history)
    ? history.slice(-8).map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content ?? "").slice(0, 1200),
      }))
    : [];

const buildUserPrompt = ({ question, selectedPickNumber }) =>
  [
    `Selected pick number: ${Number(selectedPickNumber ?? 1) || 1}`,
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
        { role: "user", content: buildUserPrompt({ question, selectedPickNumber }) },
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
              buildUserPrompt({ question, selectedPickNumber }),
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
      return json(event, 200, {
        ok: true,
        configured,
        provider,
        model: provider === "bedrock" ? bedrockModelId : deepSeekModel,
        modelLabel: provider === "bedrock" ? bedrockModelId : deepSeekModelLabel,
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
