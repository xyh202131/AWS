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
const ragDir = resolve(rootDir, "data", "rag");

const outputJsonPath = resolve(rootDir, "data", "boards", `relative_scoring_prediction_${runStamp}.json`);
const outputReportPath = resolve(rootDir, "data", "reports", `relative_scoring_prediction_${runStamp}.md`);

const tagAliases = {
  "alpha scorer": "shot creator",
  "lead guard": "primary guard",
  "point guard": "primary guard",
  "big guard": "guard",
  "bench guard": "combo guard",
  "guard depth": "combo guard",
  "shooting guard": "combo guard",
  shooter: "shooting",
  spacing: "shooting",
  "floor spacing": "shooting",
  "pull-up shooting": "shooting",
  "pull up shooting": "shooting",
  "movement shooting": "shooting",
  "secondary creation": "creation",
  "secondary ball handling": "playmaking",
  "secondary handler": "playmaking",
  "late clock offense": "shot creator",
  "self creation": "shot creator",
  "paint touch": "rim pressure",
  "frontcourt scoring": "frontcourt engine",
  "frontcourt depth": "frontcourt",
  "bench size": "frontcourt",
  "center depth": "frontcourt",
  big: "frontcourt",
  forward: "wing",
  "vertical spacing": "interior finisher",
  "interior scoring": "interior finisher",
  "rim protection": "rim protector",
  "defensive size": "defense",
  "defensive playmaking": "defense",
  "team defense": "defense",
  "defensive activity": "defense",
  "point of attack defense": "defense",
  "point-of-attack defense": "defense",
  "switchable forward": "big wing",
  "physical wing": "big wing",
  "wing shooting": "3-and-D",
  "low usage defense": "3-and-D",
  "low-usage defense": "3-and-D",
  "fan facing upside": "star upside",
  "fan-facing upside": "star upside",
  toughness: "maturity",
  "two way": "defense",
  "two-way": "defense",
};

const tagFamilies = {
  "primary guard": ["guard", "playmaking", "creation"],
  "combo guard": ["guard", "shooting", "creation"],
  guard: ["guard"],
  "shot creator": ["creation", "scoring"],
  playmaking: ["guard", "creation", "feel"],
  creation: ["creation"],
  "wing creator": ["wing", "creation", "scoring"],
  "big wing": ["wing", "forward", "size", "defense"],
  "3-and-D": ["wing", "shooting", "defense"],
  shooting: ["shooting", "spacing"],
  "rim protector": ["frontcourt", "defense", "size"],
  rebounder: ["frontcourt", "size"],
  connector: ["feel", "passing", "decision maker"],
  "frontcourt engine": ["frontcourt", "feel", "rebounder"],
  frontcourt: ["frontcourt", "size"],
  "stretch forward": ["wing", "frontcourt", "shooting", "size"],
  "star upside": ["upside_asset", "creation"],
  "interior finisher": ["frontcourt", "finisher", "size"],
  "off-ball": ["shooting", "feel"],
  defense: ["defense"],
  size: ["size"],
  transition: ["upside_asset", "creation"],
  international: ["international"],
  maturity: ["feel"],
};

const familyAliases = {
  forward: "wing",
  scoring: "creation",
  shooter: "shooting",
  spacing: "shooting",
  upside: "upside_asset",
  athleticism: "upside_asset",
  playmaking: "creation",
  "shot creator": "creation",
  "decision maker": "feel",
  passing: "feel",
  rebounder: "frontcourt",
  finisher: "frontcourt",
};

