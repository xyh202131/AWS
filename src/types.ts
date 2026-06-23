export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export type MilestoneType = "yes_no" | "number" | "text";

export type DraftZone = "top-five" | "lottery" | "late-first";

export type LanguageCode = "zh" | "en";

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface ScoreProfile {
  shooting: number;
  creation: number;
  defense: number;
  athleticism: number;
  feel: number;
  size: number;
  upside: number;
}

export interface ProspectMedia {
  photoUrl?: string;
  remotePhotoUrl?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  provider?: string;
  status?: "verified" | "fallback" | "needs_review";
  updatedAt?: string;
}

export interface Prospect {
  id: string;
  name: string;
  positions: Position[];
  school: string;
  origin: string;
  classYear: string;
  height: string;
  weight: string;
  age: number;
  consensusRank: number;
  mockHeat: number;
  international: boolean;
  roleTags: string[];
  strengths: string[];
  risks: string[];
  profile: ScoreProfile;
  sourceNotes: string[];
  media?: ProspectMedia;
}

export interface TeamProfile {
  pick: number;
  team: string;
  acquiredFrom?: string;
  phase: "rebuild" | "accelerate" | "contend" | "asset";
  needs: string[];
  priorityTags: string[];
  riskTolerance: number;
  notes: string;
}

export interface Weights {
  consensus: number;
  need: number;
  player: number;
  upside: number;
  intel: number;
}

export interface DraftPick {
  pick: number;
  team: string;
  acquiredFrom?: string;
  prospect: Prospect;
  score: number;
  confidence: number;
  margin: number;
  zone: DraftZone;
  effectiveWeights: Weights;
  roleFit: string;
  breakdown: {
    consensus: number;
    need: number;
    player: number;
    upside: number;
    intel: number;
  };
  alternatives: Array<{
    prospectId: string;
    name: string;
    score: number;
    roleFit: string;
  }>;
  evidence: string[];
  warnings: string[];
}

export interface MilestoneAnswer {
  id: string;
  prompt: string;
  promptI18n?: LocalizedText;
  type: MilestoneType;
  answer: string;
  answerI18n?: LocalizedText;
  confidence: number;
  evidence: string[];
  evidenceI18n?: LocalizedText[];
}

export interface ImportBundle {
  teams?: TeamProfile[];
  prospects?: Prospect[];
}

export interface RuntimeDataConfig {
  bundleUrl: string;
  boardUrl: string;
  bundlePath: string;
  boardPath: string;
}

export interface RuntimeSourceLink {
  label: LocalizedText;
  url: string;
}

export interface RuntimeSubmissionConfig {
  deadlineIso: string;
  deadlineLabel: LocalizedText;
}

export interface RuntimeModelConfig {
  version: string;
  sampleWindow: string;
  chatModelLabel: string;
}

export interface RuntimeWorkflowStep {
  id: string;
  icon: string;
  label: LocalizedText;
  date: string;
  statusKey: "completed" | "active" | "pending" | "pendingShort" | "locked";
  tone: "done" | "active" | "pending";
}

export interface RuntimeAwsStep {
  id: string;
  icon: string;
  label: LocalizedText;
  detail: LocalizedText;
}

export interface RuntimeMilestoneDefinition {
  id: string;
  prompt: LocalizedText;
  type: MilestoneType;
  confidence: number;
  answer?: string;
  answerI18n?: LocalizedText;
  evidence?: string[];
  evidenceI18n?: LocalizedText[];
}

export interface RuntimeExportConfig {
  product: LocalizedText;
  submissionFilename: string;
  briefFilename: string;
  originalPick: LocalizedText;
  alternativeRetained: LocalizedText;
  alternativeMissing: LocalizedText;
  evidenceFallback: LocalizedText;
  warningFallback: LocalizedText;
  milestoneEvidenceFallback: LocalizedText;
  briefTitle: LocalizedText;
  firstRoundTitle: LocalizedText;
  milestonesTitle: LocalizedText;
  talkTrackTitle: LocalizedText;
  talkTrack: LocalizedText;
}

export interface DraftOpsManifest {
  schemaVersion: string;
  data: RuntimeDataConfig;
  submission: RuntimeSubmissionConfig;
  model: RuntimeModelConfig;
  sourceLinks: RuntimeSourceLink[];
  workflowSteps: RuntimeWorkflowStep[];
  awsSteps: RuntimeAwsStep[];
  milestones: RuntimeMilestoneDefinition[];
  exportSettings: RuntimeExportConfig;
}
