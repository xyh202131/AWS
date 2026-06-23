import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { rootDir } from "./lib/draftops-manifest.mjs";

const generatedAt = new Date().toISOString();

const sourceFiles = {
  nbaProspects: {
    label: "NBA.com 2026 Draft Prospects",
    url: "https://www.nba.com/draft/2026/prospects",
    path: ".firecrawl/online-reverify-20260623-nba-prospects.md",
  },
  chinaDraft: {
    label: "NBA China draft board",
    url: "https://china.nba.cn/draft/",
    path: ".firecrawl/online-reverify-20260623-china-draft.md",
  },
  combineInvite: {
    label: "NBA.com 73-player AWS NBA Draft Combine invite article",
    url: "https://www.nba.com/news/nba-announces-73-players-invited-to-2026-nba-draft-combine",
    path: ".firecrawl/online-reverify-20260623-combine-invite-73.md",
  },
  combineDataHub: {
    label: "NBA.com AWS NBA Draft Combine Data Hub article",
    url: "https://www.nba.com/news/2026-aws-nba-draft-combine-data-hub-everything-you-need-to-know",
    path: ".firecrawl/online-reverify-20260623-combine-data-hub.md",
  },
  statsCombine: {
    label: "NBA Stats Draft Combine summary",
    url: "https://www.nba.com/stats/draft/combine",
    path: ".firecrawl/online-reverify-20260623-nba-stats-combine.md",
  },
  statsAnthro: {
    label: "NBA Stats Draft Combine Anthro",
    url: "https://www.nba.com/stats/draft/combine-anthro",
    path: ".firecrawl/online-reverify-20260623-nba-stats-combine-anthro.md",
  },
  earlyEntry: {
    label: "NBA.com 2026 early entry candidates",
    url: "https://www.nba.com/news/2026-nba-draft-early-entry-candidates",
    path: ".firecrawl/online-reverify-20260623-early-entry-candidates.md",
  },
  savedOfficialProspects: {
    label: "Saved normalized official prospects",
    path: "data/normalized/normalized_2026_official_prospects_101.json",
  },
  localPlayerPool: {
    label: "Local answer-card 124-player pool",
    path: "data/normalized/normalized_2026_local_player_pool_124.json",
  },
  localFeatureReference: {
    label: "Local 124-player feature reference",
    path: "data/normalized/normalized_2026_player_feature_reference_124.json",
  },
};

const outJsonPath = "data/normalized/normalized_2026_online_player_list_reverification_20260623.json";
const outReportPath = "data/reports/online_full_player_list_reverification_20260623.md";

const readText = async (relativePath) => readFile(resolve(rootDir, relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));

async function fileSha256(relativePath) {
  const bytes = await readFile(resolve(rootDir, relativePath));
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function stripMarkdown(value) {
  return value
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\\_/g, "_")
    .replace(/\\>/g, ">")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^\s*\|/.test(line) && !/^\s*\|\s*-+/.test(line))
    .map((line) => line.trim().split("|").slice(1, -1).map((cell) => cell.trim()));
}

function extractLink(cell) {
  const match = cell.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (!match) return { text: stripMarkdown(cell), url: null };
  return { text: stripMarkdown(match[1]), url: match[2].trim() };
}

function parseNbaProspects(markdown) {
  return markdownRows(markdown)
    .filter((cells) => cells.length >= 8 && /nba\.com\/draft\/2026\/prospects\//i.test(cells[0]))
    .map((cells, index) => {
      const link = extractLink(cells[0]);
      return {
        ordinal: index + 1,
        name: link.text,
        profileUrl: link.url,
        position: stripMarkdown(cells[1]),
        age: Number(stripMarkdown(cells[2])),
        schoolClub: stripMarkdown(cells[3]),
        height: stripMarkdown(cells[4]),
        weight: stripMarkdown(cells[5]),
        status: stripMarkdown(cells[6]),
        country: stripMarkdown(cells[7]),
      };
    });
}

function parseChinaDraft(markdown) {
  return markdownRows(markdown)
    .filter((cells) => cells.length >= 5 && /^\d+$/.test(stripMarkdown(cells[1])))
    .map((cells) => {
      const pick = Number(stripMarkdown(cells[1]));
      const teamCell = cells[2];
      const playerLink = extractLink(cells[3]);
      const team = stripMarkdown(teamCell.split("<br>")[0]);
      const pickTrade = teamCell.match(/选秀权交易:([^<)]+)/)?.[1]?.trim() ?? "";
      const draftDayTradeTo = teamCell
        .match(/选秀当天交易-\\?>\s*<br>\s*([^)]*)\)/)?.[1]
        ?.replace(/<[^>]+>/g, "")
        .trim() ?? "";
      return {
        pick,
        team,
        pickTrade,
        draftDayTradeTo,
        playerNameZh: playerLink.text.replace(/_/g, " "),
        playerUrl: playerLink.url,
        details: stripMarkdown(cells[4]),
        populated: Boolean(playerLink.text),
      };
    });
}

