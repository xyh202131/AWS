import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { rootDir } from "./lib/draftops-manifest.mjs";

const defaultStatePath = ".draftops-watch/online-player-list-watch-state.json";
const defaultTextLogPath = ".draftops-watch/online-player-list-watch.log";
const defaultJsonlLogPath = ".draftops-watch/online-player-list-watch.jsonl";
const defaultLatestPath = ".draftops-watch/online-player-list-watch-latest.md";
const defaultIntervalSeconds = 60;
const requestTimeoutMs = 20000;
const reverifyScriptPath = "scripts/reverify-online-player-list.mjs";
const reverifyOutputPath = "data/normalized/normalized_2026_online_player_list_reverification_20260623.json";

const browserUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const monitoredSources = [
  {
    id: "china-draft",
    label: "NBA China draft board",
    url: "https://china.nba.cn/draft/",
    firecrawlPath: ".firecrawl/online-reverify-20260623-china-draft.md",
    firecrawlEveryRun: true,
  },
  {
    id: "nba-prospects",
    label: "NBA.com Prospects",
    url: "https://www.nba.com/draft/2026/prospects",
    firecrawlPath: ".firecrawl/online-reverify-20260623-nba-prospects.md",
    directHashWatch: true,
  },
  {
    id: "combine-invite",
    label: "NBA.com Combine invite",
    url: "https://www.nba.com/news/nba-announces-73-players-invited-to-2026-nba-draft-combine",
    firecrawlPath: ".firecrawl/online-reverify-20260623-combine-invite-73.md",
    directHashWatch: true,
  },
  {
    id: "combine-data-hub",
    label: "NBA.com Combine Data Hub",
    url: "https://www.nba.com/news/2026-aws-nba-draft-combine-data-hub-everything-you-need-to-know",
    firecrawlPath: ".firecrawl/online-reverify-20260623-combine-data-hub.md",
    directHashWatch: true,
  },
  {
    id: "stats-combine",
    label: "NBA Stats Combine",
    url: "https://www.nba.com/stats/draft/combine",
    firecrawlPath: ".firecrawl/online-reverify-20260623-nba-stats-combine.md",
    directHashWatch: true,
  },
  {
    id: "stats-anthro",
    label: "NBA Stats Anthro",
    url: "https://www.nba.com/stats/draft/combine-anthro",
    firecrawlPath: ".firecrawl/online-reverify-20260623-nba-stats-combine-anthro.md",
    directHashWatch: true,
  },
  {
    id: "early-entry",
    label: "NBA.com Early-entry",
    url: "https://www.nba.com/news/2026-nba-draft-early-entry-candidates",
    firecrawlPath: ".firecrawl/online-reverify-20260623-early-entry-candidates.md",
    directHashWatch: true,
  },
];

const parseArgs = (argv) => {
  const options = {
    once: false,
    fullFirecrawl: false,
    refreshOnDirectChange: false,
    refreshAllOnFirstRun: false,
    intervalSeconds: defaultIntervalSeconds,
    statePath: defaultStatePath,
    textLogPath: defaultTextLogPath,
    jsonlLogPath: defaultJsonlLogPath,
    latestPath: defaultLatestPath,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--once") options.once = true;
    else if (arg === "--full-firecrawl") options.fullFirecrawl = true;
    else if (arg === "--refresh-on-direct-change") options.refreshOnDirectChange = true;
    else if (arg === "--refresh-all-on-first-run") options.refreshAllOnFirstRun = true;
    else if (arg === "--interval") options.intervalSeconds = Number(argv[++i] ?? defaultIntervalSeconds);
    else if (arg === "--state") options.statePath = argv[++i] ?? defaultStatePath;
    else if (arg === "--log") options.textLogPath = argv[++i] ?? defaultTextLogPath;
    else if (arg === "--jsonl-log") options.jsonlLogPath = argv[++i] ?? defaultJsonlLogPath;
    else if (arg === "--latest") options.latestPath = argv[++i] ?? defaultLatestPath;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds < 10) {
    throw new Error("--interval must be at least 10 seconds.");
  }

  return options;
};

