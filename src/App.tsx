import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Database,
  FileInput,
  Filter,
  GripHorizontal,
  Globe2,
  MessageCircle,
  Minus,
  Search,
  Send,
  Server,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import "./App.css";
import draftOpsManifestJson from "./config/draftops-manifest.json";
import { defaultWeights, seedProspects, seedTeams } from "./data/seedData";
import { hideAgentParameters } from "./lib/evidence";
import { buildMarkdownBrief, buildSubmissionPayload, downloadJson, downloadText } from "./lib/export";
import { formatOptionalValue, withTextFallback } from "./lib/fallbacks";
import {
  localizeEvidenceText,
  localizePhrase,
  localizeProspectName,
  localizeSchoolName,
  localizeTeamName,
  type Language,
  UI_COPY,
} from "./lib/i18n";
import { generateBoard, generateMilestones, getBoardHealth } from "./lib/prediction";
import type {
  DraftOpsManifest,
  DraftPick,
  ImportBundle,
  LocalizedText,
  Prospect,
  RuntimeWorkflowStep,
  ScoreProfile,
  TeamProfile,
  Weights,
} from "./types";

gsap.registerPlugin(useGSAP);

const draftOpsManifest = draftOpsManifestJson as DraftOpsManifest;
const deepSeekAgentPort = import.meta.env.VITE_DEEPSEEK_AGENT_PORT ?? "4318";
const isLocalRuntime =
  typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);
const deepSeekChatUrl =
  import.meta.env.VITE_DEEPSEEK_CHAT_URL ??
  (isLocalRuntime ? `http://127.0.0.1:${deepSeekAgentPort}/api/deepseek/chat` : "/api/deepseek/chat");

const runtimeText = (value: LocalizedText, language: Language) => value[language] || value.zh || value.en;

interface AgentBoardArtifact {
  generatedAt?: string;
  generatedBy?: string;
  candidatePool?: CandidatePoolSummary;
  scenario?: {
    id?: string;
    label?: string;
    weights?: Weights;
  };
  auditScore?: number;
  summary?: AgentBoardSummary;
  boardRows?: AgentSummaryPick[];
  noManualOverride?: boolean;
  board?: DraftPick[];
}

interface CandidatePoolSummary {
  generatedAt?: string;
  officialProspectRows?: number;
  fullDraftOpsProfiles?: number;
  fallbackProfiles?: number;
  noManualOverride?: boolean;
}

interface AgentSummaryPick {
  pick?: number;
  team?: string;
  player?: string;
  confidence?: number;
  consensusRank?: number;
  fallbackProfile?: boolean;
}

interface AgentBoardSummary {
  lowConfidence?: AgentSummaryPick[];
  narrowMargins?: AgentSummaryPick[];
  fallbackPicks?: AgentSummaryPick[];
  changedVsPrevious?: AgentSummaryPick[];
}

