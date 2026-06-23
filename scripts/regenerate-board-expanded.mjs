import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = process.cwd();
const predictionPath = resolve(rootDir, "src", "lib", "prediction.ts");
const currentBundlePath = resolve(rootDir, "public", "data", "final_import_bundle.json");
const officialProspectsPath = resolve(rootDir, "data", "raw", "nba-official-2026-prospects-live.md");
const scenariosPath = resolve(rootDir, "data", "reports", "weight_scenarios.json");
const tempModulePath = resolve(rootDir, "node_modules", ".tmp", "prediction.expanded.mjs");

const dataExpandedBundlePath = resolve(rootDir, "data", "final", "expanded_import_bundle.json");
const publicExpandedBundlePath = resolve(rootDir, "public", "data", "expanded_import_bundle.json");
const dataExpandedBoardPath = resolve(rootDir, "data", "boards", "board_expanded_101_baseline.json");
const publicExpandedBoardPath = resolve(rootDir, "public", "data", "agent_expanded_board.json");
const expandedReportPath = resolve(rootDir, "data", "reports", "expanded_candidate_pool_rerun_20260623.md");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeName = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const parseHeightInches = (height) => {
  const match = String(height).match(/(\d+)-(\d+)/);
  if (!match) return 78;
  return Number(match[1]) * 12 + Number(match[2]);
};

const parseWeight = (weight) => {
  const match = String(weight).match(/\d+/);
  return match ? Number(match[0]) : 210;
};

const parseOfficialProspects = (markdown) => {
  const rowPattern =
    /^\| \[([^\]]+)\]\(https:\/\/www\.nba\.com\/draft\/2026\/prospects\/([^)]+)\) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm;

  return [...markdown.matchAll(rowPattern)].map((match, index) => ({
    officialIndex: index + 1,
    name: match[1].trim(),
    officialSlug: match[2].trim(),
    positionLabel: match[3].trim(),
    age: Number(match[4].trim()),
    school: match[5].trim(),
    height: match[6].trim(),
    weight: match[7].trim(),
    classYear: match[8].trim(),
    origin: match[9].trim(),
  }));
};

const mapPositions = (label) => {
  if (label === "G") return ["PG", "SG"];
  if (label === "F") return ["SF", "PF"];
  if (label === "C") return ["C"];
  if (label === "G-F") return ["SG", "SF"];
  if (label === "F-C") return ["PF", "C"];
  return ["SF", "PF"];
};

const fallbackRoleTags = (official) => {
  const positions = mapPositions(official.positionLabel);
  const tags = new Set();

  if (positions.includes("PG") || positions.includes("SG")) {
    tags.add("combo guard");
    tags.add("shooting");
    tags.add("secondary creation");
  }
  if (positions.includes("SF") || positions.includes("PF")) {
    tags.add("big wing");
    tags.add("connector");
    tags.add("defense");
  }
  if (positions.includes("C")) {
    tags.add("frontcourt");
    tags.add("rim protector");
    tags.add("rebounder");
  }
  if (official.origin !== "United States" || /International|G League/i.test(official.classYear)) {
    tags.add("international");
  }
  if (official.age <= 19) tags.add("upside");
  if (official.age >= 22) tags.add("maturity");

  return [...tags];
};

const fallbackProfile = (official) => {
  const positions = mapPositions(official.positionLabel);
  const height = parseHeightInches(official.height);
  const weight = parseWeight(official.weight);
  const isGuard = positions.includes("PG") || positions.includes("SG");
  const isWing = positions.includes("SF") || positions.includes("PF");
  const isCenter = positions.includes("C");
  const age = official.age || 22;
  const classYear = official.classYear.toLowerCase();

  const youthBonus = clamp((22.5 - age) * 3, -8, 10);
  const seniorFeel = /senior|junior/i.test(official.classYear) ? 5 : 0;
  const internationalFeel = official.origin !== "United States" ? 2 : 0;
  const sizeBonus = clamp((height - 78) * 1.5 + (weight - 210) * 0.08, -8, 12);

  if (isCenter) {
    return {
      shooting: clamp(57 + internationalFeel + (height >= 83 ? 1 : 0)),
      creation: clamp(52 + internationalFeel),
      defense: clamp(73 + sizeBonus * 0.6),
      athleticism: clamp(67 + youthBonus * 0.4),
      feel: clamp(64 + seniorFeel + internationalFeel),
      size: clamp(84 + sizeBonus),
      upside: clamp(75 + youthBonus - seniorFeel),
    };
  }

  if (isGuard && !isWing) {
    return {
      shooting: clamp(70 + seniorFeel * 0.4),
      creation: clamp(69 + youthBonus * 0.3),
      defense: clamp(64 + sizeBonus * 0.4),
      athleticism: clamp(69 + youthBonus * 0.4),
      feel: clamp(68 + seniorFeel + internationalFeel),
      size: clamp(62 + sizeBonus),
      upside: clamp(78 + youthBonus - seniorFeel * 0.7),
    };
  }

  return {
    shooting: clamp(65 + internationalFeel),
    creation: clamp(62 + youthBonus * 0.2),
    defense: clamp(70 + sizeBonus * 0.5),
    athleticism: clamp(70 + youthBonus * 0.3),
    feel: clamp(67 + seniorFeel + internationalFeel),
    size: clamp(76 + sizeBonus),
    upside: clamp(77 + youthBonus - seniorFeel * 0.7),
  };
};

