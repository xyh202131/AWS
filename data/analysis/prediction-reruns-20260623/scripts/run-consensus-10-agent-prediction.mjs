import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const stampArgIndex = process.argv.indexOf("--run-stamp");
const runStamp =
  stampArgIndex >= 0 && process.argv[stampArgIndex + 1] ? process.argv[stampArgIndex + 1] : "20260624";

const localBundlePath = resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json");
const teamPreferencePath = resolve(rootDir, "data", "reports", "team_preference_research_20260623.json");
const featureReferencePath = resolve(rootDir, "data", "normalized", "normalized_2026_player_feature_reference_124.json");
const currentBoardPath = resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json");
const deepseekBoardPath = resolve(rootDir, "data", "boards", "deepseek_agentic_tool_123_prediction_20260623.json");
const codexBoardPath = resolve(rootDir, "data", "boards", "codex_sequential_123_prediction_20260623.json");
const archiveDir = resolve(rootDir, "data", "analysis", "prediction-reruns-20260623");
const calibrationBoardConfigs = [
  { label: "current_frontend", path: currentBoardPath, weight: 1.2 },
  { label: "deepseek_tool_third_round", path: deepseekBoardPath, weight: 1.2 },
  { label: "codex_third_round", path: codexBoardPath, weight: 1.1 },
  {
    label: "first_sequential_dynamic",
    path: resolve(archiveDir, "boards", "sequential_dynamic_board_123_audit.json"),
    weight: 0.9,
  },
  {
    label: "mild_parameter_rerun",
    path: resolve(archiveDir, "boards", "sequential_dynamic_board_123_audit_deepseek_mild.json"),
    weight: 1.0,
  },
  {
    label: "deepseek_llm_parameter_rerun",
    path: resolve(archiveDir, "boards", "sequential_dynamic_board_123_audit_deepseek_llm.json"),
    weight: 1.0,
  },
  {
    label: "codex_llm_rag_rerun",
    path: resolve(archiveDir, "boards", "codex_llm_rag_sequential_123_prediction_20260623.json"),
    weight: 0.9,
  },
];

const outputJsonPath = resolve(rootDir, "data", "boards", `consensus_10_agent_prediction_${runStamp}.json`);
const outputReportPath = resolve(rootDir, "data", "reports", `consensus_10_agent_prediction_${runStamp}.md`);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readJsonIfExists = async (path) => {
  if (!existsSync(path)) return null;
  return readJson(path);
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));

const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const familyAliases = new Map([
  ["alpha scorer", "creation"],
  ["lead guard", "guard"],
  ["point guard", "guard"],
  ["primary guard", "guard"],
  ["combo guard", "guard"],
  ["shot creation", "creation"],
  ["shot creator", "creation"],
  ["late clock offense", "creation"],
  ["late-clock offense", "creation"],
  ["pull up shooting", "shooting"],
  ["pull-up shooting", "shooting"],
  ["floor spacing", "shooting"],
  ["spacing", "shooting"],
  ["shooter", "shooting"],
  ["shooting", "shooting"],
  ["wing creator", "wing"],
  ["big wing", "wing"],
  ["3 and d", "wing"],
  ["3-and-d", "wing"],
  ["forward", "wing"],
  ["frontcourt", "frontcourt"],
  ["center", "frontcourt"],
  ["big", "frontcourt"],
  ["rim protector", "defense"],
  ["rim protection", "defense"],
  ["two way", "defense"],
  ["two-way", "defense"],
  ["defensive size", "defense"],
  ["defense", "defense"],
  ["size", "size"],
  ["star upside", "upside_asset"],
  ["fan facing upside", "upside_asset"],
  ["fan-facing upside", "upside_asset"],
  ["upside", "upside_asset"],
  ["connector", "feel"],
  ["playmaking", "feel"],
  ["decision maker", "feel"],
  ["maturity", "feel"],
  ["international", "international"],
]);

