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
import type { DraftOpsManifest, DraftPick, ImportBundle, LocalizedText, Prospect, RuntimeWorkflowStep, TeamProfile, Weights } from "./types";

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

const findTeamProfile = (teams: TeamProfile[], pick: DraftPick) =>
  teams.find((team) => team.pick === pick.pick) ??
  teams.find((team) => team.team.toLowerCase() === pick.team.toLowerCase());

type PositionFilter = "all" | "PG" | "SG" | "SF" | "PF" | "C";
type SortKey = "pick" | "score" | "confidence" | "consensus" | "age";
type DossierTab = "overview" | "evidence" | "risk" | "fit" | "alternatives";
type MobileSection = "board" | "player" | "flow";
type WorkflowMode = "flow" | "aws";

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
  const [dossierTab, setDossierTab] = useState<DossierTab>("overview");
  const [mobileSection, setMobileSection] = useState<MobileSection>("board");
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("flow");
  const [statusState, setStatusState] = useState<StatusState>({ type: "loading" });
  const [isChatOpen, setIsChatOpen] = useState(false);
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

  const copy = UI_COPY[language];
  const d = dashboardCopy[language];
  const languageToggleLabel = language === "zh" ? "Switch to English" : "切换到中文";
  const filterLabel = riskOnly ? d.filterRiskOnly : d.filter;
  const status = useMemo(() => formatStatus(statusState, language), [language, statusState]);
  const milestones = useMemo(() => generateMilestones(board, draftOpsManifest.milestones), [board]);
  const health = useMemo(() => getBoardHealth(board), [board]);
  const selectedPick = board.find((pick) => pick.pick === selectedPickNumber) ?? board[0];
  const selectedTeam = findTeamProfile(teamProfiles, selectedPick);
  const prospectProfile = Object.entries(selectedPick.prospect.profile);
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
  const selectedNeedsReview = needsBoardReview(selectedPick);
  const selectedFallbackProfile = hasExpandedFallbackProfile(selectedPick.prospect);
  const teamNote = localizeEvidenceText(formatOptionalValue(selectedTeam?.notes, copy.teamNotePending), language);
  const boardAverage = board.length
    ? Math.round(board.reduce((sum, pick) => sum + pick.confidence, 0) / board.length)
    : 0;
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
    downloadJson(
      draftOpsManifest.exportSettings.submissionFilename,
      buildSubmissionPayload(board, milestones, draftOpsManifest.exportSettings, language),
    );
    setStatusState({ type: "submissionExported" });
  };

  const exportBrief = () => {
    downloadText(
      draftOpsManifest.exportSettings.briefFilename,
      buildMarkdownBrief(board, milestones, draftOpsManifest.exportSettings, language),
    );
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
        .from(".ops-command-bar", { y: -18, duration: 0.45 })
        .from(".ops-board-header", { y: 20, duration: 0.46 }, "-=0.18")
        .from(".ops-vital-card", { y: 14, duration: 0.34, stagger: 0.045 }, "-=0.2")
        .from(".ops-filter-row", { y: 12, duration: 0.3 }, "-=0.18")
        .from(".board-panel", { y: 24, duration: 0.45 }, "-=0.14")
        .from(".ops-prospect-dossier", { opacity: 0, duration: 0.34 }, "-=0.28")
        .from(".ops-workflow-dock", { opacity: 0, duration: 0.28 }, "-=0.2")
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
    label: runtimeText(step.label, language),
    status: workflowStatusLabel(step, d),
  }));

  const awsSteps = draftOpsManifest.awsSteps.map((step) => ({
    ...step,
    icon: runtimeIcon(step.icon),
    label: runtimeText(step.label, language),
    detail: runtimeText(step.detail, language),
  }));

  const boardIntegrity = health.hasThirtyPicks && health.noDuplicates;
  const statusCopy = {
    commandTitle: language === "zh" ? "Draft Board Command" : "Draft Board Command",
    commandSubtitle: language === "zh" ? "首轮 30 签锁定工作台" : "Round-one lock desk",
    mission: language === "zh" ? "任务" : "Mission",
    playerTab: language === "zh" ? "球员" : "Player",
    flowTab: language === "zh" ? "流程" : "Flow",
    chatTab: language === "zh" ? "问答" : "Chat",
    integrity: language === "zh" ? "完整性" : "Integrity",
    lowConfidence: language === "zh" ? "低置信" : "Low confidence",
    fallback: language === "zh" ? "回退画像" : "Fallbacks",
    locked: language === "zh" ? "锁定状态" : "Lock state",
    lockedValue: language === "zh" ? "候选板已载入" : "board loaded",
    riskMode: language === "zh" ? "风险视图" : "Risk view",
    normalMode: language === "zh" ? "全量视图" : "Full board",
    dataset: language === "zh" ? "数据状态" : "Data state",
    dossier: language === "zh" ? "Prospect Dossier" : "Prospect Dossier",
    scenario: language === "zh" ? "情景" : "Scenario",
    model: language === "zh" ? "模型" : "Model",
    sources: language === "zh" ? "来源" : "Sources",
    board: language === "zh" ? "看板" : "Board",
    teams: language === "zh" ? "球队" : "Teams",
    scenarios: language === "zh" ? "情景" : "Scenarios",
    milestones: language === "zh" ? "里程碑" : "Milestones",
    aws: "AWS",
    sourceModule: language === "zh" ? "源" : "Source",
    workflowDock: language === "zh" ? "Workflow Dock" : "Workflow Dock",
    evidenceTab: language === "zh" ? "证据" : "Evidence",
    riskTab: language === "zh" ? "风险" : "Risk",
    fitTab: language === "zh" ? "匹配" : "Fit",
    altTab: language === "zh" ? "备选" : "Alternatives",
    overviewTab: language === "zh" ? "概览" : "Overview",
    showFlow: language === "zh" ? "流程" : "Flow",
    showAws: language === "zh" ? "数据链路" : "Data chain",
  };

  const dossierTabs: Array<{ id: DossierTab; label: string }> = [
    { id: "overview", label: statusCopy.overviewTab },
    { id: "evidence", label: statusCopy.evidenceTab },
    { id: "risk", label: statusCopy.riskTab },
    { id: "fit", label: statusCopy.fitTab },
    { id: "alternatives", label: statusCopy.altTab },
  ];
  const boardVitals = [
    {
      label: statusCopy.integrity,
      value: boardIntegrity ? "30/30" : `${board.length}/30`,
      detail: boardIntegrity ? copy.pass : copy.review,
      tone: boardIntegrity ? "good" : "risk",
    },
    { label: statusCopy.lowConfidence, value: String(lowConfidenceCount), detail: agentReviewNote, tone: lowConfidenceCount > 8 ? "risk" : "good" },
    { label: statusCopy.fallback, value: String(fallbackPickCount), detail: agentPoolNote || "--", tone: fallbackPickCount ? "risk" : "good" },
    { label: statusCopy.locked, value: statusCopy.lockedValue, detail: riskOnly ? statusCopy.riskMode : statusCopy.normalMode, tone: riskOnly ? "risk" : "good" },
  ];
  const mobileTabs = [
    { id: "board" as const, label: statusCopy.board, icon: <ClipboardList size={18} /> },
    { id: "player" as const, label: statusCopy.playerTab, icon: <UserRound size={18} /> },
    { id: "flow" as const, label: statusCopy.flowTab, icon: <CalendarDays size={18} /> },
  ];
  const selectedRiskItems = (warningNotes.length ? warningNotes : riskNotes.length ? riskNotes : [d.fallbackNotes]).slice(0, 5);

  return (
    <main className="app-shell ops-shell" ref={appRef} lang={language === "zh" ? "zh-CN" : "en"} translate="no">
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
            <strong>{formatDataTime(agentMeta.generatedAt, language)} (CT)</strong>
            <em>{agentPoolNote || agentMeta.label}</em>
            <b>{statusCopy.model} {draftOpsManifest.model.version}</b>
          </div>

          <div className="ops-actions ops-command-actions">
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

        <section className="ops-board-workspace" id="board" ref={boardRef}>
          <div className="ops-board-header">
            <div>
              <span>{statusCopy.scenario} · {isAgentLoading ? copy.loading : localizePhrase(agentMeta.label, language)}</span>
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

          <section className="ops-filter-row">
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
                    const prospectName = localizeProspectName(pick.prospect.name, language);
                    return (
                      <tr
                        key={pick.pick}
                        className={`${pick.pick === selectedPick.pick ? "selected" : ""} ${pickNeedsReview ? "needs-review" : ""}`}
                        onClick={() => {
                          setSelectedPickNumber(pick.pick);
                          setMobileSection("player");
                        }}
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
                <div className="ops-grade-pair">
                  <span>{d.upside} <strong>{selectedUpsideGrade}</strong></span>
                  <span>{d.readiness} <strong className="warn">{selectedReadinessGrade}</strong></span>
                </div>
                <div className="ops-profile-bars">
                  {prospectProfile.map(([key, value]) => (
                    <div className="ops-profile-bar" key={key}>
                      <span>{profileLabelKeys[key]?.[language] ?? localizePhrase(key, language)}</span>
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
                    {language === "zh"
                      ? `#${selectedPick.pick} 使用扩展候选池回退画像，锁定前需补强球探资料。`
                      : `#${selectedPick.pick} uses an expanded-pool fallback profile; enrich scouting before final lock.`}
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
                      <span>{localizeProspectName(candidate.name, language)}</span>
                      <small>{localizePhrase(candidate.roleFit, language)}</small>
                      <b>{formatOneDecimal(candidate.score)}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="ops-source-card" id="sources">
            <h3>{d.dataSource}</h3>
            {agentPoolNote && <p className="ops-source-note ops-source-note-strong">{agentPoolNote}</p>}
            <p className="ops-source-note">{agentReviewNote}</p>
            <p className="ops-source-note">{d.sourcePrefix}</p>
            <p className="ops-source-note">{formatModelNote(draftOpsManifest, language, boardAverage)}</p>
            <div className="ops-source-links">
              {draftOpsManifest.sourceLinks.slice(0, 3).map((source) => (
                <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                  {runtimeText(source.label, language)}
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
        <section className="deepseek-dock open" aria-label="DeepSeek chat window">
          <div className="deepseek-window" role="dialog" aria-modal="true" aria-labelledby="deepseek-title">
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