const printHelp = () => {
  console.log(`DraftOps online player-list watcher

Usage:
  npm run draft:watch
  npm run draft:watch -- --once
  npm run draft:watch -- --interval 60
  npm run draft:watch -- --full-firecrawl

Options:
  --once                    Run one polling pass and exit.
  --interval <seconds>      Polling interval. Default: 60.
  --full-firecrawl          Scrape every monitored page with Firecrawl every pass.
  --refresh-on-direct-change Firecrawl-refresh a non-China source when its raw direct-fetch hash changes.
  --refresh-all-on-first-run Scrape every monitored page with Firecrawl only when creating the baseline.
  --state <path>            State file path. Default: ${defaultStatePath}
  --log <path>              Text log path. Default: ${defaultTextLogPath}
  --jsonl-log <path>        JSONL log path. Default: ${defaultJsonlLogPath}
  --latest <path>           Latest markdown status path. Default: ${defaultLatestPath}

Default mode scrapes NBA China draft board with Firecrawl every pass because that page requires rendering.
Other NBA.com sources are direct-fetched for health/hash observation and are parsed from the latest verified snapshots unless --full-firecrawl or --refresh-on-direct-change is set.
`);
};

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const hash = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 20);
const absolute = (path) => resolve(rootDir, path);

const normalizeFetchedText = (value) =>
  String(value ?? "")
    .replace(/"buildId":"[^"]+"/g, '"buildId":""')
    .replace(/"generatedAt":"[^"]+"/g, '"generatedAt":""')
    .replace(/\b\d{13,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const runCommand = (command, args, { timeoutMs = 90000 } = {}) =>
  new Promise((resolveCommand, rejectCommand) => {
    const child = execFile(command, args, { cwd: rootDir, timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const detail = [error.message, stderr?.trim()].filter(Boolean).join("\n");
        rejectCommand(new Error(detail));
        return;
      }
      resolveCommand({ stdout, stderr });
    });
    child.stdin?.end();
  });

const runFirecrawl = async (args) => {
  if (process.platform === "win32") {
    return runCommand(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "firecrawl", ...args]);
  }
  return runCommand("firecrawl", args);
};

const scrapeWithFirecrawl = async (source) => {
  await mkdir(dirname(absolute(source.firecrawlPath)), { recursive: true });
  await runFirecrawl([
    "scrape",
    "--max-age",
    "0",
    "--format",
    "markdown",
    "-o",
    source.firecrawlPath,
    source.url,
  ]);
};

const fetchHash = async (source) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
        referer: source.url.includes("nba.com") ? "https://www.nba.com/" : source.url,
        "user-agent": browserUserAgent,
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return {
      ok: true,
      hash: hash(normalizeFetchedText(text)),
      bytes: text.length,
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const readJson = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
};

const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const appendLogs = async (options, entry) => {
  const textLogPath = absolute(options.textLogPath);
  const jsonlLogPath = absolute(options.jsonlLogPath);
  await mkdir(dirname(textLogPath), { recursive: true });
  await mkdir(dirname(jsonlLogPath), { recursive: true });
  await appendFile(textLogPath, `${entry.message}\n`, "utf8");
  await appendFile(jsonlLogPath, `${JSON.stringify(entry)}\n`, "utf8");
};

const compactReverification = (result) => ({
  counts: {
    nbaProspects: result.validation.nbaProspects.currentRowCount,
    chinaDraftRows: result.validation.chinaDraft.rowCount,
    chinaPopulatedPicks: result.validation.chinaDraft.populatedPickCount,
    combineInvitees: result.validation.combineInvite.rowCount,
    statsAnthroRows: result.validation.statsAnthro.rowCount,
    earlyEntryCandidates: result.validation.earlyEntry.rowCount,
    localPlayerPool: result.validation.localPlayerPool.rowCount,
  },
  nbaProspects: result.lists.nbaProspects.map((item) => ({
    ordinal: item.ordinal,
    name: item.name,
    position: item.position,
    age: item.age,
    schoolClub: item.schoolClub,
    height: item.height,
    weight: item.weight,
    status: item.status,
    country: item.country,
  })),
  chinaDraftBoard: result.lists.chinaDraftBoard.map((item) => ({
    pick: item.pick,
    team: item.team,
    pickTrade: item.pickTrade,
    draftDayTradeTo: item.draftDayTradeTo,
    playerNameZh: item.playerNameZh,
    details: item.details,
    populated: item.populated,
  })),
  combineInvitees: result.lists.combineInvitees.map((item) => ({
    ordinal: item.ordinal,
    name: item.name,
    collegeClub: item.collegeClub,
  })),
  statsAnthro: result.lists.statsAnthro.map((item) => ({
    ordinal: item.ordinal,
    name: item.name,
    position: item.position,
    heightWithoutShoes: item.heightWithoutShoes,
    weightLbs: item.weightLbs,
    wingspan: item.wingspan,
    standingReach: item.standingReach,
  })),
  earlyEntryCandidates: result.lists.earlyEntryCandidates.map((item) => ({
    ordinal: item.ordinal,
    category: item.category,
    name: item.name,
    schoolOrTeam: item.schoolOrTeam,
    height: item.height,
    status: item.status,
  })),
});