const familyLabels = {
  guard: "Guard / ball handling",
  wing: "Wing",
  frontcourt: "Frontcourt",
  shooting: "Shooting / spacing",
  creation: "Creation / scoring",
  defense: "Defense",
  size: "Size",
  upside_asset: "Upside / asset value",
  feel: "Feel / connector",
  international: "International",
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const average = (values) => {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
};

const normalizeName = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeTag = (value) => {
  const clean = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return tagAliases[clean] ?? clean;
};

const normalizeFamily = (value) => {
  const clean = normalizeTag(value);
  return familyAliases[clean] ?? clean;
};

const buildSignalSet = (values) => {
  const signals = new Set();
  values.filter(Boolean).forEach((value) => {
    const canonical = normalizeTag(value);
    if (!canonical) return;
    signals.add(canonical);
    signals.add(normalizeFamily(canonical));
    canonical.split(" ").forEach((part) => {
      if (part.length > 3) signals.add(normalizeFamily(part));
    });
    tagFamilies[canonical]?.forEach((family) => signals.add(normalizeFamily(family)));
  });
  return signals;
};

const intersection = (left, right) => [...left].filter((value) => right.has(value));

const getDraftZone = (pick) => {
  if (pick <= 5) return "top-five";
  if (pick <= 14) return "lottery";
  return "late-first";
};

const getPositionFamilies = (positions) => {
  const families = new Set();
  if ((positions ?? []).some((position) => position === "PG" || position === "SG")) families.add("guard");
  if ((positions ?? []).some((position) => position === "SF" || position === "PF")) families.add("wing");
  if ((positions ?? []).some((position) => position === "PF" || position === "C")) families.add("frontcourt");
  if ((positions ?? []).includes("C")) families.add("size");
  return families;
};

const getProfileFamilies = (profile = {}) => {
  const families = new Set();
  if (profile.shooting >= 80) families.add("shooting");
  if (profile.creation >= 80) families.add("creation");
  if (profile.defense >= 80) families.add("defense");
  if (profile.size >= 82) families.add("size");
  if (profile.feel >= 82) families.add("feel");
  if (profile.upside >= 84 || profile.athleticism >= 86) families.add("upside_asset");
  return families;
};

const getFeatureFamilies = (feature) => {
  const families = new Set();
  const derived = feature?.derived ?? {};
  if (derived.shootingDrillScore >= 70) families.add("shooting");
  if (derived.physicalToolsScore >= 72) {
    families.add("size");
    families.add("defense");
  }
  if (derived.explosivenessScore >= 75 || derived.agilitySpeedScore >= 75) families.add("upside_asset");
  return families;
};

const getProspectFamilies = (prospect, feature) => {
  const families = new Set();
  getPositionFamilies(prospect.positions ?? []).forEach((family) => families.add(family));
  getProfileFamilies(prospect.profile ?? {}).forEach((family) => families.add(family));
  getFeatureFamilies(feature).forEach((family) => families.add(family));
  buildSignalSet(prospect.roleTags ?? []).forEach((signal) => {
    const family = normalizeFamily(signal);
    if (familyLabels[family]) families.add(family);
  });
  if (prospect.international) families.add("international");
  return families;
};

const getFeatureByOrdinal = (featureReference) => {
  const map = new Map();
  for (const player of featureReference.players ?? []) map.set(player.poolOrdinal, player);
  return map;
};

const loadRagChunks = async () => {
  const files = [
    "rag-core-board.json",
    "rag-team-preference.json",
    "rag-prospect-evidence.json",
    "rag-milestone.json",
    "rag-architecture.json",
  ];
  const chunks = [];
  for (const file of files) {
    const path = resolve(ragDir, file);
    if (!existsSync(path)) continue;
    const artifact = await readJson(path);
    for (const chunk of artifact.chunks ?? []) {
      chunks.push({
        indexId: artifact.id,
        source: chunk.source,
        path: chunk.path,
        trustTier: chunk.sourceTrustTier,
        text: String(chunk.text ?? ""),
      });
    }
  }
  return chunks;
};

const buildRagEvidenceIndex = (prospects, ragChunks) => {
  const trustWeight = {
    "locked-artifact": 4,
    "official-or-reverified": 3.5,
    "normalized-data": 2.5,
  };
  const index = new Map();

  for (const prospect of prospects) {
    const terms = [
      normalizeName(prospect.name),
      String(prospect.localPool?.nameZh ?? "").trim().toLowerCase(),
      String(prospect.id ?? "").replace(/-/g, " ").toLowerCase(),
    ].filter((term) => term.length >= 3 || /[\u4e00-\u9fff]/.test(term));

    const matches = [];
    for (const chunk of ragChunks) {
      const haystack = `${chunk.source}\n${chunk.path}\n${chunk.text}`.toLowerCase();
      if (!terms.some((term) => haystack.includes(term))) continue;
      matches.push({
        indexId: chunk.indexId,
        source: chunk.source,
        path: chunk.path,
        trustTier: chunk.trustTier,
        text: chunk.text.slice(0, 700),
        weight: trustWeight[chunk.trustTier] ?? 1,
      });
    }

    const totalTrustWeight = matches.reduce((sum, match) => sum + match.weight, 0);
    index.set(prospect.id, {
      count: matches.length,
      totalTrustWeight,
      snippets: matches.sort((left, right) => right.weight - left.weight).slice(0, 5),
    });
  }

  return index;
};

const getTeamRagSnippets = ({ team, ragChunks }) => {
  const terms = [team.team, ...(team.needs ?? []), ...(team.priorityTags ?? [])]
    .map((term) => String(term ?? "").toLowerCase())
    .filter((term) => term.length > 3);
  return ragChunks
    .map((chunk) => {
      const haystack = `${chunk.source}\n${chunk.path}\n${chunk.text}`.toLowerCase();
      const matches = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      const trustBoost = chunk.trustTier === "official-or-reverified" ? 2 : chunk.trustTier === "locked-artifact" ? 1.5 : 1;
      return { ...chunk, score: matches * trustBoost };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((chunk) => ({
      indexId: chunk.indexId,
      source: chunk.source,
      path: chunk.path,
      trustTier: chunk.trustTier,
      text: chunk.text.slice(0, 700),
    }));
};

const getDynamicWeights = (team) => {
  const zone = getDraftZone(Number(team.pick));
  const weights = {
    consensus: 28,
    need: 23,
    player: 18,
    upside: 14,
    feature: 8,
    source: 9,
  };

  if (zone === "top-five") {
    weights.consensus += 4;
    weights.upside += 6;
    weights.need -= 2;
  } else if (zone === "lottery") {
    weights.need += 4;
    weights.player += 2;
    weights.consensus -= 2;
  } else {
    weights.need += 7;
    weights.player += 3;
    weights.feature += 3;
    weights.consensus -= 5;
    weights.upside -= 4;
  }

  if (team.phase === "rebuild") {
    weights.upside += 4;
    weights.consensus += 2;
  } else if (team.phase === "accelerate") {
    weights.need += 3;
    weights.player += 2;
  } else if (team.phase === "contend") {
    weights.need += 4;
    weights.player += 4;
    weights.source += 2;
    weights.upside -= 4;
  } else if (team.phase === "asset") {
    weights.upside += 3;
    weights.source += 2;
  }

  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(1, value), 0);
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.max(1, value) / total]));
};

const getConsensusScore = (team, prospect) => {
  const pick = Number(team.pick);
  const rank = Number(prospect.consensusRank ?? 160);
  const reachDistance = rank - pick;
  const fallDistance = pick - rank;
  let score = 100 - Math.abs(rank - pick) * 3.35;

  if (pick <= 5 && reachDistance > 5) score -= (reachDistance - 5) * 1.2 + 7;
  if (pick <= 14 && reachDistance > 9) score -= (reachDistance - 9) * 0.8 + 4;
  if (pick >= 15 && reachDistance > 16) score -= (reachDistance - 16) * 0.45;
  if (pick >= 10 && fallDistance > 7) score += Math.min(8, (fallDistance - 7) * 0.9);

  return clamp(score);
};