const familiesFromText = (values = []) => {
  const families = new Set();
  for (const raw of values.filter(Boolean)) {
    const text = normalizeText(raw);
    if (!text) continue;
    if (familyAliases.has(text)) families.add(familyAliases.get(text));
    if (/guard|handler|playmak/.test(text)) families.add("guard");
    if (/creator|scor|offense|paint touch|rim pressure/.test(text)) families.add("creation");
    if (/shoot|spacing|three|pull up|pull-up/.test(text)) families.add("shooting");
    if (/wing|forward|3 and d|3-and-d/.test(text)) families.add("wing");
    if (/frontcourt|center|rebound|big|interior/.test(text)) families.add("frontcourt");
    if (/defen|rim protect|switch/.test(text)) families.add("defense");
    if (/size|length|physical/.test(text)) families.add("size");
    if (/upside|ceiling|asset|star|athletic/.test(text)) families.add("upside_asset");
    if (/feel|connector|decision|pass|maturity/.test(text)) families.add("feel");
    if (/international|stash/.test(text)) families.add("international");
  }
  return families;
};

const positionFamilies = (positions = []) => {
  const families = new Set();
  if (positions.some((position) => ["PG", "SG", "G"].includes(position))) families.add("guard");
  if (positions.some((position) => ["SF", "PF", "F"].includes(position))) families.add("wing");
  if (positions.some((position) => ["PF", "C", "F"].includes(position))) families.add("frontcourt");
  if (positions.includes("C")) {
    families.add("frontcourt");
    families.add("size");
  }
  return families;
};

const profileFamilies = (profile = {}) => {
  const families = new Set();
  if (profile.shooting >= 80) families.add("shooting");
  if (profile.creation >= 80) families.add("creation");
  if (profile.defense >= 80) families.add("defense");
  if (profile.athleticism >= 86 || profile.upside >= 84) families.add("upside_asset");
  if (profile.size >= 82) families.add("size");
  if (profile.feel >= 82) families.add("feel");
  return families;
};

const featureFamilies = (feature) => {
  const families = new Set();
  const derived = feature?.derived ?? {};
  if (derived.shootingDrillScore >= 70) families.add("shooting");
  if (derived.physicalToolsScore >= 72) {
    families.add("size");
    families.add("defense");
  }
  if (derived.explosivenessScore >= 75 || derived.agilitySpeedScore >= 75) families.add("upside_asset");
  familiesFromText(derived.tags ?? []).forEach((family) => families.add(family));
  return families;
};

const prospectFamilies = (prospect, feature) => {
  const families = new Set();
  positionFamilies(prospect.positions ?? []).forEach((family) => families.add(family));
  profileFamilies(prospect.profile ?? {}).forEach((family) => families.add(family));
  featureFamilies(feature).forEach((family) => families.add(family));
  familiesFromText([...(prospect.roleTags ?? []), ...(prospect.strengths ?? [])]).forEach((family) => families.add(family));
  if (prospect.international) families.add("international");
  return families;
};

const buildFeatureByOrdinal = (featureReference) =>
  new Map((featureReference.players ?? []).map((player) => [Number(player.poolOrdinal), player]));

const preferenceForPick = (teamPreference, pick) =>
  (teamPreference.entries ?? []).find((entry) => Number(entry.pick) === Number(pick)) ?? null;

const extractBoardRows = (board) => {
  if (!board) return [];
  if (Array.isArray(board.boardRows)) return board.boardRows;
  if (Array.isArray(board.rows)) return board.rows;
  if (Array.isArray(board.board)) return board.board;
  if (Array.isArray(board.picks)) return board.picks;
  return [];
};

const boardCandidateForPick = (rows, pick) => {
  const row = rows.find((item) => Number(item.pick ?? item.pickNo ?? item.slot) === Number(pick));
  return row?.prospectId ?? row?.id ?? row?.selected?.prospectId ?? null;
};

const overlapCount = (left, right) => {
  let count = 0;
  for (const item of left) if (right.has(item)) count += 1;
  return count;
};