const describePick = (pick) => {
  if (!pick) return "空";
  const player = pick.playerNameZh || "未填球员";
  const trade = pick.draftDayTradeTo ? `; 选秀当天交易->${pick.draftDayTradeTo}` : "";
  return `${pick.team || "未知球队"} / ${player} / ${pick.details || "/"}${trade}`;
};

const describeChanges = (previous, current) => {
  if (!previous) return ["初始化基线，后续每分钟会输出有无变动。"];
  const changes = [];

  for (const [key, value] of Object.entries(current.counts)) {
    const oldValue = previous.counts?.[key];
    if (oldValue !== value) changes.push(`数量变动 ${key}: ${oldValue ?? "无"} -> ${value}`);
  }

  const previousPicks = new Map((previous.chinaDraftBoard ?? []).map((pick) => [pick.pick, pick]));
  const currentPicks = new Map((current.chinaDraftBoard ?? []).map((pick) => [pick.pick, pick]));
  for (const [pickNumber, currentPick] of currentPicks) {
    const previousPick = previousPicks.get(pickNumber);
    if (JSON.stringify(previousPick) !== JSON.stringify(currentPick)) {
      changes.push(`顺位 ${pickNumber} 变动: ${describePick(previousPick)} -> ${describePick(currentPick)}`);
    }
  }

  const previousPlayerPick = new Map(
    (previous.chinaDraftBoard ?? [])
      .filter((pick) => pick.playerNameZh)
      .map((pick) => [pick.playerNameZh, pick.pick]),
  );
  for (const pick of current.chinaDraftBoard ?? []) {
    if (!pick.playerNameZh) continue;
    const oldPick = previousPlayerPick.get(pick.playerNameZh);
    if (oldPick && oldPick !== pick.pick) changes.push(`球员顺位移动 ${pick.playerNameZh}: ${oldPick} -> ${pick.pick}`);
  }

  const sections = [
    ["nbaProspects", "NBA.com Prospects 名单"],
    ["combineInvitees", "Combine 邀请名单"],
    ["statsAnthro", "Stats Anthro 体测表"],
    ["earlyEntryCandidates", "Early-entry 名单"],
  ];
  for (const [key, label] of sections) {
    if (hash(JSON.stringify(previous[key] ?? [])) !== hash(JSON.stringify(current[key] ?? []))) {
      changes.push(`${label} 内容变动`);
    }
  }

  return changes;
};

const latestMarkdown = (entry) => `# DraftOps 每分钟名单监控

- 时间：${entry.timestamp}
- 轮次：${entry.runNumber}
- 状态：${entry.status}
- 信息：${entry.message}

## 当前数量

| 口径 | 数量 |
| --- | --- |
| NBA.com Prospects | ${entry.counts.nbaProspects} |
| NBA 中国已填顺位 | ${entry.counts.chinaPopulatedPicks}/${entry.counts.chinaDraftRows} |
| Combine 邀请 | ${entry.counts.combineInvitees} |
| Stats Anthro | ${entry.counts.statsAnthroRows} |
| Early-entry | ${entry.counts.earlyEntryCandidates} |
| 本地球员池 | ${entry.counts.localPlayerPool} |

## 变动

${entry.changes.length ? entry.changes.map((item) => `- ${item}`).join("\n") : "- 无变动"}

## 本轮抓取

${entry.refreshes.length ? entry.refreshes.map((item) => `- ${item}`).join("\n") : "- 无 Firecrawl 刷新"}

## 错误

${entry.errors.length ? entry.errors.map((item) => `- ${item.sourceLabel}: ${item.message}`).join("\n") : "- 无"}
`;