function parseSimpleNameTable(markdown, headerPattern, columns) {
  const rows = markdownRows(markdown);
  const headerIndex = rows.findIndex((cells) => headerPattern.test(cells.map(stripMarkdown).join(" | ")));
  if (headerIndex < 0) return [];

  const parsed = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const cells = rows[i];
    const firstCell = stripMarkdown(cells[0] ?? "");
    if (!firstCell || /^related$/i.test(firstCell)) break;
    if (cells.length < columns.length) break;
    const entry = {};
    columns.forEach((column, columnIndex) => {
      entry[column] = stripMarkdown(cells[columnIndex] ?? "");
    });
    parsed.push(entry);
  }
  return parsed;
}

function parseAnthroTable(markdown) {
  return parseSimpleNameTable(markdown, /^PLAYER \| POS \| BODY/i, [
    "name",
    "position",
    "bodyFatPct",
    "handLengthIn",
    "handWidthIn",
    "heightWithoutShoes",
    "heightWithShoes",
    "standingReach",
    "weightLbs",
    "wingspan",
  ]).map((entry, index) => ({
    ordinal: index + 1,
    ...entry,
  }));
}

function parseEarlyEntry(markdown) {
  const rows = markdownRows(markdown);
  const tables = [];
  for (let i = 0; i < rows.length; i += 1) {
    const header = rows[i].map(stripMarkdown).join(" | ");
    if (!/^Player \| (School or Team|Team\/Country of Team) \| Height \| Status$/i.test(header)) continue;
    const category = /Team\/Country/i.test(header) ? "international" : "nonInternationalCollege";
    const entries = [];
    for (let j = i + 1; j < rows.length; j += 1) {
      const cells = rows[j];
      if (cells.length < 4) break;
      const player = stripMarkdown(cells[0]);
      if (!player || /^player$/i.test(player) || /^related$/i.test(player)) break;
      entries.push({
        category,
        name: player,
        schoolOrTeam: stripMarkdown(cells[1]),
        height: stripMarkdown(cells[2]),
        status: stripMarkdown(cells[3]),
      });
    }
    tables.push(...entries);
  }
  return tables.map((entry, index) => ({ ordinal: index + 1, ...entry }));
}

function nameKey(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\bjr\.\b/g, "jr")
    .replace(/[.'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const aliasTargets = new Map([
  ["matthew able", "matt able"],
  ["nathaniel ament", "nate ament"],
  ["christian anderson", "christian anderson jr"],
  ["nicholas boyd", "nick boyd"],
  ["christopher cenac jr", "chris cenac jr"],
  ["anicet dybantsa", "aj dybantsa"],
  ["sergio de larrea", "sergio de larrea"],
  ["labaron philon", "labaron philon jr"],
  ["andrej stojakovic", "andrej stojakovic"],
  ["morez johnson", "morez johnson jr"],
]);

function canonicalNameKey(name) {
  const key = nameKey(name);
  return aliasTargets.get(key) ?? key;
}

function duplicateValues(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}

function differenceByName(left, right, leftName = (item) => item.name, rightName = (item) => item.name) {
  const rightKeys = new Set(right.map((item) => canonicalNameKey(rightName(item))));
  return left
    .filter((item) => !rightKeys.has(canonicalNameKey(leftName(item))))
    .map((item) => leftName(item));
}