const fallbackStrengths = (official) => {
  const positions = mapPositions(official.positionLabel);
  const strengths = [];
  if (positions.includes("PG") || positions.includes("SG")) strengths.push("Guard skill baseline");
  if (positions.includes("SF") || positions.includes("PF")) strengths.push("Forward size baseline");
  if (positions.includes("C")) strengths.push("Frontcourt size baseline");
  if (official.age <= 19) strengths.push("Young official candidate");
  if (official.origin !== "United States") strengths.push("International official candidate");
  if (official.age >= 22) strengths.push("Older production profile");
  return strengths.slice(0, 3);
};

const fallbackRisks = (official) => {
  const risks = ["Expanded-pool fallback profile"];
  if (official.age >= 23) risks.push("Older prospect age curve");
  if (official.origin !== "United States") risks.push("NBA translation uncertainty");
  return risks;
};

const collectMediaMentions = (rawText, officialProspects) => {
  const lowerText = rawText.toLowerCase();
  return new Map(
    officialProspects.map((official) => {
      const escaped = official.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const count = (lowerText.match(new RegExp(`\\b${escaped}\\b`, "g")) ?? []).length;
      return [normalizeName(official.name), count];
    }),
  );
};

const buildExpandedProspects = ({ officialProspects, currentProspects, rawText }) => {
  const currentByName = new Map(currentProspects.map((prospect) => [normalizeName(prospect.name), prospect]));
  const mediaMentions = collectMediaMentions(rawText, officialProspects);
  const missingOfficials = officialProspects
    .filter((official) => !currentByName.has(normalizeName(official.name)))
    .sort((left, right) => {
      const mentionDelta =
        (mediaMentions.get(normalizeName(right.name)) ?? 0) - (mediaMentions.get(normalizeName(left.name)) ?? 0);
      if (mentionDelta !== 0) return mentionDelta;
      const ageDelta = left.age - right.age;
      if (ageDelta !== 0) return ageDelta;
      return left.officialIndex - right.officialIndex;
    });

  const fallbackRankByName = new Map(
    missingOfficials.map((official, index) => [normalizeName(official.name), currentProspects.length + index + 1]),
  );

  return officialProspects.map((official) => {
    const normalizedName = normalizeName(official.name);
    const existing = currentByName.get(normalizedName);
    if (existing) {
      return {
        ...existing,
        sourceNotes: [
          ...existing.sourceNotes,
          `Expanded pool: retained full DraftOps profile from original 30-player bundle; official row ${official.officialIndex}/101.`,
        ],
      };
    }

    const fallbackRank = fallbackRankByName.get(normalizedName) ?? 101;
    const mentions = mediaMentions.get(normalizedName) ?? 0;
    const positions = mapPositions(official.positionLabel);
    const mockHeat = clamp(18 + Math.min(22, mentions * 2) - Math.max(0, fallbackRank - 45) * 0.35, 8, 46);

    return {
      id: official.officialSlug || slugify(official.name),
      name: official.name,
      positions,
      school: official.school,
      origin: official.origin,
      classYear: official.classYear,
      height: official.height,
      weight: official.weight,
      age: official.age,
      consensusRank: fallbackRank,
      mockHeat: Math.round(mockHeat),
      international: official.origin !== "United States" || /International|G League/i.test(official.classYear),
      roleTags: fallbackRoleTags(official),
      strengths: fallbackStrengths(official),
      risks: fallbackRisks(official),
      profile: fallbackProfile(official),
      sourceNotes: [
        `NBA.com official prospects: ${official.positionLabel}, age ${official.age}, ${official.school}, ${official.height}, ${official.weight}, ${official.classYear}, ${official.origin}`,
        `Expanded-pool fallback profile: no full DraftOps scouting profile in original 30-player bundle.`,
        `Fallback consensusRank ${fallbackRank} derived deterministically from media mention count, age, and official row order; media mention count ${mentions}.`,
      ],
    };
  });
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

const toBoardRows = (board) =>
  board.map((pick) => ({
    pick: pick.pick,
    team: pick.team,
    acquiredFrom: pick.acquiredFrom ?? null,
    player: pick.prospect.name,
    prospectId: pick.prospect.id,
    school: pick.prospect.school,
    origin: pick.prospect.origin,
    position: pick.prospect.positions.join("/"),
    consensusRank: pick.prospect.consensusRank,
    score: pick.score,
    confidence: pick.confidence,
    margin: pick.margin,
    zone: pick.zone,
    effectiveWeights: pick.effectiveWeights,
    roleFit: pick.roleFit,
    breakdown: pick.breakdown,
    alternatives: pick.alternatives,
    warnings: pick.warnings,
    fallbackProfile: pick.prospect.risks.includes("Expanded-pool fallback profile"),
  }));

const summarizeBoard = (board) => {
  const lowConfidencePicks = board
    .filter((pick) => pick.confidence < 65)
    .map((pick) => ({
      pick: pick.pick,
      team: pick.team,
      prospect: pick.prospect.name,
      confidence: pick.confidence,
    }));
  const fallbackPicks = board
    .filter((pick) => pick.prospect.risks.includes("Expanded-pool fallback profile"))
    .map((pick) => ({
      pick: pick.pick,
      team: pick.team,
      prospect: pick.prospect.name,
      confidence: pick.confidence,
      consensusRank: pick.prospect.consensusRank,
    }));

  return {
    pickCount: board.length,
    uniqueProspects: new Set(board.map((pick) => pick.prospect.id)).size,
    averageConfidence: Math.round(board.reduce((sum, pick) => sum + pick.confidence, 0) / board.length),
    averageScore: Math.round(board.reduce((sum, pick) => sum + pick.score, 0) / board.length),
    lowConfidencePicks,
    fallbackPicks,
  };
};

const writeReport = async ({ artifact, currentBoardRows, officialCount, currentProspectCount }) => {
  const boardRows = artifact.boardRows;
  const changedRows = boardRows.filter((row) => {
    const previous = currentBoardRows.find((item) => item.pick === row.pick);
    return previous?.player !== row.player;
  });
  const fallbackRows = boardRows.filter((row) => row.fallbackProfile);

  const lines = [
    "# Expanded Candidate Pool Rerun",
    "",
    `Generated: ${artifact.generatedAt}`,
    "",
    "## Scope",
    "",
    "This rerun selects the first round from the NBA.com official 101-player prospect capture, not from the previous preselected 30-player bundle. It does not manually select, replace, or reorder players.",
    "",
    "## Candidate Pool",
    "",
    `- Official prospects parsed: ${officialCount}`,
    `- Existing full DraftOps profiles retained: ${currentProspectCount}`,
    `- Expanded-pool fallback profiles generated: ${officialCount - currentProspectCount}`,
    "",
    "Fallback profiles are deterministic and low-trust: they use official position, age, height, weight, class, origin, and raw-source mention count. They are included to prevent the 30th pick from being forced by a 30-player candidate pool.",
    "",
    "## Health",
    "",
    `- 30 picks: ${artifact.health.hasThirtyPicks}`,
    `- No duplicates: ${artifact.health.noDuplicates}`,
    `- Low-confidence picks: ${artifact.health.lowConfidence}`,
    `- Ready under current code gate: ${artifact.health.ready}`,
    "",
    "## Summary",
    "",
    `- Average confidence: ${artifact.summary.averageConfidence}`,
    `- Average score: ${artifact.summary.averageScore}`,
    `- Fallback-profile picks in first round: ${artifact.summary.fallbackPicks.length}`,
    `- Changed slots vs previous 30-player baseline: ${changedRows.length}`,
    "",
    "## Changed Slots Vs Previous 30-Player Baseline",
    "",
    changedRows.length
      ? [
          "| Pick | Team | Previous | Expanded-pool rerun | Fallback profile |",
          "|---:|---|---|---|---|",
          ...changedRows.map((row) => {
            const previous = currentBoardRows.find((item) => item.pick === row.pick);
            return `| ${row.pick} | ${row.team} | ${previous?.player ?? "N/A"} | ${row.player} | ${row.fallbackProfile} |`;
          }),
        ].join("\n")
      : "No selected-player slots changed.",
    "",
    "## Expanded-Pool Board",
    "",
    "| Pick | Team | Player | Rank | Confidence | Margin | Fallback |",
    "|---:|---|---|---:|---:|---:|---|",
    ...boardRows.map(
      (row) =>
        `| ${row.pick} | ${row.team} | ${row.player} | ${row.consensusRank} | ${row.confidence} | ${row.margin} | ${row.fallbackProfile} |`,
    ),
    "",
    "## Fallback Picks",
    "",
    fallbackRows.length
      ? [
          "| Pick | Team | Player | Rank | Confidence |",
          "|---:|---|---|---:|---:|",
          ...fallbackRows.map(
            (row) => `| ${row.pick} | ${row.team} | ${row.player} | ${row.consensusRank} | ${row.confidence} |`,
          ),
        ].join("\n")
      : "No fallback-profile candidate entered the first round.",
    "",
    "## Lock-Gate Note",
    "",
    "This is a more valid candidate-pool rerun than the previous 30-player-bundle run, but fallback-profile candidates still need sourceConfidence/profile validation before final lock.",
    "",
  ];

  await writeFile(expandedReportPath, `${lines.join("\n")}\n`, "utf8");
};

const main = async () => {
  const [{ generateBoard, getBoardHealth }, currentBundle, officialMarkdown, scenarios, currentBoardArtifact] =
    await Promise.all([
      loadPredictionModule(),
      readJson(currentBundlePath),
      readFile(officialProspectsPath, "utf8"),
      readJson(scenariosPath),
      readJson(resolve(rootDir, "public", "data", "agent_balanced_board.json")),
    ]);

  const officialProspects = parseOfficialProspects(officialMarkdown);
  const currentProspects = currentBundle.prospects ?? [];
  const expandedProspects = buildExpandedProspects({
    officialProspects,
    currentProspects,
    rawText: officialMarkdown + "\n" + JSON.stringify(await readJson(resolve(rootDir, "data", "raw", "raw_sources.json"))),
  });
  const scenario = scenarios.scenarios.find((item) => item.id === "baseline") ?? scenarios.scenarios[0];
  const board = generateBoard(currentBundle.teams ?? [], expandedProspects, scenario.weights);
  const health = getBoardHealth(board);
  const summary = summarizeBoard(board);
  const expandedBundle = {
    ...currentBundle,
    metadata: {
      ...(currentBundle.metadata ?? {}),
      expandedCandidatePool: {
        generatedAt: new Date().toISOString(),
        officialProspectRows: officialProspects.length,
        fullDraftOpsProfiles: currentProspects.length,
        fallbackProfiles: expandedProspects.length - currentProspects.length,
        noManualOverride: true,
      },
    },
    prospects: expandedProspects,
  };
  const artifact = {
    schemaVersion: "draftops.expanded_candidate_board.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "DraftOps Expanded Candidate Pool Regeneration Script",
    method:
      "Parse NBA.com official 101-player prospects capture, merge existing 30 full profiles, generate deterministic fallback profiles for the rest, then run generateBoard.",
    inputFiles: [
      "data/raw/nba-official-2026-prospects-live.md",
      "public/data/final_import_bundle.json",
      "data/reports/weight_scenarios.json",
      "src/lib/prediction.ts",
    ],
    scenario,
    sourceMetadata: expandedBundle.metadata,
    health,
    summary,
    board,
    boardRows: toBoardRows(board),
  };

  await Promise.all([
    writeFile(dataExpandedBundlePath, `${JSON.stringify(expandedBundle, null, 2)}\n`, "utf8"),
    writeFile(publicExpandedBundlePath, `${JSON.stringify(expandedBundle, null, 2)}\n`, "utf8"),
    writeFile(dataExpandedBoardPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(publicExpandedBoardPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeReport({
      artifact,
      currentBoardRows: currentBoardArtifact.boardRows ?? [],
      officialCount: officialProspects.length,
      currentProspectCount: currentProspects.length,
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        output: [
          "data/final/expanded_import_bundle.json",
          "public/data/expanded_import_bundle.json",
          "data/boards/board_expanded_101_baseline.json",
          "public/data/agent_expanded_board.json",
          "data/reports/expanded_candidate_pool_rerun_20260623.md",
        ],
        candidatePool: {
          officialProspects: officialProspects.length,
          retainedFullProfiles: currentProspects.length,
          fallbackProfiles: expandedProspects.length - currentProspects.length,
        },
        health,
        summary,
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
