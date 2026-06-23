import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();

const localBundlePath = resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json");
const scenariosPath = resolve(rootDir, "data", "reports", "weight_scenarios.json");
const teamPreferencePath = resolve(rootDir, "data", "reports", "team_preference_research_20260623.json");
const featureReferencePath = resolve(rootDir, "data", "normalized", "normalized_2026_player_feature_reference_124.json");
const baselineBoardPath = resolve(rootDir, "data", "boards", "local_pool_124_baseline_board.json");

const outputJsonBasePath = resolve(rootDir, "data", "boards", "sequential_dynamic_board_123_audit.json");
const outputReportBasePath = resolve(rootDir, "data", "reports", "sequential_dynamic_board_123_audit_20260623.md");

const TOP_FIVE_REACH_THRESHOLD = 5;
const LOTTERY_REACH_THRESHOLD = 8;
const VALUE_FALL_BONUS_THRESHOLD = 10;
const TIEBREAK_EPSILON = 0.8;

const variantProfiles = {
  baseline: {
    id: "baseline",
    label: "Baseline dynamic audit",
  },
  "deepseek-guardrails": {
    id: "deepseek-guardrails",
    label: "DeepSeek parameter guardrail sensitivity run",
    weakPreferencePickValueCap: 2,
    featurePositiveCap: 1,
    dTierAdditionalPenalty: 0.8,
    athleticDeficitPenalty: 2,
    athleticDeficitThreshold: 10,
  },
  "deepseek-mild": {
    id: "deepseek-mild",
    label: "DeepSeek mild parameter rerun",
    weakPreferencePickValueCap: 3.25,
    featurePositiveCap: 1.15,
    dTierAdditionalPenalty: 0.35,
    athleticDeficitPenalty: 1,
    athleticDeficitThreshold: 10,
    athleticDeficitMaxRiskTolerance: 60,
  },
};

const getOutputPaths = (variant) => {
  if (variant.id === "baseline") {
    return {
      outputJsonPath: outputJsonBasePath,
      outputReportPath: outputReportBasePath,
      outputJsonLabel: "data/boards/sequential_dynamic_board_123_audit.json",
      outputReportLabel: "data/reports/sequential_dynamic_board_123_audit_20260623.md",
    };
  }

  const suffix = variant.id.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  return {
    outputJsonPath: resolve(rootDir, "data", "boards", `sequential_dynamic_board_123_audit_${suffix}.json`),
    outputReportPath: resolve(rootDir, "data", "reports", `sequential_dynamic_board_123_audit_${suffix}_20260623.md`),
    outputJsonLabel: `data/boards/sequential_dynamic_board_123_audit_${suffix}.json`,
    outputReportLabel: `data/reports/sequential_dynamic_board_123_audit_${suffix}_20260623.md`,
  };
};

const tagAliases = {
  "lead guard": "primary guard",
  "point guard": "primary guard",
  "bench guard": "combo guard",
  "young guard": "combo guard",
  "guard depth": "combo guard",
  "shooting guard": "combo guard",
  "late clock offense": "shot creator",
  "self creation": "shot creator",
  "secondary creation": "shot creator",
  "secondary handler": "playmaking",
  "paint touch": "rim pressure",
  "floor spacing": "shooting",
  spacing: "shooting",
  shooter: "shooting",
  "pull up shooting": "shooting",
  "pull-up shooting": "shooting",
  "movement shooting": "shooting",
  "frontcourt scoring": "frontcourt engine",
  "frontcourt depth": "frontcourt",
  "bench size": "frontcourt",
  "center depth": "frontcourt",
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
  "alpha scorer": "shot creator",
  "two way": "defense",
  "two-way": "defense",
};

const tagFamilies = {
  "primary guard": ["guard", "playmaking", "shot creator", "creation"],
  "combo guard": ["guard", "shooting"],
  "shot creator": ["creation", "scoring"],
  playmaking: ["guard", "creation"],
  "wing creator": ["wing", "creation", "scoring"],
  "big wing": ["wing", "forward", "size"],
  "3-and-D": ["wing", "shooting", "defense"],
  shooting: ["shooting", "shooter", "spacing"],
  "rim protector": ["frontcourt", "defense", "size"],
  rebounder: ["frontcourt", "size"],
  connector: ["feel", "passing", "decision maker"],
  "frontcourt engine": ["frontcourt", "feel", "rebounder"],
  "stretch forward": ["forward", "frontcourt", "shooting", "size"],
  "star upside": ["upside", "upside_asset", "creation"],
  "interior finisher": ["frontcourt", "finisher", "size"],
  "off-ball": ["shooting", "decision maker"],
  defense: ["defense"],
  size: ["size"],
  transition: ["athleticism", "creation"],
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
};

const familyLabels = {
  guard: "后卫/持球",
  wing: "锋线",
  frontcourt: "前场/内线",
  shooting: "投射/空间",
  creation: "创造/得分",
  defense: "防守",
  size: "尺寸",
  upside_asset: "上限/资产",
  feel: "球商/连接",
};

const teamSchoolStatePriors = {};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const readJsonIfExists = async (path) => {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const safeReadJson = async (path, fallback) => {
  try {
    return await readJson(path);
  } catch {
    return fallback;
  }
};

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

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
    signals.add(canonical);
    signals.add(normalizeFamily(canonical));
    canonical.split(" ").forEach((part) => {
      if (part.length > 3) signals.add(normalizeFamily(part));
    });
    tagFamilies[canonical]?.forEach((family) => signals.add(normalizeFamily(family)));
  });

  return signals;
};

const getDraftZone = (pick) => {
  if (pick <= 5) return "top-five";
  if (pick <= 14) return "lottery";
  return "late-first";
};

