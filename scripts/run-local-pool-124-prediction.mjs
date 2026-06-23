import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = process.cwd();
const predictionPath = resolve(rootDir, "src", "lib", "prediction.ts");
const i18nPath = resolve(rootDir, "src", "lib", "i18n.ts");
const localPoolPath = resolve(rootDir, "data", "normalized", "normalized_2026_local_player_pool_124.json");
const expandedBundlePath = resolve(rootDir, "data", "final", "expanded_import_bundle.json");
const scenariosPath = resolve(rootDir, "data", "reports", "weight_scenarios.json");
const currentBoardPath = resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json");
const tempModulePath = resolve(rootDir, "node_modules", ".tmp", "prediction.local-pool-124.mjs");

const localBundlePath = resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json");
const localBoardPath = resolve(rootDir, "data", "boards", "local_pool_124_baseline_board.json");
const localReportPath = resolve(rootDir, "data", "reports", "local_pool_124_prediction_rerun_20260623.md");

const zhNameToEnglishName = {
  "乌戈纳 奥尼恩索": "Ugonna Onyenso",
  "乔舒亚 杰弗森": "Joshua Jefferson",
  "亚历克斯 卡拉班": "Alex Karaban",
  "以赛亚 尼尔森": "Izaiyah Nelson",
  "伊曼纽尔 夏普": "Emanuel Sharp",
  "基肖恩 霍尔": "Keyshawn Hall",
  "奥泰加 奥韦": "Otega Oweh",
  "尼克 博伊德": "Nick Boyd",
  "尼克 马丁内利": "Nick Martinelli",
  "巴巴 米勒": "Baba Miller",
  "布赖斯 霍普金斯": "Bryce Hopkins",
  "布雷登 史密斯": "Braden Smith",
  "布鲁斯 索顿": "Bruce Thornton",
  "彼得 祖德尔": "Peter Suder",
  "托比 拉瓦尔": "Tobi Lawal",
  "托比 阿瓦卡": "Tobe Awaka",
  "拉斐尔 卡斯特罗": "Rafael Castro",
  "杰登 布拉德利": "Jaden Bradley",
  "泰勒 尼科尔": "Tyler Nickel",
  "泰勒 比洛多": "Tyler Bilodeau",
  "特雷 考夫曼-雷恩": "Trey Kaufman-Renn",
  "特雷冯 布拉齐尔": "Trevon Brazile",
  "祖比 埃吉奥福尔": "Zuby Ejiofor",
  "米洛斯 尤赞": "Milos Uzan",
  "莱恩 康韦尔": "Ryan Conwell",
  "费利克斯 奥克帕拉": "Felix Okpara",
  "贾科比 吉莱斯皮": "Ja’Kobi Gillespie",
  "马利奇 布朗": "Maliq Brown",
  "里奇 桑德斯": "Richie Saunders",
  "阿伦 恩克鲁玛": "Aaron Nkrumah",
  "马拉奇 莫雷诺": "Malachi Moreno",
  "内特 比特尔": "Nate Bittle",
  "卡迪尔 科普兰": "Quadir Copeland",
  "塔克 德弗里斯": "Tucker DeVries",
  "塔明 利普西": "Tamin Lipsey",
  "奥斯卡 克拉夫": "Oscar Cluff",
  "威廉 凯尔": "William Kyle III",
  "小梅尔文 康斯尔": "Melvin Council Jr.",
  "小欧内斯特 乌德": "Ernest Udeh Jr.",
  "小雅龙 皮埃尔": "Jaron Pierre Jr.",
  "弗塞沃落德 伊先科": "Vsevolod Ishchenko",
  "弗莱彻 洛耶尔": "Fletcher Loyer",
  "拉马尔 威尔克森": "Lamar Wilkerson",
  "杰登 亨利": "Jaden Henley",
  "泽维安 李": "Xaivian Lee",
  "约什 迪克斯": "Josh Dix",
  "赛斯 特林布尔": "Seth Trimble",
  "达里恩 威廉姆斯": "Darrion Williams",
  "马克 米切尔": "Mark Mitchell",
  "马利克 雷诺": "Malik Reneau",
};