const getPositionBonus = (teamSignals, prospect) => {
  const positions = prospect.positions ?? [];
  let bonus = 0;
  if (teamSignals.has("guard") && positions.some((position) => position === "PG" || position === "SG")) bonus += 10;
  if (teamSignals.has("wing") && positions.some((position) => position === "SF" || position === "PF")) bonus += 10;
  if ((teamSignals.has("frontcourt") || teamSignals.has("size")) && positions.some((position) => position === "PF" || position === "C")) {
    bonus += 10;
  }
  if (teamSignals.has("international") && prospect.international) bonus += 4;
  return clamp(bonus, 0, 16);
};

const getSkillNeedBonus = ({ teamSignals, prospect, feature }) => {
  const profile = prospect.profile ?? {};
  const derived = feature?.derived ?? {};
  let bonus = 0;

  if (teamSignals.has("shooting")) bonus += clamp((Math.max(profile.shooting ?? 0, derived.shootingDrillScore ?? 0) - 68) * 0.35, -3, 9);
  if (teamSignals.has("creation")) bonus += clamp(((profile.creation ?? 0) - 68) * 0.35, -3, 9);
  if (teamSignals.has("defense")) bonus += clamp((Math.max(profile.defense ?? 0, derived.physicalToolsScore ?? 0) - 68) * 0.3, -3, 8);
  if (teamSignals.has("size") || teamSignals.has("frontcourt")) bonus += clamp((Math.max(profile.size ?? 0, derived.physicalToolsScore ?? 0) - 70) * 0.3, -3, 8);
  if (teamSignals.has("feel")) bonus += clamp(((profile.feel ?? 0) - 70) * 0.25, -2, 6);
  if (teamSignals.has("upside_asset")) bonus += clamp((Math.max(profile.upside ?? 0, derived.explosivenessScore ?? 0) - 72) * 0.25, -2, 7);

  return clamp(bonus, -8, 24);
};

const getNeedScore = ({ team, prospect, prospectFamilies, preferenceEntry, feature }) => {
  const preferenceFamilies = (preferenceEntry?.preferenceFamilies ?? []).map(normalizeFamily);
  const teamSignals = buildSignalSet([...(team.needs ?? []), ...(team.priorityTags ?? []), ...preferenceFamilies]);
  const overlapFamilies = intersection(prospectFamilies, teamSignals).filter((family) => familyLabels[family]);
  const preferenceSet = new Set(preferenceFamilies.filter((family) => familyLabels[family]));
  const preferenceOverlap = intersection(prospectFamilies, preferenceSet);
  const preferenceRatio = preferenceSet.size ? preferenceOverlap.length / preferenceSet.size : 0;
  const coefficient = clamp(preferenceEntry?.needConfidenceCoefficient ?? 0.55, 0, 1);
  const positionBonus = getPositionBonus(teamSignals, prospect);
  const skillBonus = getSkillNeedBonus({ teamSignals, prospect, feature });
  const overlapScore = clamp(44 + overlapFamilies.length * 7 + preferenceRatio * 22 + positionBonus + skillBonus);
  return {
    score: clamp(50 + (overlapScore - 50) * (0.45 + coefficient * 0.55)),
    teamSignals: [...teamSignals].filter((family) => familyLabels[family]).sort(),
    overlapFamilies,
    preferenceFamilies: [...preferenceSet],
    preferenceOverlap,
    preferenceRatio,
    needConfidenceCoefficient: coefficient,
    positionBonus,
    skillBonus: round(skillBonus, 3),
  };
};

const getPlayerScore = (team, prospect) => {
  const profile = prospect.profile ?? {};
  const base = average([profile.shooting, profile.creation, profile.defense, profile.athleticism, profile.feel, profile.size]);
  const phaseFit =
    team.phase === "contend"
      ? average([profile.shooting, profile.defense, profile.feel])
      : team.phase === "rebuild"
        ? average([profile.creation, profile.athleticism, profile.size, profile.upside])
        : team.phase === "asset"
          ? average([profile.upside, profile.size, profile.creation])
          : average([profile.creation, profile.defense, profile.feel, profile.shooting]);
  return clamp(base * 0.62 + phaseFit * 0.38);
};

const getUpsideScore = (team, prospect) => {
  const profile = prospect.profile ?? {};
  const age = Number.isFinite(Number(prospect.age)) ? Number(prospect.age) : 22;
  const ageBonus = clamp((22.4 - age) * 3.2, -6, 11);
  const riskPremium = (Number(team.riskTolerance ?? 55) - 55) * 0.13;
  const zoneBonus = getDraftZone(Number(team.pick)) === "top-five" ? 3 : getDraftZone(Number(team.pick)) === "late-first" ? -2 : 0;
  return clamp((profile.upside ?? 60) + ageBonus + riskPremium + zoneBonus);
};

