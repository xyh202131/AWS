import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rootDir } from "./lib/draftops-manifest.mjs";

const defaultStatePath = ".draftops-watch/team-news-state.json";
const defaultIntervalSeconds = 60;
const requestTimeoutMs = 18000;
const browserUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const sources = [
  {
    id: "nba-draft-order",
    label: "NBA.com Draft Order",
    tier: "official",
    url: "https://www.nba.com/news/2026-nba-draft-order",
    mode: "draft-order",
  },
  {
    id: "nba-news",
    label: "NBA.com News",
    tier: "official",
    url: "https://www.nba.com/news",
  },
  {
    id: "nba-transactions",
    label: "NBA.com Player Transactions",
    tier: "official",
    url: "https://www.nba.com/players/transactions",
  },
  {
    id: "nba-trade-tracker",
    label: "NBA.com Trade Tracker",
    tier: "official",
    url: "https://www.nba.com/news/2025-26-nba-trade-tracker",
  },
  {
    id: "espn-transactions",
    label: "ESPN NBA Transactions",
    tier: "major-media",
    url: "https://www.espn.com/nba/transactions",
  },
  {
    id: "cbs-transactions",
    label: "CBS Sports NBA Transactions",
    tier: "major-media",
    url: "https://www.cbssports.com/nba/transactions/",
  },
  {
    id: "bleacher-rumors",
    label: "Bleacher Report NBA Rumors",
    tier: "rumor-watch",
    url: "https://bleacherreport.com/nba-rumors",
  },
  {
    id: "ringer-offer-sheet",
    label: "The Ringer NBA Offseason Tracker",
    tier: "rumor-watch",
    url: "https://nbarankings.theringer.com/the-offer-sheet",
  },
];

const teamNames = [
  "Atlanta Hawks",
  "Boston Celtics",
  "Brooklyn Nets",
  "Charlotte Hornets",
  "Chicago Bulls",
  "Cleveland Cavaliers",
  "Dallas Mavericks",
  "Denver Nuggets",
  "Detroit Pistons",
  "Golden State Warriors",
  "Houston Rockets",
  "Indiana Pacers",
  "LA Clippers",
  "Los Angeles Clippers",
  "Los Angeles Lakers",
  "Memphis Grizzlies",
  "Miami Heat",
  "Milwaukee Bucks",
  "Minnesota Timberwolves",
  "New Orleans Pelicans",
  "New York Knicks",
  "Oklahoma City Thunder",
  "Orlando Magic",
  "Philadelphia 76ers",
  "Phoenix Suns",
  "Portland Trail Blazers",
  "Sacramento Kings",
  "San Antonio Spurs",
  "Toronto Raptors",
  "Utah Jazz",
  "Washington Wizards",
];

