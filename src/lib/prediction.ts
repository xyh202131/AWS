import type { DraftPick, DraftZone, LocalizedText, MilestoneAnswer, Prospect, RuntimeMilestoneDefinition, TeamProfile, Weights } from "../types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const tagAliases: Record<string, string> = {
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
};

const tagFamilies: Record<string, string[]> = {
  "primary guard": ["guard", "playmaking", "shot creator"],
  "combo guard": ["guard", "shooting"],
  "shot creator": ["creation", "scoring"],
  "wing creator": ["wing", "creation", "scoring"],
  "big wing": ["wing", "forward", "size"],
  "3-and-D": ["wing", "shooting", "defense"],
  shooting: ["shooter", "spacing"],
  "rim protector": ["frontcourt", "defense", "size"],
  rebounder: ["frontcourt", "size"],
  connector: ["feel", "passing", "decision maker"],
  "frontcourt engine": ["frontcourt", "feel", "rebounder"],
  "stretch forward": ["forward", "shooting", "size"],
  "star upside": ["upside", "creation"],
  "interior finisher": ["frontcourt", "finisher", "size"],
  "off-ball": ["shooting", "decision maker"],
};

interface ScoredCandidate {
  prospect: Prospect;
  score: number;
  riskPenalty: number;
  pickValueAdjustment: number;
  breakdown: DraftPick["breakdown"];
  effectiveWeights: Weights;
}

const TOP_FIVE_REACH_THRESHOLD = 5;
const LOTTERY_REACH_THRESHOLD = 8;
const VALUE_FALL_BONUS_THRESHOLD = 10;
const NARROW_RACE_SCORE_EPSILON = 1.25;

const normalizeTag = (value: string) => {
  const clean = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return tagAliases[clean] ?? clean;
};

const buildSignalSet = (values: string[]) => {
  const signals = new Set<string>();

  values.forEach((value) => {
    const canonical = normalizeTag(value);
    signals.add(canonical);
    canonical.split(" ").forEach((part) => {
      if (part.length > 3) signals.add(part);
    });
    tagFamilies[canonical]?.forEach((family) => signals.add(family));
  });

  return signals;
};

const getDraftZone = (pick: number): DraftZone => {
  if (pick <= 5) return "top-five";
  if (pick <= 14) return "lottery";
  return "late-first";
};