const getFeatureScore = ({ feature, teamSignals }) => {
  if (!feature) return { score: 45, reason: "missing-feature-reference", derived: null };
  const derived = feature.derived ?? {};
  const relevant = [derived.referenceScore ?? 50];
  if (teamSignals.has("shooting")) relevant.push(derived.shootingDrillScore ?? 50);
  if (teamSignals.has("size") || teamSignals.has("frontcourt") || teamSignals.has("defense")) relevant.push(derived.physicalToolsScore ?? 50);
  if (teamSignals.has("guard")) relevant.push(derived.agilitySpeedScore ?? 50);
  if (teamSignals.has("upside_asset")) relevant.push(derived.explosivenessScore ?? 50);
  return {
    score: clamp(average(relevant)),
    reason: "pool-feature-reference",
    derived: {
      referenceScore: derived.referenceScore ?? null,
      referenceTier: derived.referenceTier ?? null,
      physicalToolsScore: derived.physicalToolsScore ?? null,
      explosivenessScore: derived.explosivenessScore ?? null,
      agilitySpeedScore: derived.agilitySpeedScore ?? null,
      shootingDrillScore: derived.shootingDrillScore ?? null,
      tags: derived.tags ?? [],
    },
  };
};

const getSourceScore = ({ prospect, ragEvidence, preferenceEntry }) => {
  const notes = prospect.sourceNotes ?? [];
  const officialOrRankNotes = notes.filter((note) => /nba\.com|official|espn|tankathon|consensus|mock/i.test(note)).length;
  const fallbackPenalty = prospect.localPool?.matchStatus === "fallback-local-only" ? 10 : 0;
  const preferenceEvidenceBonus = Math.min(4, (preferenceEntry?.sourceEvidenceNotes ?? []).length * 1.5);
  const score =
    43 +
    Math.min(18, notes.length * 2.2) +
    Math.min(12, officialOrRankNotes * 2) +
    Math.min(18, (ragEvidence?.totalTrustWeight ?? 0) * 0.55) +
    preferenceEvidenceBonus -
    fallbackPenalty;
  return clamp(score);
};

const getRiskPenalty = ({ team, prospect, feature }) => {
  const risks = (prospect.risks ?? []).map((risk) => String(risk).toLowerCase());
  const teamSignals = buildSignalSet([...(team.needs ?? []), ...(team.priorityTags ?? [])]);
  let penalty = 0;

  if (prospect.localPool?.matchStatus === "fallback-local-only") penalty += team.phase === "contend" ? 7 : 5;
  if (risks.some((risk) => risk.includes("medical") || risk.includes("health"))) penalty += team.phase === "contend" ? 10 : 6;
  if (risks.some((risk) => risk.includes("shoot")) && teamSignals.has("shooting")) penalty += 5;
  if (risks.some((risk) => risk.includes("strength")) && (teamSignals.has("frontcourt") || teamSignals.has("size"))) penalty += 4;
  if (risks.some((risk) => risk.includes("decision") || risk.includes("turnover")) && team.phase === "contend") penalty += 5;
  if (feature && (feature.derived?.dataCompletenessScore ?? 100) < 45) penalty += 2;
  return clamp(penalty, 0, 18);
};

const getPickValueAdjustment = (team, prospect) => {
  const pick = Number(team.pick);
  const rank = Number(prospect.consensusRank ?? 160);
  const reachDistance = rank - pick;
  const fallDistance = pick - rank;
  let adjustment = 0;

  if (pick <= 5 && reachDistance > 5) adjustment -= Math.min(9, (reachDistance - 5) * 1.15);
  else if (pick <= 14 && reachDistance > 9) adjustment -= Math.min(6, (reachDistance - 9) * 0.75);
  else if (pick > 14 && reachDistance > 18) adjustment -= Math.min(4, (reachDistance - 18) * 0.25);

  if (pick >= 10 && fallDistance >= 8) adjustment += Math.min(7, (fallDistance - 7) * 0.8);
  if (pick >= 18 && rank <= 14 && fallDistance >= 4) adjustment += Math.min(5, (fallDistance - 3) * 0.6);
  return clamp(adjustment, -10, 9);
};

const getSequencingAdjustment = ({ prospectFamilies, previousTeamSelections, preferenceFamilies }) => {
  if (!previousTeamSelections.length) {
    return {
      adjustment: 0,
      reason: "first-pick-for-team",
      overlappingPreviousFamilies: [],
      newPreferenceFamilies: [...preferenceFamilies],
    };
  }

  const previousFamilies = new Set(previousTeamSelections.flatMap((selection) => selection.families ?? []));
  const overlappingPreviousFamilies = intersection(prospectFamilies, previousFamilies).filter((family) => familyLabels[family]);
  const newPreferenceFamilies = [...preferenceFamilies].filter((family) => prospectFamilies.has(family) && !previousFamilies.has(family));
  const adjustment = clamp(newPreferenceFamilies.length * 1.2 - overlappingPreviousFamilies.length * 0.9, -4, 4);
  return {
    adjustment,
    reason: adjustment >= 0 ? "adds-or-balances-same-team-portfolio" : "overlaps-prior-same-team-selection",
    overlappingPreviousFamilies,
    newPreferenceFamilies,
  };
};

// ========== RELATIVE SCORING: Min-Max Normalizer ==========
const minMaxNormalize = (values) => {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return () => 50;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min;
  if (range < 0.0001) return () => 50;
  return (raw) => clamp(((raw - min) / range) * 100, 0, 100);
};