const getEffectiveWeights = (weights, team) => {
  const zone = getDraftZone(team.pick);
  const next = { ...weights };

  if (zone === "top-five") {
    next.consensus += 5;
    next.upside += 7;
    next.need -= 3;
    next.player -= 2;
  } else if (zone === "lottery") {
    next.need += 6;
    next.player += 3;
    next.consensus -= 3;
  } else {
    next.need += 8;
    next.player += 5;
    next.upside -= 5;
    next.consensus -= 4;
  }

  if (team.phase === "rebuild") {
    next.upside += 5;
    next.consensus += 2;
  } else if (team.phase === "accelerate") {
    next.need += 3;
    next.player += 2;
  } else if (team.phase === "contend") {
    next.need += 4;
    next.player += 5;
    next.upside -= 6;
    next.intel += 2;
  } else if (team.phase === "asset") {
    next.upside += 4;
    next.intel += 3;
  }

  return {
    consensus: Math.round(clamp(next.consensus, 1, 70)),
    need: Math.round(clamp(next.need, 1, 70)),
    player: Math.round(clamp(next.player, 1, 70)),
    upside: Math.round(clamp(next.upside, 1, 70)),
    intel: Math.round(clamp(next.intel, 1, 70)),
  };
};

const normalizeWeights = (weights) => {
  const total = Math.max(1, weights.consensus + weights.need + weights.player + weights.upside + weights.intel);
  return {
    consensus: weights.consensus / total,
    need: weights.need / total,
    player: weights.player / total,
    upside: weights.upside / total,
    intel: weights.intel / total,
  };
};

const getPositionBonus = (team, prospect) => {
  const signals = buildSignalSet([...(team.needs ?? []), ...(team.priorityTags ?? [])]);

  if (signals.has("guard") && prospect.positions.some((position) => position === "PG" || position === "SG")) return 10;
  if (
    (signals.has("wing") || signals.has("forward")) &&
    prospect.positions.some((position) => position === "SF" || position === "PF")
  ) {
    return 10;
  }
  if (
    (signals.has("rim") || signals.has("center") || signals.has("frontcourt")) &&
    prospect.positions.some((position) => position === "PF" || position === "C")
  ) {
    return 10;
  }

  return 0;
};

const getSkillNeedBonus = (signals, prospect) => {
  const signalSet = buildSignalSet(signals);
  let bonus = 0;

  if ((signalSet.has("shooting") || signalSet.has("shooter") || signalSet.has("spacing")) && prospect.profile.shooting >= 82) {
    bonus += 7;
  }
  if ((signalSet.has("shot creator") || signalSet.has("creation")) && prospect.profile.creation >= 84) {
    bonus += 7;
  }
  if ((signalSet.has("defense") || signalSet.has("rim protector")) && prospect.profile.defense >= 82) {
    bonus += 7;
  }
  if ((signalSet.has("rebounder") || signalSet.has("frontcourt")) && prospect.profile.size >= 86) {
    bonus += 5;
  }
  if ((signalSet.has("decision maker") || signalSet.has("maturity") || signalSet.has("feel")) && prospect.profile.feel >= 82) {
    bonus += 5;
  }

  return clamp(bonus, 0, 18);
};

const getNeedScoreRaw = (team, prospect) => {
  const tags = buildSignalSet(prospect.roleTags ?? []);
  const priorities = (team.priorityTags ?? []).map(normalizeTag);
  const needs = (team.needs ?? []).map(normalizeTag);
  const directMatches = priorities.filter((tag) => tags.has(tag) || tags.has(normalizeFamily(tag))).length;
  const fuzzyMatches = needs.filter((need) => [...tags].some((tag) => tag.includes(need) || need.includes(tag))).length;
  const positionBonus = getPositionBonus(team, prospect);
  const skillBonus = getSkillNeedBonus([...priorities, ...needs], prospect);

  return clamp(44 + directMatches * 15 + fuzzyMatches * 7 + positionBonus + skillBonus);
};

const adjustNeedForConfidence = (rawNeedScore, coefficient) => {
  const safeCoefficient = clamp(Number.isFinite(coefficient) ? coefficient : 0.6, 0, 1);
  return clamp(50 + (rawNeedScore - 50) * safeCoefficient);
};

const getConsensusScore = (pick, prospect) => {
  const rankDistance = Math.abs(prospect.consensusRank - pick);
  const topPickProtection = pick <= 5 && prospect.consensusRank > pick + 4 ? 6 : 0;
  const lateReachPenalty = pick <= 14 && prospect.consensusRank > 20 ? 5 : 0;
  return clamp(100 - rankDistance * 4.6 - Math.max(0, prospect.consensusRank - 20) * 0.7 - topPickProtection - lateReachPenalty);
};

const getPlayerScore = (team, prospect) => {
  const base = average([
    prospect.profile.shooting,
    prospect.profile.creation,
    prospect.profile.defense,
    prospect.profile.athleticism,
    prospect.profile.feel,
    prospect.profile.size,
  ]);
  const phaseFit =
    team.phase === "contend"
      ? average([prospect.profile.shooting, prospect.profile.defense, prospect.profile.feel])
      : team.phase === "rebuild"
        ? average([prospect.profile.creation, prospect.profile.athleticism, prospect.profile.size])
        : team.phase === "asset"
          ? average([prospect.profile.upside, prospect.profile.size, prospect.profile.creation])
          : average([prospect.profile.creation, prospect.profile.defense, prospect.profile.feel]);

  return clamp(base * 0.72 + phaseFit * 0.28);
};

const getUpsideScore = (team, prospect) => {
  const ageBonus = clamp((22.8 - prospect.age) * 4, -8, 12);
  const riskPremium = (team.riskTolerance - 50) * 0.16;
  const zoneBonus = getDraftZone(team.pick) === "top-five" ? 3 : getDraftZone(team.pick) === "late-first" ? -3 : 0;
  return clamp(prospect.profile.upside + ageBonus + riskPremium + zoneBonus);
};

const getMarketHeatBaseline = (consensusRank) => {
  if (consensusRank <= 5) return 100 - consensusRank * 2.4;
  if (consensusRank <= 14) return 84 - (consensusRank - 6) * 3.2;
  return 58 - (consensusRank - 15) * 1.7;
};