const averageProfile = (profile = {}) => {
  const values = ["shooting", "creation", "defense", "athleticism", "feel", "size", "upside"]
    .map((key) => Number(profile[key]))
    .filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 55;
};

const riskScore = (prospect, feature) => {
  const risks = (prospect.risks ?? []).join(" ").toLowerCase();
  const completeness = Number(feature?.derived?.dataCompletenessScore ?? 62);
  let penalty = 0;
  if (/injury|medical|health/.test(risks)) penalty += 13;
  if (/decision|shot selection|turnover|variance/.test(risks)) penalty += 5;
  if (/fallback|limited|unknown/.test(risks)) penalty += 6;
  if (completeness < 35) penalty += 8;
  else if (completeness < 65) penalty += 4;
  const age = Number(prospect.age);
  if (Number.isFinite(age) && age >= 23) penalty += 3;
  return clamp(100 - penalty);
};

const consensusValue = (pick, prospect) => clamp(100 - Math.abs(Number(prospect.consensusRank ?? 99) - pick) * 4.8);

const pickValue = (pick, prospect) => clamp(52 + (pick - Number(prospect.consensusRank ?? pick)) * 1.7, 20, 78);

const sourceEvidenceScore = (prospect, feature) => {
  const noteCount = (prospect.sourceNotes ?? []).length;
  const completeness = Number(feature?.derived?.dataCompletenessScore ?? 55);
  return clamp(38 + Math.min(32, noteCount * 4) + Math.min(24, completeness * 0.24));
};

const teamSignals = (team, preference) =>
  new Set([
    ...familiesFromText([...(team.needs ?? []), ...(team.priorityTags ?? [])]),
    ...familiesFromText(preference?.preferenceFamilies ?? []),
  ]);

const positionNeedScore = (team, preference, prospect, feature) => {
  const teamFamilySet = teamSignals(team, preference);
  const playerFamilySet = prospectFamilies(prospect, feature);
  const overlap = overlapCount(teamFamilySet, playerFamilySet);
  return clamp(43 + overlap * 12 + (preference?.needConfidenceCoefficient ?? 0.6) * 8);
};

const previousBoardSupport = (pick, prospect, referenceBoards) => {
  let support = 0;
  for (const board of referenceBoards) {
    if (boardCandidateForPick(board.rows, pick) === prospect.id) support += board.weight;
  }
  return support;
};

const agentProfiles = [
  {
    id: "consensus_guard",
    label: "Consensus Guard",
    weights: { consensus: 0.44, board: 0.16, team: 0.1, profile: 0.1, feature: 0.08, upside: 0.04, risk: 0.05, evidence: 0.03 },
  },
  {
    id: "team_fit_skeptic",
    label: "Team Fit Skeptic",
    weights: { consensus: 0.2, board: 0.08, team: 0.36, profile: 0.1, feature: 0.08, upside: 0.06, risk: 0.07, evidence: 0.05 },
  },
  {
    id: "upside_scout",
    label: "Upside Scout",
    weights: { consensus: 0.21, board: 0.06, team: 0.12, profile: 0.12, feature: 0.08, upside: 0.32, risk: 0.04, evidence: 0.05 },
  },
  {
    id: "floor_risk_auditor",
    label: "Floor/Risk Auditor",
    weights: { consensus: 0.26, board: 0.09, team: 0.16, profile: 0.17, feature: 0.1, upside: 0.03, risk: 0.16, evidence: 0.03 },
  },
  {
    id: "rag_grounding_auditor",
    label: "RAG Grounding Auditor",
    weights: { consensus: 0.25, board: 0.12, team: 0.14, profile: 0.08, feature: 0.08, upside: 0.04, risk: 0.07, evidence: 0.22 },
  },
  {
    id: "position_scarcity",
    label: "Position Scarcity Analyst",
    weights: { consensus: 0.21, board: 0.08, team: 0.26, profile: 0.09, feature: 0.1, upside: 0.08, risk: 0.06, evidence: 0.04, scarcity: 0.08 },
  },
  {
    id: "international_milestone",
    label: "International/Milestone Checker",
    weights: { consensus: 0.25, board: 0.08, team: 0.14, profile: 0.11, feature: 0.08, upside: 0.12, risk: 0.06, evidence: 0.08, international: 0.08 },
  },
  {
    id: "program_school",
    label: "Program/School Preference Analyst",
    weights: { consensus: 0.29, board: 0.1, team: 0.13, profile: 0.11, feature: 0.09, upside: 0.08, risk: 0.07, evidence: 0.08, program: 0.05 },
  },
  {
    id: "front_office_behavior",
    label: "Front Office Behavior Analyst",
    weights: { consensus: 0.25, board: 0.1, team: 0.19, profile: 0.1, feature: 0.08, upside: 0.14, risk: 0.08, evidence: 0.06 },
  },
  {
    id: "anti_hallucination",
    label: "Anti-Hallucination Judge",
    weights: { consensus: 0.34, board: 0.14, team: 0.12, profile: 0.08, feature: 0.07, upside: 0.04, risk: 0.08, evidence: 0.13 },
  },
];