const scoreCandidate = ({ team, prospect, preferenceEntry, feature, ragEvidence, previousTeamSelections, normalizers }) => {
  const weights = getDynamicWeights(team);
  const prospectFamilies = getProspectFamilies(prospect, feature);
  const need = getNeedScore({ team, prospect, prospectFamilies, preferenceEntry, feature });
  const featureScore = getFeatureScore({ feature, teamSignals: new Set(need.teamSignals) });
  const sequencing = getSequencingAdjustment({
    prospectFamilies,
    previousTeamSelections,
    preferenceFamilies: new Set(need.preferenceFamilies),
  });
  const rawBreakdown = {
    consensus: getConsensusScore(team, prospect),
    need: need.score,
    player: getPlayerScore(team, prospect),
    upside: getUpsideScore(team, prospect),
    feature: featureScore.score,
    source: getSourceScore({ prospect, ragEvidence, preferenceEntry }),
  };
  // If normalizers provided, apply RELATIVE min-max normalization across current pool
  const breakdown = normalizers ? {
    consensus: normalizers.consensus(rawBreakdown.consensus),
    need: normalizers.need(rawBreakdown.need),
    player: normalizers.player(rawBreakdown.player),
    upside: normalizers.upside(rawBreakdown.upside),
    feature: normalizers.feature(rawBreakdown.feature),
    source: normalizers.source(rawBreakdown.source),
  } : rawBreakdown;
  const riskPenalty = getRiskPenalty({ team, prospect, feature });
  const pickValueAdjustment = getPickValueAdjustment(team, prospect);
  const weightedScore =
    breakdown.consensus * weights.consensus +
    breakdown.need * weights.need +
    breakdown.player * weights.player +
    breakdown.upside * weights.upside +
    breakdown.feature * weights.feature +
    breakdown.source * weights.source;
  const finalScore = clamp(weightedScore + pickValueAdjustment + sequencing.adjustment - riskPenalty);

  return {
    prospectId: prospect.id,
    name: prospect.name,
    localNameZh: prospect.localPool?.nameZh ?? null,
    localOrdinal: prospect.localPool?.ordinal ?? null,
    positions: prospect.positions ?? [],
    school: prospect.school,
    origin: prospect.origin,
    classYear: prospect.classYear,
    age: prospect.age,
    international: Boolean(prospect.international),
    consensusRank: prospect.consensusRank,
    mockHeat: prospect.mockHeat,
    matchStatus: prospect.localPool?.matchStatus ?? "unknown",
    families: [...prospectFamilies].sort(),
    score: round(finalScore, 3),
    scoreRounded: Math.round(finalScore),
    weightedScore: round(weightedScore, 3),
    breakdown: Object.fromEntries(Object.entries(breakdown).map(([key, value]) => [key, round(value, 3)])),
    rawBreakdown: Object.fromEntries(Object.entries(rawBreakdown).map(([key, value]) => [key, round(value, 3)])),
    weights: Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, round(value, 4)])),
    need,
    featureReference: featureScore,
    sourceEvidence: {
      sourceNoteCount: (prospect.sourceNotes ?? []).length,
      ragMatchCount: ragEvidence?.count ?? 0,
      ragTrustWeight: round(ragEvidence?.totalTrustWeight ?? 0, 3),
      snippets: ragEvidence?.snippets ?? [],
    },
    riskPenalty: round(riskPenalty, 3),
    pickValueAdjustment: round(pickValueAdjustment, 3),
    sequencingAdjustment: round(sequencing.adjustment, 3),
    sequencing,
    strengths: (prospect.strengths ?? []).slice(0, 4),
    risks: (prospect.risks ?? []).slice(0, 4),
    sourceNotes: (prospect.sourceNotes ?? []).slice(0, 5),
  };
};

const compareCandidates = (left, right) => {
  const scoreDelta = right.score - left.score;
  if (Math.abs(scoreDelta) > 0.0001) return scoreDelta;
  const consensusDelta = Number(left.consensusRank ?? 999) - Number(right.consensusRank ?? 999);
  if (consensusDelta !== 0) return consensusDelta;
  const needDelta = right.breakdown.need - left.breakdown.need;
  if (Math.abs(needDelta) > 0.0001) return needDelta;
  return left.name.localeCompare(right.name);
};

const getConfidence = ({ selected, runnerUp, team }) => {
  const margin = runnerUp ? selected.score - runnerUp.score : 10;
  const rankPenalty = Math.abs(Number(selected.consensusRank ?? 100) - Number(team.pick)) * 0.55;
  const dataPenalty = selected.matchStatus === "fallback-local-only" ? 4 : 0;
  const marginBonus = clamp(margin * 1.7, -8, 12);
  return Math.round(clamp(selected.score - rankPenalty + marginBonus - dataPenalty));
};

const toBoardRow = ({ team, selected, runnerUp, confidence, remainingBefore, remainingAfter }) => ({
  pick: Number(team.pick),
  team: team.team,
  acquiredFrom: team.acquiredFrom ?? null,
  prospectId: selected.prospectId,
  player: selected.name,
  localNameZh: selected.localNameZh,
  localOrdinal: selected.localOrdinal,
  positions: selected.positions,
  position: selected.positions.join("/"),
  school: selected.school,
  origin: selected.origin,
  classYear: selected.classYear,
  international: selected.international,
  consensusRank: selected.consensusRank,
  mockHeat: selected.mockHeat,
  score: selected.scoreRounded,
  scoreExact: selected.score,
  confidence,
  margin: runnerUp ? round(selected.score - runnerUp.score, 3) : null,
  reviewedCandidates: remainingBefore,
  remainingBefore,
  remainingAfter,
  matchStatus: selected.matchStatus,
  breakdown: selected.breakdown,
  dynamicAdjustments: {
    pickValueAdjustment: selected.pickValueAdjustment,
    sequencingAdjustment: selected.sequencingAdjustment,
    riskPenalty: selected.riskPenalty,
  },
  overlapFamilies: selected.need.overlapFamilies,
  preferenceOverlap: selected.need.preferenceOverlap,
  featureReference: selected.featureReference.derived,
  topAlternative: runnerUp
    ? {
        prospectId: runnerUp.prospectId,
        name: runnerUp.name,
        localNameZh: runnerUp.localNameZh,
        score: runnerUp.score,
        consensusRank: runnerUp.consensusRank,
      }
    : null,
  reason: [
    `score ${selected.score}`,
    `need overlap ${selected.need.overlapFamilies.join(", ") || "none"}`,
    `consensus rank ${selected.consensusRank}`,
    `risk penalty ${selected.riskPenalty}`,
  ].join("; "),
});