const getEffectiveWeights = (weights: Weights, team: TeamProfile): Weights => {
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

const normalizeWeights = (weights: Weights) => {
  const total = Math.max(
    1,
    weights.consensus + weights.need + weights.player + weights.upside + weights.intel,
  );

  return {
    consensus: weights.consensus / total,
    need: weights.need / total,
    player: weights.player / total,
    upside: weights.upside / total,
    intel: weights.intel / total,
  };
};

const getNeedScore = (team: TeamProfile, prospect: Prospect) => {
  const tags = buildSignalSet(prospect.roleTags);
  const priorities = team.priorityTags.map(normalizeTag);
  const needs = team.needs.map(normalizeTag);
  const directMatches = priorities.filter((tag) => tags.has(tag)).length;
  const fuzzyMatches = needs.filter((need) => [...tags].some((tag) => tag.includes(need) || need.includes(tag))).length;
  const positionBonus = getPositionBonus(team, prospect);
  const skillBonus = getSkillNeedBonus([...priorities, ...needs], prospect);

  return clamp(44 + directMatches * 15 + fuzzyMatches * 7 + positionBonus + skillBonus);
};

const getPositionBonus = (team: TeamProfile, prospect: Prospect) => {
  const signals = buildSignalSet([...team.needs, ...team.priorityTags]);

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

const getSkillNeedBonus = (signals: string[], prospect: Prospect) => {
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

const getConsensusScore = (pick: number, prospect: Prospect) => {
  const rankDistance = Math.abs(prospect.consensusRank - pick);
  const topPickProtection = pick <= 5 && prospect.consensusRank > pick + 4 ? 6 : 0;
  const lateReachPenalty = pick <= 14 && prospect.consensusRank > 20 ? 5 : 0;
  return clamp(100 - rankDistance * 4.6 - Math.max(0, prospect.consensusRank - 20) * 0.7 - topPickProtection - lateReachPenalty);
};

const getPlayerScore = (team: TeamProfile, prospect: Prospect) => {
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

const getUpsideScore = (team: TeamProfile, prospect: Prospect) => {
  const ageBonus = clamp((22.8 - prospect.age) * 4, -8, 12);
  const riskPremium = (team.riskTolerance - 50) * 0.16;
  const zoneBonus = getDraftZone(team.pick) === "top-five" ? 3 : getDraftZone(team.pick) === "late-first" ? -3 : 0;
  return clamp(prospect.profile.upside + ageBonus + riskPremium + zoneBonus);
};

const getIntelScore = (team: TeamProfile, prospect: Prospect) => {
  const prioritySignals = buildSignalSet(team.priorityTags);
  const internationalBonus = prioritySignals.has("international") && prospect.international ? 8 : 0;
  const phasePenalty = team.phase === "contend" && prospect.profile.feel < 72 ? -7 : 0;
  const sourceBonus = Math.min(4, prospect.sourceNotes.length * 1.5);
  const marketMovement = prospect.mockHeat - getMarketHeatBaseline(prospect.consensusRank);
  const movementScore = 50 + marketMovement * 1.8;
  const staleRiskPenalty = marketMovement < -8 && prospect.consensusRank > team.pick + 8 ? -5 : 0;
  return clamp(movementScore + internationalBonus + sourceBonus + phasePenalty + staleRiskPenalty);
};

const getMarketHeatBaseline = (consensusRank: number) => {
  if (consensusRank <= 5) return 100 - consensusRank * 2.4;
  if (consensusRank <= 14) return 84 - (consensusRank - 6) * 3.2;
  return 58 - (consensusRank - 15) * 1.7;
};

const getMedicalRiskPenalty = (team: TeamProfile, prospect: Prospect) => {
  let penalty =
    team.phase === "contend"
      ? 12
      : team.phase === "accelerate"
        ? 7
        : 6;

  if (team.phase !== "contend" && team.riskTolerance >= 75) penalty -= 2;
  if (team.phase !== "contend" && prospect.profile.upside >= 86) penalty -= 1;
  if (team.phase === "contend" && team.riskTolerance < 50) penalty += 1;

  return clamp(penalty, 4, 13);
};

const getRiskPenalty = (team: TeamProfile, prospect: Prospect) => {
  const risks = prospect.risks.map((risk) => risk.toLowerCase());
  const teamSignals = buildSignalSet([...team.needs, ...team.priorityTags]);
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

const getPickValueAdjustment = (team: TeamProfile, prospect: Prospect) => {
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

const scoreProspect = (team: TeamProfile, prospect: Prospect, weights: Weights) => {
  const effectiveWeights = getEffectiveWeights(weights, team);
  const normalized = normalizeWeights(effectiveWeights);
  const breakdown = {
    consensus: getConsensusScore(team.pick, prospect),
    need: getNeedScore(team, prospect),
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

  return { score: clamp(score), breakdown, riskPenalty, pickValueAdjustment, effectiveWeights };
};

const compareScoredCandidates = (left: ScoredCandidate, right: ScoredCandidate) => {
  const scoreDelta = right.score - left.score;
  if (Math.abs(scoreDelta) > NARROW_RACE_SCORE_EPSILON) return scoreDelta;

  const consensusDelta = left.prospect.consensusRank - right.prospect.consensusRank;
  if (consensusDelta !== 0) return consensusDelta;

  const needDelta = right.breakdown.need - left.breakdown.need;
  if (Math.abs(needDelta) > 0.01) return needDelta;

  return right.breakdown.upside - left.breakdown.upside;
};

const getRoleFit = (team: TeamProfile, prospect: Prospect) => {
  const prospectSignals = buildSignalSet(prospect.roleTags);
  const match = team.priorityTags.find((tag) => prospectSignals.has(normalizeTag(tag)));
  if (match) return match;
  if (prospect.positions.includes("PG")) return "primary guard";
  if (prospect.positions.includes("C")) return "frontcourt size";
  if (prospect.positions.includes("SF")) return "wing depth";
  return "rotation fit";
};

const getWarnings = (team: TeamProfile, prospect: Prospect, needScore: number) => {
  const warnings: string[] = [];
  if (needScore < 65) warnings.push("Fit score is below target; verify with team-need notes.");
  if (team.phase === "contend" && prospect.profile.feel < 72) warnings.push("Contending team may prefer a cleaner immediate role.");
  if (prospect.risks.some((risk) => risk.toLowerCase().includes("medical"))) warnings.push("Medical context should be checked before final lock.");
  if (getRiskPenalty(team, prospect) >= 8) warnings.push("Risk penalty is material; check injury, shooting or role translation notes.");
  if (prospect.international) warnings.push("International milestone impact: monitor first international slot.");
  return warnings;
};

const getConfidence = (selected: ScoredCandidate, runnerUp: ScoredCandidate | undefined, team: TeamProfile, warnings: string[]) => {
  const rankPenalty = Math.abs(selected.prospect.consensusRank - team.pick) * 1.2;
  const margin = runnerUp ? selected.score - runnerUp.score : 12;
  const marginBonus = clamp(margin * 1.5, -6, 10);
  const narrowRacePenalty = margin < 2 ? 7 : margin < 5 ? 3 : 0;
  const warningPenalty = warnings.length * 2.5;

  return clamp(selected.score - rankPenalty + marginBonus - narrowRacePenalty - warningPenalty);
};

const getEvidence = (team: TeamProfile, prospect: Prospect, pick: number, selected: ScoredCandidate, runnerUp?: ScoredCandidate) => [
  `Consensus rank ${prospect.consensusRank} vs pick ${pick}; mock heat ${prospect.mockHeat}/100.`,
  `Intel adjusted for consensus overlap: expected heat ${Math.round(getMarketHeatBaseline(prospect.consensusRank))}, adjusted intel ${Math.round(selected.breakdown.intel)}/100.`,
  `Risk/value controls: ${Math.round(selected.riskPenalty)} risk penalty after ${team.phase} tolerance; pick-value adjustment ${formatSigned(selected.pickValueAdjustment)}.`,
  ...getNarrowRaceEvidence(selected, runnerUp),
  "Agent parameter profile locked; risk and fit adjustments applied.",
  runnerUp
    ? `Raw model margin over next candidate: ${Math.round(selected.score - runnerUp.score)} points vs ${runnerUp.prospect.name}.`
    : "Model margin: no remaining runner-up candidate.",
  `Team needs: ${team.needs.join(", ")}.`,
  `Role fit: ${getRoleFit(team, prospect)}; strengths: ${prospect.strengths.slice(0, 2).join(", ")}.`,
  ...prospect.sourceNotes.slice(0, 2),
];

const getNarrowRaceEvidence = (selected: ScoredCandidate, runnerUp?: ScoredCandidate) => {
  if (!runnerUp) return [];

  const rawMargin = selected.score - runnerUp.score;
  const selectedConsensus = selected.prospect.consensusRank;
  const runnerUpConsensus = runnerUp.prospect.consensusRank;
  const consensusEdge = selectedConsensus < runnerUpConsensus;

  if (Math.abs(rawMargin) > NARROW_RACE_SCORE_EPSILON || !consensusEdge) return [];

  if (rawMargin >= 0) {
    return [
      `Narrow-race check: raw score led by ${formatScoreMargin(rawMargin)} points; consensus rank ${selectedConsensus} over ${runnerUpConsensus} confirmed the pick.`,
    ];
  }

  return [
    `Narrow-race tiebreaker: raw score trailed by ${formatScoreMargin(Math.abs(rawMargin))} points; consensus rank ${selectedConsensus} over ${runnerUpConsensus} broke the tie.`,
  ];
};

const formatScoreMargin = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const formatSigned = (value: number) => {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
};

const buildDraftPick = (
  team: TeamProfile,
  selected: ScoredCandidate,
  alternatives: ScoredCandidate[],
  evidencePrefix?: string,
): DraftPick => {
  const warnings = getWarnings(team, selected.prospect, selected.breakdown.need);
  const runnerUp = alternatives[0];
  const evidence = getEvidence(team, selected.prospect, team.pick, selected, runnerUp);

  return {
    pick: team.pick,
    team: team.team,
    acquiredFrom: team.acquiredFrom,
    prospect: selected.prospect,
    score: Math.round(selected.score),
    confidence: Math.round(getConfidence(selected, runnerUp, team, warnings)),
    margin: Math.max(0, Math.round(runnerUp ? selected.score - runnerUp.score : 12)),
    zone: getDraftZone(team.pick),
    effectiveWeights: selected.effectiveWeights,
    roleFit: getRoleFit(team, selected.prospect),
    breakdown: {
      consensus: Math.round(selected.breakdown.consensus),
      need: Math.round(selected.breakdown.need),
      player: Math.round(selected.breakdown.player),
      upside: Math.round(selected.breakdown.upside),
      intel: Math.round(selected.breakdown.intel),
    },
    alternatives: alternatives.slice(0, 3).map((candidate) => ({
      prospectId: candidate.prospect.id,
      name: candidate.prospect.name,
      score: Math.round(candidate.score),
      roleFit: getRoleFit(team, candidate.prospect),
    })),
    evidence: evidencePrefix ? [evidencePrefix, ...evidence] : evidence,
    warnings,
  };
};

export const generateBoard = (
  teams: TeamProfile[],
  prospects: Prospect[],
  weights: Weights,
): DraftPick[] => {
  const available = [...prospects].sort((a, b) => a.consensusRank - b.consensusRank);

  return [...teams]
    .sort((a, b) => a.pick - b.pick)
    .map((team) => {
      const scored = available
        .map((prospect) => ({ prospect, ...scoreProspect(team, prospect, weights) }))
        .sort(compareScoredCandidates);
      const selected = scored[0];
      const selectedIndex = available.findIndex((prospect) => prospect.id === selected.prospect.id);
      if (selectedIndex >= 0) available.splice(selectedIndex, 1);

      return buildDraftPick(team, selected, scored.slice(1));
    });
};

const getSchoolLeader = (board: DraftPick[]) => {
  const counts = board.reduce<Record<string, number>>((memo, pick) => {
    memo[pick.prospect.school] = (memo[pick.prospect.school] ?? 0) + 1;
    return memo;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
};

const localized = (zh: string, en: string): LocalizedText => ({ zh, en });

const pickEvidence = (pick: DraftPick, suffix = ""): LocalizedText => ({
  zh: `${pick.pick}. ${pick.prospect.name}${suffix}`,
  en: `${pick.pick}. ${pick.prospect.name}${suffix}`,
});

const baseMilestone = (
  definition: RuntimeMilestoneDefinition,
  answerI18n: LocalizedText,
  evidenceI18n: LocalizedText[],
  confidence?: number,
): MilestoneAnswer => ({
  id: definition.id,
  prompt: definition.prompt.zh,
  promptI18n: definition.prompt,
  type: definition.type,
  answer: answerI18n.zh,
  answerI18n,
  confidence: confidence ?? definition.confidence,
  evidence: evidenceI18n.map((item) => item.zh),
  evidenceI18n,
});

export const generateMilestones = (board: DraftPick[], definitions: RuntimeMilestoneDefinition[]): MilestoneAnswer[] => {
  const firstFive = board.slice(0, 5);
  const firstInternational = board.find((pick) => pick.prospect.international);
  const schoolLeader = getSchoolLeader(board);
  const lotteryGuards = board
    .slice(0, 14)
    .filter((pick) => pick.prospect.positions.some((position) => position === "PG" || position === "SG"));
  const firstCenter = board.find((pick) => pick.prospect.positions.includes("C"));
  const freshmen = board.filter((pick) => pick.prospect.classYear === "Freshman");
  const tradedPicks = board.filter((pick) => pick.acquiredFrom);

  return definitions.flatMap((definition) => {
    if (definition.id === "intl-top-five") {
      const hasInternational = firstFive.some((pick) => pick.prospect.international);
      return baseMilestone(
        definition,
        localized(hasInternational ? "是" : "否", hasInternational ? "Yes" : "No"),
        firstFive.map((pick) => pickEvidence(pick, ` (${pick.prospect.origin})`)),
      );
    }

    if (definition.id === "first-intl") {
      return baseMilestone(
        definition,
        firstInternational
          ? localized(String(firstInternational.pick), String(firstInternational.pick))
          : localized("首轮无国际球员", "No international player in round one"),
        firstInternational
          ? [pickEvidence(firstInternational, `, ${firstInternational.prospect.origin}`)]
          : [localized("当前预测板首轮没有国际球员。", "Current board has no international player in round one.")],
        firstInternational ? firstInternational.confidence : definition.confidence,
      );
    }

    if (definition.id === "school-most") {
      return baseMilestone(
        definition,
        schoolLeader ? localized(`${schoolLeader[0]} (${schoolLeader[1]} 人)`, `${schoolLeader[0]} (${schoolLeader[1]})`) : localized("N/A", "N/A"),
        board.filter((pick) => pick.prospect.school === schoolLeader?.[0]).map((pick) => pickEvidence(pick)),
      );
    }

    if (definition.id === "lottery-guards") {
      return baseMilestone(
        definition,
        localized(String(lotteryGuards.length), String(lotteryGuards.length)),
        lotteryGuards.map((pick) => pickEvidence(pick, ` (${pick.prospect.positions.join("/")})`)),
      );
    }

    if (definition.id === "first-center") {
      return baseMilestone(
        definition,
        firstCenter ? localized(String(firstCenter.pick), String(firstCenter.pick)) : localized("首轮无中锋", "No center in round one"),
        firstCenter ? [pickEvidence(firstCenter)] : [localized("当前预测板首轮没有中锋。", "No center appears in current board.")],
        firstCenter ? firstCenter.confidence : definition.confidence,
      );
    }

    if (definition.id === "freshmen-count") {
      return baseMilestone(
        definition,
        localized(String(freshmen.length), String(freshmen.length)),
        freshmen.slice(0, 8).map((pick) => pickEvidence(pick)),
      );
    }

    if (definition.id === "traded-picks") {
      return baseMilestone(
        definition,
        localized(String(tradedPicks.length), String(tradedPicks.length)),
        tradedPicks.map((pick) =>
          localized(`${pick.pick}. ${pick.team} 来自 ${pick.acquiredFrom}`, `${pick.pick}. ${pick.team} from ${pick.acquiredFrom}`),
        ),
      );
    }

    return [];
  });
};

export const getBoardHealth = (board: DraftPick[]) => {
  const uniqueProspects = new Set(board.map((pick) => pick.prospect.id));
  const lowConfidence = board.filter((pick) => pick.confidence < 65).length;
  const hasThirtyPicks = board.length === 30;
  const noDuplicates = uniqueProspects.size === board.length;

  return {
    hasThirtyPicks,
    noDuplicates,
    lowConfidence,
    ready: hasThirtyPicks && noDuplicates && lowConfidence <= 8,
  };
};