const getIntelScore = (team, prospect) => {
  const prioritySignals = buildSignalSet(team.priorityTags ?? []);
  const internationalBonus = prioritySignals.has("international") && prospect.international ? 8 : 0;
  const phasePenalty = team.phase === "contend" && prospect.profile.feel < 72 ? -7 : 0;
  const sourceBonus = Math.min(4, (prospect.sourceNotes ?? []).length * 1.5);
  const marketMovement = prospect.mockHeat - getMarketHeatBaseline(prospect.consensusRank);
  const movementScore = 50 + marketMovement * 1.8;
  const staleRiskPenalty = marketMovement < -8 && prospect.consensusRank > team.pick + 8 ? -5 : 0;
  return clamp(movementScore + internationalBonus + sourceBonus + phasePenalty + staleRiskPenalty);
};

const getMedicalRiskPenalty = (team, prospect) => {
  let penalty = team.phase === "contend" ? 12 : team.phase === "accelerate" ? 7 : 6;

  if (team.phase !== "contend" && team.riskTolerance >= 75) penalty -= 2;
  if (team.phase !== "contend" && prospect.profile.upside >= 86) penalty -= 1;
  if (team.phase === "contend" && team.riskTolerance < 50) penalty += 1;

  return clamp(penalty, 4, 13);
};

const getRiskPenalty = (team, prospect) => {
  const risks = (prospect.risks ?? []).map((risk) => risk.toLowerCase());
  const teamSignals = buildSignalSet([...(team.needs ?? []), ...(team.priorityTags ?? [])]);
  let penalty = 0;

  if (risks.some((risk) => risk.includes("medical") || risk.includes("health"))) {
    penalty += getMedicalRiskPenalty(team, prospect);
  }
  if (risks.some((risk) => risk.includes("shoot")) && teamSignals.has("shooting")) {
    penalty += 5;
  }
  if (risks.some((risk) => risk.includes("strength")) && teamSignals.has("frontcourt")) {
    penalty += 4;
  }
  if (risks.some((risk) => risk.includes("decision") || risk.includes("turnover")) && team.phase === "contend") {
    penalty += 5;
  }
  if (team.phase === "contend" && prospect.age < 19.2 && prospect.profile.feel < 75) {
    penalty += 4;
  }

  return clamp(penalty, 0, 18);
};

const getPickValueAdjustment = (team, prospect) => {
  const reachDistance = prospect.consensusRank - team.pick;
  const fallDistance = team.pick - prospect.consensusRank;
  let adjustment = 0;

  if (team.pick <= 5 && reachDistance > TOP_FIVE_REACH_THRESHOLD) {
    adjustment -= Math.min(8, (reachDistance - TOP_FIVE_REACH_THRESHOLD) * 1.25);
  } else if (team.pick <= 14 && reachDistance > LOTTERY_REACH_THRESHOLD) {
    adjustment -= Math.min(5, (reachDistance - LOTTERY_REACH_THRESHOLD) * 0.9);
  }

  if (team.pick >= 10 && fallDistance >= VALUE_FALL_BONUS_THRESHOLD) {
    adjustment += Math.min(5, (fallDistance - VALUE_FALL_BONUS_THRESHOLD + 1) * 0.8);
  }
  if (team.pick >= 10 && prospect.consensusRank <= 10 && fallDistance >= 2) {
    adjustment += Math.min(6, (fallDistance - 1) * 1.35);
  }

  return clamp(adjustment, -8, 6);
};

const getPositionFamilies = (positions) => {
  const families = new Set();
  if (positions.some((position) => position === "PG" || position === "SG")) families.add("guard");
  if (positions.some((position) => position === "SF" || position === "PF")) families.add("wing");
  if (positions.some((position) => position === "PF" || position === "C")) families.add("frontcourt");
  if (positions.includes("C")) families.add("size");
  return families;
};

const getProfileFamilies = (profile) => {
  const families = new Set();
  if (profile.shooting >= 82) families.add("shooting");
  if (profile.creation >= 82) families.add("creation");
  if (profile.defense >= 82) families.add("defense");
  if (profile.size >= 84) families.add("size");
  if (profile.upside >= 84 || profile.athleticism >= 86) families.add("upside_asset");
  return families;
};