function measurementKeyFromLocal(player) {
  const measurements = player.measurements ?? {};
  if (!measurements.barefootHeightText || !measurements.wingspanText || !measurements.standingReachText) return null;
  return [
    measurements.positionCode ?? "",
    measurements.barefootHeightText ?? "",
    Number.isFinite(measurements.weightLbs) ? Number(measurements.weightLbs).toFixed(1) : "",
    measurements.wingspanText ?? "",
    measurements.standingReachText ?? "",
  ].join("|");
}

function measurementKeyFromAnthro(row) {
  if (!row.heightWithoutShoes || !row.wingspan || !row.standingReach || row.weightLbs === "-") return null;
  const weight = Number(row.weightLbs);
  return [
    row.position ?? "",
    row.heightWithoutShoes ?? "",
    Number.isFinite(weight) ? weight.toFixed(1) : "",
    row.wingspan ?? "",
    row.standingReach ?? "",
  ].join("|");
}

function normalizeZhName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[\\_\s·.。-]/g, "")
    .trim();
}

function listPreview(items, limit = 12) {
  if (!items.length) return "无";
  const head = items.slice(0, limit).join("、");
  return items.length > limit ? `${head} 等 ${items.length} 项` : head;
}

function markdownTable(rows) {
  if (!rows.length) return "";
  const [header, ...body] = rows;
  const separator = header.map(() => "---");
  return [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

const allSourceEntries = await Promise.all(
  Object.entries(sourceFiles).map(async ([id, info]) => ({
    id,
    ...info,
    sha256: await fileSha256(info.path),
  })),
);
const sources = Object.fromEntries(allSourceEntries.map(({ id, ...entry }) => [id, entry]));

const [
  nbaProspectsMd,
  chinaDraftMd,
  combineInviteMd,
  statsCombineMd,
  statsAnthroMd,
  earlyEntryMd,
  savedOfficialProspectsJson,
  localPlayerPoolJson,
  localFeatureReferenceJson,
] = await Promise.all([
  readText(sourceFiles.nbaProspects.path),
  readText(sourceFiles.chinaDraft.path),
  readText(sourceFiles.combineInvite.path),
  readText(sourceFiles.statsCombine.path),
  readText(sourceFiles.statsAnthro.path),
  readText(sourceFiles.earlyEntry.path),
  readJson(sourceFiles.savedOfficialProspects.path),
  readJson(sourceFiles.localPlayerPool.path),
  readJson(sourceFiles.localFeatureReference.path),
]);

const onlineProspects = parseNbaProspects(nbaProspectsMd);
const chinaDraftRows = parseChinaDraft(chinaDraftMd);
const combineInvitees = parseSimpleNameTable(combineInviteMd, /^Player Name \| College \/ Club$/i, [
  "name",
  "collegeClub",
]).map((entry, index) => ({ ordinal: index + 1, ...entry }));
const statsAnthroRows = parseAnthroTable(statsAnthroMd);
const earlyEntryCandidates = parseEarlyEntry(earlyEntryMd);
const savedOfficialProspects = savedOfficialProspectsJson.prospects ?? [];
const localPool = localPlayerPoolJson.prospects ?? [];
const localFeaturePlayers = localFeatureReferenceJson.players ?? [];

const anthroByMeasurement = new Map();
for (const row of statsAnthroRows) {
  const key = measurementKeyFromAnthro(row);
  if (!key) continue;
  if (!anthroByMeasurement.has(key)) anthroByMeasurement.set(key, []);
  anthroByMeasurement.get(key).push(row);
}

const localMeasured = localFeaturePlayers.filter((player) => measurementKeyFromLocal(player));
const localMeasurementKeyCounts = new Map();
for (const player of localMeasured) {
  const key = measurementKeyFromLocal(player);
  if (!localMeasurementKeyCounts.has(key)) localMeasurementKeyCounts.set(key, []);
  localMeasurementKeyCounts.get(key).push({ poolOrdinal: player.poolOrdinal, nameZh: player.nameZh });
}
const localMeasurementKeys = new Set(localMeasurementKeyCounts.keys());
const statsAnthroCompleteMeasurementRows = statsAnthroRows.filter((row) => measurementKeyFromAnthro(row));
const statsAnthroMeasurementKeys = new Set(statsAnthroCompleteMeasurementRows.map((row) => measurementKeyFromAnthro(row)));
const measurementBridge = localMeasured.map((player) => {
  const key = measurementKeyFromLocal(player);
  const matches = anthroByMeasurement.get(key) ?? [];
  return {
    poolOrdinal: player.poolOrdinal,
    nameZh: player.nameZh,
    measurementKey: key,
    matchCount: matches.length,
    matchedOnlineNames: matches.map((row) => row.name),
  };
});
const matchedLocalMeasured = measurementBridge.filter((entry) => entry.matchCount === 1);
const unmatchedLocalMeasured = measurementBridge.filter((entry) => entry.matchCount === 0);
const ambiguousLocalMeasured = measurementBridge.filter((entry) => entry.matchCount > 1);
const matchedAnthroKeys = new Set(matchedLocalMeasured.map((entry) => entry.measurementKey));
const unmatchedAnthroRows = statsAnthroRows.filter((row) => {
  const key = measurementKeyFromAnthro(row);
  return key && !matchedAnthroKeys.has(key);
});

const chinaTopThreeLocalCoverage = chinaDraftRows
  .filter((row) => row.pick <= 3)
  .map((row) => ({
    pick: row.pick,
    playerNameZh: row.playerNameZh,
    foundInLocalPool: localPool.some((player) => normalizeZhName(player.nameZh) === normalizeZhName(row.playerNameZh)),
  }));

const statsSummaryUniqueNames = [
  ...new Set(
    [...statsCombineMd.matchAll(/\[([^\]]+)\]\(https:\/\/www\.nba\.com\/stats\/player\/\d+\/\)/g)]
      .map((match) => stripMarkdown(match[1]))
      .filter(Boolean),
  ),
].sort((a, b) => a.localeCompare(b));

const validation = {
  nbaProspects: {
    currentRowCount: onlineProspects.length,
    savedRowCount: savedOfficialProspects.length,
    duplicateNames: duplicateValues(onlineProspects, (item) => canonicalNameKey(item.name)),
    missingRequiredFieldRows: onlineProspects
      .filter((item) => !item.name || !item.profileUrl || !item.position || !item.schoolClub)
      .map((item) => item.ordinal),
    addedVsSaved: differenceByName(onlineProspects, savedOfficialProspects),
    removedVsSaved: differenceByName(savedOfficialProspects, onlineProspects),
  },
  chinaDraft: {
    rowCount: chinaDraftRows.length,
    populatedPickCount: chinaDraftRows.filter((row) => row.populated).length,
    top30PopulatedPickCount: chinaDraftRows.filter((row) => row.pick <= 30 && row.populated).length,
    emptyTop30Picks: chinaDraftRows.filter((row) => row.pick <= 30 && !row.populated).map((row) => row.pick),
    populatedPicks: chinaDraftRows.filter((row) => row.populated),
    topThreeLocalCoverage: chinaTopThreeLocalCoverage,
  },
  combineInvite: {
    rowCount: combineInvitees.length,
    duplicateNames: duplicateValues(combineInvitees, (item) => canonicalNameKey(item.name)),
  },
  statsAnthro: {
    rowCount: statsAnthroRows.length,
    duplicateNames: duplicateValues(statsAnthroRows, (item) => canonicalNameKey(item.name)),
    missingMeasurementRows: statsAnthroRows
      .filter((row) => !measurementKeyFromAnthro(row))
      .map((row) => ({ ordinal: row.ordinal, name: row.name })),
  },
  statsCombineSummary: {
    uniqueLinkedPlayerCount: statsSummaryUniqueNames.length,
  },
  earlyEntry: {
    rowCount: earlyEntryCandidates.length,
    nonInternationalCount: earlyEntryCandidates.filter((entry) => entry.category === "nonInternationalCollege").length,
    internationalCount: earlyEntryCandidates.filter((entry) => entry.category === "international").length,
  },
  localPlayerPool: {
    rowCount: localPool.length,
    duplicateNames: localPlayerPoolJson.validation?.duplicateNames ?? duplicateValues(localPool, (item) => normalizeZhName(item.nameZh)),
    firstOrdinal: localPlayerPoolJson.validation?.firstOrdinal,
    lastOrdinal: localPlayerPoolJson.validation?.lastOrdinal,
    missingOrdinalCount: localPlayerPoolJson.validation?.missingOrdinalCount,
  },
  crossSource: {
    combineInviteNotInStatsAnthro: differenceByName(combineInvitees, statsAnthroRows),
    statsAnthroNotInCombineInvite: differenceByName(statsAnthroRows, combineInvitees),
    earlyEntryNotInProspects: differenceByName(earlyEntryCandidates, onlineProspects),
    prospectsNotInEarlyEntry: differenceByName(onlineProspects, earlyEntryCandidates),
    localFeatureToStatsAnthroByMeasurements: {
      localMeasuredCount: localMeasured.length,
      localDistinctMeasurementKeyCount: localMeasurementKeys.size,
      statsAnthroRowCount: statsAnthroRows.length,
      statsAnthroCompleteMeasurementRowCount: statsAnthroCompleteMeasurementRows.length,
      statsAnthroDistinctMeasurementKeyCount: statsAnthroMeasurementKeys.size,
      statsAnthroCompleteRowsCoveredByLocal: statsAnthroCompleteMeasurementRows.filter((row) =>
        localMeasurementKeys.has(measurementKeyFromAnthro(row)),
      ).length,
      exactSingleMatches: matchedLocalMeasured.length,
      ambiguousMatches: ambiguousLocalMeasured.length,
      duplicateLocalMeasurementKeys: [...localMeasurementKeyCounts.entries()]
        .filter(([, players]) => players.length > 1)
        .map(([measurementKey, players]) => ({ measurementKey, players })),
      unmatchedLocalMeasured: unmatchedLocalMeasured.map(({ poolOrdinal, nameZh }) => ({ poolOrdinal, nameZh })),
      unmatchedStatsAnthro: unmatchedAnthroRows.map(({ ordinal, name }) => ({ ordinal, name })),
    },
  },
};

const output = {
  schemaVersion: "draftops.online_player_list_reverification.v1",
  generatedAt,
  scope:
    "Live online re-verification of 2026 NBA player-list sources against the local 124-player answer-card pool. Raw local data is not modified.",
  sources,
  validation,
  lists: {
    nbaProspects: onlineProspects,
    chinaDraftBoard: chinaDraftRows,
    combineInvitees,
    statsAnthro: statsAnthroRows,
    earlyEntryCandidates,
    statsCombineSummaryUniqueLinkedNames: statsSummaryUniqueNames,
    localPlayerPool: localPool,
  },
};

await mkdir(dirname(resolve(rootDir, outJsonPath)), { recursive: true });
await writeFile(resolve(rootDir, outJsonPath), `${JSON.stringify(output, null, 2)}\n`, "utf8");

const rows = [
  ["来源", "本次核验数量", "结论"],
  ["NBA.com Prospects", String(validation.nbaProspects.currentRowCount), "官方 Prospects 线上表；与本地保存的 101 行快照对比"],
  ["NBA 中国选秀页", `${validation.chinaDraft.populatedPickCount}/${validation.chinaDraft.rowCount} 个顺位已填球员`, "当前只验证到前三顺位球员字段"],
  ["NBA.com Combine 邀请文章", String(validation.combineInvite.rowCount), "官方 73 人邀请口径"],
  ["NBA Stats Combine Anthro", String(validation.statsAnthro.rowCount), "官方 Stats 体测表口径"],
  ["NBA.com Early-entry", String(validation.earlyEntry.rowCount), "早参报名口径，不等同最终 Prospects"],
  ["本地答题卡球员池", String(validation.localPlayerPool.rowCount), "比赛模板口径，仍是本地完整 124 人池"],
];

const report = `# 联网核验完整球员名单（2026-06-23）

## 结论

- 本地答题卡里的完整球员池仍是 **124 人**；这是比赛模板 \`球员池_勿修改\` 的口径，不应被线上 NBA.com Prospects 的 101 人表覆盖。
- NBA.com 当前官方 Prospects 页解析出 **101 人**，与本地已保存的 \`normalized_2026_official_prospects_101.json\` 对比：新增 **${validation.nbaProspects.addedVsSaved.length}**、移除 **${validation.nbaProspects.removedVsSaved.length}**、重复名 **${validation.nbaProspects.duplicateNames.length}**。
- NBA 中国选秀页当前有 **60 个顺位行**，但球员字段只填了 **${validation.chinaDraft.populatedPickCount} 个**；在用户要求“只用预测前三十”的范围里，1-30 顺位目前只有 **${validation.chinaDraft.top30PopulatedPickCount} 个**可用官方结果，空缺顺位为：${validation.chinaDraft.emptyTop30Picks.join(", ")}。
- Combine 口径需要拆开看：邀请文章是 **${validation.combineInvite.rowCount} 人**，Stats Anthro 体测表是 **${validation.statsAnthro.rowCount} 行**，Early-entry 报名是 **${validation.earlyEntry.rowCount} 人**。这些都不是 124 人池的替代品，而是不同阶段/数据表的官方子集或相关口径。
- 本地 124 人特征表里有 **${validation.crossSource.localFeatureToStatsAnthroByMeasurements.localMeasuredCount} 行**带完整体测组合，其中 **${validation.crossSource.localFeatureToStatsAnthroByMeasurements.localDistinctMeasurementKeyCount} 组**为去重后的组合；NBA Stats Anthro 78 行中有 **${validation.crossSource.localFeatureToStatsAnthroByMeasurements.statsAnthroCompleteMeasurementRowCount} 行**可做完整组合比对，已被本地组合覆盖 **${validation.crossSource.localFeatureToStatsAnthroByMeasurements.statsAnthroCompleteRowsCoveredByLocal} 行**。Stats Anthro 缺完整组合的行：${listPreview(validation.statsAnthro.missingMeasurementRows.map((row) => row.name))}。

## 数量核验

${markdownTable(rows)}

## NBA 中国前三顺位核验

${markdownTable([
  ["顺位", "NBA 中国球员", "本地 124 人池是否存在", "选秀当天交易字段"],
  ...validation.chinaDraft.populatedPicks.map((row) => [
    String(row.pick),
    row.playerNameZh,
    chinaTopThreeLocalCoverage.find((item) => item.pick === row.pick)?.foundInLocalPool ? "是" : "否",
    row.draftDayTradeTo || "空",
  ]),
])}

## 跨来源差异

- Combine 邀请名单中未在 Stats Anthro 精确同名/别名匹配到：${listPreview(validation.crossSource.combineInviteNotInStatsAnthro)}
- Stats Anthro 中未在 Combine 邀请名单精确同名/别名匹配到：${listPreview(validation.crossSource.statsAnthroNotInCombineInvite)}
- Early-entry 中未进入当前 Prospects 页：${listPreview(validation.crossSource.earlyEntryNotInProspects)}
- Prospects 页中不属于 Early-entry 报名名单的主要原因通常是自动参选高年级、G League、国际、或其他非 early-entry 口径；未匹配数量：${validation.crossSource.prospectsNotInEarlyEntry.length}

## 本地 124 人池完整性

- 本地行数：${validation.localPlayerPool.rowCount}
- 序号范围：${validation.localPlayerPool.firstOrdinal}-${validation.localPlayerPool.lastOrdinal}
- 缺失序号数：${validation.localPlayerPool.missingOrdinalCount}
- 重复姓名：${listPreview(validation.localPlayerPool.duplicateNames)}

## 本次快照

${markdownTable([
  ["来源", "URL / 本地路径", "SHA-256"],
  ...Object.values(sources).map((source) => [
    source.label,
    source.url ?? source.path,
    source.sha256,
  ]),
])}

## 输出

- 结构化核验结果：\`${outJsonPath}\`
- 本报告：\`${outReportPath}\`
`;

await mkdir(dirname(resolve(rootDir, outReportPath)), { recursive: true });
await writeFile(resolve(rootDir, outReportPath), report, "utf8");

console.log(JSON.stringify({
  generatedAt,
  outJsonPath,
  outReportPath,
  counts: {
    nbaProspects: onlineProspects.length,
    chinaDraftRows: chinaDraftRows.length,
    chinaPopulatedPicks: validation.chinaDraft.populatedPickCount,
    combineInvitees: combineInvitees.length,
    statsAnthroRows: statsAnthroRows.length,
    earlyEntryCandidates: earlyEntryCandidates.length,
    localPlayerPool: localPool.length,
  },
  deltas: {
    nbaProspectsAddedVsSaved: validation.nbaProspects.addedVsSaved.length,
    nbaProspectsRemovedVsSaved: validation.nbaProspects.removedVsSaved.length,
    localFeatureExactAnthroMatches: matchedLocalMeasured.length,
  },
}, null, 2));