const compareWithCurrentBoard = (boardRows, currentBoard) => {
  const currentRows =
    currentBoard.boardRows ??
    (currentBoard.board ?? []).map((pick) => ({
      pick: pick.pick,
      player: pick.prospect?.name ?? pick.player,
      prospectId: pick.prospect?.id ?? pick.prospectId,
      localNameZh: pick.prospect?.localPool?.nameZh ?? pick.localNameZh,
    }));
  const currentByPick = new Map(currentRows.map((row) => [Number(row.pick), row]));
  return boardRows
    .filter((row) => currentByPick.get(Number(row.pick))?.prospectId !== row.prospectId)
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      currentProspectId: currentByPick.get(Number(row.pick))?.prospectId ?? null,
      currentPlayer: currentByPick.get(Number(row.pick))?.player ?? null,
      currentLocalNameZh: currentByPick.get(Number(row.pick))?.localNameZh ?? null,
      relativeProspectId: row.prospectId,
      relativePlayer: row.player,
      relativeLocalNameZh: row.localNameZh,
    }));
};

const validateArtifact = ({ boardRows, remainingProspects, pickAudits, initialCandidateCount }) => {
  const selectedIds = boardRows.map((row) => row.prospectId);
  const duplicateSelectedProspectIds = selectedIds.filter((id, index) => selectedIds.indexOf(id) !== index);
  const expectedReviewCount = Array.from({ length: 30 }, (_, index) => initialCandidateCount - index).reduce((sum, value) => sum + value, 0);
  const actualReviewCount = pickAudits.reduce((sum, pick) => sum + pick.reviewedCandidates, 0);
  return {
    pickCountIs30: boardRows.length === 30,
    uniqueSelectedIs30: new Set(selectedIds).size === 30,
    remainingIs93: remainingProspects.length === 93,
    noDuplicateSelectedProspects: duplicateSelectedProspectIds.length === 0,
    reviewedAllRemainingEachPick: actualReviewCount === expectedReviewCount,
    expectedReviewCount,
    actualReviewCount,
    duplicateSelectedProspectIds,
  };
};

const makeReport = ({ artifact }) => {
  const boardRows = artifact.boardRows.map(
    (row) =>
      `| ${row.pick} | ${row.team} | ${row.player} | ${row.localNameZh ?? ""} | ${row.position} | ${row.consensusRank} | ${row.scoreExact} | ${row.confidence} | ${row.margin ?? ""} | ${row.reviewedCandidates} |`,
  );
  const changedRows = artifact.changedVsCurrentBoard.map(
    (row) =>
      `| ${row.pick} | ${row.team} | ${row.currentPlayer ?? ""} | ${row.currentLocalNameZh ?? ""} | ${row.relativePlayer} | ${row.relativeLocalNameZh ?? ""} |`,
  );
  const validationRows = Object.entries(artifact.validation).map(([key, value]) => `| ${key} | ${Array.isArray(value) ? value.join(", ") : value} |`);

  return [
    "# Relative Pool-Scoring Prediction (Min-Max Normalized per Pick)",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Script: \`${artifact.generatedBy}\``,
    "",
    "## Key Difference: Relative vs Absolute Scoring",
    "",
    "- **Absolute scoring (previous versions)**: Each prospect receives a fixed global grade (e.g. 85/100) regardless of who else is available. Scores are computed against static thresholds.",
    "- **Relative scoring (this run)**: At each pick, ALL remaining candidates are scored on raw dimensions, then each dimension is **min-max normalized within the current available pool** (0 = worst remaining, 100 = best remaining). The weighted sum uses these relative scores. After selecting the best relative prospect, they are removed and the next pick **renormalizes against the new smaller pool**.",
    "- This simulates true BPA (Best Player Available) draft logic: a player's value depends on who is still on the board.",
    "",
    "## Guardrails",
    "",
    "- No manual prediction or hand-written pick list was used.",
    "- Candidate pool is loaded from `data/final/local_pool_124_import_bundle.json` and validated as 123 unique candidates.",
    "- For every pick, the script scored every remaining candidate in TWO passes: (1) raw dimension scores, (2) min-max normalization within the current pool, then weighted scoring. The top relative score was selected, removed, and normalization was redone for the next pick.",
    "- Inputs used by the scoring model: team needs, team preference entries, player profile fields, feature reference, consensus rank/mock heat, source notes, and local RAG chunks.",
    "- `public/data` was read only for comparison; this run writes only the relative-scoring board/report outputs.",
    "",
    "## Summary",
    "",
    `- Picks: ${artifact.summary.pickCount}`,
    `- Unique selected players: ${artifact.summary.uniqueSelectedProspects}`,
    `- Remaining prospects: ${artifact.summary.remainingProspects}`,
    `- Total candidate reviews: ${artifact.summary.totalCandidateReviews}`,
    `- Average score: ${artifact.summary.averageScore}`,
    `- Average confidence: ${artifact.summary.averageConfidence}`,
    `- Changed vs current frontend board: ${artifact.summary.changedVsCurrentBoardCount}`,
    "",
    "## Validation",
    "",
    "| Check | Value |",
    "|---|---|",
    ...validationRows,
    "",
    "## Board",
    "",
    "| Pick | Team | Player | Local name | Pos | Rank | Score | Confidence | Margin | Reviewed |",
    "|---:|---|---|---|---|---:|---:|---:|---:|---:|",
    ...boardRows,
    "",
    "## Changed Vs Current Frontend Board",
    "",
    artifact.changedVsCurrentBoard.length
      ? [
          "| Pick | Team | Current frontend | Current local name | Relative rerun | Relative local name |",
          "|---:|---|---|---|---|---|",
          ...changedRows,
        ].join("\n")
      : "No selected-player slots changed vs `public/data/agent_expanded_recommended_board.json`.",
    "",
  ].join("\n");
};

