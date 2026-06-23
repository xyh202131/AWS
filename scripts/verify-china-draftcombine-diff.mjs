import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rootDir } from "./lib/draftops-manifest.mjs";

const generatedAt = new Date().toISOString();
const runStamp = "20260624";

const rawDir = `data/raw/china_nba_draftcombine_${runStamp}`;
const sourceFiles = {
  page: {
    label: "NBA China Draft Combine page",
    url: "https://china.nba.cn/statistics/draftcombine",
    localHtmlPath: ".firecrawl/china-nba-local-draftcombine-20260624.html",
    firecrawlAttemptPath: ".firecrawl/china-nba-draftcombine-20260624.json",
  },
  bundle: {
    label: "NBA China Vue bundle exposing static JSON endpoints",
    url: "https://res.nba.cn/static/webmaster/assets/js/index-e2ff8c41.js",
    path: ".firecrawl/china-index-e2ff8c41.js",
  },
  candidates: {
    label: "NBA China Draft Combine candidates",
    url: "https://res.nba.cn/static/data/draft_combine/candidates.json",
    path: `${rawDir}/candidates.json`,
  },
  anthropometric: {
    label: "NBA China Draft Combine anthropometric data",
    url: "https://res.nba.cn/static/data/draft_combine/anthro.json",
    path: `${rawDir}/anthro.json`,
    seasonKey: "26-27",
  },
  strengthAgility: {
    label: "NBA China Draft Combine strength and agility data",
    url: "https://res.nba.cn/static/data/draft_combine/strength%26agility.json",
    path: `${rawDir}/strength&agility.json`,
    seasonKey: "2026-27",
  },
  shooting: {
    label: "NBA China Draft Combine shooting drills",
    url: "https://res.nba.cn/static/data/draft_combine/shooting_drills.json",
    path: `${rawDir}/shooting_drills.json`,
    seasonKey: "2026",
  },
  localFeatureReference: {
    label: "DraftOps local 124-player feature reference",
    path: "data/normalized/normalized_2026_player_feature_reference_124.json",
  },
};

const outNormalizedPath = `data/normalized/normalized_china_nba_draftcombine_${runStamp}.json`;
const outDiffJsonPath = `data/reports/china_draftcombine_data_diff_${runStamp}.json`;
const outDiffReportPath = `data/reports/china_draftcombine_data_diff_${runStamp}.md`;

const readText = async (relativePath) => readFile(resolve(rootDir, relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));

async function sha256(relativePath) {
  const bytes = await readFile(resolve(rootDir, relativePath));
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function normalizeZhName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[\\_\s·.。,\-]/g, "")
    .trim();
}

const zhAliasTargets = new Map([
  [normalizeZhName("内特 阿门特"), normalizeZhName("纳撒尼尔 阿门特")],
]);

function nameKey(name) {
  const key = normalizeZhName(name);
  return zhAliasTargets.get(key) ?? key;
}

function isMissing(value) {
  if (value === null || value === undefined) return true;
  const text = String(value).trim();
  return text === "" || text === "-" || text === "-%" || /^n\/a$/i.test(text);
}

function cleanText(value) {
  return isMissing(value) ? null : String(value).trim();
}

