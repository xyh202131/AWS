import type { DraftPick, LanguageCode, LocalizedText, MilestoneAnswer, RuntimeExportConfig } from "../types";
import { hideAgentParameters } from "./evidence";
import { withTextFallback } from "./fallbacks";

const text = (value: LocalizedText, language: LanguageCode) => value[language] || value.zh || value.en;

const milestonePrompt = (milestone: MilestoneAnswer, language: LanguageCode) =>
  milestone.promptI18n ? text(milestone.promptI18n, language) : milestone.prompt;

const milestoneAnswer = (milestone: MilestoneAnswer, language: LanguageCode) =>
  milestone.answerI18n ? text(milestone.answerI18n, language) : milestone.answer;

const milestoneEvidence = (milestone: MilestoneAnswer, language: LanguageCode) =>
  milestone.evidenceI18n?.length ? milestone.evidenceI18n.map((item) => text(item, language)) : milestone.evidence;

export const buildSubmissionPayload = (
  board: DraftPick[],
  milestones: MilestoneAnswer[],
  exportSettings: RuntimeExportConfig,
  language: LanguageCode,
) => ({
  generatedAt: new Date().toISOString(),
  product: text(exportSettings.product, language),
  firstRoundPrediction: board.map((pick) => ({
    pick: pick.pick,
    team: pick.team,
    acquiredFrom: pick.acquiredFrom ?? text(exportSettings.originalPick, language),
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
    alternativeStatus: pick.alternatives.length
      ? text(exportSettings.alternativeRetained, language)
      : text(exportSettings.alternativeMissing, language),
    evidence: withTextFallback(pick.evidence, text(exportSettings.evidenceFallback, language)).map(hideAgentParameters),
    warnings: withTextFallback(pick.warnings, text(exportSettings.warningFallback, language)),
  })),
  milestoneAnswers: milestones.map((milestone) => ({
    id: milestone.id,
    prompt: milestonePrompt(milestone, language),
    answer: milestoneAnswer(milestone, language),
    confidence: milestone.confidence,
    evidence: withTextFallback(milestoneEvidence(milestone, language), text(exportSettings.milestoneEvidenceFallback, language)).map(
      hideAgentParameters,
    ),
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

export const buildMarkdownBrief = (
  board: DraftPick[],
  milestones: MilestoneAnswer[],
  exportSettings: RuntimeExportConfig,
  language: LanguageCode,
) => {
  const picks = board
    .map(
      (pick) =>
        `| ${pick.pick} | ${pick.team} | ${pick.prospect.name} | ${pick.prospect.positions.join("/")} | ${pick.zone} | ${pick.confidence}% | ${pick.margin} | ${pick.roleFit} |`,
    )
    .join("\n");
  const answers = milestones
    .map((milestone) => `- **${milestonePrompt(milestone, language)}** ${milestoneAnswer(milestone, language)} (${milestone.confidence}%)`)
    .join("\n");

  const headers =
    language === "zh"
      ? "| 顺位 | 球队 | 球员 | 位置 | 区间 | 置信度 | 分差 | 适配 |\n|---:|---|---|---|---|---:|---:|---|"
      : "| Pick | Team | Player | Pos | Zone | Confidence | Margin | Fit |\n|---:|---|---|---|---|---:|---:|---|";

  return `# ${text(exportSettings.briefTitle, language)}

## ${text(exportSettings.firstRoundTitle, language)}

${headers}
${picks}

## ${text(exportSettings.milestonesTitle, language)}

${answers}

## ${text(exportSettings.talkTrackTitle, language)}

${text(exportSettings.talkTrack, language)}
`;
};