const scoreForAgent = ({ agent, pick, team, preference, prospect, feature, referenceBoards, roundVotes, previousTeamSelections }) => {
  const consensus = consensusValue(pick, prospect);
  const board = clamp(previousBoardSupport(pick, prospect, referenceBoards) * 15);
  const teamScore = positionNeedScore(team, preference, prospect, feature);
  const profile = averageProfile(prospect.profile);
  const featureScore = Number(feature?.derived?.referenceScore ?? 55);
  const upside = Number(prospect.profile?.upside ?? 55);
  const risk = riskScore(prospect, feature);
  const evidence = sourceEvidenceScore(prospect, feature);
  const playerFamilies = prospectFamilies(prospect, feature);
  const previousFamilies = new Set(previousTeamSelections.flatMap((item) => [...prospectFamilies(item.prospect, item.feature)]));
  const scarcity = [...playerFamilies].some((family) => previousFamilies.has(family)) ? 44 : 65 + playerFamilies.size * 3;
  const international = prospect.international ? 75 : 50;
  const program = prospect.school && prospect.school !== "-" ? 56 + Math.min(12, (prospect.sourceNotes ?? []).length) : 48;
  const values = { consensus, board, team: teamScore, profile, feature: featureScore, upside, risk, evidence, scarcity, international, program };
  const raw = Object.entries(agent.weights).reduce((sum, [key, weight]) => sum + (values[key] ?? 0) * weight, 0);
  const voteShare = roundVotes?.get(prospect.id) ?? 0;
  const debateBonus = voteShare ? Math.min(18, voteShare * 2.5) : 0;
  const phaseBonus =
    team.phase === "rebuild" ? (upside - 65) * 0.035 : team.phase === "contend" ? (risk - 70) * 0.035 : 0;
  return {
    score: round(raw + debateBonus + phaseBonus, 4),
    components: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, round(value)])),
  };
};

const rankForAgent = (params) =>
  params.available
    .map((prospect) => {
      const feature = params.featureByOrdinal.get(Number(prospect.localPool?.ordinal));
      const scored = scoreForAgent({ ...params, prospect, feature });
      return {
        prospect,
        feature,
        score: scored.score,
        components: scored.components,
      };
    })
    .sort((left, right) => right.score - left.score || Number(left.prospect.consensusRank ?? 999) - Number(right.prospect.consensusRank ?? 999));

