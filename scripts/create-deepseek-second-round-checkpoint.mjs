import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const localBundlePath = resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json");
const checkpointPath = resolve(rootDir, ".draftops-watch", `deepseek_sequential_123_prediction_${stamp}.checkpoint.json`);

const secondRoundTranscript = [
  [1, "Washington Wizards", "AJ Dybantsa"],
  [2, "Utah Jazz", "Darryn Peterson"],
  [3, "Memphis Grizzlies", "Cameron Boozer"],
  [4, "Chicago Bulls", "Caleb Wilson"],
  [5, "LA Clippers", "Keaton Wagler"],
  [6, "Brooklyn Nets", "Darius Acuff Jr."],
  [7, "Sacramento Kings", "Mikel Brown Jr."],
  [8, "Atlanta Hawks", "Aday Mara"],
  [9, "Dallas Mavericks", "Brayden Burries"],
  [10, "Milwaukee Bucks", "Kingston Flemings"],
  [11, "Golden State Warriors", "Nate Ament"],
  [12, "Oklahoma City Thunder", "Yaxel Lendeborg"],
  [13, "Miami Heat", "Karim Lopez"],
  [14, "Charlotte Hornets", "Morez Johnson Jr."],
  [15, "Chicago Bulls", "Allen Graves"],
  [16, "Memphis Grizzlies", "Hannes Steinbach"],
  [17, "Oklahoma City Thunder", "Chris Cenac Jr."],
  [18, "Charlotte Hornets", "Christian Anderson"],
  [19, "Toronto Raptors", "Dailyn Swain"],
  [20, "San Antonio Spurs", "Cameron Carr"],
  [21, "Detroit Pistons", "Isaiah Evans"],
  [22, "Philadelphia 76ers", "Bennett Stirtz"],
  [23, "Atlanta Hawks", "Labaron Philon Jr."],
];

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const normalizeName = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const run = async () => {
  const localBundle = await readJson(localBundlePath);
  const teamsByPick = new Map((localBundle.teams ?? []).map((team) => [Number(team.pick), team]));
  const prospectsByName = new Map((localBundle.prospects ?? []).map((prospect) => [normalizeName(prospect.name), prospect]));
  const boardRows = [];
  const pickAudits = [];

  for (const [pick, teamName, playerName] of secondRoundTranscript) {
    const team = teamsByPick.get(pick);
    if (!team) throw new Error(`Missing team row for pick ${pick}`);
    if (team.team !== teamName) throw new Error(`Team mismatch at pick ${pick}: expected ${teamName}, got ${team.team}`);

    const prospect = prospectsByName.get(normalizeName(playerName));
    if (!prospect) throw new Error(`Missing prospect for second-round transcript player: ${playerName}`);

    const boardRow = {
      pick,
      team: team.team,
      acquiredFrom: team.acquiredFrom ?? null,
      prospectId: prospect.id,
      player: prospect.name,
      localNameZh: prospect.localPool?.nameZh ?? null,
      localOrdinal: prospect.localPool?.ordinal ?? null,
      positions: prospect.positions ?? [],
      position: (prospect.positions ?? []).join("/"),
      school: prospect.school,
      origin: prospect.origin,
      classYear: prospect.classYear,
      international: Boolean(prospect.international),
      consensusRank: prospect.consensusRank,
      mockHeat: prospect.mockHeat,
      confidence: null,
      reason: "Seeded from the second DeepSeek sequential run terminal transcript before the API empty-content failure at pick 24.",
      dynamicParameters: {
        seedSource: "second-deepseek-run-terminal-transcript",
        evidenceWeakness: "Original per-pick JSON was not persisted before checkpoint support was added.",
      },
      remainingBefore: 124 - pick,
      remainingAfter: 123 - pick,
    };

    boardRows.push(boardRow);
    pickAudits.push({
      pick,
      team: team.team,
      selectedProspectId: prospect.id,
      selectedName: prospect.name,
      selectedLocalNameZh: prospect.localPool?.nameZh ?? null,
      confidence: null,
      prediction: {
        pick,
        team: team.team,
        selectedProspectId: prospect.id,
        selectedName: prospect.name,
        confidence: null,
        overallReason: boardRow.reason,
        dynamicParameters: boardRow.dynamicParameters,
        topCandidates: [],
        rejectedHighSignalCandidates: [],
        noManualPredictionConfirmation: true,
      },
      ragSnippets: [],
      usage: null,
      finishReason: "checkpoint-seed",
      remainingBefore: boardRow.remainingBefore,
      remainingAfter: boardRow.remainingAfter,
      noManualPredictionConfirmation: true,
    });
  }

  await mkdir(dirname(checkpointPath), { recursive: true });
  await writeFile(
    checkpointPath,
    `${JSON.stringify(
      {
        schemaVersion: "draftops.deepseek_sequential_checkpoint.v1",
        generatedAt: new Date().toISOString(),
        generatedBy: "scripts/create-deepseek-second-round-checkpoint.mjs",
        seedPolicy:
          "Uses only the already-observed second DeepSeek sequential run terminal outputs for picks 1-23; no new human player choice is introduced.",
        model: "deepseek-v4-pro",
        modelLabel: "deepseek-v4-pro[1m]",
        boardRows,
        pickAudits,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalRemainingCandidatesShown: 0,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        checkpoint: `.draftops-watch/deepseek_sequential_123_prediction_${stamp}.checkpoint.json`,
        seededPicks: boardRows.length,
        nextPick: 24,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