const runOnce = async (options, runNumber) => {
  const statePath = absolute(options.statePath);
  const state = await readJson(statePath, {
    schemaVersion: "draftops.online-player-list-watch.v1",
    createdAt: nowIso(),
    runCount: 0,
    directHashes: {},
  });
  const firstRun = !state.lastComparable;
  const timestamp = nowIso();
  const errors = [];
  const refreshes = [];
  const directHashes = {};

  for (const source of monitoredSources.filter((item) => item.directHashWatch)) {
    try {
      const result = await fetchHash(source);
      directHashes[source.id] = {
        label: source.label,
        hash: result.hash,
        bytes: result.bytes,
        status: result.status,
      };
    } catch (error) {
      errors.push({
        sourceId: source.id,
        sourceLabel: source.label,
        message: error instanceof Error ? error.message : String(error),
      });
      directHashes[source.id] = state.directHashes?.[source.id] ?? {
        label: source.label,
        hash: null,
        status: "error",
      };
    }
  }

  const sourcesToFirecrawl = monitoredSources.filter((source) => {
    if (source.firecrawlEveryRun) return true;
    if (options.fullFirecrawl) return true;
    if (firstRun && options.refreshAllOnFirstRun) return true;
    if (!options.refreshOnDirectChange || !source.directHashWatch) return false;
    const currentHash = directHashes[source.id]?.hash;
    const previousHash = state.directHashes?.[source.id]?.hash;
    return Boolean(currentHash && previousHash && currentHash !== previousHash);
  });

  for (const source of sourcesToFirecrawl) {
    try {
      await scrapeWithFirecrawl(source);
      refreshes.push(`${source.label} -> ${source.firecrawlPath}`);
    } catch (error) {
      errors.push({
        sourceId: source.id,
        sourceLabel: source.label,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await runCommand(process.execPath, [reverifyScriptPath], { timeoutMs: 45000 });
  const reverify = await readJson(absolute(reverifyOutputPath));
  const comparable = compactReverification(reverify);
  const comparableHash = hash(JSON.stringify(comparable));
  const previousHash = state.lastComparableHash;
  const changes = previousHash === comparableHash ? [] : describeChanges(state.lastComparable, comparable);
  const status = changes.length ? (firstRun ? "baseline" : "changed") : "unchanged";
  const counts = comparable.counts;
  const message =
    status === "unchanged"
      ? `[${timestamp}] 第 ${runNumber} 次：无变动。NBA中国已填 ${counts.chinaPopulatedPicks}/${counts.chinaDraftRows}；Prospects ${counts.nbaProspects}；Combine ${counts.combineInvitees}/${counts.statsAnthroRows}；Early-entry ${counts.earlyEntryCandidates}；本地池 ${counts.localPlayerPool}。`
      : `[${timestamp}] 第 ${runNumber} 次：${firstRun ? "初始化基线" : "发现数据变动"}。${changes.join(" | ")}`;

  const entry = {
    timestamp,
    runNumber,
    status,
    message,
    changes,
    refreshes,
    errors,
    counts,
    comparableHash,
  };

  state.updatedAt = timestamp;
  state.runCount = (state.runCount ?? 0) + 1;
  state.directHashes = directHashes;
  state.lastComparableHash = comparableHash;
  state.lastComparable = comparable;
  state.lastEntry = entry;
  await writeJson(statePath, state);
  await appendLogs(options, entry);
  await mkdir(dirname(absolute(options.latestPath)), { recursive: true });
  await writeFile(absolute(options.latestPath), latestMarkdown(entry), "utf8");

  console.log(message);
  if (errors.length) {
    for (const error of errors) console.warn(`[${timestamp}] ${error.sourceLabel}: ${error.message}`);
  }

  return entry;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  let runNumber = 1;

  while (true) {
    try {
      await runOnce(options, runNumber);
    } catch (error) {
      const timestamp = nowIso();
      const entry = {
        timestamp,
        runNumber,
        status: "error",
        message: `[${timestamp}] 第 ${runNumber} 次：监控执行失败。${error instanceof Error ? error.message : String(error)}`,
        changes: [],
        refreshes: [],
        errors: [{ sourceLabel: "watcher", message: error instanceof Error ? error.message : String(error) }],
        counts: {},
      };
      console.error(entry.message);
      await appendLogs(options, entry);
    }

    if (options.once) break;
    runNumber += 1;
    await sleep(options.intervalSeconds * 1000);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
