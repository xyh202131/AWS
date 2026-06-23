import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Clock3,
  Database,
  Download,
  FileInput,
  Gauge,
  Languages,
  MessageCircle,
  Search,
  Send,
  Server,
  ShieldCheck,
  TrendingUp,
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
import type { DraftPick, ImportBundle, TeamProfile, Weights } from "./types";

gsap.registerPlugin(useGSAP);

const deadline = new Date("2026-06-24T08:00:00+08:00");
const agentBundleUrl = "/data/final_import_bundle.json";
const agentBoardUrl = "/data/agent_balanced_board.json";
const deepSeekChatUrl = "http://127.0.0.1:4318/api/deepseek/chat";

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
  scenario?: {
    id?: string;
    label?: string;
    weights?: Weights;
  };
  board?: DraftPick[];
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

function App() {
  const appRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const insightRef = useRef<HTMLElement | null>(null);
  const [language, setLanguage] = useState<Language>("zh");
  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>(seedTeams);
  const [board, setBoard] = useState(() => generateBoard(seedTeams, seedProspects, defaultWeights));
  const [agentMeta, setAgentMeta] = useState({
    label: "Agent board pending",
    generatedBy: "local fallback",
    generatedAt: "",
  });
  const [isAgentLoading, setIsAgentLoading] = useState(true);
  const [selectedPickNumber, setSelectedPickNumber] = useState(1);
  const [search, setSearch] = useState("");
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
  const teamNote = localizeEvidenceText(formatOptionalValue(selectedTeam?.notes, copy.teamNotePending), language);
  const tradeSlot = selectedPick.acquiredFrom
    ? `${copy.fromTeam} ${localizeTeamName(selectedPick.acquiredFrom, language)}`
    : copy.originalPick;
  const boardAverage = board.length
    ? Math.round(board.reduce((sum, pick) => sum + pick.confidence, 0) / board.length)
    : 0;
  const tradedPickCount = board.filter((pick) => pick.acquiredFrom).length;
  const warningPickCount = board.filter((pick) => pick.warnings.length > 0).length;
  const filteredBoard = board.filter((pick) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [
      pick.team,
      localizeTeamName(pick.team, language),
      localizeTeamName(pick.team, "zh"),
      pick.prospect.name,
      localizeProspectName(pick.prospect.name, language),
      localizeProspectName(pick.prospect.name, "zh"),
      pick.prospect.school,
      localizeSchoolName(pick.prospect.school, language),
      localizeSchoolName(pick.prospect.school, "zh"),
      pick.roleFit,
      localizePhrase(pick.roleFit, language),
      localizePhrase(pick.roleFit, "zh"),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const overviewMetrics = [
    {
      label: copy.officialAudit,
      value: health.hasThirtyPicks && health.noDuplicates ? copy.pass : copy.review,
      detail: copy.officialAuditDetail,
      icon: <ShieldCheck size={22} />,
    },
    {
      label: copy.boardConfidence,
      value: `${boardAverage}%`,
      detail: copy.boardConfidenceDetail,
      icon: <Gauge size={22} />,
    },
    {
      label: copy.agentControl,
      value: isAgentLoading ? copy.loading : copy.locked,
      detail: copy.agentControlDetail,
      icon: <BrainCircuit size={22} />,
    },
    {
      label: copy.riskWatch,
      value: String(warningPickCount),
      detail: copy.riskWatchDetail,
      icon: <AlertTriangle size={22} />,
    },
    {
      label: copy.tradedPicks,
      value: String(tradedPickCount),
      detail: copy.tradedPicksDetail,
      icon: <TrendingUp size={22} />,
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

  return (
    <main className="app-shell" ref={appRef}>
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark">D</div>
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
          <button className="button secondary language-toggle" type="button" onClick={() => setLanguage((current) => (current === "zh" ? "en" : "zh"))} title={copy.languageToggleAria}>
            <Languages size={18} />
            {copy.languageSwitch}
          </button>
          <button className="button secondary" type="button" onClick={() => setIsChatOpen(true)} title={copy.actionDeepSeek}>
            <MessageCircle size={18} />
            {copy.actionDeepSeek}
          </button>
          <button className="button secondary" type="button" onClick={exportBrief} title={copy.actionBrief}>
            <FileInput size={18} />
            {copy.actionBrief}
          </button>
          <button className="button primary" type="button" onClick={exportSubmission} title={copy.actionSubmission}>
            <Download size={18} />
            {copy.actionSubmission}
          </button>
        </div>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyeline">
            <Clock3 size={18} />
            <span>{formatCountdown(language)}</span>
          </div>
          <h1>{copy.heroTitle}</h1>
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
                {filteredBoard.map((pick) => (
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
                      <strong>{localizeProspectName(pick.prospect.name, language)}</strong>
                      <span>
                        {formatPositionsLocalized(pick.prospect.positions, language, copy.positionPending)} ·{" "}
                        {localizeSchoolName(pick.prospect.school, language)}
                      </span>
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
                ))}
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
              <div>
                <span>{copy.pickLabel} {selectedPick.pick}</span>
                <h2>{localizeProspectName(selectedPick.prospect.name, language)}</h2>
                <p>{localizeTeamName(selectedPick.team, language)}</p>
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

      <section className={`deepseek-dock ${isChatOpen ? "open" : ""}`} aria-label="DeepSeek chat window">
        <div className="deepseek-window" role="dialog" aria-modal="false" aria-labelledby="deepseek-title">
          <header className="deepseek-header">
            <div>
              <span className="section-kicker">{copy.liveLlm}</span>
              <h2 id="deepseek-title">{copy.deepSeekWindow}</h2>
              <p>{chatModelLabel} · {copy.deepSeekSubtitle}</p>
            </div>
            <button className="icon-button" type="button" onClick={() => setIsChatOpen(false)} title={copy.closeDeepSeek}>
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
            <button className="button primary" type="submit" disabled={isChatLoading || !chatInput.trim()}>
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
