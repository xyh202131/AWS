import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Database,
  Download,
  FileInput,
  Filter,
  Gauge,
  Globe2,
  Languages,
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
import { defaultWeights, seedProspects, seedTeams, sourceLinks } from "./data/seedData";
import { hideAgentParameters } from "./lib/evidence";
import { buildMarkdownBrief, buildSubmissionPayload, downloadJson, downloadText } from "./lib/export";
import { formatOptionalValue, withTextFallback } from "./lib/fallbacks";
import {
  formatPositionsLocalized,
  localizeCountryName,
  localizeEvidenceText,
  localizeMilestonePrompt,
  localizeMilestoneType,
  localizePhase,
  localizePhrase,
  localizeProspectName,
  localizeSchoolName,
  localizeTeamName,
  localizeZone,
  type Language,
  UI_COPY,
} from "./lib/i18n";
import { generateBoard, generateMilestones, getBoardHealth } from "./lib/prediction";
import type { DraftPick, ImportBundle, Prospect, TeamProfile, Weights } from "./types";

gsap.registerPlugin(useGSAP);

const deadline = new Date("2026-06-24T08:00:00+08:00");
const agentBundleUrl = "/data/expanded_import_bundle.json";
const agentBoardUrl = "/data/agent_expanded_recommended_board.json";
const deepSeekAgentPort = import.meta.env.VITE_DEEPSEEK_AGENT_PORT ?? "4318";
const isLocalRuntime =
  typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);
const deepSeekChatUrl =
  import.meta.env.VITE_DEEPSEEK_CHAT_URL ??
  (isLocalRuntime ? `http://127.0.0.1:${deepSeekAgentPort}/api/deepseek/chat` : "/api/deepseek/chat");

const formatCountdown = (language: Language) => {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return UI_COPY[language].countdownClosed;
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (language === "zh") return `距 2026-06-24 08:00 还有 ${hours} 小时 ${minutes} 分钟`;
  return `${hours}h ${minutes}m to 2026-06-24 08:00`;
};

const weightLabels: Record<keyof Weights, Record<Language, string>> = {
  consensus: { en: "Consensus", zh: "共识" },
  need: { en: "Team Need", zh: "球队需求" },
  player: { en: "Player Grade", zh: "球员评分" },
  upside: { en: "Upside", zh: "上限" },
  intel: { en: "Late Intel", zh: "后期情报" },
};

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
  candidatePool?: CandidatePoolSummary;
  auditScore?: number;
  noManualOverride?: boolean;
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
  error?: string;
}

type StatusState =
  | { type: "loading" }
  | { type: "applied"; label: string; teams: number; prospects: number; noManualOverride?: boolean }
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

const formatWeight = (weight: string | null | undefined, language: Language) => {
  const fallback = UI_COPY[language].weightPending;
  const normalizedWeight = formatOptionalValue(weight, fallback);
  if (normalizedWeight === fallback) return normalizedWeight;
  if (language === "zh") return `${normalizedWeight.replace(/\s*lbs?\.?/i, "")} 磅`;
  return normalizedWeight.toLowerCase().includes("lb") ? normalizedWeight : `${normalizedWeight} lbs`;
};

const findTeamProfile = (teams: TeamProfile[], pick: DraftPick) =>
  teams.find((team) => team.pick === pick.pick) ??
  teams.find((team) => team.team.toLowerCase() === pick.team.toLowerCase());

type PositionFilter = "all" | "PG" | "SG" | "SF" | "PF" | "C";
type SortKey = "pick" | "score" | "confidence" | "consensus" | "age";

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
    modelVersion: "备注：模型版本 V5.3.2 | 样本期 2024.04-2026.05 | 置信度",
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
    modelVersion: "Note: Model V5.3.2 | Sample window 2024.04-2026.05 | Confidence",
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
      {media?.sourceUrl && (
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
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path className="draftops-mark-glow" d="M7 5h20.9C38 5 44 12.7 44 24s-6 19-16.1 19H7V5Z" />
      <path className="draftops-mark-face" d="M7 5h20.9C38 5 44 12.7 44 24s-6 19-16.1 19H7V5Z" />
      <path
        className="draftops-mark-inner"
        fillRule="evenodd"
        d="M15 13h12.1C33.4 13 37 17.2 37 24s-3.6 11-9.9 11H15V13Zm8 8v6h3.8c1.9 0 3.1-1.1 3.1-3s-1.2-3-3.1-3H23Z"
      />
      <path className="draftops-mark-notch" d="M7 5h8L7 13V5Z" />
      <path className="draftops-mark-edge" d="M7 43h20.9C38 43 44 35.3 44 24" />
      <path className="draftops-mark-scan" d="M7 39h14" />
    </svg>
  );
}