const getFeatureFamilies = (feature) => {
  const families = new Set();
  const derived = feature?.derived ?? {};
  if (derived.shootingDrillScore >= 70) families.add("shooting");
  if (derived.physicalToolsScore >= 75) {
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

  return [...families].sort();
};

const scoreBaseModel = (team, prospect, weights, needConfidenceCoefficient) => {
  const effectiveWeights = getEffectiveWeights(weights, team);
  const normalized = normalizeWeights(effectiveWeights);
  const needRaw = getNeedScoreRaw(team, prospect);
  const need = adjustNeedForConfidence(needRaw, needConfidenceCoefficient);
  const breakdown = {
    consensus: getConsensusScore(team.pick, prospect),
    need,
    needRaw,
    player: getPlayerScore(team, prospect),
    upside: getUpsideScore(team, prospect),
    intel: getIntelScore(team, prospect),
  };
  const riskPenalty = getRiskPenalty(team, prospect);
  const pickValueAdjustment = getPickValueAdjustment(team, prospect);
  const score =
    breakdown.consensus * normalized.consensus +
    breakdown.need * normalized.need +
    breakdown.player * normalized.player +
    breakdown.upside * normalized.upside +
    breakdown.intel * normalized.intel -
    riskPenalty +
    pickValueAdjustment;

  return {
    score: clamp(score),
    breakdown,
    riskPenalty,
    pickValueAdjustment,
    effectiveWeights,
  };
};

const getFamilyLabel = (families) => families.map((family) => familyLabels[family] ?? family).join("、") || "无";

const getPreferenceAdjustment = ({ prospectFamilies, team, preferenceEntry, needConfidenceCoefficient }) => {
  const configuredFamilies = (preferenceEntry?.preferenceFamilies ?? []).map(normalizeFamily).filter((family) => familyLabels[family]);
  if (configuredFamilies.length === 0 || needConfidenceCoefficient <= 0) {
    return {
      adjustment: 0,
      overlapFamilies: [],
      missingPreferenceFamilies: configuredFamilies,
      overlapRatio: 0,
      positionFitBonus: 0,
      reason: needConfidenceCoefficient <= 0 ? "team-preference-disabled" : "no-team-preference-families",
    };
  }

  const prospectFamilySet = new Set(prospectFamilies);
  const overlapFamilies = configuredFamilies.filter((family) => prospectFamilySet.has(family));
  const missingPreferenceFamilies = configuredFamilies.filter((family) => !prospectFamilySet.has(family));
  const overlapRatio = overlapFamilies.length / configuredFamilies.length;
  const positionFitBonus = getPositionBonus(team, {
    positions: [...prospectFamilySet].includes("guard")
      ? ["PG"]
      : [...prospectFamilySet].includes("frontcourt")
        ? ["PF"]
        : [...prospectFamilySet].includes("wing")
          ? ["SF"]
          : [],
  });
  const coreFit = (overlapRatio - 0.5) * 4.2;
  const broadFit = overlapFamilies.length >= 3 ? 0.75 : overlapFamilies.length === 0 ? -0.8 : 0;
  const positionFit = positionFitBonus ? 0.7 : 0;
  const rawAdjustment = (coreFit + broadFit + positionFit) * needConfidenceCoefficient;

  return {
    adjustment: clamp(rawAdjustment, -3.5, 4.5),
    overlapFamilies,
    missingPreferenceFamilies,
    overlapRatio,
    positionFitBonus,
    reason: "data-backed-team-preference",
  };
};

const getSchoolStateAdjustment = ({ team, prospect }) => {
  const prior = teamSchoolStatePriors[team.team];
  if (!prior) {
    return {
      adjustment: 0,
      applied: false,
      matched: [],
      reason: "no-data-backed-school-or-state-prior-configured",
    };
  }

  const matched = [];
  if (prior.schools?.includes(prospect.school)) matched.push(`school:${prospect.school}`);
  if (prior.origins?.includes(prospect.origin)) matched.push(`origin:${prospect.origin}`);

  return {
    adjustment: matched.length ? clamp(matched.length * 0.6, 0, 1.2) : 0,
    applied: matched.length > 0,
    matched,
    reason: matched.length ? "configured-school-state-prior-match" : "configured-prior-no-match",
  };
};

const getFeatureAdjustment = ({ feature, preferenceFamilies }) => {
  if (!feature) {
    return {
      adjustment: -0.75,
      reason: "no-local-feature-reference",
      summary: null,
    };
  }

  const derived = feature.derived ?? {};
  const preferenceSet = new Set((preferenceFamilies ?? []).map(normalizeFamily));
  let adjustment = 0;
  const reasons = [];

  if (derived.referenceTier?.startsWith("A-")) {
    adjustment += 1.25;
    reasons.push("elite-reference-tier");
  } else if (derived.referenceTier?.startsWith("B-")) {
    adjustment += 0.55;
    reasons.push("positive-reference-tier");
  } else if (derived.referenceTier?.startsWith("D-")) {
    adjustment -= 0.45;
    reasons.push("low-or-incomplete-reference-tier");
  }

  if (preferenceSet.has("shooting") && derived.shootingDrillScore >= 70) {
    adjustment += 0.75;
    reasons.push("shooting-drill-matches-team-preference");
  } else if (preferenceSet.has("shooting") && Number.isFinite(derived.shootingDrillScore) && derived.shootingDrillScore < 35) {
    adjustment -= 0.5;
    reasons.push("shooting-drill-below-team-preference");
  }

  if ((preferenceSet.has("size") || preferenceSet.has("defense") || preferenceSet.has("frontcourt")) && derived.physicalToolsScore >= 75) {
    adjustment += 0.65;
    reasons.push("physical-tools-match-team-preference");
  }

  if (preferenceSet.has("upside_asset") && (derived.explosivenessScore >= 75 || derived.agilitySpeedScore >= 75)) {
    adjustment += 0.55;
    reasons.push("athletic-upside-match-team-preference");
  }

  if (derived.dataCompletenessScore < 40) {
    adjustment -= 0.65;
    reasons.push("low-data-completeness");
  }

  return {
    adjustment: clamp(adjustment, -2.5, 2.5),
    reason: reasons.join(",") || "neutral-local-feature-reference",
    summary: {
      referenceScore: derived.referenceScore ?? null,
      referenceTier: derived.referenceTier ?? null,
      physicalToolsScore: derived.physicalToolsScore ?? null,
      explosivenessScore: derived.explosivenessScore ?? null,
      agilitySpeedScore: derived.agilitySpeedScore ?? null,
      shootingDrillScore: derived.shootingDrillScore ?? null,
      dataCompletenessScore: derived.dataCompletenessScore ?? null,
      tags: derived.tags ?? [],
    },
  };
};

const applyVariantBaseGuardrails = ({ base, needConfidenceCoefficient, variant }) => {
  const pickValueCap =
    variant.weakPreferencePickValueCap && needConfidenceCoefficient < 0.5 ? variant.weakPreferencePickValueCap : null;
  if (!pickValueCap) return { ...base, variantAdjustments: [] };

  const cappedPickValueAdjustment = clamp(base.pickValueAdjustment, -pickValueCap, pickValueCap);
  if (cappedPickValueAdjustment === base.pickValueAdjustment) return { ...base, variantAdjustments: [] };

  return {
    ...base,
    score: clamp(base.score - base.pickValueAdjustment + cappedPickValueAdjustment),
    pickValueAdjustment: cappedPickValueAdjustment,
    variantAdjustments: [
      {
        key: "weakPreferencePickValueCap",
        from: round(base.pickValueAdjustment, 3),
        to: round(cappedPickValueAdjustment, 3),
      },
    ],
  };
};

const applyVariantFeatureGuardrails = ({ featureAdjustment, feature, prospectFamilies, team, variant }) => {
  let adjustment = featureAdjustment.adjustment;
  const variantAdjustments = [];
  const derived = feature?.derived ?? {};

  if (variant.featurePositiveCap && adjustment > variant.featurePositiveCap) {
    variantAdjustments.push({
      key: "featurePositiveCap",
      from: round(adjustment, 3),
      to: round(variant.featurePositiveCap, 3),
    });
    adjustment = variant.featurePositiveCap;
  }

  if (variant.dTierAdditionalPenalty && String(derived.referenceTier ?? "").startsWith("D-")) {
    const next = adjustment - variant.dTierAdditionalPenalty;
    variantAdjustments.push({
      key: "dTierAdditionalPenalty",
      from: round(adjustment, 3),
      to: round(next, 3),
    });
    adjustment = next;
  }

  const isWingOrFrontcourt = prospectFamilies.some((family) => ["wing", "frontcourt", "size"].includes(family));
  if (
    variant.athleticDeficitPenalty &&
    isWingOrFrontcourt &&
    (!variant.athleticDeficitMaxRiskTolerance || team.riskTolerance <= variant.athleticDeficitMaxRiskTolerance) &&
    Number.isFinite(derived.explosivenessScore) &&
    derived.explosivenessScore < variant.athleticDeficitThreshold
  ) {
    const next = adjustment - variant.athleticDeficitPenalty;
    variantAdjustments.push({
      key: "athleticDeficitPenalty",
      from: round(adjustment, 3),
      to: round(next, 3),
      explosivenessScore: round(derived.explosivenessScore, 3),
    });
    adjustment = next;
  }

  return {
    ...featureAdjustment,
    adjustment: clamp(adjustment, -4.5, 2.5),
    variantAdjustments,
  };
};

const getSequencingAdjustment = ({ prospectFamilies, previousTeamSelections, needConfidenceCoefficient }) => {
  if (!previousTeamSelections.length) {
    return {
      adjustment: 0,
      repeatedFamilies: [],
      newPreferenceCoverage: [],
      reason: "first-pick-for-team",
    };
  }

  const previousFamilies = new Set(previousTeamSelections.flatMap((selection) => selection.families));
  const repeatedFamilies = prospectFamilies.filter((family) => previousFamilies.has(family));
  const newPreferenceCoverage = prospectFamilies.filter((family) => !previousFamilies.has(family));
  const repeatedCoreFamilies = repeatedFamilies.filter((family) => ["guard", "wing", "frontcourt", "creation", "defense", "shooting"].includes(family));
  const penalty = Math.min(2.2, repeatedCoreFamilies.length * 0.35 * Math.max(0.35, needConfidenceCoefficient));
  const complementBonus = Math.min(1.15, newPreferenceCoverage.length * 0.12 * Math.max(0.35, needConfidenceCoefficient));

  return {
    adjustment: round(complementBonus - penalty, 3),
    repeatedFamilies,
    newPreferenceCoverage,
    reason: "same-team-sequencing-balance",
  };
};

const compareCandidates = (left, right) => {
  const scoreDelta = right.finalScore - left.finalScore;
  if (Math.abs(scoreDelta) > TIEBREAK_EPSILON) return scoreDelta;

  const consensusDelta = left.consensusRank - right.consensusRank;
  if (consensusDelta !== 0) return consensusDelta;

  const needDelta = right.breakdown.need - left.breakdown.need;
  if (Math.abs(needDelta) > 0.01) return needDelta;

  const upsideDelta = right.breakdown.upside - left.breakdown.upside;
  if (Math.abs(upsideDelta) > 0.01) return upsideDelta;

  return left.name.localeCompare(right.name);
};

const scoreCandidate = ({ team, prospect, weights, preferenceEntry, feature, previousTeamSelections, variant }) => {
  const needConfidenceCoefficient = clamp(preferenceEntry?.needConfidenceCoefficient ?? 0.6, 0, 1);
  const base = applyVariantBaseGuardrails({
    base: scoreBaseModel(team, prospect, weights, needConfidenceCoefficient),
    needConfidenceCoefficient,
    variant,
  });
  const prospectFamilies = getProspectFamilies(prospect, feature);
  const preferenceAdjustment = getPreferenceAdjustment({
    prospectFamilies,
    team,
    preferenceEntry,
    needConfidenceCoefficient,
  });
  const schoolStateAdjustment = getSchoolStateAdjustment({ team, prospect });
  const featureAdjustment = applyVariantFeatureGuardrails({
    featureAdjustment: getFeatureAdjustment({
      feature,
      preferenceFamilies: preferenceEntry?.preferenceFamilies ?? [],
    }),
    feature,
    prospectFamilies,
    team,
    variant,
  });
  const sequencingAdjustment = getSequencingAdjustment({
    prospectFamilies,
    previousTeamSelections,
    needConfidenceCoefficient,
  });
  const finalScore = clamp(
    base.score +
      preferenceAdjustment.adjustment +
      schoolStateAdjustment.adjustment +
      featureAdjustment.adjustment +
      sequencingAdjustment.adjustment,
  );

  return {
    prospectId: prospect.id,
    name: prospect.name,
    localNameZh: prospect.localPool?.nameZh ?? null,
    localOrdinal: prospect.localPool?.ordinal ?? null,
    positions: prospect.positions,
    school: prospect.school,
    origin: prospect.origin,
    consensusRank: prospect.consensusRank,
    mockHeat: prospect.mockHeat,
    matchStatus: prospect.localPool?.matchStatus ?? "unknown",
    fallbackProfile: prospect.risks?.includes("Local-pool fallback profile") ?? false,
    families: prospectFamilies,
    finalScore: round(finalScore, 3),
    rawModelScore: round(base.score, 3),
    dynamicPreferenceAdjustment: round(preferenceAdjustment.adjustment, 3),
    schoolStateAdjustment: round(schoolStateAdjustment.adjustment, 3),
    featureAdjustment: round(featureAdjustment.adjustment, 3),
    sequencingAdjustment: round(sequencingAdjustment.adjustment, 3),
    riskPenalty: round(base.riskPenalty, 3),
    pickValueAdjustment: round(base.pickValueAdjustment, 3),
    effectiveWeights: base.effectiveWeights,
    breakdown: {
      consensus: round(base.breakdown.consensus, 3),
      needRaw: round(base.breakdown.needRaw, 3),
      need: round(base.breakdown.need, 3),
      player: round(base.breakdown.player, 3),
      upside: round(base.breakdown.upside, 3),
      intel: round(base.breakdown.intel, 3),
    },
    preference: {
      needConfidenceCoefficient,
      preferenceFamilies: preferenceEntry?.preferenceFamilies ?? [],
      overlapFamilies: preferenceAdjustment.overlapFamilies,
      missingPreferenceFamilies: preferenceAdjustment.missingPreferenceFamilies,
      overlapRatio: round(preferenceAdjustment.overlapRatio, 3),
      reason: preferenceAdjustment.reason,
    },
    schoolState: schoolStateAdjustment,
    featureReference: featureAdjustment.summary,
    variantAdjustments: [...(base.variantAdjustments ?? []), ...(featureAdjustment.variantAdjustments ?? [])],
    adjustmentReasons: {
      feature: featureAdjustment.reason,
      sequencing: sequencingAdjustment.reason,
      schoolState: schoolStateAdjustment.reason,
    },
    sourceNotes: (prospect.sourceNotes ?? []).slice(0, 3),
  };
};

const getConfidence = ({ selected, runnerUp, team }) => {
  const rankPenalty = Math.abs(selected.consensusRank - team.pick) * 1.2;
  const margin = runnerUp ? selected.finalScore - runnerUp.finalScore : 12;
  const marginBonus = clamp(margin * 1.5, -6, 10);
  const narrowRacePenalty = margin < 2 ? 7 : margin < 5 ? 3 : 0;
  const dataPenalty = selected.fallbackProfile ? 3.5 : 0;

  return clamp(selected.finalScore - rankPenalty + marginBonus - narrowRacePenalty - dataPenalty);
};

const toBoardRow = (pickAudit) => ({
  pick: pickAudit.pick,
  team: pickAudit.team,
  acquiredFrom: pickAudit.acquiredFrom,
  player: pickAudit.selected.name,
  prospectId: pickAudit.selected.prospectId,
  localNameZh: pickAudit.selected.localNameZh,
  localOrdinal: pickAudit.selected.localOrdinal,
  school: pickAudit.selected.school,
  origin: pickAudit.selected.origin,
  position: pickAudit.selected.positions.join("/"),
  consensusRank: pickAudit.selected.consensusRank,
  score: Math.round(pickAudit.selected.finalScore),
  scoreExact: pickAudit.selected.finalScore,
  confidence: pickAudit.confidence,
  margin: pickAudit.margin,
  withinTiebreakBand: pickAudit.withinTiebreakBand,
  scoreTiebreakApplied: pickAudit.scoreTiebreakApplied,
  reviewedCandidates: pickAudit.reviewedCandidates,
  remainingAfter: pickAudit.remainingAfter,
  fallbackProfile: pickAudit.selected.fallbackProfile,
  dynamicPreferenceAdjustment: pickAudit.selected.dynamicPreferenceAdjustment,
  featureAdjustment: pickAudit.selected.featureAdjustment,
  sequencingAdjustment: pickAudit.selected.sequencingAdjustment,
  schoolStateAdjustment: pickAudit.selected.schoolStateAdjustment,
  variantAdjustments: pickAudit.selected.variantAdjustments ?? [],
  overlapFamilies: pickAudit.selected.preference.overlapFamilies,
});

const getFeatureByOrdinal = (featureReference) => {
  const map = new Map();
  for (const player of featureReference.players ?? []) {
    map.set(player.poolOrdinal, player);
  }
  return map;
};

const runSequentialBoard = ({ teams, prospects, weights, teamPreference, featureReference, maxPick, variant }) => {
  const preferenceByPick = new Map((teamPreference.entries ?? []).map((entry) => [entry.pick, entry]));
  const featureByOrdinal = getFeatureByOrdinal(featureReference);
  const available = [...prospects].sort((left, right) => left.consensusRank - right.consensusRank || left.name.localeCompare(right.name));
  const teamHistory = new Map();
  const pickAudits = [];

  for (const team of [...teams].sort((left, right) => left.pick - right.pick)) {
    if (team.pick > maxPick) break;

    const preferenceEntry = preferenceByPick.get(team.pick);
    const previousTeamSelections = teamHistory.get(team.team) ?? [];
    const scored = available
      .map((prospect) =>
        scoreCandidate({
          team,
          prospect,
          weights,
          preferenceEntry,
          feature: featureByOrdinal.get(prospect.localPool?.ordinal),
          previousTeamSelections,
          variant,
        }),
      )
      .sort(compareCandidates)
      .map((candidate, index) => ({ ...candidate, rankWithinPick: index + 1 }));

    const selected = scored[0];
    const runnerUp = scored[1];
    const selectedIndex = available.findIndex((prospect) => prospect.id === selected.prospectId);
    if (selectedIndex >= 0) available.splice(selectedIndex, 1);

    const confidence = Math.round(getConfidence({ selected, runnerUp, team }));
    const scoreGap = runnerUp ? round(selected.finalScore - runnerUp.finalScore, 3) : 12;
    const withinTiebreakBand = runnerUp ? Math.abs(scoreGap) <= TIEBREAK_EPSILON : false;
    const scoreTiebreakApplied = runnerUp ? scoreGap < 0 && withinTiebreakBand : false;
    const pickAudit = {
      pick: team.pick,
      team: team.team,
      acquiredFrom: team.acquiredFrom ?? null,
      phase: team.phase,
      reviewedCandidates: scored.length,
      remainingBefore: scored.length,
      remainingAfter: available.length,
      dynamicParameters: {
        needs: team.needs ?? [],
        priorityTags: team.priorityTags ?? [],
        riskTolerance: team.riskTolerance,
        needConfidenceCoefficient: preferenceEntry?.needConfidenceCoefficient ?? 0.6,
        preferenceLevel: preferenceEntry?.preferenceLevel ?? "not-configured",
        preferenceFamilies: preferenceEntry?.preferenceFamilies ?? [],
        preferenceFamilyLabel: preferenceEntry?.preferenceFamilyLabel ?? getFamilyLabel(preferenceEntry?.preferenceFamilies ?? []),
        sourceEvidenceNotes: preferenceEntry?.sourceEvidenceNotes ?? [],
        previousTeamSelections,
        schoolStatePreferenceApplied: false,
        schoolStatePreferenceReason: "no data-backed team school/state priors configured",
      },
      selected,
      runnerUp: runnerUp
        ? {
            prospectId: runnerUp.prospectId,
            name: runnerUp.name,
            localNameZh: runnerUp.localNameZh,
            finalScore: runnerUp.finalScore,
            consensusRank: runnerUp.consensusRank,
            overlapFamilies: runnerUp.preference.overlapFamilies,
          }
        : null,
      margin: scoreGap,
      withinTiebreakBand,
      scoreTiebreakApplied,
      confidence,
      removedProspectId: selected.prospectId,
      allScores: scored,
      topCandidates: scored.slice(0, 15),
      noManualOverride: true,
    };

    pickAudits.push(pickAudit);

    teamHistory.set(team.team, [
      ...previousTeamSelections,
      {
        pick: team.pick,
        prospectId: selected.prospectId,
        name: selected.name,
        positions: selected.positions,
        families: selected.families,
      },
    ]);
  }

  return { pickAudits, remainingProspects: available };
};

const compareWithBaseline = (boardRows, baselineBoard) => {
  const baselineRows = baselineBoard.boardRows ?? [];
  const baselineByPick = new Map(baselineRows.map((row) => [row.pick, row]));
  return boardRows
    .filter((row) => baselineByPick.get(row.pick)?.prospectId !== row.prospectId)
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      baselinePlayer: baselineByPick.get(row.pick)?.player ?? null,
      baselineProspectId: baselineByPick.get(row.pick)?.prospectId ?? null,
      dynamicPlayer: row.player,
      dynamicProspectId: row.prospectId,
    }));
};