const runVoteRound = (params) => {
  const votes = [];
  const allAgentTopScores = [];
  for (const agent of agentProfiles) {
    const ranking = rankForAgent({ ...params, agent });
    const top = ranking[0];
    votes.push({
      agentId: agent.id,
      agentLabel: agent.label,
      prospectId: top.prospect.id,
      player: top.prospect.name,
      localOrdinal: top.prospect.localPool?.ordinal ?? null,
      score: top.score,
      components: top.components,
      topFive: ranking.slice(0, 5).map((item) => ({
        prospectId: item.prospect.id,
        player: item.prospect.name,
        score: item.score,
      })),
    });
    allAgentTopScores.push(...ranking.slice(0, 12).map((item) => ({ agentId: agent.id, prospect: item.prospect, score: item.score })));
  }
  const voteCounts = new Map();
  for (const vote of votes) voteCounts.set(vote.prospectId, (voteCounts.get(vote.prospectId) ?? 0) + 1);
  const candidates = [...voteCounts.entries()]
    .map(([prospectId, votesCount]) => {
      const prospect = params.available.find((item) => item.id === prospectId);
      const scores = allAgentTopScores.filter((item) => item.prospect.id === prospectId).map((item) => item.score);
      const averageScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
      return { prospectId, player: prospect?.name ?? prospectId, votes: votesCount, averageScore: round(averageScore) };
    })
    .sort((left, right) => right.votes - left.votes || right.averageScore - left.averageScore);
  return { votes, candidates, voteCounts };
};

const aggregateScores = (params, finalRoundVotes) =>
  params.available
    .map((prospect) => {
      const feature = params.featureByOrdinal.get(Number(prospect.localPool?.ordinal));
      const agentScores = agentProfiles.map((agent) => {
        const scored = scoreForAgent({ ...params, agent, prospect, feature, roundVotes: finalRoundVotes });
        return { agentId: agent.id, score: scored.score, components: scored.components };
      });
      const averageScore = agentScores.reduce((sum, item) => sum + item.score, 0) / agentScores.length;
      return {
        prospectId: prospect.id,
        player: prospect.name,
        localOrdinal: prospect.localPool?.ordinal ?? null,
        positions: prospect.positions ?? [],
        school: prospect.school ?? null,
        consensusRank: prospect.consensusRank ?? null,
        mockHeat: prospect.mockHeat ?? null,
        averageScore: round(averageScore),
        voteCount: finalRoundVotes.get(prospect.id) ?? 0,
        agentScores,
      };
    })
    .sort((left, right) => right.averageScore - left.averageScore || right.voteCount - left.voteCount);