const schoolZhToEnglish = {
  "杨百翰大学": "BYU",
  "弗吉尼亚大学": "Virginia",
  "爱荷华州立大学": "Iowa State",
  "密歇根大学": "Michigan",
  "康涅狄格大学": "Connecticut",
  "北卡罗来纳大学": "North Carolina",
  "杜克大学": "Duke",
  "南佛罗里达大学": "South Florida",
  "休斯顿大学": "Houston",
  "德克萨斯理工大学": "Texas Tech",
  "伊利诺伊大学": "Illinois",
  "贝勒大学": "Baylor",
  "奥本大学": "Auburn",
  "肯塔基大学": "Kentucky",
  "阿拉巴马大学": "Alabama",
  "威斯康星大学": "Wisconsin",
  "西北大学": "Northwestern",
  "辛辛那提大学": "Cincinnati",
  "圣约翰大学": "St. John's",
  "亚利桑那大学": "Arizona",
  "普渡大学": "Purdue",
  "俄亥俄州立大学": "Ohio State",
  "迈阿密大学（俄亥俄州）": "Miami (Ohio)",
  "德克萨斯大学": "Texas",
  "弗吉尼亚理工大学": "Virginia Tech",
  "乔治华盛顿大学": "George Washington",
  "华盛顿大学": "Washington",
  "范德比尔特大学": "Vanderbilt",
  "阿肯色大学": "Arkansas",
  "圣塔克拉拉大学": "Santa Clara",
  "斯坦福大学": "Stanford",
  "堪萨斯大学": "Kansas",
  "路易斯维尔大学": "Louisville",
  "密苏里大学": "Missouri",
  "巴特勒大学": "Butler",
  "北卡罗来纳州立大学": "N.C. State",
  "俄勒冈大学": "Oregon",
  "雪城大学": "Syracuse",
  "南卫理公会大学": "Southern Methodist",
  "佛罗里达州立大学": "Florida State",
  "印第安纳大学": "Indiana",
  "大峡谷大学": "Grand Canyon",
  "冈萨加大学": "Gonzaga",
  "佛罗里达大学": "Florida",
  "克雷顿大学": "Creighton",
  "中佛罗里达大学": "Central Florida",
  "明尼苏达大学": "Minnesota",
  "密西西比大学": "Mississippi",
};

const countryZhToEnglish = {
  "美国": "United States",
  "尼日利亚": "Nigeria",
  "爱沙尼亚": "Estonia",
  "以色列": "Israel",
  "西班牙": "Spain",
  "英国": "England",
  "德国": "Germany",
  "意大利": "Italy",
  "澳大利亚": "Australia",
  "俄罗斯": "Russia",
  "伊朗": "Iran",
  "芬兰": "Finland",
  "塞尔维亚": "Serbia",
  "克罗地亚": "Croatia",
  "塞内加尔": "Senegal",
};