const makeReport = ({ artifact }) => {
  const pick1 = artifact.pickAudits[0];
  const topPickRows = (pick1?.topCandidates ?? []).map(
    (candidate) =>
      `| ${candidate.rankWithinPick} | ${candidate.name} | ${candidate.localNameZh ?? ""} | ${candidate.positions.join("/")} | ${candidate.consensusRank} | ${candidate.finalScore} | ${candidate.rawModelScore} | ${candidate.dynamicPreferenceAdjustment} | ${candidate.featureAdjustment} | ${candidate.preference.overlapFamilies.join(", ")} |`,
  );
  const boardRows = artifact.boardRows.map(
    (row) =>
      `| ${row.pick} | ${row.team} | ${row.player} | ${row.localNameZh ?? ""} | ${row.position} | ${row.consensusRank} | ${row.scoreExact} | ${row.confidence} | ${row.margin} | ${row.scoreTiebreakApplied ? "yes" : ""} | ${row.reviewedCandidates} |`,
  );
  const changedRows = artifact.changedVsBaseline.map(
    (row) => `| ${row.pick} | ${row.team} | ${row.baselinePlayer ?? ""} | ${row.dynamicPlayer} |`,
  );

  return [
    "# Sequential Dynamic 123-Player Board Audit",
    "",
    `Generated: ${artifact.generatedAt}`,
    "",
    "## Method",
    "",
    "- Candidate boundary: `data/final/local_pool_124_import_bundle.json`, 123 unique players.",
    "- Selection loop: score every remaining candidate for the current pick, select the top scored player, remove him, then continue to the next pick.",
    "- Dynamic layers: team preference confidence, position/family overlap, same-team sequencing, local combine/shooting feature reference.",
    "- School/state priors are implemented as a configurable channel but remain zero here because no data-backed team school/state preference was present.",
    "- No manual prediction or manual override was used.",
    "",
    "## Candidate Review Count",
    "",
    `- Picks run: ${artifact.summary.pickCount}`,
    `- Total candidate reviews: ${artifact.summary.totalCandidateReviews}`,
    `- First pick reviewed candidates: ${pick1?.reviewedCandidates ?? 0}`,
    `- Unique selected players: ${artifact.summary.uniqueSelectedProspects}`,
    `- Remaining after run: ${artifact.summary.remainingProspects}`,
    "",
    "## Board",
    "",
    "| Pick | Team | Player | Local name | Pos | Rank | Score | Confidence | Score gap | Tie-break | Reviewed |",
    "|---:|---|---|---|---|---:|---:|---:|---:|---|---:|",
    ...boardRows,
    "",
    "## Changed Vs Previous 124-Pool Baseline",
    "",
    artifact.changedVsBaseline.length
      ? [
          "| Pick | Team | Previous baseline | Sequential dynamic |",
          "|---:|---|---|---|",
          ...changedRows,
        ].join("\n")
      : "No selected-player slots changed vs `local_pool_124_baseline_board.json`.",
    "",
    "## Pick 1 Detail",
    "",
    pick1
      ? [
          `- Team: ${pick1.team}`,
          `- Reviewed candidates: ${pick1.reviewedCandidates}`,
          `- Selected: ${pick1.selected.name} (${pick1.selected.localNameZh ?? "N/A"})`,
          `- Removed prospect id: ${pick1.removedProspectId}`,
          `- Remaining after pick 1: ${pick1.remainingAfter}`,
          `- Dynamic preference: ${pick1.dynamicParameters.preferenceFamilyLabel}`,
          `- School/state preference: ${pick1.dynamicParameters.schoolStatePreferenceReason}`,
          `- Score gap vs next sorted candidate: ${pick1.margin}`,
          "",
          "| Rank | Player | Local name | Pos | Consensus | Final | Raw | Team pref adj | Feature adj | Overlap families |",
          "|---:|---|---|---|---:|---:|---:|---:|---:|---|",
          ...topPickRows,
        ].join("\n")
      : "Pick 1 was not run.",
    "",
  ].join("\n");
};