const runSequentialPrediction = ({ teams, prospects, teamPreference, featureReference, ragEvidenceIndex, ragChunks }) => {
  const preferenceByPick = new Map((teamPreference.entries ?? []).map((entry) => [Number(entry.pick), entry]));
  const featureByOrdinal = getFeatureByOrdinal(featureReference);
  const available = [...prospects].sort((left, right) => Number(left.consensusRank ?? 999) - Number(right.consensusRank ?? 999) || left.name.localeCompare(right.name));
  const teamHistory = new Map();
  const pickAudits = [];

  for (const team of teams.sort((left, right) => Number(left.pick) - Number(right.pick)).slice(0, 30)) {
    const preferenceEntry = preferenceByPick.get(Number(team.pick));
    const previousTeamSelections = teamHistory.get(team.team) ?? [];
    const remainingBefore = available.length;

    // === RELATIVE SCORING: TWO-PASS APPROACH ===
    // Pass 1: Compute raw scores for all remaining candidates (without normalization)
    const rawCandidates = available.map((prospect) =>
      scoreCandidate({
        team,
        prospect,
        preferenceEntry,
        feature: featureByOrdinal.get(prospect.localPool?.ordinal),
        ragEvidence: ragEvidenceIndex.get(prospect.id),
        previousTeamSelections,
        normalizers: null, // raw pass
      }),
    );

    // Build min-max normalizers from raw values across the CURRENT available pool
    const normalizers = {
      consensus: minMaxNormalize(rawCandidates.map((c) => c.rawBreakdown.consensus)),
      need: minMaxNormalize(rawCandidates.map((c) => c.rawBreakdown.need)),
      player: minMaxNormalize(rawCandidates.map((c) => c.rawBreakdown.player)),
      upside: minMaxNormalize(rawCandidates.map((c) => c.rawBreakdown.upside)),
      feature: minMaxNormalize(rawCandidates.map((c) => c.rawBreakdown.feature)),
      source: minMaxNormalize(rawCandidates.map((c) => c.rawBreakdown.source)),
    };

    // Pass 2: Apply relative normalization and score
    const scored = available
      .map((prospect) =>
        scoreCandidate({
          team,
          prospect,
          preferenceEntry,
          feature: featureByOrdinal.get(prospect.localPool?.ordinal),
          ragEvidence: ragEvidenceIndex.get(prospect.id),
          previousTeamSelections,
          normalizers,
        }),
      )
      .sort(compareCandidates)
      .map((candidate, index) => ({ ...candidate, rankWithinPick: index + 1 }));

    const selected = scored[0];
    const runnerUp = scored[1] ?? null;
    const selectedIndex = available.findIndex((prospect) => prospect.id === selected.prospectId);
    if (selectedIndex < 0) throw new Error(`Selected prospect was not available: ${selected.prospectId}`);
    available.splice(selectedIndex, 1);

    const confidence = getConfidence({ selected, runnerUp, team });
    const teamRagSnippets = getTeamRagSnippets({ team, ragChunks });
    const pickAudit = {
      pick: Number(team.pick),
      team: team.team,
      acquiredFrom: team.acquiredFrom ?? null,
      phase: team.phase,
      reviewedCandidates: remainingBefore,
      remainingBefore,
      remainingAfter: available.length,
      dynamicParameters: {
        needs: team.needs ?? [],
        priorityTags: team.priorityTags ?? [],
        riskTolerance: team.riskTolerance,
        preferenceLevel: preferenceEntry?.preferenceLevel ?? "not-configured",
        needConfidenceCoefficient: preferenceEntry?.needConfidenceCoefficient ?? null,
        preferenceFamilies: preferenceEntry?.preferenceFamilies ?? [],
        sourceEvidenceNotes: preferenceEntry?.sourceEvidenceNotes ?? [],
        previousTeamSelections,
        weights: selected.weights,
      },
      selected,
      runnerUp: runnerUp
        ? {
            prospectId: runnerUp.prospectId,
            name: runnerUp.name,
            localNameZh: runnerUp.localNameZh,
            score: runnerUp.score,
            consensusRank: runnerUp.consensusRank,
            breakdown: runnerUp.breakdown,
            overlapFamilies: runnerUp.need.overlapFamilies,
        }
        : null,
      allScores: scored,
      topCandidates: scored.slice(0, 10),
      rejectedHighSignalCandidates: scored.slice(1, 6).map((candidate) => ({
        prospectId: candidate.prospectId,
        name: candidate.name,
        localNameZh: candidate.localNameZh,
        score: candidate.score,
        reason: `runner-up algorithmic score; selected ${selected.name} had score ${selected.score}`,
      })),
      teamRagSnippets,
      confidence,
      margin: runnerUp ? round(selected.score - runnerUp.score, 3) : null,
      removedProspectId: selected.prospectId,
      noManualPrediction: true,
      noManualOverride: true,
    };
    pickAudits.push(pickAudit);

    teamHistory.set(team.team, [
      ...previousTeamSelections,
      {
        pick: Number(team.pick),
        prospectId: selected.prospectId,
        name: selected.name,
        positions: selected.positions,
        families: selected.families,
      },
    ]);

    console.log(`Relative-scoring pick ${team.pick}/30: pool=${remainingBefore}, selected ${selected.name} (rel=${selected.score}), remaining ${available.length}`);
  }

  return { pickAudits, remainingProspects: available };
};