interface AgentMetaState {
  label: string;
  generatedBy: string;
  generatedAt: string;
  auditScore?: number;
  fallbackPickCount?: number;
  lowConfidenceCount?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface DeepSeekChatResponse {
  answer?: string;
  modelLabel?: string;
  finishReason?: string | null;
  truncated?: boolean;
  maxTokens?: number;
  error?: string;
}

interface LocalDecisionItem {
  label: string;
  value?: string;
  text?: string;
  source: string;
  tone?: "good" | "watch" | "risk";
}

interface LocalDecisionReport {
  tone: "good" | "watch" | "risk";
  verdict: string;
  summary: string;
  metrics: LocalDecisionItem[];
  evidenceChain: LocalDecisionItem[];
  riskChain: LocalDecisionItem[];
  fitChain: LocalDecisionItem[];
  guardrail: string;
}

type StatusState =
  | { type: "loading" }
  | { type: "applied"; label: string; teams: number; prospects: number }
  | { type: "fallback" }
  | { type: "submissionExported" }
  | { type: "briefExported" };

const formatStatus = (status: StatusState, language: Language) => {
  const copy = UI_COPY[language];
  if (status.type === "applied") return copy.appliedBoard(localizePhrase(status.label, language), status.teams, status.prospects);
  if (status.type === "fallback") return copy.fallbackBoard;
  if (status.type === "submissionExported") return copy.submissionExported;
  if (status.type === "briefExported") return copy.briefExported;
  return copy.loadingBoard;
};

const findTeamProfile = (teams: TeamProfile[], pick: DraftPick) =>
  teams.find((team) => team.pick === pick.pick) ??
  teams.find((team) => team.team.toLowerCase() === pick.team.toLowerCase());

type PositionFilter = "all" | "PG" | "SG" | "SF" | "PF" | "C";
type SortKey = "pick" | "score" | "confidence" | "consensus" | "age";
type DossierTab = "overview" | "evidence" | "risk" | "fit" | "alternatives";
type MobileSection = "board" | "player" | "flow";
type WorkflowMode = "flow" | "aws";
type FilterMenu = "position" | "sort" | null;

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

const dashboardCopy = {
  zh: {
    systemTitle: "2026 NBA 选秀预测系统",
    dataUpdated: "数据更新时间",
    primaryTabs: ["选秀板", "球队视图", "模拟选秀", "大数据", "球探报告", "趋势分析", "历史选秀", "设置"],
    searchPlaceholder: "搜索球员（姓名、学校、位置、标签）",
    position: "位置",
    all: "全部",
    sort: "排序",
    sortPick: "顺位",
    sortScore: "综合分",
    sortConfidence: "置信度",
    sortConsensus: "共识排名",
    sortAge: "年龄",
    filter: "筛选",
    filterRiskOnly: "风险签位",
    wholeBoard: "整体看板",
    averageScore: "平均综合分",
    highUpside: "高潜力（A-及以上）",
    internationalShare: "国际球员占比",
    averageAge: "平均年龄",
    predictedTrades: "预测交易数",
    modelConfidence: "模型置信度",
    rank: "顺位",
    teamProjected: "球队（预计）",
    positionShort: "位置",
    schoolTeam: "学校/球队",
    height: "身高",
    wingspan: "臂展",
    totalScore: "综合分",
    potential: "潜力",
    immediate: "即战力",
    trend: "趋势",
    playerIntel: "球员智能情报",
    focus: "重点关注",
    compositeScore: "综合评分",
    upside: "潜力",
    readiness: "即战力",
    coreEvidence: "核心证据",
    risks: "风险与注意事项",
    fitMatch: "球队情况匹配",
    match: "匹配度",
    playerProfile: "球员画像",
    dataSource: "数据来源与备注",
    sourcePrefix: "来源：NBA.com / ESPN / 本地官方球员池 / 智能体预测板",
    fallbackNotes: "当前风险说明较少，需继续跟踪体测、医疗和球队试训反馈。",
    alternativesIfMissed: "备选方案（如无法选中）",
    moreAlternatives: "更多备选",
    workflow: "选秀流程里程碑",
    awsData: "AWS 数据与模型架构",
    completed: "完成",
    active: "进行中",
    pending: "待开始",
    pendingShort: "待开始",
    locked: "已锁定",
  },
  en: {
    systemTitle: "2026 NBA Draft Prediction System",
    dataUpdated: "Data updated",
    primaryTabs: ["Draft Board", "Team View", "Mock Draft", "Data Lake", "Scouting", "Trends", "History", "Settings"],
    searchPlaceholder: "Search player (name, school, position, tag)",
    position: "Position",
    all: "All",
    sort: "Sort",
    sortPick: "Pick",
    sortScore: "Score",
    sortConfidence: "Confidence",
    sortConsensus: "Consensus",
    sortAge: "Age",
    filter: "Filter",
    filterRiskOnly: "Risk picks",
    wholeBoard: "Board Summary",
    averageScore: "Average score",
    highUpside: "High upside (A-+)",
    internationalShare: "International share",
    averageAge: "Average age",
    predictedTrades: "Projected trades",
    modelConfidence: "Model confidence",
    rank: "Rank",
    teamProjected: "Team",
    positionShort: "Pos",
    schoolTeam: "School/Team",
    height: "Height",
    wingspan: "Wingspan",
    totalScore: "Score",
    potential: "Potential",
    immediate: "Ready",
    trend: "Trend",
    playerIntel: "Player Intelligence",
    focus: "Focus",
    compositeScore: "Composite score",
    upside: "Upside",
    readiness: "Readiness",
    coreEvidence: "Core evidence",
    risks: "Risk notes",
    fitMatch: "Team fit match",
    match: "Match",
    playerProfile: "Player profile",
    dataSource: "Sources and notes",
    sourcePrefix: "Sources: NBA.com / ESPN / local official player pool / agent board",
    fallbackNotes: "Risk notes are limited; keep tracking measurements, medicals, and workouts.",
    alternativesIfMissed: "Alternatives if unavailable",
    moreAlternatives: "More alternatives",
    workflow: "Draft Workflow",
    awsData: "AWS Data and Model Architecture",
    completed: "Done",
    active: "Active",
    pending: "Pending",
    pendingShort: "Pending",
    locked: "Locked",
  },
} as const;

const runtimeIcon = (name: string, size = 22) => {
  if (name === "user") return <UserRound size={size} />;
  if (name === "users") return <Users size={size} />;
  if (name === "message") return <MessageCircle size={size} />;
  if (name === "clipboard") return <ClipboardList size={size} />;
  if (name === "calendar") return <CalendarDays size={size} />;
  if (name === "server") return <Server size={size} />;
  if (name === "brain") return <BrainCircuit size={size} />;
  if (name === "trending") return <TrendingUp size={size} />;
  return <Database size={size} />;
};

const workflowStatusLabel = (step: RuntimeWorkflowStep, copy: (typeof dashboardCopy)[Language]) => {
  if (step.statusKey === "completed") return copy.completed;
  if (step.statusKey === "active") return copy.active;
  if (step.statusKey === "pendingShort") return copy.pendingShort;
  if (step.statusKey === "locked") return copy.locked;
  return copy.pending;
};

const formatModelNote = (manifest: DraftOpsManifest, language: Language, confidence: number) =>
  language === "zh"
    ? `备注：模型版本 ${manifest.model.version} | 样本期 ${manifest.model.sampleWindow} | 置信度 ${confidence}%`
    : `Note: Model ${manifest.model.version} | Sample window ${manifest.model.sampleWindow} | Confidence ${confidence}%`;

const teamAbbrev: Record<string, string> = {
  "Washington Wizards": "WAS",
  "Utah Jazz": "UTA",
  "Memphis Grizzlies": "MEM",
  "Chicago Bulls": "CHI",
  "New Orleans Pelicans": "NO",
  "Brooklyn Nets": "BKN",
  "Toronto Raptors": "TOR",
  "San Antonio Spurs": "SAS",
  "Portland Trail Blazers": "POR",
  "Houston Rockets": "HOU",
  "Miami Heat": "MIA",
  "Oklahoma City Thunder": "OKC",
  "Atlanta Hawks": "ATL",
  "Dallas Mavericks": "DAL",
  "Orlando Magic": "ORL",
  "Indiana Pacers": "IND",
  "Minnesota Timberwolves": "MIN",
  "Phoenix Suns": "PHX",
  "Philadelphia 76ers": "PHI",
  "New York Knicks": "NYK",
  "Denver Nuggets": "DEN",
  "Los Angeles Lakers": "LAL",
  "Milwaukee Bucks": "MIL",
  "Sacramento Kings": "SAC",
  "Boston Celtics": "BOS",
  "Charlotte Hornets": "CHA",
  "Cleveland Cavaliers": "CLE",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Los Angeles Clippers": "LAC",
};

const profileLabelKeys: Record<string, { zh: string; en: string }> = {
  shooting: { zh: "投射", en: "Shooting" },
  creation: { zh: "得分创造", en: "Creation" },
  defense: { zh: "防守影响", en: "Defense" },
  athleticism: { zh: "运动能力", en: "Athleticism" },
  feel: { zh: "组织能力", en: "Feel" },
  size: { zh: "尺寸", en: "Size" },
  upside: { zh: "上限", en: "Upside" },
};

const gradeFromScore = (value: number) => {
  if (value >= 96) return "A+";
  if (value >= 91) return "A";
  if (value >= 87) return "A-";
  if (value >= 82) return "B+";
  if (value >= 77) return "B";
  if (value >= 72) return "B-";
  if (value >= 66) return "C+";
  return "C";
};

const formatOneDecimal = (value: number) => (Math.round(value * 10) / 10).toFixed(1);

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const parseHeightInches = (height: string) => {
  const match = height.match(/(\d+)\s*(?:'|-)\s*(\d+)/);
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]);
};

const formatHeightFromInches = (inches: number | null) => {
  if (!inches) return "--";
  const feet = Math.floor(inches / 12);
  const rest = inches % 12;
  return `${feet}' ${rest}"`;
};

const formatHeightDisplay = (height: string) => {
  const inches = parseHeightInches(height);
  return inches ? formatHeightFromInches(inches) : formatOptionalValue(height, "--");
};

const estimateWingspan = (height: string, profileSize: number) => {
  const heightInches = parseHeightInches(height);
  if (!heightInches) return "--";
  const extra = profileSize >= 92 ? 5 : profileSize >= 84 ? 4 : profileSize >= 74 ? 3 : 2;
  return formatHeightFromInches(heightInches + extra);
};

const formatDataTime = (value: string, language: Language) => {
  if (!value) return language === "zh" ? "本地缓存" : "Local cache";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (item: number) => String(item).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getTeamCode = (team: string) => teamAbbrev[team] ?? team.slice(0, 3).toUpperCase();

const hasExpandedFallbackProfile = (prospect: Prospect) =>
  prospect.risks.some((risk) => risk.toLowerCase().includes("expanded-pool fallback profile"));

const needsBoardReview = (pick: DraftPick) =>
  pick.confidence < 70 || pick.warnings.length > 0 || hasExpandedFallbackProfile(pick.prospect);

const getTrend = (pick: DraftPick) => {
  if (pick.margin >= 4 || pick.confidence >= 90) return "up";
  if (pick.warnings.length || pick.confidence < 70) return "down";
  return "flat";
};

const formatSignedOneDecimal = (value: number) => {
  const rounded = formatOneDecimal(Math.abs(value));
  if (value > 0) return `+${rounded}`;
  if (value < 0) return `-${rounded}`;
  return "0.0";
};

const decisionSourceLabels = {
  zh: {
    boardScore: "本地锁定预测板：selectedPick.score / confidence / margin",
    breakdown: "本地策略拆分：selectedPick.breakdown",
    evidence: "本地保留证据：selectedPick.evidence",
    warnings: "本地风险闸门：selectedPick.warnings",
    risks: "本地球员画像：prospect.risks",
    fit: "本地球队档案：teamProfiles.needs / notes",
    role: "本地角色适配：selectedPick.roleFit",
    profile: "本地球员画像：prospect.profile",
  },
  en: {
    boardScore: "Local locked board: selectedPick.score / confidence / margin",
    breakdown: "Local strategy breakdown: selectedPick.breakdown",
    evidence: "Local retained evidence: selectedPick.evidence",
    warnings: "Local risk gate: selectedPick.warnings",
    risks: "Local prospect profile: prospect.risks",
    fit: "Local team file: teamProfiles.needs / notes",
    role: "Local role fit: selectedPick.roleFit",
    profile: "Local prospect profile: prospect.profile",
  },
} as const;

const decisionBreakdownLabels: Record<keyof Weights, { zh: string; en: string }> = {
  consensus: { zh: "共识", en: "Consensus" },
  need: { zh: "需求适配", en: "Need fit" },
  player: { zh: "球员质量", en: "Player grade" },
  upside: { zh: "上限", en: "Upside" },
  intel: { zh: "情报", en: "Intel" },
};

const formatDecisionScore = (value: number, language: Language) =>
  language === "zh" ? `${Math.round(value)}分` : `${Math.round(value)}/100`;

const getTopProfileSignals = (profile: ScoreProfile, language: Language) =>
  (Object.entries(profile) as Array<[keyof ScoreProfile, number]>)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 3)
    .map(([key, value]) => `${profileLabelKeys[key]?.[language] ?? key} ${formatDecisionScore(value, language)}`)
    .join(language === "zh" ? "，" : ", ");

const buildLocalDecisionReport = ({
  pick,
  evidenceItems,
  warningNotes,
  riskNotes,
  teamNeeds,
  teamNote,
  prospectName,
  teamName,
  manifest,
  language,
}: {
  pick: DraftPick;
  evidenceItems: string[];
  warningNotes: string[];
  riskNotes: string[];
  teamNeeds: string[];
  teamNote: string;
  prospectName: string;
  teamName: string;
  manifest: DraftOpsManifest;
  language: Language;
}): LocalDecisionReport => {
  const source = decisionSourceLabels[language];
  const hasBlockingRisk = warningNotes.length > 0 || hasExpandedFallbackProfile(pick.prospect);
  const hasNarrowMargin = Math.abs(pick.margin) < 1.5;
  const tone: LocalDecisionReport["tone"] =
    pick.confidence < 70 || hasBlockingRisk ? "risk" : pick.confidence < 82 || hasNarrowMargin ? "watch" : "good";
  const strongestBreakdown = (Object.entries(pick.breakdown) as Array<[keyof Weights, number]>).sort(
    ([, left], [, right]) => right - left,
  )[0];
  const strongestBreakdownLabel = strongestBreakdown
    ? `${decisionBreakdownLabels[strongestBreakdown[0]][language]} ${formatDecisionScore(strongestBreakdown[1], language)}`
    : language === "zh"
      ? "暂无策略拆分"
      : "No strategy breakdown";
  const topSignals = getTopProfileSignals(pick.prospect.profile, language);
  const verdict =
    language === "zh"
      ? tone === "good"
        ? "建议锁定该签"
        : tone === "watch"
          ? "可锁定，但需盯紧分差"
          : "先复核，再锁定"
      : tone === "good"
        ? "Lock recommendation"
        : tone === "watch"
          ? "Lockable, monitor the margin"
          : "Review before lock";
  const summary =
    language === "zh"
      ? `${teamName} 在 #${pick.pick} 选择 ${prospectName}：本地锁定板给出综合分 ${formatOneDecimal(pick.score)}、置信度 ${Math.round(pick.confidence)}%、相对下一候选分差 ${formatSignedOneDecimal(pick.margin)}。`
      : `${teamName} at #${pick.pick} selects ${prospectName}: the local locked board gives ${formatOneDecimal(pick.score)}, ${Math.round(pick.confidence)}% confidence, and a ${formatSignedOneDecimal(pick.margin)} margin over the next candidate.`;
  const firstEvidence = evidenceItems[0] ?? (language === "zh" ? "当前顺位没有保留证据文本。" : "No retained evidence text.");
  const riskSource = warningNotes.length ? source.warnings : source.risks;
  const riskTexts = warningNotes.length ? warningNotes : riskNotes;
  const riskFallback = language === "zh" ? "本地风险闸门未给出阻塞性警告。" : "No blocking warning in the local risk gate.";
  const needsText = teamNeeds.length
    ? teamNeeds.slice(0, 3).join(language === "zh" ? "；" : "; ")
    : language === "zh"
      ? "球队需求待确认。"
      : "Team needs pending.";
  const evidenceChain: LocalDecisionItem[] = evidenceItems.length
    ? evidenceItems.slice(0, 3).map((text, index) => ({
        label: language === "zh" ? `证据 ${index + 1}` : `Evidence ${index + 1}`,
        text,
        source: source.evidence,
      }))
    : [{ label: language === "zh" ? "证据缺口" : "Evidence gap", text: firstEvidence, source: source.evidence, tone: "watch" }];

  return {
    tone,
    verdict,
    summary,
    metrics: [
      { label: language === "zh" ? "综合分" : "Score", value: formatOneDecimal(pick.score), source: source.boardScore, tone },
      { label: language === "zh" ? "置信度" : "Confidence", value: `${Math.round(pick.confidence)}%`, source: source.boardScore, tone },
      { label: language === "zh" ? "模型分差" : "Model margin", value: formatSignedOneDecimal(pick.margin), source: source.boardScore, tone: hasNarrowMargin ? "watch" : "good" },
      { label: language === "zh" ? "最高策略项" : "Top strategy input", value: strongestBreakdownLabel, source: source.breakdown, tone: "good" },
    ],
    evidenceChain,
    riskChain: (riskTexts.length ? riskTexts : [riskFallback]).slice(0, 3).map((text, index) => ({
      label: language === "zh" ? `风险闸门 ${index + 1}` : `Risk gate ${index + 1}`,
      text,
      source: riskSource,
      tone: warningNotes.length || hasExpandedFallbackProfile(pick.prospect) ? "risk" : "good",
    })),
    fitChain: [
      { label: language === "zh" ? "球队需求" : "Team needs", text: needsText, source: source.fit },
      { label: language === "zh" ? "角色适配" : "Role fit", text: localizePhrase(pick.roleFit, language), source: source.role },
      {
        label: language === "zh" ? "画像强项" : "Profile signals",
        text: topSignals,
        source: source.profile,
      },
      {
        label: language === "zh" ? "球队备注" : "Team note",
        text: teamNote,
        source: source.fit,
      },
    ].filter((item) => item.text),
    guardrail:
      language === "zh"
        ? `防幻觉边界：只汇总 ${manifest.data.boardPath}、${manifest.data.bundlePath} 与本地球队/球员字段；缺失信息显示待确认，不补写外部事实。`
        : `Anti-hallucination guard: this summarizes only ${manifest.data.boardPath}, ${manifest.data.bundlePath}, and local team/prospect fields; missing facts stay pending.`,
  };
};

const buttonMeta = (label: string) => ({
  "aria-label": label,
  "data-label": label,
  title: label,
  value: label,
});

const mediaProviderLabels: Record<string, Record<Language, string>> = {
  "NBA.com": { en: "NBA.com", zh: "NBA.com" },
  "Michigan Athletics": { en: "Michigan Athletics", zh: "密歇根大学官方" },
};

const getProspectInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const formatPhotoSource = (prospect: Prospect, language: Language) => {
  const media = prospect.media;
  if (media?.status === "missing") return language === "zh" ? "候选库已登记，暂无稳定头像" : "Registered in candidate media database; no stable headshot";
  if (!media?.provider) return language === "zh" ? "暂无官方头像来源" : "No official headshot source";
  const provider = mediaProviderLabels[media.provider]?.[language] ?? media.provider;
  if (language === "zh") return media.status === "fallback" ? `${provider}头像（备用来源）` : `${provider}官方头像`;
  return media.sourceLabel ?? `${provider} headshot`;
};

interface PlayerPhotoProps {
  prospect: Prospect;
  label: string;
  language: Language;
  variant?: "table" | "hero" | "panel" | "compact";
}

function PlayerPhoto({ prospect, label, language, variant = "table" }: PlayerPhotoProps) {
  const [hasError, setHasError] = useState(false);
  const media = prospect.media;
  const photoUrl = media?.photoUrl && !hasError ? media.photoUrl : "";
  const sourceLabel = formatPhotoSource(prospect, language);
  const fallbackIconSize = variant === "table" || variant === "compact" ? 11 : 20;

  return (
    <span className={`player-photo player-photo--${variant}`} title={sourceLabel}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={label}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="player-photo-fallback" aria-hidden="true">
          {variant === "table" || variant === "compact" ? (
            <UserRound size={fallbackIconSize} />
          ) : (
            getProspectInitials(prospect.name) || <UserRound size={fallbackIconSize} />
          )}
        </span>
      )}
      {media?.sourceUrl && media.status !== "missing" && (
        <span
          className={`player-photo-badge ${media.status === "fallback" ? "is-fallback" : ""}`}
          aria-label={sourceLabel}
        >
          <ShieldCheck size={variant === "table" || variant === "compact" ? 7 : 9} />
        </span>
      )}
    </span>
  );
}