const main = async () => {
  const [bundle, teamPreference, featureReference, ...calibrationBoards] = await Promise.all([
    readJson(localBundlePath),
    readJson(teamPreferencePath),
    readJson(featureReferencePath),
    ...calibrationBoardConfigs.map((config) => readJsonIfExists(config.path)),
  ]);

  const featureByOrdinal = buildFeatureByOrdinal(featureReference);
  const referenceBoards = calibrationBoardConfigs
    .map((config, index) => ({
      label: config.label,
      path: config.path,
      weight: config.weight,
      rows: extractBoardRows(calibrationBoards[index]),
      loaded: Boolean(calibrationBoards[index]),
    }))
    .filter((board) => board.loaded && board.rows.length);
  const available = [...bundle.prospects];
  const selectedByTeam = new Map();
  const boardRows = [];
  const pickAudits = [];

  console.log(`candidatePool=${available.length}; agents=${agentProfiles.length}; threshold=7`);

  for (const team of bundle.teams.slice(0, 30)) {
    const pick = Number(team.pick);
    const preference = preferenceForPick(teamPreference, pick);
    let roundVotes = new Map();
    let locked = null;
    const debateRounds = [];

    for (let roundIndex = 1; roundIndex <= 9; roundIndex += 1) {
      const voteRound = runVoteRound({
        pick,
        team,
        preference,
        available,
        featureByOrdinal,
        referenceBoards,
        roundVotes,
        previousTeamSelections: selectedByTeam.get(team.team) ?? [],
      });
      debateRounds.push({
        round: roundIndex,
        topCandidates: voteRound.candidates.slice(0, 6),
        votes: voteRound.votes,
      });
      const leader = voteRound.candidates[0];
      console.log(
        `pick ${String(pick).padStart(2, "0")} round ${roundIndex}: ${leader.player} ${leader.votes}/10`
      );
      if (leader.votes >= 7) {
        locked = {
          prospectId: leader.prospectId,
          player: leader.player,
          voteCount: leader.votes,
          consensusRound: roundIndex,
          finalRoundVotes: voteRound.voteCounts,
        };
        break;
      }
      roundVotes = new Map(voteRound.candidates.map((candidate) => [candidate.prospectId, candidate.votes]));
    }

    if (!locked) {
      const lastRound = debateRounds.at(-1);
      const fallback = lastRound.topCandidates[0];
      locked = {
        prospectId: fallback.prospectId,
        player: fallback.player,
        voteCount: fallback.votes,
        consensusRound: debateRounds.length,
        finalRoundVotes: new Map(lastRound.topCandidates.map((candidate) => [candidate.prospectId, candidate.votes])),
        auditFlag: "threshold_not_met_after_max_rounds",
      };
    }

    const selectedIndex = available.findIndex((prospect) => prospect.id === locked.prospectId);
    if (selectedIndex < 0) throw new Error(`Selected prospect not available: ${locked.prospectId}`);
    const [selected] = available.splice(selectedIndex, 1);
    const selectedFeature = featureByOrdinal.get(Number(selected.localPool?.ordinal));
    const allScores = aggregateScores(
      {
        pick,
        team,
        preference,
        available: [selected, ...available],
        featureByOrdinal,
        referenceBoards,
        roundVotes: locked.finalRoundVotes,
        previousTeamSelections: selectedByTeam.get(team.team) ?? [],
      },
      locked.finalRoundVotes
    );
    const selectedScore = allScores.find((item) => item.prospectId === selected.id);
    const runnerUp = allScores.find((item) => item.prospectId !== selected.id);
    const previousTeamSelections = selectedByTeam.get(team.team) ?? [];
    selectedByTeam.set(team.team, [...previousTeamSelections, { prospect: selected, feature: selectedFeature }]);

    const boardRow = {
      pick,
      team: team.team,
      prospectId: selected.id,
      player: selected.name,
      localOrdinal: selected.localPool?.ordinal ?? null,
      positions: selected.positions ?? [],
      school: selected.school ?? null,
      origin: selected.origin ?? null,
      consensusRank: selected.consensusRank ?? null,
      scoreExact: selectedScore?.averageScore ?? null,
      voteCount: locked.voteCount,
      consensusRound: locked.consensusRound,
      confidence: clamp(62 + locked.voteCount * 4 + Math.max(0, (selectedScore?.averageScore ?? 0) - (runnerUp?.averageScore ?? 0)) * 0.6),
      margin: runnerUp ? round((selectedScore?.averageScore ?? 0) - runnerUp.averageScore) : null,
      reviewedCandidates: available.length + 1,
      remainingAfter: available.length,
    };
    boardRows.push(boardRow);
    pickAudits.push({
      pick,
      team: team.team,
      selected: boardRow,
      runnerUp: runnerUp
        ? {
            prospectId: runnerUp.prospectId,
            player: runnerUp.player,
            averageScore: runnerUp.averageScore,
            voteCount: runnerUp.voteCount,
          }
        : null,
      debateRounds,
      allScores,
      noManualOverride: true,
      selectedFromLocalPool: true,
      removedProspectId: selected.id,
    });
    console.log(`LOCK pick ${String(pick).padStart(2, "0")}: ${selected.name} (${locked.voteCount}/10 in round ${locked.consensusRound})`);
  }

  const uniqueSelected = new Set(boardRows.map((row) => row.prospectId));
  const currentReferenceRows = referenceBoards.find((board) => board.label === "current_frontend")?.rows ?? [];
  const changedVsCurrent = boardRows.filter((row) => boardCandidateForPick(currentReferenceRows, row.pick) !== row.prospectId);
  const artifact = {
    schemaVersion: "consensus-10-agent-v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/run-consensus-10-agent-prediction.mjs",
    method:
      "Sequential local-data prediction. Ten deterministic agent lenses vote each pick; debate rounds continue until a prospect reaches at least 7/10 votes, then the prospect is removed before the next pick.",
    inputFiles: {
      localBundlePath,
      teamPreferencePath,
      featureReferencePath,
      currentBoardPath,
      deepseekBoardPath,
      codexBoardPath,
      calibrationBoardConfigs,
    },
    guardrails: {
      localCandidatePoolOnly: true,
      uniqueCandidatePool: bundle.prospects.length,
      requiredVoteThreshold: 7,
      agentCount: agentProfiles.length,
      calibrationBoardsLoaded: referenceBoards.map(({ label, weight, rows }) => ({ label, weight, picks: rows.length })),
      noManualOverride: true,
      noHumanPickInjection: true,
      selectedProspectRemovedBeforeNextPick: true,
    },
    agents: agentProfiles.map(({ id, label, weights }) => ({ id, label, weights })),
    summary: {
      pickCount: boardRows.length,
      uniqueSelectedProspects: uniqueSelected.size,
      remainingProspects: available.length,
      totalCandidateReviews: pickAudits.reduce((sum, audit) => sum + audit.selected.reviewedCandidates, 0),
      allPicksReachedThreshold: pickAudits.every((audit) => audit.selected.voteCount >= 7),
      averageConsensusRound: round(pickAudits.reduce((sum, audit) => sum + audit.selected.consensusRound, 0) / pickAudits.length),
      averageVoteCount: round(pickAudits.reduce((sum, audit) => sum + audit.selected.voteCount, 0) / pickAudits.length),
      changedVsCurrentBoardCount: changedVsCurrent.length,
      changedVsCurrentBoardPicks: changedVsCurrent.map((row) => row.pick),
    },
    boardRows,
    pickAudits,
    remainingProspects: available.map((prospect) => ({
      prospectId: prospect.id,
      player: prospect.name,
      localOrdinal: prospect.localPool?.ordinal ?? null,
      consensusRank: prospect.consensusRank ?? null,
    })),
  };

  await mkdir(dirname(outputJsonPath), { recursive: true });
  await mkdir(dirname(outputReportPath), { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  const report = [
    "# 10-Agent Consensus Prediction",
    "",
    `Generated: ${artifact.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Picks: ${artifact.summary.pickCount}`,
    `- Unique selected prospects: ${artifact.summary.uniqueSelectedProspects}`,
    `- Remaining prospects: ${artifact.summary.remainingProspects}`,
    `- Total candidate reviews: ${artifact.summary.totalCandidateReviews}`,
    `- Vote threshold met for every pick: ${artifact.summary.allPicksReachedThreshold}`,
    `- Average consensus round: ${artifact.summary.averageConsensusRound}`,
    `- Average selected vote count: ${artifact.summary.averageVoteCount}/10`,
    `- Changed vs current frontend board: ${artifact.summary.changedVsCurrentBoardCount}`,
    "",
    "## Board",
    "",
    "| Pick | Team | Player | Votes | Round | Score | Margin |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: |",
    ...boardRows.map(
      (row) =>
        `| ${row.pick} | ${row.team} | ${row.player} | ${row.voteCount}/10 | ${row.consensusRound} | ${row.scoreExact} | ${row.margin} |`
    ),
    "",
    "## Fragile Locks",
    "",
    ...boardRows
      .filter((row) => row.voteCount < 8 || row.consensusRound > 2)
      .map((row) => `- ${row.pick}: ${row.team} -> ${row.player} (${row.voteCount}/10, round ${row.consensusRound}, margin ${row.margin})`),
    "",
  ].join("\n");
  await writeFile(outputReportPath, report, "utf8");

  console.log(
    JSON.stringify(
      {
        output: { json: outputJsonPath, report: outputReportPath },
        summary: artifact.summary,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
