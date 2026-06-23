export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export type MilestoneType = "yes_no" | "number" | "text";

export type DraftZone = "top-five" | "lottery" | "late-first";

export interface ScoreProfile {
  shooting: number;
  creation: number;
  defense: number;
  athleticism: number;
  feel: number;
  size: number;
  upside: number;
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
  type: MilestoneType;
  answer: string;
  confidence: number;
  evidence: string[];
}

export interface ImportBundle {
  teams?: TeamProfile[];
  prospects?: Prospect[];
}