function parseNumber(value) {
  if (isMissing(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const numeric = Number(String(value).replace("%", "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseHeightInches(value) {
  if (isMissing(value)) return null;
  const text = String(value).replace(/[’]/g, "'").trim();
  const match = text.match(/(\d+)\s*'\s*([0-9.]+)?/);
  if (!match) return null;
  const feet = Number(match[1]);
  const inches = Number(match[2] ?? 0);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  return feet * 12 + inches;
}

function pct(made, attempts) {
  if (!Number.isFinite(made) || !Number.isFinite(attempts) || attempts === 0) return null;
  return round((made / attempts) * 100, 1);
}

function component(row, madeKey, attemptsKey) {
  const made = parseNumber(row[madeKey]);
  const attempts = parseNumber(row[attemptsKey]);
  return {
    made,
    attempts,
    pct: pct(made, attempts),
  };
}

function normalizeCandidate(row) {
  return {
    nameZh: cleanText(row.name),
    positionZh: cleanText(row.postion ?? row.position),
    age: parseNumber(row.age),
    schoolClubZh: cleanText(row.school),
    gradeZh: cleanText(row.grade),
    countryRegionZh: cleanText(row.country),
  };
}

function normalizeAnthro(row) {
  return {
    nameZh: cleanText(row.player_name_cn),
    positionCode: cleanText(row.pos),
    bodyFatPct: parseNumber(row.body_fat_pct),
    handLengthIn: parseNumber(row.hand_length),
    handWidthIn: parseNumber(row.hand_width),
    barefootHeightText: cleanText(row.height_wo_shoes),
    barefootHeightIn: parseHeightInches(row.height_wo_shoes),
    heightWithShoesText: cleanText(row.height_w_shoes),
    heightWithShoesIn: parseHeightInches(row.height_w_shoes),
    standingReachText: cleanText(row.standing_reach),
    standingReachIn: parseHeightInches(row.standing_reach),
    weightLbs: parseNumber(row.weight_lbs),
    wingspanText: cleanText(row.wingspan),
    wingspanIn: parseHeightInches(row.wingspan),
  };
}

function normalizeStrength(row) {
  return {
    nameZh: cleanText(row.player_name_cn),
    positionCode: cleanText(row.pos),
    laneAgilitySec: parseNumber(row.lane_agility_time),
    shuttleRunSec: parseNumber(row.shuttle_run),
    sprintSec: parseNumber(row.three_quarter_sprint),
    noStepVerticalIn: parseNumber(row.standing_vertical_leap),
    maxVerticalIn: parseNumber(row.max_vertical_leap),
    benchPressReps: parseNumber(row.max_bench_press),
  };
}

function normalizeShooting(row) {
  const components = {
    offDribble: component(row, "off_dribble_fgm", "off_dribble_fga"),
    spotUp: component(row, "spot_up_fgm", "spot_up_fga"),
    stationaryThree: component(row, "3pt_star_fgm", "3pt_star_fga"),
    stationaryMidrange: component(row, "midrange_star_fgm", "midrange_star_fga"),
    wingThree: component(row, "3pt_side_fgm", "3pt_side_fga"),
    wingMidrange: component(row, "midrange_side_fgm", "midrange_side_fga"),
    freeThrow: component(row, "freethrow_fgm", "freethrow_fga"),
  };
  const totals = Object.values(components).reduce(
    (acc, item) => {
      if (Number.isFinite(item.made) && Number.isFinite(item.attempts)) {
        acc.made += item.made;
        acc.attempts += item.attempts;
      }
      return acc;
    },
    { made: 0, attempts: 0 },
  );
  const threeMade = (components.stationaryThree.made ?? 0) + (components.wingThree.made ?? 0);
  const threeAttempts = (components.stationaryThree.attempts ?? 0) + (components.wingThree.attempts ?? 0);

  return {
    nameZh: cleanText(row.player_name_cn),
    positionCode: cleanText(row.pos),
    components,
    totalMade: totals.attempts > 0 ? totals.made : null,
    totalAttempts: totals.attempts > 0 ? totals.attempts : null,
    aggregatePct: pct(totals.made, totals.attempts),
    threeMade: threeAttempts > 0 ? threeMade : null,
    threeAttempts: threeAttempts > 0 ? threeAttempts : null,
    threePct: pct(threeMade, threeAttempts),
  };
}

function indexByName(rows, nameFn = (row) => row.nameZh) {
  const index = new Map();
  for (const row of rows) {
    const key = nameKey(nameFn(row));
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  }
  return index;
}

function pickDisplayName(key, ...indexes) {
  for (const index of indexes) {
    const row = index.get(key)?.[0];
    if (row?.nameZh) return row.nameZh;
  }
  return key;
}

function getPath(object, path) {
  return path.split(".").reduce((cursor, part) => cursor?.[part], object);
}

function compareValue(localValue, sourceValue, tolerance = 0.01) {
  const localMissing = localValue === null || localValue === undefined;
  const sourceMissing = sourceValue === null || sourceValue === undefined;
  if (localMissing && sourceMissing) return { matches: true };
  if (localMissing !== sourceMissing) return { matches: false };
  if (typeof localValue === "number" || typeof sourceValue === "number") {
    const localNumber = Number(localValue);
    const sourceNumber = Number(sourceValue);
    if (!Number.isFinite(localNumber) || !Number.isFinite(sourceNumber)) {
      return { matches: String(localValue) === String(sourceValue) };
    }
    return { matches: Math.abs(localNumber - sourceNumber) <= tolerance, delta: round(localNumber - sourceNumber, 3) };
  }
  return { matches: String(localValue) === String(sourceValue) };
}

function diffFields(dataset, localPlayer, sourceRow, fields) {
  const differences = [];
  for (const field of fields) {
    const localValue = field.local(localPlayer);
    const sourceValue = field.source(sourceRow);
    const result = compareValue(localValue, sourceValue, field.tolerance ?? 0.01);
    if (!result.matches) {
      differences.push({
        dataset,
        field: field.label,
        localValue,
        sourceValue,
        delta: result.delta ?? null,
      });
    }
  }
  return differences;
}

function compareDataset({ dataset, localPlayer, sourceRows, fields }) {
  if (!sourceRows?.length) {
    return {
      dataset,
      status: "source-missing",
      differences: [],
      sourceDuplicateCount: 0,
      matchedSourceRowIndex: null,
    };
  }
  const candidates = sourceRows.map((sourceRow, index) => ({
    index,
    sourceRow,
    differences: diffFields(dataset, localPlayer, sourceRow, fields),
  }));
  candidates.sort((a, b) => a.differences.length - b.differences.length || a.index - b.index);
  const best = candidates[0];
  return {
    dataset,
    status: best.differences.length ? "different" : "matched",
    differences: best.differences,
    sourceDuplicateCount: sourceRows.length,
    matchedSourceRowIndex: best.index,
    sourceMatchStrategy: sourceRows.length > 1 ? "best-field-match" : "single-source-row",
  };
}

function duplicateEntries(index) {
  return [...index.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      key,
      names: [...new Set(rows.map((row) => row.nameZh).filter(Boolean))],
      poolOrdinals: rows.map((row) => row.poolOrdinal).filter(Boolean),
      count: rows.length,
    }));
}

function markdownTable(rows) {
  if (!rows.length) return "";
  const [header, ...body] = rows;
  const separator = header.map(() => "---");
  return [header, separator, ...body].map((row) => `| ${row.map((cell) => String(cell ?? "")).join(" | ")} |`).join("\n");
}

function listPreview(items, limit = 20) {
  if (!items.length) return "无";
  const values = items.map(String);
  const head = values.slice(0, limit).join("、");
  return values.length > limit ? `${head} 等 ${values.length} 项` : head;
}

function summarizeDataset(name, sourceIndex, comparedPlayers, perPlayer) {
  const statusItems = perPlayer.map((entry) => entry.comparisons[name]);
  const differences = statusItems.flatMap((item) => item.differences);
  const mismatchByField = new Map();
  for (const difference of differences) {
    mismatchByField.set(difference.field, (mismatchByField.get(difference.field) ?? 0) + 1);
  }
  const sourceKeys = new Set(sourceIndex.keys());
  const localKeys = new Set(comparedPlayers.map((player) => player.nameKey));
  const sourceOnly = [...sourceKeys].filter((key) => !localKeys.has(key)).map((key) => pickDisplayName(key, sourceIndex));
  const localOnly = [...localKeys].filter((key) => !sourceKeys.has(key)).map((key) => comparedPlayers.find((player) => player.nameKey === key)?.nameZh);

  return {
    sourceRows: [...sourceIndex.values()].reduce((count, rows) => count + rows.length, 0),
    sourceUniquePlayers: sourceIndex.size,
    comparedUniqueLocalPlayers: comparedPlayers.length,
    matchedPlayers: statusItems.filter((item) => item.status === "matched" || item.status === "different").length,
    exactMatchedPlayers: statusItems.filter((item) => item.status === "matched").length,
    playersWithDifferences: statusItems.filter((item) => item.status === "different").length,
    sourceMissingPlayers: statusItems.filter((item) => item.status === "source-missing").length,
    fieldDifferences: differences.length,
    mismatchByField: Object.fromEntries([...mismatchByField.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    sourceOnly,
    localOnly,
  };
}

const [
  candidatesRaw,
  anthroRawBySeason,
  strengthRawBySeason,
  shootingRawBySeason,
  localFeatureReference,
] = await Promise.all([
  readJson(sourceFiles.candidates.path),
  readJson(sourceFiles.anthropometric.path),
  readJson(sourceFiles.strengthAgility.path),
  readJson(sourceFiles.shooting.path),
  readJson(sourceFiles.localFeatureReference.path),
]);

const candidates = candidatesRaw.map(normalizeCandidate);
const anthroRows = (anthroRawBySeason[sourceFiles.anthropometric.seasonKey] ?? []).map(normalizeAnthro);
const strengthRows = (strengthRawBySeason[sourceFiles.strengthAgility.seasonKey] ?? []).map(normalizeStrength);
const shootingRows = (shootingRawBySeason[sourceFiles.shooting.seasonKey] ?? []).map(normalizeShooting);
const localPlayers = localFeatureReference.players ?? [];

const candidateIndex = indexByName(candidates);
const anthroIndex = indexByName(anthroRows);
const strengthIndex = indexByName(strengthRows);
const shootingIndex = indexByName(shootingRows);
const localIndex = indexByName(localPlayers);
const uniqueLocalPlayers = [...localIndex.entries()].map(([key, rows]) => ({ ...rows[0], nameKey: key, duplicateLocalCount: rows.length }));

const allSourceKeys = new Set([
  ...candidateIndex.keys(),
  ...anthroIndex.keys(),
  ...strengthIndex.keys(),
  ...shootingIndex.keys(),
]);

const normalizedSourcePlayers = [...allSourceKeys]
  .sort((a, b) => pickDisplayName(a, candidateIndex, anthroIndex, strengthIndex, shootingIndex).localeCompare(
    pickDisplayName(b, candidateIndex, anthroIndex, strengthIndex, shootingIndex),
    "zh-Hans-CN",
  ))
  .map((key) => ({
    nameKey: key,
    nameZh: pickDisplayName(key, candidateIndex, anthroIndex, strengthIndex, shootingIndex),
    candidateProfile: candidateIndex.get(key)?.[0] ?? null,
    candidateProfiles: candidateIndex.get(key) ?? [],
    measurements: anthroIndex.get(key)?.[0] ?? null,
    measurementRows: anthroIndex.get(key) ?? [],
    athleticAgility: strengthIndex.get(key)?.[0] ?? null,
    athleticAgilityRows: strengthIndex.get(key) ?? [],
    shootingDrill: shootingIndex.get(key)?.[0] ?? null,
    shootingDrillRows: shootingIndex.get(key) ?? [],
    sourcePresence: {
      candidates: candidateIndex.has(key),
      anthropometric: anthroIndex.has(key),
      strengthAgility: strengthIndex.has(key),
      shooting: shootingIndex.has(key),
    },
  }));

const comparisonFields = {
  anthropometric: [
    { label: "positionCode", local: (p) => getPath(p, "measurements.positionCode"), source: (r) => r.positionCode },
    { label: "bodyFatPct", local: (p) => getPath(p, "measurements.bodyFatPct"), source: (r) => r.bodyFatPct },
    { label: "handLengthIn", local: (p) => getPath(p, "measurements.handLengthIn"), source: (r) => r.handLengthIn },
    { label: "handWidthIn", local: (p) => getPath(p, "measurements.handWidthIn"), source: (r) => r.handWidthIn },
    { label: "barefootHeightIn", local: (p) => getPath(p, "measurements.barefootHeightIn"), source: (r) => r.barefootHeightIn },
    { label: "weightLbs", local: (p) => getPath(p, "measurements.weightLbs"), source: (r) => r.weightLbs },
    { label: "wingspanIn", local: (p) => getPath(p, "measurements.wingspanIn"), source: (r) => r.wingspanIn },
    { label: "standingReachIn", local: (p) => getPath(p, "measurements.standingReachIn"), source: (r) => r.standingReachIn },
  ],
  strengthAgility: [
    { label: "positionCode", local: (p) => getPath(p, "athleticAgility.positionCode"), source: (r) => r.positionCode },
    { label: "laneAgilitySec", local: (p) => getPath(p, "athleticAgility.laneAgilitySec"), source: (r) => r.laneAgilitySec },
    { label: "shuttleRunSec", local: (p) => getPath(p, "athleticAgility.shuttleRunSec"), source: (r) => r.shuttleRunSec },
    { label: "sprintSec", local: (p) => getPath(p, "athleticAgility.sprintSec"), source: (r) => r.sprintSec },
    { label: "noStepVerticalIn", local: (p) => getPath(p, "athleticAgility.noStepVerticalIn"), source: (r) => r.noStepVerticalIn },
    { label: "maxVerticalIn", local: (p) => getPath(p, "athleticAgility.maxVerticalIn"), source: (r) => r.maxVerticalIn },
    { label: "benchPressReps", local: (p) => getPath(p, "athleticAgility.benchPressReps"), source: (r) => r.benchPressReps },
  ],
  shooting: [
    { label: "positionCode", local: (p) => getPath(p, "shootingDrill.positionCode"), source: (r) => r.positionCode },
    { label: "offDribble.made", local: (p) => getPath(p, "shootingDrill.components.offDribble.made"), source: (r) => r.components.offDribble.made },
    { label: "offDribble.attempts", local: (p) => getPath(p, "shootingDrill.components.offDribble.attempts"), source: (r) => r.components.offDribble.attempts },
    { label: "spotUp.made", local: (p) => getPath(p, "shootingDrill.components.spotUp.made"), source: (r) => r.components.spotUp.made },
    { label: "spotUp.attempts", local: (p) => getPath(p, "shootingDrill.components.spotUp.attempts"), source: (r) => r.components.spotUp.attempts },
    { label: "stationaryThree.made", local: (p) => getPath(p, "shootingDrill.components.stationaryThree.made"), source: (r) => r.components.stationaryThree.made },
    { label: "stationaryThree.attempts", local: (p) => getPath(p, "shootingDrill.components.stationaryThree.attempts"), source: (r) => r.components.stationaryThree.attempts },
    { label: "stationaryMidrange.made", local: (p) => getPath(p, "shootingDrill.components.stationaryMidrange.made"), source: (r) => r.components.stationaryMidrange.made },
    { label: "stationaryMidrange.attempts", local: (p) => getPath(p, "shootingDrill.components.stationaryMidrange.attempts"), source: (r) => r.components.stationaryMidrange.attempts },
    { label: "wingThree.made", local: (p) => getPath(p, "shootingDrill.components.wingThree.made"), source: (r) => r.components.wingThree.made },
    { label: "wingThree.attempts", local: (p) => getPath(p, "shootingDrill.components.wingThree.attempts"), source: (r) => r.components.wingThree.attempts },
    { label: "wingMidrange.made", local: (p) => getPath(p, "shootingDrill.components.wingMidrange.made"), source: (r) => r.components.wingMidrange.made },
    { label: "wingMidrange.attempts", local: (p) => getPath(p, "shootingDrill.components.wingMidrange.attempts"), source: (r) => r.components.wingMidrange.attempts },
    { label: "freeThrow.made", local: (p) => getPath(p, "shootingDrill.components.freeThrow.made"), source: (r) => r.components.freeThrow.made },
    { label: "freeThrow.attempts", local: (p) => getPath(p, "shootingDrill.components.freeThrow.attempts"), source: (r) => r.components.freeThrow.attempts },
    { label: "totalMade", local: (p) => getPath(p, "shootingDrill.totalMade"), source: (r) => r.totalMade },
    { label: "totalAttempts", local: (p) => getPath(p, "shootingDrill.totalAttempts"), source: (r) => r.totalAttempts },
    { label: "aggregatePct", local: (p) => getPath(p, "shootingDrill.aggregatePct"), source: (r) => r.aggregatePct, tolerance: 0.05 },
    { label: "threeMade", local: (p) => getPath(p, "shootingDrill.threeMade"), source: (r) => r.threeMade },
    { label: "threeAttempts", local: (p) => getPath(p, "shootingDrill.threeAttempts"), source: (r) => r.threeAttempts },
    { label: "threePct", local: (p) => getPath(p, "shootingDrill.threePct"), source: (r) => r.threePct, tolerance: 0.05 },
  ],
};

const perPlayerComparisons = uniqueLocalPlayers
  .sort((a, b) => a.poolOrdinal - b.poolOrdinal)
  .map((player) => {
    const key = player.nameKey;
    const comparisons = {
      anthropometric: compareDataset({
        dataset: "anthropometric",
        localPlayer: player,
        sourceRows: anthroIndex.get(key) ?? [],
        fields: comparisonFields.anthropometric,
      }),
      strengthAgility: compareDataset({
        dataset: "strengthAgility",
        localPlayer: player,
        sourceRows: strengthIndex.get(key) ?? [],
        fields: comparisonFields.strengthAgility,
      }),
      shooting: compareDataset({
        dataset: "shooting",
        localPlayer: player,
        sourceRows: shootingIndex.get(key) ?? [],
        fields: comparisonFields.shooting,
      }),
    };
    return {
      poolOrdinal: player.poolOrdinal,
      nameKey: key,
      nameZh: player.nameZh,
      duplicateLocalCount: player.duplicateLocalCount,
      sourcePresence: {
        candidates: candidateIndex.has(key),
        anthropometric: anthroIndex.has(key),
        strengthAgility: strengthIndex.has(key),
        shooting: shootingIndex.has(key),
      },
      comparisons,
    };
  });

const allDifferences = perPlayerComparisons.flatMap((entry) =>
  Object.values(entry.comparisons).flatMap((comparison) =>
    comparison.differences.map((difference) => ({
      poolOrdinal: entry.poolOrdinal,
      nameZh: entry.nameZh,
      ...difference,
    })),
  ),
);

const localKeys = new Set(localIndex.keys());
const candidateKeys = new Set(candidateIndex.keys());
const localNotCandidates = [...localKeys]
  .filter((key) => !candidateKeys.has(key))
  .map((key) => pickDisplayName(key, localIndex));
const candidatesNotLocal = [...candidateKeys]
  .filter((key) => !localKeys.has(key))
  .map((key) => pickDisplayName(key, candidateIndex));

const datasetSummaries = {
  anthropometric: summarizeDataset("anthropometric", anthroIndex, uniqueLocalPlayers, perPlayerComparisons),
  strengthAgility: summarizeDataset("strengthAgility", strengthIndex, uniqueLocalPlayers, perPlayerComparisons),
  shooting: summarizeDataset("shooting", shootingIndex, uniqueLocalPlayers, perPlayerComparisons),
};

const summary = {
  localRows: localPlayers.length,
  localUniquePlayers: localIndex.size,
  normalizedSourceUniquePlayers: normalizedSourcePlayers.length,
  sourceRows: {
    candidates: candidates.length,
    anthropometric: anthroRows.length,
    strengthAgility: strengthRows.length,
    shooting: shootingRows.length,
  },
  candidateCoverage: {
    localUniquePlayersNotInCandidates: localNotCandidates.length,
    candidatesNotInLocalUniquePlayers: candidatesNotLocal.length,
    localNotCandidates,
    candidatesNotLocal,
  },
  duplicateLocalNames: duplicateEntries(localIndex),
  duplicateSourceNames: {
    candidates: duplicateEntries(candidateIndex),
    anthropometric: duplicateEntries(anthroIndex),
    strengthAgility: duplicateEntries(strengthIndex),
    shooting: duplicateEntries(shootingIndex),
  },
  datasetSummaries,
  fieldDifferences: allDifferences.length,
};

const sourceManifest = {};
for (const [key, info] of Object.entries(sourceFiles)) {
  const path = info.path ?? info.localHtmlPath;
  sourceManifest[key] = {
    ...info,
    sha256: path ? await sha256(path) : null,
  };
}

const normalizedOutput = {
  schemaVersion: "draftops.china_nba_draftcombine_normalized.v1",
  generatedAt,
  scope: "Normalized current NBA China Draft Combine static JSON data scraped from the public page backing files.",
  sourcePage: sourceFiles.page.url,
  seasons: {
    anthropometric: sourceFiles.anthropometric.seasonKey,
    strengthAgility: sourceFiles.strengthAgility.seasonKey,
    shooting: sourceFiles.shooting.seasonKey,
  },
  summary: {
    sourceRows: summary.sourceRows,
    normalizedSourceUniquePlayers: normalizedSourcePlayers.length,
  },
  sources: sourceManifest,
  players: normalizedSourcePlayers,
};

const diffOutput = {
  schemaVersion: "draftops.china_nba_draftcombine_diff.v1",
  generatedAt,
  scope: "Field-level verification of current NBA China Draft Combine data against DraftOps local 124-player feature reference. Local data is not modified.",
  scrapedSource: sourceFiles.page.url,
  note: "Firecrawl proxy fetch returned a blocked 404 response, so the page was fetched locally and its static JSON endpoints from the Vue bundle were used.",
  seasons: normalizedOutput.seasons,
  sources: sourceManifest,
  summary,
  differences: allDifferences,
  perPlayerComparisons,
};

await mkdir(dirname(resolve(rootDir, outNormalizedPath)), { recursive: true });
await mkdir(dirname(resolve(rootDir, outDiffJsonPath)), { recursive: true });
await writeFile(resolve(rootDir, outNormalizedPath), `${JSON.stringify(normalizedOutput, null, 2)}\n`, "utf8");
await writeFile(resolve(rootDir, outDiffJsonPath), `${JSON.stringify(diffOutput, null, 2)}\n`, "utf8");

const sourceRowsTable = [
  ["数据表", "中国站当前行数", "赛季键", "说明"],
  ["候选名单", summary.sourceRows.candidates, "-", "页面 candidates.json"],
  ["人体测量", summary.sourceRows.anthropometric, sourceFiles.anthropometric.seasonKey, "身高、臂展、站立摸高、体重、手长/手宽、体脂"],
  ["力量敏捷", summary.sourceRows.strengthAgility, sourceFiles.strengthAgility.seasonKey, "折返、敏捷、冲刺、原地/助跑弹跳、卧推"],
  ["投篮训练", summary.sourceRows.shooting, sourceFiles.shooting.seasonKey, "各投篮项目命中/出手与汇总命中率"],
  ["本地特征表", `${summary.localRows} 行 / ${summary.localUniquePlayers} 唯一名`, "-", "normalized_2026_player_feature_reference_124.json"],
];

const comparisonRows = [
  ["模块", "源站唯一球员", "本地可对齐", "完全一致", "有差异球员", "字段差异", "源站缺本地"],
  ...Object.entries(datasetSummaries).map(([name, item]) => [
    name,
    item.sourceUniquePlayers,
    item.matchedPlayers,
    item.exactMatchedPlayers,
    item.playersWithDifferences,
    item.fieldDifferences,
    item.sourceOnly.length,
  ]),
];

const duplicateSourceNotes = Object.entries(summary.duplicateSourceNames)
  .flatMap(([dataset, items]) =>
    items.map((item) => `${dataset}: ${item.names.join("/")}（${item.count} 行）`),
  );

const diffRows = allDifferences.slice(0, 50).map((item) => [
  item.nameZh,
  item.dataset,
  item.field,
  item.localValue,
  item.sourceValue,
  item.delta ?? "",
]);

const mismatchFieldRows = [
  ["模块", "字段", "差异次数"],
  ...Object.entries(datasetSummaries).flatMap(([dataset, item]) =>
    Object.entries(item.mismatchByField).map(([field, count]) => [dataset, field, count]),
  ),
];

const report = `# NBA 中国 Draft Combine 身体数据核验（${runStamp}）

## 结论

- 已从 ${sourceFiles.page.url} 背后的静态 JSON 抓取当前数据；页面壳本身是 Vue SPA，真实数据来自 \`res.nba.cn/static/data/draft_combine/\`。
- Firecrawl 代理访问该 URL 返回了 404/IP 区域拦截页；本次采用本机直连页面并解析 bundle 中的数据端点，原始文件已保存在 \`${rawDir}\`。
- 中国站当前表：候选名单 **${summary.sourceRows.candidates}** 人，人体测量 **${summary.sourceRows.anthropometric}** 行，力量敏捷 **${summary.sourceRows.strengthAgility}** 行，投篮训练 **${summary.sourceRows.shooting}** 行。
- 与本地 \`normalized_2026_player_feature_reference_124.json\` 的唯一球员名口径对齐后，三类可核验字段总差异为 **${summary.fieldDifferences}** 个。
- 本地 124 行实际是 **${summary.localUniquePlayers}** 个唯一球员名；\`${summary.duplicateLocalNames.map((item) => item.names.join("/")).join("、") || "无"}\` 为本地重复名。本次字段差异统计按唯一名计算，避免重复行放大差异。
- 名称归并：候选名单里的 \`内特 阿门特\` 按同一球员归并到本地 \`纳撒尼尔 阿门特\`；源站同名重复：${listPreview(duplicateSourceNotes)}。遇到源站同名多行时，脚本按字段最佳匹配行核验。

## 数据量

${markdownTable(sourceRowsTable)}

## 字段级核验

${markdownTable(comparisonRows)}

${summary.fieldDifferences > 0 ? `## 差异明细（前 50 条）\n\n${markdownTable([["球员", "模块", "字段", "本地值", "中国站值", "本地-源站差"], ...diffRows])}\n\n## 差异字段统计\n\n${markdownTable(mismatchFieldRows)}\n` : "## 差异明细\n\n可对齐的体测、敏捷和投篮字段未发现数值差异。\n"}
## 覆盖差异

- 候选名单不包含的本地唯一球员：${listPreview(summary.candidateCoverage.localNotCandidates)}
- 候选名单中未匹配本地唯一球员：${listPreview(summary.candidateCoverage.candidatesNotLocal)}
- 人体测量源站有、本地没有：${listPreview(datasetSummaries.anthropometric.sourceOnly)}
- 力量敏捷源站有、本地没有：${listPreview(datasetSummaries.strengthAgility.sourceOnly)}
- 投篮训练源站有、本地没有：${listPreview(datasetSummaries.shooting.sourceOnly)}

## 产物

- 规范化中国站数据：\`${outNormalizedPath}\`
- 字段差异 JSON：\`${outDiffJsonPath}\`
- 本报告：\`${outDiffReportPath}\`
`;

await writeFile(resolve(rootDir, outDiffReportPath), report, "utf8");

console.log(
  JSON.stringify(
    {
      generatedAt,
      outNormalizedPath,
      outDiffJsonPath,
      outDiffReportPath,
      sourceRows: summary.sourceRows,
      localRows: summary.localRows,
      localUniquePlayers: summary.localUniquePlayers,
      fieldDifferences: summary.fieldDifferences,
      datasetSummaries,
    },
    null,
    2,
  ),
);
