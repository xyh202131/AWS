import type { DraftPick, DraftZone, MilestoneAnswer, Prospect, TeamProfile, Weights } from "../types";

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
  breakdown: DraftPick["breakdown"];
  effectiveWeights: Weights;
}

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
  const staleRiskPenalty = prospect.mockHeat < 45 && prospect.consensusRank > team.pick + 8 ? -5 : 0;
  return clamp(prospect.mockHeat + internationalBonus + sourceBonus + phasePenalty + staleRiskPenalty);
};

const getRiskPenalty = (team: TeamProfile, prospect: Prospect) => {
  const risks = prospect.risks.map((risk) => risk.toLowerCase());
  const teamSignals = buildSignalSet([...team.needs, ...team.priorityTags]);
  let penalty = 0;

  if (risks.some((risk) => risk.includes("medical") || risk.includes("health"))) {
    penalty += team.phase === "contend" ? 10 : 7;
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
  const score =
    breakdown.consensus * normalized.consensus +
    breakdown.need * normalized.need +
    breakdown.player * normalized.player +
    breakdown.upside * normalized.upside +
    breakdown.intel * normalized.intel -
    riskPenalty;

  return { score: clamp(score), breakdown, riskPenalty, effectiveWeights };
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
  "Agent parameter profile locked; risk and fit adjustments applied.",
  runnerUp
    ? `Model margin over next candidate: ${Math.round(selected.score - runnerUp.score)} points vs ${runnerUp.prospect.name}.`
    : "Model margin: no remaining runner-up candidate.",
  `Team needs: ${team.needs.join(", ")}.`,
  `Role fit: ${getRoleFit(team, prospect)}; strengths: ${prospect.strengths.slice(0, 2).join(", ")}.`,
  ...prospect.sourceNotes.slice(0, 2),
];

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
    margin: Math.round(runnerUp ? selected.score - runnerUp.score : 12),
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
        .sort((a, b) => b.score - a.score);
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

export const generateMilestones = (board: DraftPick[]): MilestoneAnswer[] => {
  const firstFive = board.slice(0, 5);
  const firstInternational = board.find((pick) => pick.prospect.international);
  const schoolLeader = getSchoolLeader(board);
  const lotteryGuards = board
    .slice(0, 14)
    .filter((pick) => pick.prospect.positions.some((position) => position === "PG" || position === "SG"));
  const firstCenter = board.find((pick) => pick.prospect.positions.includes("C"));
  const freshmen = board.filter((pick) => pick.prospect.classYear === "Freshman");
  const topConfidence = [...board].sort((a, b) => b.confidence - a.confidence)[0];
  const tradedPicks = board.filter((pick) => pick.acquiredFrom);

  return [
    {
      id: "intl-top-five",
      prompt: "前 5 位是否包含国际球员？",
      type: "yes_no",
      answer: firstFive.some((pick) => pick.prospect.international) ? "是" : "否",
      confidence: 74,
      evidence: firstFive.map((pick) => `${pick.pick}. ${pick.prospect.name} (${pick.prospect.origin})`),
    },
    {
      id: "first-intl",
      prompt: "第一位被选中的国际球员是几顺位？",
      type: "number",
      answer: firstInternational ? String(firstInternational.pick) : "首轮无国际球员",
      confidence: firstInternational ? firstInternational.confidence : 48,
      evidence: firstInternational
        ? [`${firstInternational.pick}. ${firstInternational.prospect.name}, ${firstInternational.prospect.origin}`]
        : ["Current board has no international player in round one."],
    },
    {
      id: "school-most",
      prompt: "哪所学校贡献最多首轮秀？",
      type: "text",
      answer: schoolLeader ? `${schoolLeader[0]} (${schoolLeader[1]} 人)` : "N/A",
      confidence: 68,
      evidence: board
        .filter((pick) => pick.prospect.school === schoolLeader?.[0])
        .map((pick) => `${pick.pick}. ${pick.prospect.name}`),
    },
    {
      id: "lottery-guards",
      prompt: "乐透区会有多少名后卫？",
      type: "number",
      answer: String(lotteryGuards.length),
      confidence: 66,
      evidence: lotteryGuards.map((pick) => `${pick.pick}. ${pick.prospect.name} (${pick.prospect.positions.join("/")})`),
    },
    {
      id: "first-center",
      prompt: "第一位中锋是几顺位？",
      type: "number",
      answer: firstCenter ? String(firstCenter.pick) : "首轮无中锋",
      confidence: firstCenter ? firstCenter.confidence : 45,
      evidence: firstCenter ? [`${firstCenter.pick}. ${firstCenter.prospect.name}`] : ["No center appears in current board."],
    },
    {
      id: "freshmen-count",
      prompt: "首轮 Freshman 数量是多少？",
      type: "number",
      answer: String(freshmen.length),
      confidence: 63,
      evidence: freshmen.slice(0, 8).map((pick) => `${pick.pick}. ${pick.prospect.name}`),
    },
    {
      id: "highest-confidence",
      prompt: "置信度最高的一组选秀预测是什么？",
      type: "text",
      answer: `${topConfidence.pick}. ${topConfidence.team} - ${topConfidence.prospect.name}`,
      confidence: topConfidence.confidence,
      evidence: topConfidence.evidence,
    },
    {
      id: "traded-picks",
      prompt: "首轮来自交易的顺位数量是多少？",
      type: "number",
      answer: String(tradedPicks.length),
      confidence: 82,
      evidence: tradedPicks.map((pick) => `${pick.pick}. ${pick.team} from ${pick.acquiredFrom}`),
    },
  ];
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