const draftTeamAliases = [
  ["Atlanta", "Atlanta Hawks"],
  ["Atlanta Hawks", "Atlanta Hawks"],
  ["Boston", "Boston Celtics"],
  ["Boston Celtics", "Boston Celtics"],
  ["Brooklyn", "Brooklyn Nets"],
  ["Brooklyn Nets", "Brooklyn Nets"],
  ["Charlotte", "Charlotte Hornets"],
  ["Charlotte Hornets", "Charlotte Hornets"],
  ["Chicago", "Chicago Bulls"],
  ["Chicago Bulls", "Chicago Bulls"],
  ["Cleveland", "Cleveland Cavaliers"],
  ["Cleveland Cavaliers", "Cleveland Cavaliers"],
  ["Dallas", "Dallas Mavericks"],
  ["Dallas Mavericks", "Dallas Mavericks"],
  ["Denver", "Denver Nuggets"],
  ["Denver Nuggets", "Denver Nuggets"],
  ["Detroit", "Detroit Pistons"],
  ["Detroit Pistons", "Detroit Pistons"],
  ["Golden State", "Golden State Warriors"],
  ["Golden State Warriors", "Golden State Warriors"],
  ["Houston", "Houston Rockets"],
  ["Houston Rockets", "Houston Rockets"],
  ["Indiana", "Indiana Pacers"],
  ["Indiana Pacers", "Indiana Pacers"],
  ["LA Clippers", "LA Clippers"],
  ["Los Angeles Clippers", "LA Clippers"],
  ["Los Angeles Lakers", "Los Angeles Lakers"],
  ["Memphis", "Memphis Grizzlies"],
  ["Memphis Grizzlies", "Memphis Grizzlies"],
  ["Miami", "Miami Heat"],
  ["Miami Heat", "Miami Heat"],
  ["Milwaukee", "Milwaukee Bucks"],
  ["Milwaukee Bucks", "Milwaukee Bucks"],
  ["Minnesota", "Minnesota Timberwolves"],
  ["Minnesota Timberwolves", "Minnesota Timberwolves"],
  ["New Orleans", "New Orleans Pelicans"],
  ["New Orleans Pelicans", "New Orleans Pelicans"],
  ["New York", "New York Knicks"],
  ["New York Knicks", "New York Knicks"],
  ["Oklahoma City", "Oklahoma City Thunder"],
  ["Oklahoma City Thunder", "Oklahoma City Thunder"],
  ["Orlando", "Orlando Magic"],
  ["Orlando Magic", "Orlando Magic"],
  ["Philadelphia", "Philadelphia 76ers"],
  ["Philadelphia 76ers", "Philadelphia 76ers"],
  ["Phoenix", "Phoenix Suns"],
  ["Phoenix Suns", "Phoenix Suns"],
  ["Portland", "Portland Trail Blazers"],
  ["Portland Trail Blazers", "Portland Trail Blazers"],
  ["Sacramento", "Sacramento Kings"],
  ["Sacramento Kings", "Sacramento Kings"],
  ["San Antonio", "San Antonio Spurs"],
  ["San Antonio Spurs", "San Antonio Spurs"],
  ["Toronto", "Toronto Raptors"],
  ["Toronto Raptors", "Toronto Raptors"],
  ["Utah", "Utah Jazz"],
  ["Utah Jazz", "Utah Jazz"],
  ["Washington", "Washington Wizards"],
  ["Washington Wizards", "Washington Wizards"],
];

const changePatterns = [
  /\btrade(?:d|s)?\b/i,
  /\btrading\b/i,
  /\bacquir(?:e|es|ed|ing)\b/i,
  /\breceiv(?:e|es|ed|ing)\b/i,
  /\bsend(?:s|ing)?\b/i,
  /\bsent\b/i,
  /\bsign(?:s|ed|ing)?\b/i,
  /\bagree(?:s|d)?\b/i,
  /\bextension\b/i,
  /\bwaiv(?:e|es|ed|ing)\b/i,
  /\bclaim(?:s|ed|ing)?\b/i,
  /\boption\b/i,
  /\bdeal\b/i,
  /\btransaction(?:s)?\b/i,
  /\bdraft rights\b/i,
  /\bpick swap\b/i,
  /\bfirst-round pick\b/i,
  /\bsecond-round pick\b/i,
  /\bdraft order\b/i,
  /\border of selection\b/i,
  /\bpicks?\s+1-60\b/i,
  /\bno\.\s*\d{1,2}\s+(?:pick|selection)\b/i,
  /\btrade kicker\b/i,
  /\bopt(?:s|ed)?\s+in\b/i,
  /\bopt(?:s|ed)?\s+out\b/i,
  /\bteam option\b/i,
  /\bplayer option\b/i,
];

const noisePatterns = [
  /^all transactions$/i,
  /^all teams$/i,
  /^team all teams$/i,
  /^no transactions at this time\.?$/i,
  /^standings$/i,
  /^schedule$/i,
  /^tickets$/i,
  /^shop$/i,
  /^watch$/i,
  /^sign in$/i,
  /^log in$/i,
  /^privacy policy$/i,
];