const parseArgs = () => {
  const maxPickArgIndex = process.argv.indexOf("--max-pick");
  const variantArgIndex = process.argv.indexOf("--variant");
  const variantFileArgIndex = process.argv.indexOf("--variant-file");
  const maxPick =
    maxPickArgIndex >= 0 && process.argv[maxPickArgIndex + 1]
      ? Number.parseInt(process.argv[maxPickArgIndex + 1], 10)
      : 30;
  const variantFile = variantFileArgIndex >= 0 && process.argv[variantFileArgIndex + 1] ? process.argv[variantFileArgIndex + 1] : "";
  const variantId = variantArgIndex >= 0 && process.argv[variantArgIndex + 1] ? process.argv[variantArgIndex + 1] : "baseline";
  return {
    maxPick: clamp(Number.isFinite(maxPick) ? maxPick : 30, 1, 30),
    variantId,
    variantFile,
  };
};

const main = async () => {
  const { maxPick, variantId, variantFile } = parseArgs();
  const externalVariant = variantFile ? await readJson(resolve(rootDir, variantFile)) : null;
  const variant = externalVariant ?? variantProfiles[variantId];
  if (!variant) {
    throw new Error(`Unknown variant "${variantId}". Available variants: ${Object.keys(variantProfiles).join(", ")}`);
  }
  if (!variant.id) {
    throw new Error("Variant config must include an id.");
  }
  const { outputJsonPath, outputReportPath, outputJsonLabel, outputReportLabel } = getOutputPaths(variant);
  const [localBundle, scenariosFile, teamPreference, featureReference, baselineBoard] = await Promise.all([
    readJson(localBundlePath),
    readJson(scenariosPath),
    readJson(teamPreferencePath),
    readJson(featureReferencePath),
    safeReadJson(baselineBoardPath, {}),
  ]);
  const scenario = scenariosFile.scenarios.find((item) => item.id === "baseline") ?? scenariosFile.scenarios[0];
  const teams = localBundle.teams ?? [];
  const prospects = localBundle.prospects ?? [];
  const uniqueProspects = new Set(prospects.map((prospect) => prospect.id));

  if (uniqueProspects.size !== prospects.length) {
    throw new Error(`Candidate pool contains duplicate prospect ids: ${prospects.length} rows, ${uniqueProspects.size} unique.`);
  }

  const { pickAudits, remainingProspects } = runSequentialBoard({
    teams,
    prospects,
    weights: scenario.weights,
    teamPreference,
    featureReference,
    maxPick,
    variant,
  });
  const boardRows = pickAudits.map(toBoardRow);
  const changedVsBaseline = compareWithBaseline(boardRows, baselineBoard);
  const artifact = {
    schemaVersion: "draftops.sequential_dynamic_123_board_audit.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "DraftOps Sequential Dynamic Pick Audit Script",
    method:
      "For each pick, score every remaining candidate from the 123-player local pool, apply dynamic team preference / feature / sequencing adjustments, select the top candidate, remove him, then continue.",
    inputFiles: [
      "data/final/local_pool_124_import_bundle.json",
      "data/reports/weight_scenarios.json",
      "data/reports/team_preference_research_20260623.json",
      "data/normalized/normalized_2026_player_feature_reference_124.json",
    ],
    scenario,
    variant,
    candidatePool: {
      sourceRows: localBundle.metadata?.localPlayerPool124?.sourceRows ?? null,
      uniqueCandidates: prospects.length,
      expectedUniqueCandidates: 123,
      matchedCurrentProfiles: localBundle.metadata?.localPlayerPool124?.matchedCurrentProfiles ?? null,
      localOnlyFallbackProfiles: localBundle.metadata?.localPlayerPool124?.localOnlyFallbackProfiles ?? null,
      duplicateSourceRowsSkipped: localBundle.metadata?.localPlayerPool124?.duplicateSourceRowsSkipped ?? null,
    },
    guardrails: {
      noManualOverride: true,
      noHumanPickInjection: true,
      schoolStatePriorPolicy: "Only apply configured, data-backed priors. None are configured in this run.",
      sequentialRemoval: true,
      allRemainingCandidatesReviewedEachPick: true,
    },
    summary: {
      pickCount: pickAudits.length,
      totalCandidateReviews: pickAudits.reduce((sum, pick) => sum + pick.reviewedCandidates, 0),
      uniqueSelectedProspects: new Set(boardRows.map((row) => row.prospectId)).size,
      remainingProspects: remainingProspects.length,
      averageScore: round(boardRows.reduce((sum, row) => sum + row.scoreExact, 0) / Math.max(1, boardRows.length), 2),
      averageConfidence: Math.round(boardRows.reduce((sum, row) => sum + row.confidence, 0) / Math.max(1, boardRows.length)),
      changedVsBaselineCount: changedVsBaseline.length,
    },
    boardRows,
    changedVsBaseline,
    pickAudits,
    remainingProspects: remainingProspects.map((prospect) => ({
      prospectId: prospect.id,
      name: prospect.name,
      localNameZh: prospect.localPool?.nameZh ?? null,
      consensusRank: prospect.consensusRank,
    })),
  };

  const report = makeReport({ artifact });
  await Promise.all([
    mkdir(dirname(outputJsonPath), { recursive: true }),
    mkdir(dirname(outputReportPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(outputReportPath, `${report}\n`, "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        output: [outputJsonLabel, outputReportLabel],
        summary: artifact.summary,
        variant: artifact.variant,
        pick1: {
          team: artifact.pickAudits[0]?.team,
          reviewedCandidates: artifact.pickAudits[0]?.reviewedCandidates,
          selected: artifact.pickAudits[0]?.selected.name,
          localNameZh: artifact.pickAudits[0]?.selected.localNameZh,
          score: artifact.pickAudits[0]?.selected.finalScore,
          margin: artifact.pickAudits[0]?.margin,
          remainingAfter: artifact.pickAudits[0]?.remainingAfter,
        },
        board: artifact.boardRows.map((row) => ({
          pick: row.pick,
          team: row.team,
          player: row.player,
          localNameZh: row.localNameZh,
          score: row.scoreExact,
          confidence: row.confidence,
          reviewedCandidates: row.reviewedCandidates,
        })),
        changedVsBaseline,
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
