import type { DraftPick, MilestoneAnswer } from "../types";
import { hideAgentParameters } from "./evidence";
import { ORIGINAL_PICK_LABEL, WARNING_FALLBACK, withTextFallback } from "./fallbacks";

export const buildSubmissionPayload = (board: DraftPick[], milestones: MilestoneAnswer[]) => ({
  generatedAt: new Date().toISOString(),
  product: "DraftOps 2026 NBA Draft Prediction Agent",
  firstRoundPrediction: board.map((pick) => ({
    pick: pick.pick,
    team: pick.team,
    acquiredFrom: pick.acquiredFrom ?? ORIGINAL_PICK_LABEL,
    player: pick.prospect.name,
    school: pick.prospect.school,
    origin: pick.prospect.origin,
    position: pick.prospect.positions.join("/"),
    confidence: pick.confidence,
    score: pick.score,
    margin: pick.margin,
    zone: pick.zone,
    roleFit: pick.roleFit,
    alternatives: pick.alternatives,
    alternativeStatus: pick.alternatives.length ? "Runner-up candidates retained." : "No alternative retained for this slot.",
    evidence: withTextFallback(pick.evidence, "No evidence text retained for this pick.").map(hideAgentParameters),
    warnings: withTextFallback(pick.warnings, WARNING_FALLBACK),
  })),
  milestoneAnswers: milestones.map((milestone) => ({
    id: milestone.id,
    prompt: milestone.prompt,
    answer: milestone.answer,
    confidence: milestone.confidence,
    evidence: withTextFallback(milestone.evidence, "No evidence retained for this milestone.").map(hideAgentParameters),
  })),
});

export const downloadJson = (filename: string, value: unknown) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadText = (filename: string, value: string, type = "text/markdown") => {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const buildMarkdownBrief = (board: DraftPick[], milestones: MilestoneAnswer[]) => {
  const picks = board
    .map(
      (pick) =>
        `| ${pick.pick} | ${pick.team} | ${pick.prospect.name} | ${pick.prospect.positions.join("/")} | ${pick.zone} | ${pick.confidence}% | ${pick.margin} | ${pick.roleFit} |`,
    )
    .join("\n");
  const answers = milestones
    .map((milestone) => `- **${milestone.prompt}** ${milestone.answer} (${milestone.confidence}%)`)
    .join("\n");

  return `# DraftOps Submission Brief

## First Round Prediction

| Pick | Team | Player | Pos | Zone | Confidence | Margin | Fit |
|---:|---|---|---|---|---:|---:|---|
${picks}

## Milestones

${answers}

## Talk Track

We combine official pick order, public consensus mocks, team needs, prospect profile scores, and late intel into one explainable board. Each pick keeps its evidence and warnings so the final 6-minute demo can defend changes instead of only showing a list.
`;
};