const parseArgs = (argv) => {
  const options = {
    intervalSeconds: defaultIntervalSeconds,
    statePath: defaultStatePath,
    once: false,
    officialOnly: false,
    maxItemsPerSource: 24,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--once") options.once = true;
    else if (arg === "--official-only") options.officialOnly = true;
    else if (arg === "--state" && next) {
      options.statePath = next;
      index += 1;
    } else if ((arg === "--interval" || arg === "--interval-seconds") && next) {
      const value = Number(next);
      if (Number.isFinite(value) && value > 0) options.intervalSeconds = value;
      index += 1;
    } else if (arg === "--max-items-per-source" && next) {
      const value = Number(next);
      if (Number.isFinite(value) && value > 0) options.maxItemsPerSource = Math.round(value);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
};

const printHelp = () => {
  console.log(`DraftOps team-change news watcher

Usage:
  npm run news:watch
  npm run news:watch -- --once
  npm run news:watch -- --interval 30
  npm run news:watch -- --official-only

Options:
  --once                    Run one polling pass and exit.
  --interval <seconds>      Polling interval. Default: 60.
  --official-only           Only monitor NBA.com sources.
  --state <path>            State file path. Default: ${defaultStatePath}
  --max-items-per-source N  Keep up to N relevant snippets per source per pass.
`);
};

const nowIso = () => new Date().toISOString();

const localTime = () =>
  new Intl.DateTimeFormat("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 20);

const decodeHtml = (value) =>
  String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const cleanText = (value) =>
  decodeHtml(value)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

const stripHtmlToLines = (html) => {
  const text = String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|article|section|tr|td|span)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return text
    .split(/\r?\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map(cleanText)
    .filter(Boolean);
};

const extractTitle = (html) => {
  const match = String(html ?? "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match?.[1] ?? "");
};

const normalizeSignalText = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/g, "")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi, "")
    .replace(/\b\d+\s*(min|mins|minute|minutes|hour|hours|day|days)\s+ago\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isNoise = (line) => {
  if (line.length < 12 || line.length > 360) return true;
  if (noisePatterns.some((pattern) => pattern.test(line))) return true;
  if (/^(facebook|twitter|instagram|youtube|tiktok|reddit)$/i.test(line)) return true;
  return false;
};

const hasTeamName = (line) => teamNames.some((team) => line.toLowerCase().includes(team.toLowerCase()));

const hasChangeKeyword = (line) => changePatterns.some((pattern) => pattern.test(line));

const isRelevantLine = (line) => {
  if (isNoise(line)) return false;
  if (hasChangeKeyword(line)) return true;
  return hasTeamName(line) && /\bpick|draft|roster|guard|forward|center|contract|deal\b/i.test(line);
};

const tierWeight = (tier) =>
  ({
    official: 0,
    "major-media": 1,
    "rumor-watch": 2,
  })[tier] ?? 3;

const summarizeReason = (line) => {
  if (/\bdraft order|order of selection|picks?\s+1-60|no\.\s*\d{1,2}\s+(?:pick|selection)\b/i.test(line)) {
    return "顺位次序相关";
  }
  if (/\btrade|traded|trading|acquire|acquired|receives|sends|sent|draft rights|pick swap\b/i.test(line)) {
    return "交易/签位相关";
  }
  if (/\bsign|signed|agree|extension|option|deal\b/i.test(line)) return "签约/合同相关";
  if (/\bwaive|waived|claim|claimed|transaction\b/i.test(line)) return "球员流动相关";
  return "球队上下文相关";
};

const fetchWithTimeout = async (source) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "referer": source.url.includes("nba.com") ? "https://www.nba.com/" : source.url,
        "user-agent": browserUserAgent,
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 160)}`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const draftTeamAliasByLower = new Map(draftTeamAliases.map(([alias, team]) => [alias.toLowerCase(), team]));

const draftTeamAliasPattern = draftTeamAliases
  .map(([alias]) => alias)
  .sort((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join("|");

const textForDraftOrderParsing = (html) =>
  stripHtmlToLines(html)
    .join("\n")
    .replace(/\*\*/g, "")
    .replace(/\\+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[–—]/g, " ");

const extractDraftOrderEntries = (html) => {
  const text = textForDraftOrderParsing(html);
  const pickPattern = new RegExp(
    String.raw`\b([1-9]|[1-5]\d|60)\s*\.?\s+(${draftTeamAliasPattern})(?:\s*\((from[^)]*)\))?`,
    "gi",
  );
  const byPick = new Map();

  for (const match of text.matchAll(pickPattern)) {
    const pick = Number(match[1]);
    if (!Number.isInteger(pick) || pick < 1 || pick > 60 || byPick.has(pick)) continue;

    const alias = cleanText(match[2]);
    const team = draftTeamAliasByLower.get(alias.toLowerCase()) ?? alias;
    const from = cleanText(match[3] ?? "");
    byPick.set(pick, { pick, team, from });
  }

  return [...byPick.values()].sort((left, right) => left.pick - right.pick);
};

const draftOrderSignature = (entries) =>
  entries.map((entry) => `${entry.pick}:${entry.team}:${entry.from}`).join("|");

const formatDraftPick = (entry) =>
  `${entry.pick}. ${entry.team}${entry.from ? ` (${entry.from})` : ""}`;

const formatDraftOrderWindow = (entries, start, end) =>
  entries
    .filter((entry) => entry.pick >= start && entry.pick <= end)
    .map(formatDraftPick)
    .join(" | ");

const extractDraftOrderSignals = (source, html, maxItems) => {
  const entries = extractDraftOrderEntries(html);
  const firstRoundEntries = entries.filter((entry) => entry.pick >= 1 && entry.pick <= 30);
  if (firstRoundEntries.length < 10) return [];

  const signature = draftOrderSignature(firstRoundEntries);
  const signals = [
    {
      id: hash(`${source.id}:first-round-order:${signature}`),
      sourceId: source.id,
      sourceLabel: source.label,
      tier: source.tier,
      url: source.url,
      reason: "顺位次序相关",
      text: `官方前30顺位次序快照已纳入监控：${formatDraftOrderWindow(firstRoundEntries, 1, 30)}；共 ${firstRoundEntries.length} 个首轮顺位。`,
      draftOrderSignature: signature,
      draftOrder: firstRoundEntries,
    },
  ];

  for (const entry of firstRoundEntries) {
    signals.push({
      id: hash(`${source.id}:pick:${entry.pick}:${entry.team}:${entry.from}`),
      sourceId: source.id,
      sourceLabel: source.label,
      tier: source.tier,
      url: source.url,
      reason: entry.from ? "顺位归属相关" : "顺位次序相关",
      text: formatDraftPick(entry),
      pick: entry.pick,
      team: entry.team,
      from: entry.from,
    });
  }

  return signals.slice(0, Math.max(maxItems, firstRoundEntries.length + 1));
};

const extractSignals = (source, html, maxItems) => {
  if (source.mode === "draft-order") {
    const draftOrderSignals = extractDraftOrderSignals(source, html, maxItems);
    if (draftOrderSignals.length) return draftOrderSignals;
  }

  const title = extractTitle(html);
  const lines = stripHtmlToLines(html);
  const candidates = [];

  if (title && isRelevantLine(title)) candidates.push(title);

  for (const line of lines) {
    if (!isRelevantLine(line)) continue;
    candidates.push(line);
  }

  const byFingerprint = new Map();
  for (const line of candidates) {
    const normalized = normalizeSignalText(line);
    if (!normalized) continue;
    const id = hash(`${source.id}:${normalized}`);
    if (!byFingerprint.has(id)) {
      byFingerprint.set(id, {
        id,
        sourceId: source.id,
        sourceLabel: source.label,
        tier: source.tier,
        url: source.url,
        reason: summarizeReason(line),
        text: cleanText(line),
      });
    }
  }

  return [...byFingerprint.values()].slice(0, maxItems);
};

const readState = async (statePath) => {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: "draftops.team-news-watch.v1",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        seen: {},
        sources: {},
      };
    }
    throw error;
  }
};

const writeState = async (statePath, state) => {
  state.updatedAt = nowIso();
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const pollSource = async (source, maxItemsPerSource) => {
  const html = await fetchWithTimeout(source);
  const signals = extractSignals(source, html, maxItemsPerSource);
  const pageHash = hash(signals.map((item) => item.id).join("|"));
  return {
    source,
    signals,
    pageHash,
  };
};

const formatSignal = (signal) => {
  const tierLabel =
    signal.tier === "official" ? "官方" : signal.tier === "major-media" ? "主流媒体" : "传闻监控";
  return `- [${tierLabel}][${signal.sourceLabel}] ${signal.reason}: ${signal.text}\n  ${signal.url}`;
};

const runOnce = async (options, runNumber) => {
  const absoluteStatePath = resolve(rootDir, options.statePath);
  const state = await readState(absoluteStatePath);
  const firstRun = Object.keys(state.seen ?? {}).length === 0;
  const activeSources = options.officialOnly ? sources.filter((source) => source.tier === "official") : sources;
  const results = [];
  const errors = [];

  for (const source of activeSources.sort((left, right) => tierWeight(left.tier) - tierWeight(right.tier))) {
    try {
      results.push(await pollSource(source, options.maxItemsPerSource));
    } catch (error) {
      errors.push({
        source,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const allSignals = results
    .flatMap((result) => result.signals)
    .sort((left, right) => tierWeight(left.tier) - tierWeight(right.tier));
  const newSignals = [];
  const timestamp = nowIso();

  state.seen ??= {};
  state.sources ??= {};

  for (const result of results) {
    state.sources[result.source.id] = {
      label: result.source.label,
      tier: result.source.tier,
      url: result.source.url,
      lastOkAt: timestamp,
      lastHash: result.pageHash,
      lastSignalCount: result.signals.length,
    };
  }

  for (const error of errors) {
    state.sources[error.source.id] = {
      ...(state.sources[error.source.id] ?? {}),
      label: error.source.label,
      tier: error.source.tier,
      url: error.source.url,
      lastErrorAt: timestamp,
      lastError: error.message,
    };
  }

  for (const signal of allSignals) {
    const existing = state.seen[signal.id];
    if (!existing && !firstRun) newSignals.push(signal);
    state.seen[signal.id] = {
      ...(existing ?? signal),
      ...signal,
      firstSeenAt: existing?.firstSeenAt ?? timestamp,
      latestSeenAt: timestamp,
    };
  }

  const seenEntries = Object.entries(state.seen)
    .sort((left, right) => String(right[1].latestSeenAt).localeCompare(String(left[1].latestSeenAt)))
    .slice(0, 1200);
  state.seen = Object.fromEntries(seenEntries);

  await writeState(absoluteStatePath, state);

  const prefix = `[${localTime()}] 第 ${runNumber} 轮球队变动监控`;
  if (firstRun) {
    console.log(`${prefix}: 已建立基线，当前抓到 ${allSignals.length} 条相关信号；从下一轮开始只报告新增变动。`);
  } else if (newSignals.length) {
    console.log(`${prefix}: 发现 ${newSignals.length} 条新增球队变动信号。`);
    console.log(newSignals.map(formatSignal).join("\n"));
  } else {
    console.log(`${prefix}: 暂无新增球队变动。已检查 ${results.length}/${activeSources.length} 个源，当前相关信号 ${allSignals.length} 条。`);
  }

  if (errors.length) {
    console.log(`  注意：${errors.length} 个源抓取失败：${errors.map((error) => `${error.source.label}(${error.message})`).join("; ")}`);
  }
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  let runNumber = 1;

  console.log("DraftOps 球队变动监控已启动。");
  console.log(`优先级：NBA 官方源（含前30顺位次序）-> 主流媒体 -> 传闻监控。轮询间隔：${options.intervalSeconds} 秒。`);
  console.log(`状态文件：${resolve(rootDir, options.statePath)}`);

  while (true) {
    await runOnce(options, runNumber);
    if (options.once) break;
    runNumber += 1;
    await sleep(options.intervalSeconds * 1000);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