function App() {
  const appRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const insightRef = useRef<HTMLElement | null>(null);
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
  const [riskOnly, setRiskOnly] = useState(false);
  const [statusState, setStatusState] = useState<StatusState>({ type: "loading" });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "deepseek-ready",
      role: "assistant",
      content: "DeepSeek V4 Pro[1m] 已接入。当前 DeepSeek 是只读问答 Agent，可回答应试题、参考口径和预测主题问题；预测结果只读取当前锁定预测板，不能参与改动。",
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatModelLabel, setChatModelLabel] = useState("deepseek-v4-pro[1m]");

  const copy = UI_COPY[language];
  const d = dashboardCopy[language];
  const languageToggleLabel = language === "zh" ? "Switch to English" : "切换到中文";
  const filterLabel = riskOnly ? d.filterRiskOnly : d.filter;
  const status = useMemo(() => formatStatus(statusState, language), [language, statusState]);
  const milestones = useMemo(() => generateMilestones(board), [board]);
  const health = useMemo(() => getBoardHealth(board), [board]);
  const selectedPick = board.find((pick) => pick.pick === selectedPickNumber) ?? board[0];
  const selectedTeam = findTeamProfile(teamProfiles, selectedPick);
  const prospectProfile = Object.entries(selectedPick.prospect.profile);
  const selectedPositions = formatPositionsLocalized(selectedPick.prospect.positions, language, copy.positionPending);
  const playerRoleTags = withTextFallback(selectedPick.prospect.roleTags, copy.roleTagsPending).map((tag) =>
    localizePhrase(tag, language),
  );
  const evidenceItems = withTextFallback(selectedPick.evidence, copy.evidenceFallback).map((item) =>
    localizeEvidenceText(hideAgentParameters(item), language),
  );
  const riskNotes = withTextFallback(selectedPick.prospect.risks, copy.riskFallback).map((risk) =>
    localizePhrase(risk, language),
  );
  const warningNotes = withTextFallback(selectedPick.warnings, copy.warningFallback).map((warning) =>
    localizeEvidenceText(warning, language),
  );
  const teamNeeds = withTextFallback(selectedTeam?.needs, copy.teamNeedsPending).map((need) =>
    localizePhrase(need, language),
  );
  const priorityTags = withTextFallback(selectedTeam?.priorityTags, copy.priorityPending).map((tag) =>
    localizePhrase(tag, language),
  );
  const strengthNotes = withTextFallback(selectedPick.prospect.strengths, copy.strengthFallback).map((strength) =>
    localizePhrase(strength, language),
  );
  const sourceNotes = withTextFallback(selectedPick.prospect.sourceNotes, copy.sourceFallback).map((note) =>
    localizeEvidenceText(note, language),
  );
  const selectedNeedsReview = needsBoardReview(selectedPick);
  const selectedFallbackProfile = hasExpandedFallbackProfile(selectedPick.prospect);
  const teamNote = localizeEvidenceText(formatOptionalValue(selectedTeam?.notes, copy.teamNotePending), language);
  const tradeSlot = selectedPick.acquiredFrom
    ? `${copy.fromTeam} ${localizeTeamName(selectedPick.acquiredFrom, language)}`
    : copy.originalPick;
  const boardAverage = board.length
    ? Math.round(board.reduce((sum, pick) => sum + pick.confidence, 0) / board.length)
    : 0;
  const averageScore = average(board.map((pick) => pick.score));
  const highUpsideCount = board.filter((pick) => pick.prospect.profile.upside >= 87).length;
  const internationalShare = board.length
    ? Math.round((board.filter((pick) => pick.prospect.international).length / board.length) * 100)
    : 0;
  const averageAge = average(board.map((pick) => pick.prospect.age));
  const tradedPickCount = board.filter((pick) => pick.acquiredFrom).length;
  const reviewPickCount = board.filter(needsBoardReview).length;
  const candidatePoolSize = agentMeta.candidatePool?.officialProspectRows ?? 0;
  const fullProfileCount = agentMeta.candidatePool?.fullDraftOpsProfiles ?? 0;
  const fallbackProfileCount = agentMeta.candidatePool?.fallbackProfiles ?? 0;
  const fallbackPickCount = agentMeta.fallbackPickCount ?? board.filter((pick) => hasExpandedFallbackProfile(pick.prospect)).length;
  const lowConfidenceCount = agentMeta.lowConfidenceCount ?? board.filter((pick) => pick.confidence < 70).length;
  const agentPoolNote = [
    candidatePoolSize ? (language === "zh" ? `${candidatePoolSize} 人候选池` : `${candidatePoolSize} prospects`) : "",
    fullProfileCount ? (language === "zh" ? `${fullProfileCount} 份完整画像` : `${fullProfileCount} full profiles`) : "",
    fallbackProfileCount ? (language === "zh" ? `${fallbackProfileCount} 份扩展回退画像` : `${fallbackProfileCount} fallback profiles`) : "",
    agentMeta.noManualOverride ? (language === "zh" ? "无人工改签" : "no manual override") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const agentReviewNote =
    language === "zh"
      ? `审计分 ${agentMeta.auditScore ? formatOneDecimal(agentMeta.auditScore) : "--"} · 低置信 ${lowConfidenceCount} 个 · 回退入选 ${fallbackPickCount} 个`
      : `Audit ${agentMeta.auditScore ? formatOneDecimal(agentMeta.auditScore) : "--"} · ${lowConfidenceCount} low-confidence · ${fallbackPickCount} fallback pick`;
  const selectedReviewLabel = language === "zh" ? "需复核" : "Review";
  const fallbackProfileLabel = language === "zh" ? "扩展回退画像" : "Fallback profile";
  const selectedUpsideGrade = gradeFromScore(selectedPick.prospect.profile.upside);
  const selectedReadinessScore = average([
    selectedPick.prospect.profile.shooting,
    selectedPick.prospect.profile.defense,
    selectedPick.prospect.profile.feel,
  ]);
  const selectedReadinessGrade = gradeFromScore(selectedReadinessScore);
  const selectedMatch = Math.min(98, Math.max(58, Math.round(average([selectedPick.breakdown.need, selectedPick.confidence, selectedPick.score]))));
  const filteredBoard = board
    .filter((pick) => {
      if (riskOnly && !needsBoardReview(pick)) return false;
      if (positionFilter !== "all" && !pick.prospect.positions.includes(positionFilter)) return false;
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return [
        pick.team,
        getTeamCode(pick.team),
        localizeTeamName(pick.team, language),
        localizeTeamName(pick.team, "zh"),
        pick.prospect.name,
        localizeProspectName(pick.prospect.name, language),
        localizeProspectName(pick.prospect.name, "zh"),
        pick.prospect.school,
        localizeSchoolName(pick.prospect.school, language),
        localizeSchoolName(pick.prospect.school, "zh"),
        pick.prospect.positions.join("/"),
        pick.roleFit,
        localizePhrase(pick.roleFit, language),
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
  const overviewMetrics = [
    {
      label: d.averageScore,
      value: formatOneDecimal(averageScore),
      detail: health.hasThirtyPicks && health.noDuplicates ? copy.pass : copy.review,
      icon: <ShieldCheck size={22} />,
    },
    {
      label: d.highUpside,
      value: String(highUpsideCount),
      detail: "20%",
      icon: <Gauge size={22} />,
    },
    {
      label: d.internationalShare,
      value: `${internationalShare}%`,
      detail: "+ 3%",
      icon: <BrainCircuit size={22} />,
    },
    {
      label: d.averageAge,
      value: formatOneDecimal(averageAge),
      detail: "v 0.1",
      icon: <AlertTriangle size={22} />,
    },
    {
      label: d.predictedTrades,
      value: String(tradedPickCount),
       detail: `${reviewPickCount} ${copy.riskWatch}`,
      icon: <TrendingUp size={22} />,
    },
    {
      label: d.modelConfidence,
      value: `${boardAverage}%`,
      detail: "+ 4%",
      icon: <CheckCircle2 size={22} />,
    },
  ];

  useEffect(() => {
    let cancelled = false;

    const loadAgentBoard = async () => {
      setIsAgentLoading(true);
      try {
        const [bundleResponse, boardResponse] = await Promise.all([fetch(agentBundleUrl), fetch(agentBoardUrl)]);
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
          candidatePool: artifact.candidatePool,
          auditScore: artifact.auditScore,
          noManualOverride: artifact.noManualOverride ?? artifact.candidatePool?.noManualOverride,
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
          noManualOverride: artifact.noManualOverride ?? artifact.candidatePool?.noManualOverride,
        });
      } catch {
        if (!cancelled) {
          setStatusState({ type: "fallback" });
          setAgentMeta({
            label: "fallback seed",
            generatedBy: "src/data/seedData.ts",
            generatedAt: "",
            noManualOverride: false,
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
    downloadJson("draftops-submission.json", buildSubmissionPayload(board, milestones));
    setStatusState({ type: "submissionExported" });
  };

  const exportBrief = () => {
    downloadText("draftops-brief.md", buildMarkdownBrief(board, milestones));
    setStatusState({ type: "briefExported" });
  };

  const askDeepSeek = async () => {
    const question = chatInput.trim();
    if (!question || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch(deepSeekChatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          selectedPickNumber,
          history: chatMessages.slice(-8).map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });
      const payload = (await response.json()) as DeepSeekChatResponse;
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "DeepSeek chat request failed.");
      }

      setChatMessages([
        ...nextMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: payload.answer ?? "DeepSeek returned an empty answer.",
        },
      ]);
      if (payload.modelLabel) setChatModelLabel(payload.modelLabel);
    } catch (error) {
      setChatMessages([
        ...nextMessages,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content:
            language === "zh"
              ? error instanceof Error
                ? `DeepSeek 窗口暂不可用：${error.message}`
                : "DeepSeek 窗口暂不可用：未知错误。"
              : error instanceof Error
                ? `DeepSeek window is unavailable: ${error.message}`
                : "DeepSeek window is unavailable: unknown error.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) return;

      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      timeline
        .from(".app-header", { y: -18, duration: 0.45 })
        .from(".hero-copy", { y: 28, duration: 0.55 }, "-=0.18")
        .from(".scenario-card", { x: 28, duration: 0.52 }, "-=0.38")
        .from(".metric-card", { y: 18, duration: 0.4, stagger: 0.06 }, "-=0.2")
        .from(".board-panel", { y: 24, duration: 0.45 }, "-=0.14")
        .from(".insight-rail > .panel", { x: 24, duration: 0.42, stagger: 0.08 }, "-=0.32")
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
        panel.querySelectorAll(".pick-hero, .player-line, .profile-ribbon, .tag-cloud, .evidence-panel"),
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

  const workflowSteps = [
    {
      icon: <UserRound size={22} />,
      label: language === "zh" ? "联合试训" : "Combine",
      date: "5/11-5/18",
      status: d.completed,
      tone: "done",
    },
    {
      icon: <Users size={22} />,
      label: language === "zh" ? "球队试训" : "Team workouts",
      date: "5/20-6/15",
      status: d.active,
      tone: "active",
    },
    {
      icon: <MessageCircle size={22} />,
      label: language === "zh" ? "球队面试" : "Interviews",
      date: "6/16-6/23",
      status: d.pendingShort,
      tone: "pending",
    },
    {
      icon: <ClipboardList size={22} />,
      label: language === "zh" ? "模拟选秀" : "Mock draft",
      date: "6/24-6/28",
      status: d.pendingShort,
      tone: "pending",
    },
    {
      icon: <CalendarDays size={22} />,
      label: language === "zh" ? "选秀大会" : "Draft night",
      date: "6/25 7:00PM",
      status: d.pending,
      tone: "pending",
    },
  ];

  const awsSteps = [
    {
      icon: <Database size={22} />,
      label: "S3",
      detail: language === "zh" ? "Second Spectrum / NBA.com / 球探报告" : "Second Spectrum / NBA.com / scouting",
    },
    {
      icon: <Server size={22} />,
      label: "Amazon S3",
      detail: language === "zh" ? "原始数据湖" : "Raw data lake",
    },
    {
      icon: <BrainCircuit size={22} />,
      label: "AWS Glue",
      detail: language === "zh" ? "数据目录 / ETL" : "Catalog / ETL",
    },
    {
      icon: <Database size={22} />,
      label: "Amazon Redshift",
      detail: language === "zh" ? "数据仓库" : "Warehouse",
    },
    {
      icon: <BrainCircuit size={22} />,
      label: "Amazon SageMaker",
      detail: language === "zh" ? "模型训练与推理" : "Training / inference",
    },
    {
      icon: <TrendingUp size={22} />,
      label: "Amazon QuickSight",
      detail: language === "zh" ? "可视化分析" : "Analytics",
    },
    {
      icon: <CalendarDays size={22} />,
      label: "API / App",
      detail: language === "zh" ? "前端应用" : "Frontend app",
    },
  ];

  return (
    <main className="app-shell ops-shell" ref={appRef} lang={language === "zh" ? "zh-CN" : "en"} translate="no">
      <div className="ops-layout">
        <header className="ops-topbar">
          <div className="ops-brand">
            <div className="ops-logo">
              <DraftOpsMark />
            </div>
            <strong>DRAFTOPS</strong>
            <span>{d.systemTitle}</span>
            <ChevronDown size={15} />
          </div>

          <div className="ops-clock">
            <span>{d.dataUpdated}</span>
            <strong>{formatDataTime(agentMeta.generatedAt, language)} (CT)</strong>
            {agentPoolNote && <em>{agentPoolNote}</em>}
            <ChevronDown size={14} />
          </div>

          <div className="ops-actions">
            <button
              className="ops-button ops-language-toggle"
              type="button"
              onClick={() => setLanguage((current) => (current === "zh" ? "en" : "zh"))}
              aria-pressed={language === "en"}
              {...buttonMeta(languageToggleLabel)}
            >
              <Globe2 size={16} />
              <span className={language === "zh" ? "active" : ""}>中文</span>
              <i aria-hidden="true" />
              <span className={language === "en" ? "active" : ""}>EN</span>
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

        <section className="ops-dashboard">
          <div className="ops-mainframe">
            <section className="ops-toolbar">
              <label className="ops-search" htmlFor="ops-board-search">
                <Search size={18} />
                <input
                  id="ops-board-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={d.searchPlaceholder}
                />
              </label>

              <div className="ops-select">
                <span>{d.position}</span>
                <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value as PositionFilter)}>
                  <option value="all">{d.all}</option>
                  <option value="PG">PG</option>
                  <option value="SG">SG</option>
                  <option value="SF">SF</option>
                  <option value="PF">PF</option>
                  <option value="C">C</option>
                </select>
                <ChevronDown size={14} />
              </div>

              <div className="ops-select">
                <span>{d.sort}</span>
                <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                  <option value="pick">{d.sortPick}</option>
                  <option value="score">{d.sortScore}</option>
                  <option value="confidence">{d.sortConfidence}</option>
                  <option value="consensus">{d.sortConsensus}</option>
                  <option value="age">{d.sortAge}</option>
                </select>
                <ChevronDown size={14} />
              </div>

              <button
                className={`ops-filter ${riskOnly ? "active" : ""}`}
                type="button"
                onClick={() => setRiskOnly((current) => !current)}
                aria-pressed={riskOnly}
                {...buttonMeta(filterLabel)}
              >
                <Filter size={16} />
                {filterLabel}
                <ChevronDown size={13} />
              </button>
            </section>

            <section className="ops-metrics" aria-label={d.wholeBoard}>
              <div className="ops-metric-title">{d.wholeBoard}</div>
              {overviewMetrics.map((item, index) => (
                <article className="ops-metric" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small className={index % 2 === 0 ? "positive" : ""}>{item.detail}</small>
                </article>
              ))}
            </section>

            <section className="ops-table-shell board-panel" id="board">
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
                      const prospectName = localizeProspectName(pick.prospect.name, language);
                      return (
                        <tr
                          key={pick.pick}
                          className={`${pick.pick === selectedPick.pick ? "selected" : ""} ${pickNeedsReview ? "needs-review" : ""}`}
                          onClick={() => setSelectedPickNumber(pick.pick)}
                        >
                          <td>{String(pick.pick).padStart(2, "0")}</td>
                          <td>
                            <strong>{getTeamCode(pick.team)}</strong>
                            {pick.acquiredFrom && <small>({copy.fromTeam} {getTeamCode(pick.acquiredFrom)})</small>}
                          </td>
                          <td>
                            <span className="ops-player-cell">
                              <PlayerPhoto prospect={pick.prospect} label={prospectName} language={language} />
                              <span className="ops-player-name">{prospectName}</span>
                              {pickNeedsReview && (
                                <span className={`ops-review-icon ${fallbackProfile ? "is-fallback" : ""}`} title={reviewTitle} aria-label={reviewTitle}>
                                  <AlertTriangle size={11} />
                                </span>
                              )}
                            </span>
                          </td>
                          <td>{pick.prospect.positions.join("/")}</td>
                          <td>{localizeSchoolName(pick.prospect.school, language)}</td>
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

            <section className="ops-workflow" id="milestones">
              <h2>{d.workflow}</h2>
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
            </section>

            <section className="ops-aws" id="aws">
              <h2>{d.awsData}</h2>
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
            </section>
          </div>

          <aside className="ops-intel insight-rail" ref={insightRef}>
            <section className="ops-intel-card ops-player-card">
              <header>
                <span>{d.playerIntel}</span>
                <b>#{String(selectedPick.pick).padStart(2, "0")} {d.focus}</b>
              </header>
              <div className="ops-player-summary">
                <PlayerPhoto
                  prospect={selectedPick.prospect}
                  label={localizeProspectName(selectedPick.prospect.name, language)}
                  language={language}
                  variant="hero"
                />
                <div>
                  <h2>{localizeProspectName(selectedPick.prospect.name, language)}</h2>
                  <p>
                    {selectedPick.prospect.positions.join("/")} | {localizeSchoolName(selectedPick.prospect.school, language)} |{" "}
                    {formatOneDecimal(selectedPick.prospect.age)}
                    {language === "zh" ? "岁" : ""}
                  </p>
                  <span className="ops-photo-meta">
                    <ShieldCheck size={12} />
                    {formatPhotoSource(selectedPick.prospect, language)}
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
              <div className="ops-grade-pair">
                <span>{d.upside} <strong>{selectedUpsideGrade}</strong></span>
                <span>{d.readiness} <strong className="warn">{selectedReadinessGrade}</strong></span>
              </div>
            </section>

            <section className="ops-intel-card">
              <h3>{d.coreEvidence}</h3>
              <ul className="ops-bullet-list">
                {evidenceItems.slice(0, 5).map((item) => (
                  <li key={item}>{hideAgentParameters(item)}</li>
                ))}
              </ul>
            </section>

            <section className="ops-intel-card">
              <h3>{d.risks}</h3>
              <ul className="ops-warning-list">
                {(warningNotes.length ? warningNotes : riskNotes.length ? riskNotes : [d.fallbackNotes]).slice(0, 4).map((item) => (
                  <li key={item}>
                    <AlertTriangle size={16} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="ops-intel-card ops-fit-card">
              <h3>{d.fitMatch}（{getTeamCode(selectedPick.team)}）</h3>
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
            </section>

            <section className="ops-intel-card">
              <h3>{d.playerProfile}</h3>
              <div className="ops-profile-bars">
                {prospectProfile.map(([key, value]) => (
                  <div className="ops-profile-bar" key={key}>
                    <span>{profileLabelKeys[key]?.[language] ?? localizePhrase(key, language)}</span>
                    <i><b style={{ width: `${value}%` }} /></i>
                    <strong>{formatOneDecimal(value / 10)}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="ops-intel-card ops-source-card">
              <h3>{d.dataSource}</h3>
              {agentPoolNote && <p className="ops-source-note ops-source-note-strong">{agentPoolNote}</p>}
              <p className="ops-source-note">{agentReviewNote}</p>
              {selectedFallbackProfile && (
                <p className="ops-source-note ops-source-warning">
                  {language === "zh"
                    ? `#${selectedPick.pick} 使用扩展候选池回退画像，锁定前需补强球探资料。`
                    : `#${selectedPick.pick} uses an expanded-pool fallback profile; enrich scouting before final lock.`}
                </p>
              )}
              <p className="ops-source-note">{d.sourcePrefix}</p>
              <p className="ops-source-note">{d.modelVersion} {boardAverage}%</p>
              <p className="ops-source-note">{teamNote}</p>
              <div className="ops-source-links">
                {sourceLinks.slice(0, 3).map((source) => (
                  <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                    {localizePhrase(source.label, language)}
                  </a>
                ))}
              </div>
            </section>

            <section className="ops-intel-card ops-alt-card">
              <h3>{d.alternativesIfMissed}</h3>
              <div className="ops-alt-list">
                {selectedPick.alternatives.slice(0, 3).map((candidate, index) => (
                  <div key={candidate.prospectId}>
                    <strong>A{index + 1}</strong>
                    <span>{localizeProspectName(candidate.name, language)}</span>
                    <small>{localizePhrase(candidate.roleFit, language)}</small>
                    <b>{formatOneDecimal(candidate.score)}</b>
                  </div>
                ))}
              </div>
              <button type="button" {...buttonMeta(d.moreAlternatives)}>{d.moreAlternatives}<ChevronDown size={14} /></button>
            </section>
          </aside>
        </section>
      </div>

      <div className="legacy-layout" hidden>
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark">
            <DraftOpsMark />
          </div>
          <div>
            <strong>DraftOps</strong>
            <span>{copy.brandSubtitle}</span>
          </div>
        </div>
        <nav className="command-nav" aria-label="Page sections">
          <a href="#board">{copy.navBoard}</a>
          <a href="#milestones">{copy.navMilestones}</a>
          <a href="#aws">{copy.navAws}</a>
        </nav>
        <div className="topbar-actions">
          <button
            className="button secondary legacy-language-toggle"
            type="button"
            onClick={() => setLanguage((current) => (current === "zh" ? "en" : "zh"))}
            {...buttonMeta(copy.languageToggleAria)}
          >
            <Languages size={18} />
            {copy.languageSwitch}
          </button>
          <button className="button secondary" type="button" onClick={() => setIsChatOpen(true)} {...buttonMeta(copy.actionDeepSeek)}>
            <MessageCircle size={18} />
            {copy.actionDeepSeek}
          </button>
          <button className="button secondary" type="button" onClick={exportBrief} {...buttonMeta(copy.actionBrief)}>
            <FileInput size={18} />
            {copy.actionBrief}
          </button>
          <button className="button primary" type="button" onClick={exportSubmission} {...buttonMeta(copy.actionSubmission)}>
            <Download size={18} />
            {copy.actionSubmission}
          </button>
        </div>
      </header>

      <section className="hero-panel command-deck">
        <div className="hero-copy">
          <div className="eyeline">
            <Clock3 size={18} />
            <span>{formatCountdown(language)}</span>
          </div>
          <h1>{copy.predictionBoard}</h1>
          <p className="hero-status" aria-live="polite">
            {status}
          </p>
        </div>
        <div className="scenario-card">
          <span>{copy.activeScenario}</span>
          <strong>{isAgentLoading ? copy.loading : localizePhrase(agentMeta.label, language)}</strong>
          <p>{copy.agentOnlyBoard}</p>
          <small>{localizePhrase(agentMeta.generatedBy, language)}</small>
          <small>{copy.translationSource}</small>
        </div>
      </section>

      <section className="overview-grid" aria-label="Board status">
        {overviewMetrics.map((item) => (
          <article className="metric-card" key={item.label}>
            <span className="metric-icon">{item.icon}</span>
            <div>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="board-layout">
        <div className="workspace-main">
          <section id="board" className="panel board-panel" ref={boardRef}>
          <div className="panel-header">
            <div>
              <span className="section-kicker">{copy.roundOne}</span>
              <h2>{copy.predictionBoard}</h2>
            </div>
            <div className="board-tools">
              <label className="search-box" htmlFor="board-search">
                <Search size={18} />
                <input
                  id="board-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                />
              </label>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{copy.pick}</th>
                  <th>{copy.team}</th>
                  <th>{copy.player}</th>
                  <th>{copy.market}</th>
                  <th>{copy.fit}</th>
                  <th>{copy.confidence}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBoard.map((pick) => {
                  const prospectName = localizeProspectName(pick.prospect.name, language);
                  return (
                    <tr
                      key={pick.pick}
                      className={pick.pick === selectedPick.pick ? "selected" : ""}
                      onClick={() => setSelectedPickNumber(pick.pick)}
                    >
                      <td className="pick-number">{pick.pick}</td>
                      <td>
                        <strong>{localizeTeamName(pick.team, language)}</strong>
                        {pick.acquiredFrom && <span>{copy.fromTeam} {localizeTeamName(pick.acquiredFrom, language)}</span>}
                      </td>
                      <td>
                        <div className="table-player-cell">
                          <PlayerPhoto prospect={pick.prospect} label={prospectName} language={language} variant="compact" />
                          <div>
                            <strong>{prospectName}</strong>
                            <span>
                              {formatPositionsLocalized(pick.prospect.positions, language, copy.positionPending)} ·{" "}
                              {localizeSchoolName(pick.prospect.school, language)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>#{pick.prospect.consensusRank}</strong>
                        <span>{pick.prospect.mockHeat}/100 {copy.heat}</span>
                      </td>
                      <td>{localizePhrase(pick.roleFit, language)}</td>
                      <td>
                        <div className="confidence">
                          <span style={{ width: `${pick.confidence}%` }} />
                        </div>
                        <small>{pick.confidence}%</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </section>

          <section className="support-grid">
            <section id="milestones" className="panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">{copy.submissionHelpers}</span>
                  <h2>{copy.milestones}</h2>
                </div>
              </div>
              <div className="milestone-grid">
                {milestones.map((milestone) => (
                  <article key={milestone.id} className="milestone">
                    <span>{localizeMilestoneType(milestone.type, language)}</span>
                    <h3>{localizeMilestonePrompt(milestone.prompt, language)}</h3>
                    <strong>{milestone.answer}</strong>
                    <p>
                      {milestone.evidence
                        .slice(0, 2)
                        .map((item) => localizeEvidenceText(hideAgentParameters(item), language))
                        .join(" · ")}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section id="aws" className="panel aws-panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">{copy.architecture}</span>
                  <h2>{copy.awsPlan}</h2>
                </div>
              </div>
              <div className="aws-rail">
                <div>
                  <Server size={22} />
                  <strong>{copy.appRunner}</strong>
                  <span>{copy.appRunnerDetail}</span>
                </div>
                <div>
                  <Database size={22} />
                  <strong>{copy.storage}</strong>
                  <span>{copy.storageDetail}</span>
                </div>
                <div>
                  <BrainCircuit size={22} />
                  <strong>{copy.bedrock}</strong>
                  <span>{copy.bedrockDetail}</span>
                </div>
              </div>
              <div className="cost-bar">
                <span style={{ width: "32%" }} />
              </div>
              <p className="cost-note">{copy.costNote}</p>
            </section>
          </section>

          <section id="brief" className="brief-band">
            <div>
              <span className="section-kicker">{copy.roadshow}</span>
              <h2>{copy.pitchSpine}</h2>
              <p>{copy.pitchCopy}</p>
            </div>
            <div className="source-list">
              {sourceLinks.map((source) => (
                <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                  {localizePhrase(source.label, language)}
                </a>
              ))}
            </div>
          </section>
        </div>

        <aside className="insight-rail" ref={insightRef}>
          <section className="panel pick-panel">
            <div className="pick-hero">
              <div className="pick-hero-main">
                <PlayerPhoto
                  prospect={selectedPick.prospect}
                  label={localizeProspectName(selectedPick.prospect.name, language)}
                  language={language}
                  variant="panel"
                />
                <div>
                  <span>{copy.pickLabel} {selectedPick.pick}</span>
                  <h2>{localizeProspectName(selectedPick.prospect.name, language)}</h2>
                  <p>{localizeTeamName(selectedPick.team, language)}</p>
                  <small className="photo-source-line">{formatPhotoSource(selectedPick.prospect, language)}</small>
                </div>
              </div>
              <strong>{selectedPick.score}{copy.scoreUnit}</strong>
            </div>
            <p className="player-line">
              {selectedPositions} · {formatOptionalValue(selectedPick.prospect.height, copy.heightPending)} ·{" "}
              {formatWeight(selectedPick.prospect.weight, language)} ·{" "}
              {localizeCountryName(formatOptionalValue(selectedPick.prospect.origin, copy.originPending), language)}
            </p>
            <div className="lock-note">{copy.lockedPick}</div>
            <div className="profile-ribbon">
              <div>
                <span>{copy.consensus}</span>
                <strong>#{selectedPick.prospect.consensusRank}</strong>
              </div>
              <div>
                <span>{copy.heat}</span>
                <strong>{selectedPick.prospect.mockHeat}</strong>
              </div>
              <div>
                <span>{copy.age}</span>
                <strong>{selectedPick.prospect.age}</strong>
              </div>
              <div>
                <span>{copy.margin}</span>
                <strong>{selectedPick.margin}</strong>
              </div>
            </div>
            <div className="tag-cloud" aria-label="Player role tags">
              {playerRoleTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </section>

          <section className="panel evidence-panel expanded">
            <div className="panel-header compact">
              <div>
                <span className="section-kicker">{copy.whyThisPick}</span>
                <h2>{copy.evidence}</h2>
              </div>
              <Activity size={22} />
            </div>
            <div className="breakdown">
              {Object.entries(selectedPick.breakdown).map(([key, value]) => (
                <div key={key}>
                  <span>{weightLabels[key as keyof Weights][language]}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <ul className="evidence-list">
              {evidenceItems.map((item) => (
                <li key={item}>{hideAgentParameters(item)}</li>
              ))}
            </ul>
            <div className="risk-strip">
              <span>{copy.riskNotes}</span>
              <div>
                {riskNotes.slice(0, 4).map((risk) => (
                  <strong key={risk}>{risk}</strong>
                ))}
              </div>
            </div>
            <div className="warning-stack">
              {warningNotes.map((warning) => (
                <div className="warning-box" key={warning}>
                  <AlertTriangle size={18} />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel context-panel">
            <div className="panel-header compact">
              <div>
                <span className="section-kicker">{copy.teamFile}</span>
                <h2>{copy.fitContext}</h2>
              </div>
              <BrainCircuit size={22} />
            </div>
            <div className="context-grid">
              <div>
                <span>{copy.draftZone}</span>
                <strong>{localizeZone(selectedPick.zone, language)}</strong>
              </div>
              <div>
                <span>{copy.teamPhase}</span>
                <strong>{localizePhase(formatOptionalValue(selectedTeam?.phase, language === "zh" ? "智能体推断" : "agent inferred"), language)}</strong>
              </div>
              <div>
                <span>{copy.riskTolerance}</span>
                <strong>{formatOptionalValue(selectedTeam?.riskTolerance, language === "zh" ? "智能体待确认" : "agent pending")}</strong>
              </div>
              <div>
                <span>{copy.tradeSlot}</span>
                <strong>{tradeSlot}</strong>
              </div>
            </div>
            <div className="signal-section">
              <span>{copy.teamNeeds}</span>
              <div className="tag-cloud compact">
                {teamNeeds.map((need) => (
                  <span key={need}>{need}</span>
                ))}
              </div>
            </div>
            <div className="signal-section">
              <span>{copy.priorityTags}</span>
              <div className="tag-cloud compact">
                {priorityTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
            <p className="context-note">{teamNote}</p>
          </section>

          <section className="panel profile-panel">
            <div className="panel-header compact">
              <div>
                <span className="section-kicker">{copy.playerFile}</span>
                <h2>{copy.profileSignals}</h2>
              </div>
              <Gauge size={22} />
            </div>
            <div className="profile-bars">
              {prospectProfile.map(([key, value]) => (
                <div className="profile-bar" key={key}>
                  <span>
                    {localizePhrase(key, language)} <strong>{value}</strong>
                  </span>
                  <div>
                    <i style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="signal-section">
              <span>{copy.strengths}</span>
              <ul className="compact-list">
                {strengthNotes.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </div>
            <div className="signal-section">
              <span>{copy.sourceNotes}</span>
              <ul className="compact-list">
                {sourceNotes.map((note) => (
                  <li key={note}>{hideAgentParameters(note)}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel alternatives-panel">
            <div className="panel-header compact">
              <div>
                <span className="section-kicker">{copy.runnerUpCheck}</span>
                <h2>{copy.alternatives}</h2>
              </div>
              <TrendingUp size={22} />
            </div>
            <div className="candidate-list">
              {selectedPick.alternatives.length ? (
                selectedPick.alternatives.map((candidate, index) => (
                  <div className="candidate-row" key={candidate.prospectId}>
                    <strong>{index + 2}</strong>
                    <span>{localizeProspectName(candidate.name, language)}</span>
                    <small>{localizePhrase(candidate.roleFit, language)}</small>
                    <b>{candidate.score}</b>
                  </div>
                ))
              ) : (
                <div className="candidate-empty">{copy.noAlternativeFallback}</div>
              )}
            </div>
            <p className="context-note">
              {copy.agentMargin}: {selectedPick.margin}. {copy.confidence}: {selectedPick.confidence}%.
            </p>
          </section>

        </aside>
      </section>
      </div>

      <section className={`deepseek-dock ${isChatOpen ? "open" : ""}`} aria-label="DeepSeek chat window">
        <div className="deepseek-window" role="dialog" aria-modal="false" aria-labelledby="deepseek-title">
          <header className="deepseek-header">
            <div>
              <span className="section-kicker">{copy.liveLlm}</span>
              <h2 id="deepseek-title">{copy.deepSeekWindow}</h2>
              <p>{chatModelLabel} · {copy.deepSeekSubtitle}</p>
            </div>
            <button className="icon-button" type="button" onClick={() => setIsChatOpen(false)} {...buttonMeta(copy.closeDeepSeek)}>
              <X size={20} />
            </button>
          </header>

          <div className="chat-log" aria-live="polite">
            {chatMessages.map((message) => (
              <article className={`chat-message ${message.role}`} key={message.id}>
                <span>{message.role === "assistant" ? "DeepSeek" : copy.you}</span>
                <p>{message.id === "deepseek-ready" ? copy.chatIntro : message.content}</p>
              </article>
            ))}
            {isChatLoading && (
              <article className="chat-message assistant">
                <span>DeepSeek</span>
                <p>{copy.chatThinking}</p>
              </article>
            )}
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

    </main>
  );
}

export default App;