const main = async () => {
  const [localBundle, teamPreference, featureReference, currentBoard, ragChunks] = await Promise.all([
    readJson(localBundlePath),
    readJson(teamPreferencePath),
    readJson(featureReferencePath),
    readJson(currentBoardPath),
    loadRagChunks(),
  ]);

  const teams = localBundle.teams ?? [];
  const prospects = localBundle.prospects ?? [];
  const uniqueCandidateIds = new Set(prospects.map((prospect) => prospect.id));
  if (prospects.length !== 123 || uniqueCandidateIds.size !== 123) {
    throw new Error(`Expected 123 unique local-pool candidates, got rows=${prospects.length}, unique=${uniqueCandidateIds.size}.`);
  }
  if (teams.length < 30) throw new Error(`Expected at least 30 teams/picks, got ${teams.length}.`);

  const ragEvidenceIndex = buildRagEvidenceIndex(prospects, ragChunks);
  const { pickAudits, remainingProspects } = runSequentialPrediction({
    teams: teams.slice(0, 30),
    prospects,
    teamPreference,
    featureReference,
    ragEvidenceIndex,
    ragChunks,
  });
  const boardRows = pickAudits.map((pickAudit) =>
    toBoardRow({
      team: pickAudit,
      selected: pickAudit.selected,
      runnerUp: pickAudit.runnerUp,
      confidence: pickAudit.confidence,
      remainingBefore: pickAudit.remainingBefore,
      remainingAfter: pickAudit.remainingAfter,
    }),
  );
  const changedVsCurrentBoard = compareWithCurrentBoard(boardRows, currentBoard);
  const validation = validateArtifact({
    boardRows,
    remainingProspects,
    pickAudits,
    initialCandidateCount: prospects.length,
  });
  const generatedAt = new Date().toISOString();
  const artifact = {
    schemaVersion: "draftops.relative_scoring_prediction.v1",
    generatedAt,
    generatedBy: "scripts/relative-scoring-prediction.mjs",
    runStamp,
    method:
      "RELATIVE POOL-SCORING: Each pick first computes raw dimension scores for all remaining candidates, then applies MIN-MAX NORMALIZATION across the CURRENT available pool (0=worst remaining, 100=best remaining) for each dimension before weighted scoring. The top relative score is selected, removed, and the next pick renormalizes against the new smaller pool. This simulates true BPA (Best Player Available) logic where value is relative to who is left, not an absolute global grade.",
    inputFiles: [
      "data/final/local_pool_124_import_bundle.json",
      "data/reports/team_preference_research_20260623.json",
      "data/normalized/normalized_2026_player_feature_reference_124.json",
      "data/rag/*.json",
      "public/data/agent_expanded_recommended_board.json (read-only comparison)",
    ],
    guardrails: {
      noManualPrediction: true,
      noHumanPickInjection: true,
      noHandWrittenPickList: true,
      sequentialRemoval: true,
      relativeMinMaxNormalization: true,
      poolRelativeScoring: true,
      allRemainingCandidatesReviewedEachPick: true,
      frontendBoardReadOnly: true,
      candidateBoundary: "data/final/local_pool_124_import_bundle.json, 123 unique prospect ids",
    },
    candidatePool: {
      sourceRows: localBundle.metadata?.localPlayerPool124?.sourceRows ?? null,
      uniqueCandidates: prospects.length,
      expectedUniqueCandidates: 123,
      matchedCurrentProfiles: localBundle.metadata?.localPlayerPool124?.matchedCurrentProfiles ?? null,
      localOnlyFallbackProfiles: localBundle.metadata?.localPlayerPool124?.localOnlyFallbackProfiles ?? null,
      duplicateSourceRowsSkipped: localBundle.metadata?.localPlayerPool124?.duplicateSourceRowsSkipped ?? null,
    },
    summary: {
      pickCount: boardRows.length,
      uniqueSelectedProspects: new Set(boardRows.map((row) => row.prospectId)).size,
      remainingProspects: remainingProspects.length,
      totalCandidateReviews: pickAudits.reduce((sum, pick) => sum + pick.reviewedCandidates, 0),
      averageScore: round(boardRows.reduce((sum, row) => sum + row.scoreExact, 0) / Math.max(1, boardRows.length), 2),
      averageConfidence: Math.round(boardRows.reduce((sum, row) => sum + row.confidence, 0) / Math.max(1, boardRows.length)),
      changedVsCurrentBoardCount: changedVsCurrentBoard.length,
    },
    validation,
    boardRows,
    changedVsCurrentBoard,
    pickAudits,
    remainingProspects: remainingProspects.map((prospect) => ({
      prospectId: prospect.id,
      name: prospect.name,
      localNameZh: prospect.localPool?.nameZh ?? null,
      consensusRank: prospect.consensusRank,
    })),
  };

  if (!Object.entries(validation).every(([key, value]) => key === "duplicateSelectedProspectIds" || value === true || typeof value === "number")) {
    throw new Error(`Validation failed: ${JSON.stringify(validation)}`);
  }

  await Promise.all([mkdir(dirname(outputJsonPath), { recursive: true }), mkdir(dirname(outputReportPath), { recursive: true })]);
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(outputReportPath, `${makeReport({ artifact })}\n`, "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        output: [
          `data/boards/relative_scoring_prediction_${runStamp}.json`,
          `data/reports/relative_scoring_prediction_${runStamp}.md`,
        ],
        summary: artifact.summary,
        validation,
        changedVsCurrentBoard,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