function DraftOpsMark({ className = "draftops-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="draftopsMarkShell" x1="8" x2="58" y1="6" y2="57" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#68f7ff" />
          <stop offset="0.48" stopColor="#18b8ff" />
          <stop offset="1" stopColor="#5dffbf" />
        </linearGradient>
        <linearGradient id="draftopsMarkCore" x1="18" x2="48" y1="15" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#041923" />
          <stop offset="1" stopColor="#081014" />
        </linearGradient>
        <radialGradient id="draftopsMarkAura" cx="0" cy="0" r="1" gradientTransform="matrix(36 32 -32 36 22 13)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9dfff1" stopOpacity="0.92" />
          <stop offset="0.45" stopColor="#21dfff" stopOpacity="0.34" />
          <stop offset="1" stopColor="#21dfff" stopOpacity="0" />
        </radialGradient>
        <filter id="draftopsMarkGlow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feColorMatrix
            in="blur"
            result="glow"
            values="0 0 0 0 0.05 0 0 0 0 0.95 0 0 0 0 1 0 0 0 0.82 0"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path className="draftops-mark-aura" d="M6 8h29.4C50.1 8 59 17.7 59 32s-8.9 24-23.6 24H6V8Z" />
      <path className="draftops-mark-shell" d="M8 7h27.1C49.3 7 58 17.1 58 32s-8.7 25-22.9 25H8V7Z" />
      <path className="draftops-mark-core" d="M16 15h18.3C45.2 15 52 21.6 52 32s-6.8 17-17.7 17H16V15Z" />
      <path
        className="draftops-mark-d"
        fillRule="evenodd"
        d="M21 20h13.1C41.9 20 47 24.7 47 32s-5.1 12-12.9 12H21V20Zm9 9v6h4.1c2.4 0 3.9-1.1 3.9-3s-1.5-3-3.9-3H30Z"
      />
      <path className="draftops-mark-corner" d="M8 7h12.5L8 19.5V7Z" />
      <g className="draftops-mark-board">
        <path d="M16 51h18.8" />
        <path d="M16 46h10.8" />
        <path d="M16 41h6.6" />
      </g>
      <path className="draftops-mark-orbit orbit-main" d="M10 43c7.9-13.8 23.4-25.9 43-28" />
      <path className="draftops-mark-orbit orbit-secondary" d="M13 22c8.6 7.8 22.6 11.7 39 10.8" />
      <g className="draftops-mark-ball">
        <circle cx="48" cy="15" r="7.2" />
        <path d="M41.5 12.3c4.2 1.3 7.1 4.2 8.4 8" />
        <path d="M50.4 8.6c-2.1 3.9-2.1 8.2 0 12.8" />
        <path d="M42.5 17.3h11" />
      </g>
      <g className="draftops-mark-nodes">
        <circle cx="17" cy="42" r="1.9" />
        <circle cx="33" cy="26" r="1.7" />
        <circle cx="54" cy="32.5" r="1.8" />
      </g>
    </svg>
  );
}