const positionZhToPositions = {
  "后卫": ["PG", "SG"],
  "前锋": ["SF", "PF"],
  "中锋": ["C"],
  PG: ["PG"],
  SG: ["SG"],
  SF: ["SF"],
  PF: ["PF"],
  C: ["C"],
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const normalizeName = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

const slugify = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseTsStringMap = (source, constName) => {
  const match = source.match(
    new RegExp(`const\\s+${constName}:\\s+Record<string, string>\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`),
  );
  if (!match) return {};
  return Object.fromEntries([...match[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((item) => [item[1], item[2]]));
};

const sourceRowQuality = (row) =>
  [row.positionZh, row.schoolClubZh, row.countryRegionZh].filter((value) => {
    const normalized = normalizeText(value);
    return normalized && normalized !== "-";
  }).length;

const buildMappingRows = (rows) => {
  const groups = new Map();
  rows.forEach((row) => {
    const key = normalizeText(row.nameZh);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  const seenNames = new Set();
  const mappingRows = [];
  const skippedDuplicateRows = [];

  rows.forEach((row) => {
    const key = normalizeText(row.nameZh);
    if (seenNames.has(key)) return;
    seenNames.add(key);

    const group = groups.get(key) ?? [row];
    if (group.length === 1) {
      mappingRows.push(row);
      return;
    }

    const [best, ...skipped] = [...group].sort(
      (left, right) => sourceRowQuality(right) - sourceRowQuality(left) || left.ordinal - right.ordinal,
    );
    mappingRows.push(best);
    skippedDuplicateRows.push(...skipped);
  });

  return { mappingRows, skippedDuplicateRows };
};

const loadPredictionModule = async () => {
  const source = await readFile(predictionPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: predictionPath,
  });

  await mkdir(dirname(tempModulePath), { recursive: true });
  await writeFile(tempModulePath, transpiled.outputText, "utf8");
  return import(`${pathToFileURL(tempModulePath).href}?t=${Date.now()}`);
};

const positionsOverlap = (left = [], right = []) => left.some((position) => right.includes(position));

const mapPositions = (positionZh) => positionZhToPositions[normalizeText(positionZh)] ?? ["SF", "PF"];

const isInternational = (row) => {
  const country = normalizeText(row.countryRegionZh);
  const school = normalizeText(row.schoolClubZh);
  return country !== "" && country !== "-" && country !== "美国" || ["法国", "德国", "意大利", "澳大利亚", "西班牙", "塞尔维亚", "俄罗斯", "伊朗", "芬兰", "克罗地亚", "塞内加尔"].includes(school);
};

const makeFallbackProfile = (positions, international) => {
  const isGuard = positions.some((position) => position === "PG" || position === "SG");
  const isCenter = positions.includes("C");

  if (isCenter) {
    return {
      shooting: international ? 58 : 55,
      creation: 52,
      defense: 70,
      athleticism: 66,
      feel: international ? 66 : 62,
      size: 82,
      upside: international ? 74 : 70,
    };
  }

  if (isGuard) {
    return {
      shooting: 67,
      creation: 67,
      defense: 62,
      athleticism: 68,
      feel: international ? 68 : 65,
      size: 61,
      upside: international ? 75 : 72,
    };
  }

  return {
    shooting: international ? 64 : 62,
    creation: 61,
    defense: 67,
    athleticism: 69,
    feel: international ? 67 : 64,
    size: 75,
    upside: international ? 76 : 73,
  };
};

const makeFallbackRoleTags = (positions, international) => {
  const tags = new Set();
  if (positions.some((position) => position === "PG" || position === "SG")) {
    tags.add("combo guard");
    tags.add("shooting");
    tags.add("secondary creation");
  }
  if (positions.some((position) => position === "SF" || position === "PF")) {
    tags.add("big wing");
    tags.add("connector");
    tags.add("defense");
  }
  if (positions.includes("C")) {
    tags.add("frontcourt");
    tags.add("rim protector");
    tags.add("rebounder");
  }
  if (international) tags.add("international");
  return [...tags];
};

const buildFallbackProspect = (row, consensusRank) => {
  const positions = mapPositions(row.positionZh);
  const international = isInternational(row);
  const school = schoolZhToEnglish[normalizeText(row.schoolClubZh)] ?? normalizeText(row.schoolClubZh);
  const origin = countryZhToEnglish[normalizeText(row.countryRegionZh)] ?? (international ? normalizeText(row.countryRegionZh) : "United States");

  return {
    id: `local-pool-124-${String(row.ordinal).padStart(3, "0")}-${slugify(row.nameZh) || "prospect"}`,
    name: row.nameZh,
    positions,
    school: school && school !== "-" ? school : "Unknown",
    origin: origin && origin !== "-" ? origin : "Unknown",
    classYear: "Unknown",
    height: "N/A",
    weight: "N/A",
    age: 22,
    consensusRank,
    mockHeat: clamp(18 - Math.max(0, consensusRank - 105) * 0.25, 8, 22),
    international,
    roleTags: makeFallbackRoleTags(positions, international),
    strengths: ["Local 124-player pool candidate", positions.includes("C") ? "Frontcourt role baseline" : "Positional baseline"],
    risks: ["Local-pool fallback profile", "No matched DraftOps scouting profile"],
    profile: makeFallbackProfile(positions, international),
    sourceNotes: [
      `Local 124-player pool row ${row.ordinal}: ${row.nameZh}, ${row.positionZh}, ${row.schoolClubZh}, ${row.countryRegionZh}.`,
      "Fallback profile generated only because this row did not match the current 101-player DraftOps/NBA.com profile pool.",
      "Consensus rank placed after matched 101-pool prospects because the local 124-player sheet is a candidate pool, not a ranking board.",
    ],
    localPool: {
      ordinal: row.ordinal,
      nameZh: row.nameZh,
      positionZh: row.positionZh,
      schoolClubZh: row.schoolClubZh,
      countryRegionZh: row.countryRegionZh,
      matchStatus: "fallback-local-only",
    },
  };
};

const cloneMatchedProspect = (prospect, row, matchMethod) => ({
  ...prospect,
  sourceNotes: [
    ...(prospect.sourceNotes ?? []),
    `Local 124-player pool match: row ${row.ordinal}, ${row.nameZh}; method=${matchMethod}.`,
  ],
  localPool: {
    ordinal: row.ordinal,
    nameZh: row.nameZh,
    positionZh: row.positionZh,
    schoolClubZh: row.schoolClubZh,
    countryRegionZh: row.countryRegionZh,
    matchStatus: "matched-current-profile",
    matchMethod,
  },
});

const findUniqueProfileMatch = (row, currentProspects) => {
  const school = schoolZhToEnglish[normalizeText(row.schoolClubZh)];
  const country = countryZhToEnglish[normalizeText(row.countryRegionZh)];
  const positions = mapPositions(row.positionZh);
  if (!school || !country) return undefined;

  const matches = currentProspects.filter(
    (prospect) =>
      normalizeText(prospect.school) === school &&
      normalizeText(prospect.origin) === country &&
      positionsOverlap(positions, prospect.positions),
  );

  return matches.length === 1 ? matches[0] : undefined;
};

const toBoardRows = (board) =>
  board.map((pick) => ({
    pick: pick.pick,
    team: pick.team,
    acquiredFrom: pick.acquiredFrom ?? null,
    player: pick.prospect.name,
    prospectId: pick.prospect.id,
    localNameZh: pick.prospect.localPool?.nameZh ?? null,
    localOrdinal: pick.prospect.localPool?.ordinal ?? null,
    school: pick.prospect.school,
    origin: pick.prospect.origin,
    position: pick.prospect.positions.join("/"),
    consensusRank: pick.prospect.consensusRank,
    score: pick.score,
    confidence: pick.confidence,
    margin: pick.margin,
    fallbackProfile: pick.prospect.risks?.includes("Local-pool fallback profile") ?? false,
    matchStatus: pick.prospect.localPool?.matchStatus ?? "unknown",
    warnings: pick.warnings,
    alternatives: pick.alternatives,
    breakdown: pick.breakdown,
  }));

const summarizeBoard = (board, currentBoard) => {
  const currentByPick = new Map((currentBoard.boardRows ?? []).map((pick) => [pick.pick, pick]));
  const rows = toBoardRows(board);
  return {
    pickCount: board.length,
    uniqueProspects: new Set(board.map((pick) => pick.prospect.id)).size,
    averageConfidence: Math.round(board.reduce((sum, pick) => sum + pick.confidence, 0) / board.length),
    averageScore: Math.round(board.reduce((sum, pick) => sum + pick.score, 0) / board.length),
    fallbackPicks: rows.filter((row) => row.fallbackProfile),
    lowConfidence: rows.filter((row) => row.confidence < 65),
    narrowMargins: rows.filter((row) => row.margin <= 1),
    changedVsCurrent101: rows
      .filter((row) => currentByPick.get(row.pick)?.prospectId !== row.prospectId)
      .map((row) => ({
        pick: row.pick,
        team: row.team,
        previous: currentByPick.get(row.pick)?.player ?? "N/A",
        next: row.player,
        nextLocalNameZh: row.localNameZh,
      })),
  };
};

const writeReport = async ({ artifact, currentBoard }) => {
  const currentRows = currentBoard.boardRows ?? [];
  const currentByPick = new Map(currentRows.map((pick) => [pick.pick, pick]));
  const rows = artifact.boardRows;
  const changedRows = rows.filter((row) => currentByPick.get(row.pick)?.prospectId !== row.prospectId);

  const lines = [
    "# Local 124-Player Pool Prediction Rerun",
    "",
    `Generated: ${artifact.generatedAt}`,
    "",
    "## Scope",
    "",
    "This run uses the competition answer-card 124-row player pool as the candidate eligibility boundary. It does not overwrite the current frontend board.",
    "",
    "The 124-row list is treated as a player pool, not as a ranking board. Matched players retain their current DraftOps/NBA.com profile and consensus rank. Local-only unmatched rows receive deterministic low-trust fallback profiles after the matched profile pool.",
    "",
    "## Candidate Pool Audit",
    "",
    `- Source rows: ${artifact.candidatePool.sourceRows}`,
    `- Unique candidate identities used for scoring: ${artifact.candidatePool.uniqueCandidates}`,
    `- Matched to current 101-profile pool: ${artifact.candidatePool.matchedCurrentProfiles}`,
    `- Local-only fallback profiles: ${artifact.candidatePool.localOnlyFallbackProfiles}`,
    `- Current 101 profiles excluded because absent from local 124 pool: ${artifact.candidatePool.current101Excluded}`,
    `- Duplicate source-name rows skipped for scoring: ${artifact.candidatePool.duplicateSourceRowsSkipped}`,
    "",
    "## Health",
    "",
    `- 30 picks: ${artifact.health.hasThirtyPicks}`,
    `- No duplicates: ${artifact.health.noDuplicates}`,
    `- Low-confidence count: ${artifact.health.lowConfidence}`,
    `- Ready: ${artifact.health.ready}`,
    "",
    "## Board",
    "",
    "| Pick | Team | Player | Local name | Rank | Confidence | Margin | Fallback |",
    "|---:|---|---|---|---:|---:|---:|---|",
    ...rows.map(
      (row) =>
        `| ${row.pick} | ${row.team} | ${row.player} | ${row.localNameZh ?? ""} | ${row.consensusRank} | ${row.confidence} | ${row.margin} | ${row.fallbackProfile} |`,
    ),
    "",
    "## Changed Vs Current 101-Pool Board",
    "",
    changedRows.length
      ? [
          "| Pick | Team | Current 101-pool board | Local 124-pool rerun |",
          "|---:|---|---|---|",
          ...changedRows.map((row) => {
            const previous = currentByPick.get(row.pick);
            return `| ${row.pick} | ${row.team} | ${previous?.player ?? "N/A"} | ${row.player} |`;
          }),
        ].join("\n")
      : "No selected-player slots changed.",
    "",
    "## Local-Only Fallback Picks In First Round",
    "",
    artifact.summary.fallbackPicks.length
      ? [
          "| Pick | Team | Player | Local name | Confidence |",
          "|---:|---|---|---|---:|",
          ...artifact.summary.fallbackPicks.map(
            (row) => `| ${row.pick} | ${row.team} | ${row.player} | ${row.localNameZh ?? ""} | ${row.confidence} |`,
          ),
        ].join("\n")
      : "None.",
    "",
    "## Notes",
    "",
    "- `纳撒尼尔 阿门特` appears twice in the source pool. The row with Tennessee/United States data is kept; the blank PF row is skipped for scoring to avoid selecting the same player twice.",
    "- This is still no-manual-override: the script performs deterministic pool matching and then calls `generateBoard` once with the baseline scenario.",
    "",
  ];

  await writeFile(localReportPath, `${lines.join("\n")}\n`, "utf8");
};

const main = async () => {
  const [{ generateBoard, getBoardHealth }, i18nSource, localPool, expandedBundle, scenariosFile, currentBoard] =
    await Promise.all([
      loadPredictionModule(),
      readFile(i18nPath, "utf8"),
      readJson(localPoolPath),
      readJson(expandedBundlePath),
      readJson(scenariosPath),
      readJson(currentBoardPath),
    ]);

  const i18nProspectZh = parseTsStringMap(i18nSource, "prospectZh");
  const reverseI18nNameMap = Object.fromEntries(
    Object.entries(i18nProspectZh).map(([english, zh]) => [normalizeText(zh), english]),
  );
  const currentProspects = expandedBundle.prospects ?? [];
  const currentByName = new Map(currentProspects.map((prospect) => [normalizeName(prospect.name), prospect]));
  const currentIds = new Set(currentProspects.map((prospect) => prospect.id));

  const usedProspectIds = new Set();
  const { mappingRows, skippedDuplicateRows } = buildMappingRows(localPool.prospects ?? []);
  const duplicateRowsSkipped = skippedDuplicateRows.map((row) => ({
    ordinal: row.ordinal,
    nameZh: row.nameZh,
    reason: "duplicate-source-name-less-complete-row",
  }));
  const unmatchedRows = [];
  const matchedRows = [];
  const localCandidates = [];

  for (const row of mappingRows) {
    const nameZh = normalizeText(row.nameZh);
    const englishName = reverseI18nNameMap[nameZh] ?? zhNameToEnglishName[nameZh];
    const namedMatch = englishName ? currentByName.get(normalizeName(englishName)) : undefined;
    const profileMatch = namedMatch ?? findUniqueProfileMatch(row, currentProspects);

    if (profileMatch) {
      if (usedProspectIds.has(profileMatch.id)) {
        duplicateRowsSkipped.push({
          ordinal: row.ordinal,
          nameZh: row.nameZh,
          matchedProspectId: profileMatch.id,
          matchedName: profileMatch.name,
        });
        continue;
      }
      usedProspectIds.add(profileMatch.id);
      matchedRows.push({ ordinal: row.ordinal, nameZh: row.nameZh, matchedName: profileMatch.name, id: profileMatch.id });
      localCandidates.push(cloneMatchedProspect(profileMatch, row, namedMatch ? "name-translation" : "school-country-position"));
      continue;
    }

    unmatchedRows.push(row);
  }

  const maxMatchedRank = Math.max(...localCandidates.map((prospect) => prospect.consensusRank), 101);
  unmatchedRows.forEach((row, index) => {
    localCandidates.push(buildFallbackProspect(row, maxMatchedRank + index + 1));
  });

  const scenario = scenariosFile.scenarios.find((item) => item.id === "baseline") ?? scenariosFile.scenarios[0];
  const board = generateBoard(expandedBundle.teams ?? [], localCandidates, scenario.weights);
  const health = getBoardHealth(board);
  const boardRows = toBoardRows(board);
  const summary = summarizeBoard(board, currentBoard);
  const excludedCurrent101 = [...currentIds].filter((id) => !usedProspectIds.has(id));

  const generatedAt = new Date().toISOString();
  const localBundle = {
    ...expandedBundle,
    metadata: {
      ...(expandedBundle.metadata ?? {}),
      localPlayerPool124: {
        generatedAt,
        sourceFile: "data/normalized/normalized_2026_local_player_pool_124.json",
        sourceRows: localPool.prospects?.length ?? 0,
        uniqueCandidates: localCandidates.length,
        matchedCurrentProfiles: matchedRows.length,
        localOnlyFallbackProfiles: unmatchedRows.length,
        current101Excluded: excludedCurrent101.length,
        duplicateSourceRowsSkipped: duplicateRowsSkipped.length,
        noManualOverride: true,
      },
    },
    prospects: localCandidates,
  };

  const artifact = {
    schemaVersion: "draftops.local_pool_124_prediction.v1",
    generatedAt,
    generatedBy: "DraftOps Local 124-Player Pool Prediction Script",
    method:
      "Use competition answer-card 124-row player pool as eligibility boundary; retain matched 101-pool profiles/ranks; assign local-only fallback profiles after matched profile pool; run baseline generateBoard once.",
    inputFiles: [
      "data/normalized/normalized_2026_local_player_pool_124.json",
      "data/final/expanded_import_bundle.json",
      "data/reports/weight_scenarios.json",
      "src/lib/prediction.ts",
    ],
    candidatePool: localBundle.metadata.localPlayerPool124,
    scenario,
    health,
    summary,
    board,
    boardRows,
    audit: {
      matchedRows,
      unmatchedRows: unmatchedRows.map((row) => ({
        ordinal: row.ordinal,
        nameZh: row.nameZh,
        positionZh: row.positionZh,
        schoolClubZh: row.schoolClubZh,
        countryRegionZh: row.countryRegionZh,
      })),
      duplicateRowsSkipped,
      excludedCurrent101,
    },
    noManualOverride: true,
  };

  await Promise.all([
    writeFile(localBundlePath, `${JSON.stringify(localBundle, null, 2)}\n`, "utf8"),
    writeFile(localBoardPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeReport({ artifact, currentBoard }),
  ]);

  console.log(
    JSON.stringify(
      {
        output: [
          "data/final/local_pool_124_import_bundle.json",
          "data/boards/local_pool_124_baseline_board.json",
          "data/reports/local_pool_124_prediction_rerun_20260623.md",
        ],
        candidatePool: artifact.candidatePool,
        health,
        summary: {
          pickCount: summary.pickCount,
          uniqueProspects: summary.uniqueProspects,
          averageConfidence: summary.averageConfidence,
          averageScore: summary.averageScore,
          lowConfidence: summary.lowConfidence.length,
          narrowMargins: summary.narrowMargins.length,
          fallbackPicks: summary.fallbackPicks.length,
          changedVsCurrent101: summary.changedVsCurrent101,
        },
        board: boardRows.map((row) => ({
          pick: row.pick,
          team: row.team,
          player: row.player,
          localNameZh: row.localNameZh,
          confidence: row.confidence,
          margin: row.margin,
          fallbackProfile: row.fallbackProfile,
        })),
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