interface FilterDropdownProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: Array<FilterOption<T>>;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: T) => void;
}

function FilterDropdown<T extends string>({
  id,
  label,
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
}: FilterDropdownProps<T>) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className={`ops-select ${isOpen ? "open" : ""}`}>
      <button
        className="ops-select-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={onToggle}
      >
        <span>{label}</span>
        <strong>{selectedOption.label}</strong>
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <div className="ops-select-menu" id={`${id}-menu`} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              className={option.value === value ? "selected" : ""}
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => onSelect(option.value)}
            >
              <span>{option.label}</span>
              {option.value === value && <CheckCircle2 size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const appRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const insightRef = useRef<HTMLElement | null>(null);
  const filterRowRef = useRef<HTMLElement | null>(null);
  const chatDockRef = useRef<HTMLElement | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const chatDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const chatMessageIdRef = useRef(0);
  const [language, setLanguage] = useState<Language>("zh");
  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>(seedTeams);
  const [board, setBoard] = useState(() => generateBoard(seedTeams, seedProspects, defaultWeights));
  const [agentMeta, setAgentMeta] = useState<AgentMetaState>({
    label: "Agent board pending",
    generatedBy: "local fallback",
    generatedAt: "",
  });
  const [isAgentLoading, setIsAgentLoading] = useState(true);
  const [selectedPickNumber, setSelectedPickNumber] = useState(1);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pick");
  const [openFilterMenu, setOpenFilterMenu] = useState<FilterMenu>(null);
  const [riskOnly, setRiskOnly] = useState(false);
  const [dossierTab, setDossierTab] = useState<DossierTab>("overview");
  const [mobileSection, setMobileSection] = useState<MobileSection>("board");
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("flow");
  const [statusState, setStatusState] = useState<StatusState>({ type: "loading" });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatDockPosition, setChatDockPosition] = useState<{ left: number; top: number } | null>(null);
  const [isChatDragging, setIsChatDragging] = useState(false);
  const [selectedPickFocusActive, setSelectedPickFocusActive] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "deepseek-ready",
      role: "assistant",
      content: "",
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatModelLabel, setChatModelLabel] = useState(draftOpsManifest.model.chatModelLabel);

  const entityLanguage = language;
  const uiLanguage: Language = "zh";
  const copy = UI_COPY.zh;
  const d = dashboardCopy.zh;
  const languageToggleLabel =
    entityLanguage === "zh" ? "切换球员、学校、球队为英文" : "切换球员、学校、球队为中文";
  const filterLabel = riskOnly ? d.filterRiskOnly : d.filter;
  const status = useMemo(() => formatStatus(statusState, uiLanguage), [statusState]);
  const milestones = useMemo(() => generateMilestones(board, draftOpsManifest.milestones), [board]);
  const health = useMemo(() => getBoardHealth(board), [board]);
  const selectedPick = board.find((pick) => pick.pick === selectedPickNumber) ?? board[0];
  const selectedTeam = findTeamProfile(teamProfiles, selectedPick);
  const prospectProfile = Object.entries(selectedPick.prospect.profile);
  const playerRoleTags = withTextFallback(selectedPick.prospect.roleTags, copy.roleTagsPending).map((tag) =>
    localizePhrase(tag, uiLanguage),
  );
  const evidenceItems = withTextFallback(selectedPick.evidence, copy.evidenceFallback).map((item) =>
    localizeEvidenceText(hideAgentParameters(item), uiLanguage),
  );
  const riskNotes = withTextFallback(selectedPick.prospect.risks, copy.riskFallback).map((risk) =>
    localizePhrase(risk, uiLanguage),
  );
  const warningNotes = withTextFallback(selectedPick.warnings, copy.warningFallback).map((warning) =>
    localizeEvidenceText(warning, uiLanguage),
  );
  const teamNeeds = withTextFallback(selectedTeam?.needs, copy.teamNeedsPending).map((need) =>
    localizePhrase(need, uiLanguage),
  );
  const selectedNeedsReview = needsBoardReview(selectedPick);
  const selectedFallbackProfile = hasExpandedFallbackProfile(selectedPick.prospect);
  const teamNote = localizeEvidenceText(formatOptionalValue(selectedTeam?.notes, copy.teamNotePending), uiLanguage);
  const boardAverage = board.length
    ? Math.round(board.reduce((sum, pick) => sum + pick.confidence, 0) / board.length)
    : 0;
  const fallbackPickCount = agentMeta.fallbackPickCount ?? board.filter((pick) => hasExpandedFallbackProfile(pick.prospect)).length;
  const lowConfidenceCount = agentMeta.lowConfidenceCount ?? board.filter((pick) => pick.confidence < 70).length;
  const agentReviewNote = `审计分 ${agentMeta.auditScore ? formatOneDecimal(agentMeta.auditScore) : "--"} · 低置信 ${lowConfidenceCount} 个 · 回退入选 ${fallbackPickCount} 个`;
  const selectedReviewLabel = "需复核";
  const fallbackProfileLabel = "扩展回退画像";
  const selectedProspectName = localizeProspectName(selectedPick.prospect.name, entityLanguage);
  const selectedTeamName = localizeTeamName(selectedPick.team, entityLanguage);
  const selectedUpsideGrade = gradeFromScore(selectedPick.prospect.profile.upside);
  const selectedReadinessScore = average([
    selectedPick.prospect.profile.shooting,
    selectedPick.prospect.profile.defense,
    selectedPick.prospect.profile.feel,
  ]);
  const selectedReadinessGrade = gradeFromScore(selectedReadinessScore);
  const selectedMatch = Math.min(98, Math.max(58, Math.round(average([selectedPick.breakdown.need, selectedPick.confidence, selectedPick.score]))));
  const selectedRiskItems = (warningNotes.length ? warningNotes : riskNotes.length ? riskNotes : [d.fallbackNotes]).slice(0, 5);
  const decisionReport = buildLocalDecisionReport({
    pick: selectedPick,
    evidenceItems,
    warningNotes,
    riskNotes,
    teamNeeds,
    teamNote,
    prospectName: selectedProspectName,
    teamName: selectedTeamName,
    manifest: draftOpsManifest,
    language: uiLanguage,
  });
  const decisionPathItems = [
    {
      label: "球队问题",
      value: teamNeeds[0] ?? "需求待确认",
      detail: teamNeeds.slice(1, 3).join(" / ") || teamNote,
      tone: "good" as const,
    },
    {
      label: "球员解法",
      value: playerRoleTags.slice(0, 2).join(" / ") || selectedPick.prospect.positions.join("/"),
      detail: localizePhrase(selectedPick.roleFit, uiLanguage),
      tone: "good" as const,
    },
    {
      label: "复核重点",
      value: selectedNeedsReview ? selectedReviewLabel : "可直接解释",
      detail: `分差 ${formatSignedOneDecimal(selectedPick.margin)} · 置信 ${Math.round(selectedPick.confidence)}%`,
      tone: decisionReport.tone,
    },
  ];
  const evidenceCoverageItems = [
    {
      label: "预测板",
      value: "已命中",
      detail: `综合分 ${formatOneDecimal(selectedPick.score)} / 置信 ${Math.round(selectedPick.confidence)}%`,
      tone: "good" as const,
    },
    {
      label: "球队偏好",
      value: selectedTeam ? "已加载" : "待补强",
      detail: teamNeeds.slice(0, 2).join(" / ") || "本地球队字段不足",
      tone: selectedTeam ? ("good" as const) : ("watch" as const),
    },
    {
      label: "球员证据",
      value: selectedPick.evidence.length ? "已加载" : "待补强",
      detail: evidenceItems[0] ?? "证据字段不足",
      tone: selectedPick.evidence.length ? ("good" as const) : ("watch" as const),
    },
    {
      label: "幻觉防护",
      value: "已开启",
      detail: "无证据时必须标记资料不足或需复核",
      tone: selectedPick.evidence.length && selectedTeam ? ("good" as const) : ("watch" as const),
    },
  ];
  const antiHallucinationGuardrails = [
    "优先使用 selectedPickContext、retrievedKnowledge、锁定预测板和本地资料回答。",
    "涉及球员、球队、顺位、评分、证据、风险、来源或提交字段时，找不到依据就说本地资料未提供。",
    "区分已证据支持的事实、模型推断和待复核缺口；不要把模型记忆或常识写成已验证事实。",
    "如果检索反思显示证据不足，必须降低确定性并说明缺哪类资料。",
  ];
  const quickQuestions = [
    {
      id: "why",
      label: "为什么选他",
      question: `为什么 ${selectedTeamName} 在第 ${selectedPick.pick} 顺位选择 ${selectedProspectName}？请先区分已证据支持、模型推断和待复核缺口，再结合球队偏好、球员画像和当前预测分差。`,
    },
    {
      id: "alternatives",
      label: "看备选人",
      question: `第 ${selectedPick.pick} 顺位如果不选 ${selectedProspectName}，前三个备选是谁？分别差在哪里？证据不足的地方请明确标记，不要补写。`,
    },
    {
      id: "risk",
      label: "风险复核",
      question: `复核第 ${selectedPick.pick} 顺位 ${selectedProspectName} 的主要风险，哪些风险有证据支持，哪些只是待查假设？`,
    },
    {
      id: "team",
      label: "球队偏好",
      question: `${selectedTeamName} 当前选人偏好是什么？这些偏好如何解释第 ${selectedPick.pick} 顺位？请不要使用本地资料没有的球队偏好。`,
    },
    {
      id: "rag",
      label: "RAG 证据",
      question: `按 Agentic RAG 的方式解释第 ${selectedPick.pick} 顺位：先说明检索了哪些资料类型、证据是否充分，再给结论。`,
    },
  ];
  const filteredBoard = board
    .filter((pick) => {
      if (riskOnly && !needsBoardReview(pick)) return false;
      if (positionFilter !== "all" && !pick.prospect.positions.includes(positionFilter)) return false;
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return [
        pick.team,
        getTeamCode(pick.team),
        localizeTeamName(pick.team, entityLanguage),
        localizeTeamName(pick.team, "zh"),
        pick.prospect.name,
        localizeProspectName(pick.prospect.name, entityLanguage),
        localizeProspectName(pick.prospect.name, "zh"),
        pick.prospect.school,
        localizeSchoolName(pick.prospect.school, entityLanguage),
        localizeSchoolName(pick.prospect.school, "zh"),
        pick.prospect.positions.join("/"),
        pick.roleFit,
        localizePhrase(pick.roleFit, uiLanguage),
        localizePhrase(pick.roleFit, "zh"),
        ...pick.prospect.roleTags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((left, right) => {
      if (sortKey === "confidence") return right.confidence - left.confidence || left.pick - right.pick;
      if (sortKey === "consensus") return left.prospect.consensusRank - right.prospect.consensusRank || left.pick - right.pick;
      if (sortKey === "age") return left.prospect.age - right.prospect.age || left.pick - right.pick;
      if (sortKey === "score") return right.score - left.score || left.pick - right.pick;
      return left.pick - right.pick;
    });
  const onlyFilteredPickNumber = filteredBoard.length === 1 ? filteredBoard[0].pick : null;

  useEffect(() => {
    if (onlyFilteredPickNumber && onlyFilteredPickNumber !== selectedPickNumber) {
      const syncSelection = window.requestAnimationFrame(() => {
        setSelectedPickNumber(onlyFilteredPickNumber);
      });
      return () => window.cancelAnimationFrame(syncSelection);
    }
  }, [onlyFilteredPickNumber, selectedPickNumber]);

  useEffect(() => {
    let cancelled = false;

    const loadAgentBoard = async () => {
      setIsAgentLoading(true);
      try {
        const [bundleResponse, boardResponse] = await Promise.all([
          fetch(draftOpsManifest.data.bundleUrl),
          fetch(draftOpsManifest.data.boardUrl),
        ]);
        if (!bundleResponse.ok || !boardResponse.ok) {
          throw new Error("Agent data request failed.");
        }

        const bundle = (await bundleResponse.json()) as ImportBundle;
        const artifact = (await boardResponse.json()) as AgentBoardArtifact;
        const importedTeams = Array.isArray(bundle.teams) && bundle.teams.length > 0 ? bundle.teams : seedTeams;
        const importedProspects =
          Array.isArray(bundle.prospects) && bundle.prospects.length > 0 ? bundle.prospects : seedProspects;
        const nextWeights = artifact.scenario?.weights ?? defaultWeights;
        const artifactBoard =
          Array.isArray(artifact.board) && artifact.board.length === importedTeams.length
            ? artifact.board
            : generateBoard(importedTeams, importedProspects, nextWeights);
        const scenarioLabel = artifact.scenario?.label ?? "balanced baseline";

        if (cancelled) return;
        setTeamProfiles(importedTeams);
        setBoard(artifactBoard);
        setSelectedPickNumber(artifactBoard[0]?.pick ?? 1);
        setAgentMeta({
          label: scenarioLabel,
          generatedBy: artifact.generatedBy ?? "A7 Board Simulation Agent",
          generatedAt: artifact.generatedAt ?? "",
          auditScore: artifact.auditScore,
          fallbackPickCount:
            artifact.summary?.fallbackPicks?.length ??
            artifact.boardRows?.filter((row) => row.fallbackProfile).length ??
            artifactBoard.filter((pick) => hasExpandedFallbackProfile(pick.prospect)).length,
          lowConfidenceCount:
            artifact.summary?.lowConfidence?.length ?? artifactBoard.filter((pick) => pick.confidence < 70).length,
        });
        setStatusState({
          type: "applied",
          label: scenarioLabel,
          teams: importedTeams.length,
          prospects: importedProspects.length,
        });
      } catch {
        if (!cancelled) {
          setStatusState({ type: "fallback" });
          setAgentMeta({
            label: "fallback seed",
            generatedBy: "src/data/seedData.ts",
            generatedAt: "",
          });
        }
      } finally {
        if (!cancelled) setIsAgentLoading(false);
      }
    };

    void loadAgentBoard();

    return () => {
      cancelled = true;
    };
  }, []);

  const exportSubmission = () => {
    downloadJson(
      draftOpsManifest.exportSettings.submissionFilename,
      buildSubmissionPayload(board, milestones, draftOpsManifest.exportSettings, uiLanguage),
    );
    setStatusState({ type: "submissionExported" });
  };

  const exportBrief = () => {
    downloadText(
      draftOpsManifest.exportSettings.briefFilename,
      buildMarkdownBrief(board, milestones, draftOpsManifest.exportSettings, uiLanguage),
    );
    setStatusState({ type: "briefExported" });
  };

  const nextChatMessageId = (prefix: string) => {
    chatMessageIdRef.current += 1;
    return `${prefix}-${chatMessageIdRef.current}`;
  };

  const scrollChatToLatest = () => {
    const chatLog = chatLogRef.current;
    if (!chatLog) return;

    chatLog.scrollTo({
      top: chatLog.scrollHeight,
      behavior: "auto",
    });
  };

  const askDeepSeek = async (overrideQuestion?: string, options?: { focusActive?: boolean }) => {
    const question = (overrideQuestion ?? chatInput).trim();
    if (!question || isChatLoading) return;

    if (overrideQuestion) {
      setIsChatOpen(true);
      setSelectedPickFocusActive(options?.focusActive ?? true);
    }

    const userMessage: ChatMessage = {
      id: nextChatMessageId("user"),
      role: "user",
      content: question,
    };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const selectedPickContext = {
        pick: selectedPick.pick,
        team: selectedPick.team,
        teamCode: getTeamCode(selectedPick.team),
        acquiredFrom: selectedPick.acquiredFrom ?? null,
        player: selectedPick.prospect.name,
        positions: selectedPick.prospect.positions,
        school: selectedPick.prospect.school,
        origin: selectedPick.prospect.origin,
        classYear: selectedPick.prospect.classYear,
        international: selectedPick.prospect.international,
        roleFit: selectedPick.roleFit,
        score: selectedPick.score,
        confidence: selectedPick.confidence,
        margin: selectedPick.margin,
        teamNeeds: selectedTeam?.needs ?? [],
        teamPriorityTags: selectedTeam?.priorityTags ?? [],
        teamPhase: selectedTeam?.phase ?? null,
        teamNotes: selectedTeam?.notes ?? null,
        evidence: selectedPick.evidence.slice(0, 6),
        warnings: selectedPick.warnings.slice(0, 5),
        alternatives: selectedPick.alternatives.slice(0, 3).map((candidate) => ({
          name: candidate.name,
          score: candidate.score,
          roleFit: candidate.roleFit,
        })),
      };
      const response = await fetch(deepSeekChatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          selectedPickNumber,
          selectedPickFocusActive: options?.focusActive ?? selectedPickFocusActive,
          selectedPickContext,
          antiHallucinationGuardrails,
          history: chatMessages.slice(-8).map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });
      const payload = (await response.json()) as DeepSeekChatResponse;
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "DeepSeek 问答请求失败。");
      }

      const truncationNotice = payload.truncated
        ? `\n\n本地代理提示：DeepSeek 返回 finish_reason=length，本次回答可能被 max_tokens=${payload.maxTokens ?? "未知"} 截断。可以提高 DEEPSEEK_CHAT_MAX_TOKENS 后重启本地代理，或把问题拆成多轮。`
        : "";

      setChatMessages([
        ...nextMessages,
        {
          id: nextChatMessageId("assistant"),
          role: "assistant",
          content: `${payload.answer ?? "DeepSeek 返回了空回答。"}${truncationNotice}`,
        },
      ]);
      if (payload.modelLabel) setChatModelLabel(payload.modelLabel);
    } catch (error) {
      setChatMessages([
        ...nextMessages,
        {
          id: nextChatMessageId("assistant-error"),
          role: "assistant",
          content:
            error instanceof Error
              ? `DeepSeek 窗口暂不可用：${error.message}`
              : "DeepSeek 窗口暂不可用：未知错误。",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const clampChatDockPosition = (left: number, top: number) => {
    const dock = chatDockRef.current;
    const width = dock?.offsetWidth ?? 520;
    const height = dock?.offsetHeight ?? 560;
    const padding = 8;
    return {
      left: Math.min(Math.max(padding, left), Math.max(padding, window.innerWidth - width - padding)),
      top: Math.min(Math.max(padding, top), Math.max(padding, window.innerHeight - height - padding)),
    };
  };

  const startChatDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, a, input, textarea")) return;
    const rect = chatDockRef.current?.getBoundingClientRect();
    if (!rect) return;
    chatDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    setChatDockPosition({ left: rect.left, top: rect.top });
    setIsChatDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveChatDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = chatDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setChatDockPosition(clampChatDockPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY));
  };

  const stopChatDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = chatDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    chatDragRef.current = null;
    setIsChatDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    if (!openFilterMenu) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!filterRowRef.current?.contains(event.target as Node)) {
        setOpenFilterMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFilterMenu(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openFilterMenu]);

  useEffect(() => {
    if (!chatDockPosition) return undefined;
    const handleResize = () => {
      setChatDockPosition((position) => (position ? clampChatDockPosition(position.left, position.top) : position));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [chatDockPosition]);

  useEffect(() => {
    if (!isChatOpen) return undefined;
    const frame = window.requestAnimationFrame(scrollChatToLatest);
    return () => window.cancelAnimationFrame(frame);
  }, [chatMessages.length, isChatLoading, isChatOpen]);

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) return;

      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      timeline
        .from(".ops-command-bar", { y: -18, duration: 0.45 })
        .from(".ops-board-header", { y: 20, duration: 0.46 }, "-=0.18")
        .from(".ops-vital-card", { y: 14, duration: 0.34, stagger: 0.045 }, "-=0.2")
        .from(".ops-filter-row", { y: 12, duration: 0.3 }, "-=0.18")
        .from(".board-panel", { y: 24, duration: 0.45 }, "-=0.14")
        .from(".board-panel tbody tr", { x: -14, duration: 0.28, stagger: 0.018 }, "-=0.18");
    },
    { scope: appRef },
  );

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const rows = boardRef.current?.querySelectorAll("tbody tr");
      if (!rows?.length) return;

      gsap.fromTo(
        rows,
        reduceMotion ? { x: 0 } : { x: -12 },
        {
          x: 0,
          duration: reduceMotion ? 0.12 : 0.24,
          stagger: reduceMotion ? 0 : 0.012,
          ease: "power2.out",
        },
      );
    },
    { dependencies: [filteredBoard.length, search, board], scope: boardRef },
  );

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const panel = insightRef.current;
      if (!panel) return;

      gsap.fromTo(
        panel.querySelectorAll(".ops-dossier-hero, .ops-dossier-tabs, .ops-dossier-body, .ops-source-card"),
        reduceMotion ? { y: 0 } : { y: 16 },
        {
          y: 0,
          duration: reduceMotion ? 0.12 : 0.32,
          stagger: reduceMotion ? 0 : 0.045,
          ease: "power2.out",
        },
      );
    },
    { dependencies: [selectedPickNumber], scope: insightRef },
  );

  const workflowSteps = draftOpsManifest.workflowSteps.map((step) => ({
    ...step,
    icon: runtimeIcon(step.icon),
    label: runtimeText(step.label, uiLanguage),
    status: workflowStatusLabel(step, d),
  }));

  const awsSteps = draftOpsManifest.awsSteps.map((step) => ({
    ...step,
    icon: runtimeIcon(step.icon),
    label: runtimeText(step.label, uiLanguage),
    detail: runtimeText(step.detail, uiLanguage),
  }));

  const boardIntegrity = health.hasThirtyPicks && health.noDuplicates;
  const statusCopy = {
    commandTitle: "选秀板指挥台",
    commandSubtitle: "首轮 30 签锁定工作台",
    mission: "任务",
    playerTab: "球员",
    flowTab: "流程",
    chatTab: "问答",
    integrity: "完整性",
    lowConfidence: "低置信",
    fallback: "回退画像",
    locked: "锁定状态",
    lockedValue: "候选板已载入",
    riskMode: "风险视图",
    normalMode: "全量视图",
    dataset: "数据状态",
    dossier: "球员档案",
    scenario: "情景",
    model: "模型",
    sources: "来源",
    board: "看板",
    teams: "球队",
    scenarios: "情景",
    milestones: "里程碑",
    aws: "AWS",
    sourceModule: "源",
    workflowDock: "流程面板",
    evidenceTab: "证据",
    riskTab: "风险",
    fitTab: "匹配",
    altTab: "备选",
    overviewTab: "概览",
    showFlow: "流程",
    showAws: "数据链路",
    localDecision: "本地策略结论",
    localEvidence: "依据链",
    localRisk: "风险闸门",
    localFit: "球队匹配依据",
    evidenceSource: "来源字段",
    dragDeepSeek: "拖动标题栏移动窗口",
  };

  const dossierTabs: Array<{ id: DossierTab; label: string }> = [
    { id: "overview", label: statusCopy.overviewTab },
    { id: "evidence", label: statusCopy.evidenceTab },
    { id: "risk", label: statusCopy.riskTab },
    { id: "fit", label: statusCopy.fitTab },
    { id: "alternatives", label: statusCopy.altTab },
  ];
  const positionOptions: Array<FilterOption<PositionFilter>> = [
    { value: "all", label: d.all },
    { value: "PG", label: "PG" },
    { value: "SG", label: "SG" },
    { value: "SF", label: "SF" },
    { value: "PF", label: "PF" },
    { value: "C", label: "C" },
  ];
  const sortOptions: Array<FilterOption<SortKey>> = [
    { value: "pick", label: d.sortPick },
    { value: "score", label: d.sortScore },
    { value: "confidence", label: d.sortConfidence },
    { value: "consensus", label: d.sortConsensus },
    { value: "age", label: d.sortAge },
  ];
  const boardVitals = [
    {
      label: statusCopy.integrity,
      value: boardIntegrity ? "30/30" : `${board.length}/30`,
      detail: boardIntegrity ? copy.pass : copy.review,
      tone: boardIntegrity ? "good" : "risk",
    },
    { label: statusCopy.lowConfidence, value: String(lowConfidenceCount), detail: agentReviewNote, tone: lowConfidenceCount > 8 ? "risk" : "good" },
    { label: statusCopy.fallback, value: String(fallbackPickCount), detail: fallbackPickCount ? copy.review : copy.pass, tone: fallbackPickCount ? "risk" : "good" },
    { label: statusCopy.locked, value: statusCopy.lockedValue, detail: riskOnly ? statusCopy.riskMode : statusCopy.normalMode, tone: riskOnly ? "risk" : "good" },
  ];
  const mobileTabs = [
    { id: "board" as const, label: statusCopy.board, icon: <ClipboardList size={18} /> },
    { id: "player" as const, label: statusCopy.playerTab, icon: <UserRound size={18} /> },
    { id: "flow" as const, label: statusCopy.flowTab, icon: <CalendarDays size={18} /> },
  ];

  return (
    <main className="app-shell ops-shell" ref={appRef} lang="zh-CN" translate="no">
      <div className={`ops-layout-v2 mobile-section-${mobileSection}`}>
        <header className="ops-command-bar">
          <div className="ops-command-brand">
            <div className="ops-logo">
              <DraftOpsMark />
            </div>
            <div>
              <strong>DRAFTOPS</strong>
              <span>{d.systemTitle}</span>
            </div>
          </div>

          <div className="ops-command-status" aria-label={statusCopy.dataset}>
            <span>{d.dataUpdated}</span>
            <strong>{formatDataTime(agentMeta.generatedAt, uiLanguage)} (CT)</strong>
            <em>{localizePhrase(agentMeta.label, uiLanguage)}</em>
            <b>{statusCopy.model} {draftOpsManifest.model.version}</b>
          </div>

          <div className="ops-actions ops-command-actions">
            <button
              className="ops-button ops-language-toggle"
              type="button"
              onClick={() => setLanguage((current) => (current === "zh" ? "en" : "zh"))}
              aria-pressed={entityLanguage === "en"}
              {...buttonMeta(languageToggleLabel)}
            >
              <Globe2 size={16} />
              <span className={entityLanguage === "zh" ? "active" : ""}>中文</span>
              <i aria-hidden="true" />
              <span className={entityLanguage === "en" ? "active" : ""}>EN</span>
            </button>
            <button className="ops-button" type="button" onClick={() => setIsChatOpen(true)} {...buttonMeta("DeepSeek")}>
              <BrainCircuit size={17} />
              DeepSeek
            </button>
            <button className="ops-button" type="button" onClick={exportBrief} {...buttonMeta(copy.actionBrief)}>
              <FileInput size={16} />
              {copy.actionBrief}
            </button>
            <button className="ops-button ops-button-hot" type="button" onClick={exportSubmission} {...buttonMeta(copy.actionSubmission)}>
              <ClipboardList size={16} />
              {copy.actionSubmission}
            </button>
          </div>
        </header>

        <section className="ops-board-workspace" id="board" ref={boardRef}>
          <div className="ops-board-header">
            <div>
              <span>{statusCopy.scenario} · {isAgentLoading ? copy.loading : localizePhrase(agentMeta.label, uiLanguage)}</span>
              <h1>{statusCopy.commandTitle}</h1>
              <p>{statusCopy.commandSubtitle} · {status}</p>
            </div>
            <div className="ops-board-lock">
              <ShieldCheck size={18} />
              <strong>{boardIntegrity ? copy.pass : copy.review}</strong>
              <span>{riskOnly ? statusCopy.riskMode : statusCopy.normalMode}</span>
            </div>
          </div>

          <section className="ops-board-vitals" aria-label={d.wholeBoard}>
            {boardVitals.map((item) => (
              <article className={`ops-vital-card ${item.tone}`} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </section>

          <section className="ops-filter-row" ref={filterRowRef}>
            <label className="ops-search" htmlFor="ops-board-search">
              <Search size={18} />
              <input
                id="ops-board-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={d.searchPlaceholder}
              />
            </label>

            <FilterDropdown
              id="ops-position-filter"
              label={d.position}
              value={positionFilter}
              options={positionOptions}
              isOpen={openFilterMenu === "position"}
              onToggle={() => setOpenFilterMenu((current) => (current === "position" ? null : "position"))}
              onSelect={(value) => {
                setPositionFilter(value);
                setOpenFilterMenu(null);
              }}
            />

            <FilterDropdown
              id="ops-sort-filter"
              label={d.sort}
              value={sortKey}
              options={sortOptions}
              isOpen={openFilterMenu === "sort"}
              onToggle={() => setOpenFilterMenu((current) => (current === "sort" ? null : "sort"))}
              onSelect={(value) => {
                setSortKey(value);
                setOpenFilterMenu(null);
              }}
            />

            <button
              className={`ops-filter ${riskOnly ? "active" : ""}`}
              type="button"
              onClick={() => setRiskOnly((current) => !current)}
              aria-pressed={riskOnly}
              {...buttonMeta(filterLabel)}
            >
              <Filter size={16} />
              {filterLabel}
            </button>
          </section>

          <section className="ops-table-shell board-panel">
            <div className="ops-table-wrap">
              <table className="ops-draft-table">
                <thead>
                  <tr>
                    <th>{d.rank}</th>
                    <th>{d.teamProjected}</th>
                    <th>{copy.player}</th>
                    <th>{d.positionShort}</th>
                    <th>{d.schoolTeam}</th>
                    <th>{copy.age}</th>
                    <th>{d.height}</th>
                    <th>{d.wingspan}</th>
                    <th>{d.totalScore}</th>
                    <th>{d.potential}</th>
                    <th>{d.immediate}</th>
                    <th>{d.trend}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBoard.map((pick) => {
                    const trend = getTrend(pick);
                    const pickNeedsReview = needsBoardReview(pick);
                    const fallbackProfile = hasExpandedFallbackProfile(pick.prospect);
                    const reviewTitle = fallbackProfile ? fallbackProfileLabel : selectedReviewLabel;
                    const readiness = average([
                      pick.prospect.profile.shooting,
                      pick.prospect.profile.defense,
                      pick.prospect.profile.feel,
                    ]);
                    const prospectName = localizeProspectName(pick.prospect.name, entityLanguage);
                    return (
                      <tr
                        key={pick.pick}
                        className={`${pick.pick === selectedPick.pick ? "selected" : ""} ${pickNeedsReview ? "needs-review" : ""}`}
                        onClick={() => {
                          setSelectedPickNumber(pick.pick);
                          setSelectedPickFocusActive(true);
                          setMobileSection("player");
                        }}
                      >
                        <td>{String(pick.pick).padStart(2, "0")}</td>
                        <td>
                          <span className="ops-team-cell">
                            <strong title={localizeTeamName(pick.team, entityLanguage)}>{localizeTeamName(pick.team, entityLanguage)}</strong>
                            {pick.acquiredFrom && (
                              <small title={`${copy.fromTeam} ${localizeTeamName(pick.acquiredFrom, entityLanguage)}`}>
                                {copy.fromTeam} {localizeTeamName(pick.acquiredFrom, entityLanguage)}
                              </small>
                            )}
                          </span>
                        </td>
                        <td>
                          <span className="ops-player-cell">
                            <PlayerPhoto prospect={pick.prospect} label={prospectName} language={uiLanguage} />
                            <span className="ops-player-name">{prospectName}</span>
                            {pickNeedsReview && (
                              <span className={`ops-review-icon ${fallbackProfile ? "is-fallback" : ""}`} title={reviewTitle} aria-label={reviewTitle}>
                                <AlertTriangle size={11} />
                              </span>
                            )}
                          </span>
                        </td>
                        <td>{pick.prospect.positions.join("/")}</td>
                        <td>{localizeSchoolName(pick.prospect.school, entityLanguage)}</td>
                        <td>{formatOneDecimal(pick.prospect.age)}</td>
                        <td>{formatHeightDisplay(pick.prospect.height)}</td>
                        <td>{estimateWingspan(pick.prospect.height, pick.prospect.profile.size)}</td>
                        <td className="score-cell">{formatOneDecimal(pick.score)}</td>
                        <td className="grade-cell">{gradeFromScore(pick.prospect.profile.upside)}</td>
                        <td className="grade-cell warn">{gradeFromScore(readiness)}</td>
                        <td className={`trend-cell ${trend}`}>
                          {trend === "up" ? <ArrowUp size={15} /> : trend === "down" ? <ArrowDown size={15} /> : <Minus size={15} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="ops-prospect-dossier" id="dossier" ref={insightRef}>
          <section className="ops-dossier-hero">
            <header>
              <span>{statusCopy.dossier}</span>
              <b>#{String(selectedPick.pick).padStart(2, "0")} {d.focus}</b>
            </header>
            <div className="ops-player-summary">
              <PlayerPhoto
                prospect={selectedPick.prospect}
                label={localizeProspectName(selectedPick.prospect.name, entityLanguage)}
                language={uiLanguage}
                variant="hero"
              />
              <div>
                <h2>{localizeProspectName(selectedPick.prospect.name, entityLanguage)}</h2>
                <p>
                  {selectedPick.prospect.positions.join("/")} | {localizeSchoolName(selectedPick.prospect.school, entityLanguage)} |{" "}
                  {formatOneDecimal(selectedPick.prospect.age)}
                  岁
                </p>
                <span className="ops-photo-meta">
                  <ShieldCheck size={12} />
                  {formatPhotoSource(selectedPick.prospect, uiLanguage)}
                </span>
              </div>
              <div className="ops-score-badge">
                <span>{d.compositeScore}</span>
                <strong>{formatOneDecimal(selectedPick.score)}</strong>
                <small>/100</small>
              </div>
            </div>
            <div className="ops-player-tags">
              {playerRoleTags.slice(0, 4).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
              {selectedNeedsReview && (
                <span className={`ops-review-tag ${selectedFallbackProfile ? "is-fallback" : ""}`}>
                  <AlertTriangle size={13} />
                  {selectedFallbackProfile ? fallbackProfileLabel : selectedReviewLabel}
                </span>
              )}
            </div>
          </section>

          <nav className="ops-dossier-tabs" aria-label={statusCopy.dossier}>
            {dossierTabs.map((tab) => (
              <button
                className={dossierTab === tab.id ? "active" : ""}
                type="button"
                key={tab.id}
                onClick={() => setDossierTab(tab.id)}
                aria-pressed={dossierTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <section className="ops-dossier-body">
            {dossierTab === "overview" && (
              <>
                <div className={`ops-decision-card ${decisionReport.tone}`}>
                  <header>
                    <span>{statusCopy.localDecision}</span>
                    <strong>{decisionReport.verdict}</strong>
                  </header>
                  <p>{decisionReport.summary}</p>
                  <div className="ops-decision-path">
                    {decisionPathItems.map((item) => (
                      <article className={item.tone} key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <small>{item.detail}</small>
                      </article>
                    ))}
                  </div>
                  <div className="ops-evidence-coverage" aria-label="证据覆盖">
                    {evidenceCoverageItems.map((item) => (
                      <article className={item.tone} key={item.label}>
                        <CheckCircle2 size={15} />
                        <div>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <small>{item.detail}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="ops-quick-prompts" aria-label="顺位快捷提问">
                    {quickQuestions.slice(0, 4).map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        disabled={isChatLoading}
                        onClick={() => void askDeepSeek(item.question, { focusActive: true })}
                        {...buttonMeta(item.label)}
                      >
                        <MessageCircle size={14} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="ops-decision-metrics">
                    {decisionReport.metrics.map((item) => (
                      <article className={item.tone ?? ""} key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <small title={item.source}>{statusCopy.evidenceSource}: {item.source}</small>
                      </article>
                    ))}
                  </div>
                  <div className="ops-local-report-grid">
                    <section>
                      <h3>{statusCopy.localEvidence}</h3>
                      {decisionReport.evidenceChain.map((item) => (
                        <article key={`${item.label}-${item.text}`}>
                          <b>{item.label}</b>
                          <p>{item.text}</p>
                          <small>{item.source}</small>
                        </article>
                      ))}
                    </section>
                    <section>
                      <h3>{statusCopy.localRisk}</h3>
                      {decisionReport.riskChain.map((item) => (
                        <article className={item.tone ?? ""} key={`${item.label}-${item.text}`}>
                          <b>{item.label}</b>
                          <p>{item.text}</p>
                          <small>{item.source}</small>
                        </article>
                      ))}
                    </section>
                    <section className="span-all">
                      <h3>{statusCopy.localFit}</h3>
                      {decisionReport.fitChain.slice(0, 4).map((item) => (
                        <article key={`${item.label}-${item.text}`}>
                          <b>{item.label}</b>
                          <p>{item.text}</p>
                          <small>{item.source}</small>
                        </article>
                      ))}
                    </section>
                  </div>
                  <small className="ops-decision-guard">{decisionReport.guardrail}</small>
                </div>
                <div className="ops-grade-pair">
                  <span>{d.upside} <strong>{selectedUpsideGrade}</strong></span>
                  <span>{d.readiness} <strong className="warn">{selectedReadinessGrade}</strong></span>
                </div>
                <div className="ops-profile-bars">
                  {prospectProfile.map(([key, value]) => (
                    <div className="ops-profile-bar" key={key}>
                      <span>{profileLabelKeys[key]?.[uiLanguage] ?? localizePhrase(key, uiLanguage)}</span>
                      <i><b style={{ width: `${value}%` }} /></i>
                      <strong>{formatOneDecimal(value / 10)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}

            {dossierTab === "evidence" && (
              <div className="ops-dossier-panel">
                <h3>{d.coreEvidence}</h3>
                <ul className="ops-bullet-list">
                  {evidenceItems.slice(0, 5).map((item) => (
                    <li key={item}>{hideAgentParameters(item)}</li>
                  ))}
                </ul>
              </div>
            )}

            {dossierTab === "risk" && (
              <div className="ops-dossier-panel">
                <h3>{d.risks}</h3>
                <ul className="ops-warning-list">
                  {selectedRiskItems.map((item) => (
                    <li key={item}>
                      <AlertTriangle size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
                {selectedFallbackProfile && (
                  <p className="ops-source-note ops-source-warning">
                    #{selectedPick.pick} 使用扩展候选池回退画像，锁定前需补强球探资料。
                  </p>
                )}
              </div>
            )}

            {dossierTab === "fit" && (
              <div className="ops-dossier-panel ops-fit-card">
                <h3>{d.fitMatch} ({getTeamCode(selectedPick.team)})</h3>
                <div className="ops-fit-content">
                  <ul>
                    {teamNeeds.slice(0, 3).map((need) => (
                      <li key={need}>
                        <CheckCircle2 size={16} />
                        <span>{need}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="ops-ring" style={{ "--match": `${selectedMatch}%` } as React.CSSProperties}>
                    <span>{d.match}</span>
                    <strong>{selectedMatch}%</strong>
                  </div>
                </div>
                <p className="ops-source-note">{teamNote}</p>
              </div>
            )}

            {dossierTab === "alternatives" && (
              <div className="ops-dossier-panel ops-alt-card">
                <h3>{d.alternativesIfMissed}</h3>
                <div className="ops-alt-list">
                  {selectedPick.alternatives.slice(0, 3).map((candidate, index) => (
                    <div key={candidate.prospectId}>
                      <strong>A{index + 1}</strong>
                      <span>{localizeProspectName(candidate.name, entityLanguage)}</span>
                      <small>{localizePhrase(candidate.roleFit, uiLanguage)}</small>
                      <b>{formatOneDecimal(candidate.score)}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="ops-source-card" id="sources">
            <h3>{d.dataSource}</h3>
            <p className="ops-source-note">{agentReviewNote}</p>
            <p className="ops-source-note">{d.sourcePrefix}</p>
            <p className="ops-source-note">{formatModelNote(draftOpsManifest, uiLanguage, boardAverage)}</p>
            <div className="ops-source-links">
              {draftOpsManifest.sourceLinks.slice(0, 3).map((source) => (
                <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                  {runtimeText(source.label, uiLanguage)}
                </a>
              ))}
            </div>
          </section>
        </aside>

        <section className="ops-workflow-dock" id="workflow">
          <header>
            <div>
              <span>{statusCopy.workflowDock}</span>
              <h2>{workflowMode === "flow" ? d.workflow : d.awsData}</h2>
            </div>
            <div className="ops-dock-switch">
              <button className={workflowMode === "flow" ? "active" : ""} type="button" onClick={() => setWorkflowMode("flow")}>
                {statusCopy.showFlow}
              </button>
              <button className={workflowMode === "aws" ? "active" : ""} type="button" onClick={() => setWorkflowMode("aws")}>
                {statusCopy.showAws}
              </button>
            </div>
          </header>
          {workflowMode === "flow" ? (
            <div className="ops-flow-list">
              {workflowSteps.map((step, index) => (
                <article className={`ops-flow-step ${step.tone}`} key={step.label}>
                  <span className="ops-flow-icon">{step.icon}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <small>{step.date}</small>
                  </div>
                  <b>{step.status}</b>
                  {index < workflowSteps.length - 1 && <i />}
                </article>
              ))}
            </div>
          ) : (
            <div className="ops-aws-chain">
              {awsSteps.map((step, index) => (
                <article key={step.label}>
                  <span>{step.icon}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </div>
                  {index < awsSteps.length - 1 && <i />}
                </article>
              ))}
            </div>
          )}
        </section>

        <nav className="ops-mobile-tabs" aria-label="Mobile sections">
          {mobileTabs.map((item) => (
            <button
              className={mobileSection === item.id ? "active" : ""}
              type="button"
              key={item.id}
              onClick={() => setMobileSection(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <button className={isChatOpen ? "active" : ""} type="button" onClick={() => setIsChatOpen(true)} aria-pressed={isChatOpen}>
            <MessageCircle size={18} />
            <span>{statusCopy.chatTab}</span>
          </button>
        </nav>
      </div>


      {isChatOpen && (
        <section
          className={`deepseek-dock open ${chatDockPosition ? "is-floating" : ""} ${isChatDragging ? "is-dragging" : ""}`}
          aria-label="DeepSeek 问答窗口"
          ref={chatDockRef}
          style={chatDockPosition ? { left: `${chatDockPosition.left}px`, top: `${chatDockPosition.top}px` } : undefined}
        >
          <div className="deepseek-window" role="dialog" aria-modal="true" aria-labelledby="deepseek-title">
            <header
              className="deepseek-header"
              title={statusCopy.dragDeepSeek}
              onPointerDown={startChatDrag}
              onPointerMove={moveChatDrag}
              onPointerUp={stopChatDrag}
              onPointerCancel={stopChatDrag}
            >
              <span className="deepseek-drag-handle" aria-hidden="true">
                <GripHorizontal size={17} />
              </span>
              <div>
                <span className="section-kicker">{copy.liveLlm}</span>
                <h2 id="deepseek-title">{copy.deepSeekWindow}</h2>
                <p>{chatModelLabel} · {copy.deepSeekSubtitle}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsChatOpen(false)} {...buttonMeta(copy.closeDeepSeek)}>
                <X size={20} />
              </button>
            </header>

            <div className="chat-log" aria-live="polite" ref={chatLogRef}>
              {chatMessages.map((message) => (
                <article className={`chat-message ${message.role}`} key={message.id}>
                  <span>{message.role === "assistant" ? "DeepSeek" : copy.you}</span>
                  <p>{message.id === "deepseek-ready" ? copy.chatIntro(chatModelLabel) : message.content}</p>
                </article>
              ))}
              {isChatLoading && (
                <article className="chat-message assistant">
                  <span>DeepSeek</span>
                  <p>{copy.chatThinking}</p>
                </article>
              )}
            </div>

            <div className="chat-quick-actions" aria-label="DeepSeek 快捷问题">
              {quickQuestions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  disabled={isChatLoading}
                  onClick={() => void askDeepSeek(item.question, { focusActive: true })}
                  {...buttonMeta(item.label)}
                >
                  <BrainCircuit size={14} />
                  {item.label}
                </button>
              ))}
            </div>

            <form
              className="chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void askDeepSeek();
              }}
            >
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder={copy.chatPlaceholder}
                rows={3}
              />
              <button className="button primary" type="submit" disabled={isChatLoading || !chatInput.trim()} {...buttonMeta(copy.send)}>
                <Send size={18} />
                {copy.send}
              </button>
            </form>
          </div>
        </section>
      )}

    </main>
  );
}

export default App;
