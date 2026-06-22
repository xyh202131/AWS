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
  Search,
  Server,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import "./App.css";
import { defaultWeights, seedProspects, seedTeams, sourceLinks } from "./data/seedData";
import { hideAgentParameters } from "./lib/evidence";
import { buildMarkdownBrief, buildSubmissionPayload, downloadJson, downloadText } from "./lib/export";
import { formatOptionalValue, formatPositions, NO_ALTERNATIVE_FALLBACK, ORIGINAL_PICK_LABEL, WARNING_FALLBACK, withTextFallback } from "./lib/fallbacks";
import { generateBoard, generateMilestones, getBoardHealth } from "./lib/prediction";
import type { DraftPick, ImportBundle, TeamProfile, Weights } from "./types";

gsap.registerPlugin(useGSAP);

const deadline = new Date("2026-06-24T08:00:00+08:00");
const agentBundleUrl = "/data/final_import_bundle.json";
const agentBoardUrl = "/data/agent_balanced_board.json";

const formatCountdown = () => {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return "Submission window closed";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m to 2026-06-24 08:00`;
};

const weightLabels: Record<keyof Weights, string> = {
  consensus: "Consensus",
  need: "Team Need",
  player: "Player Grade",
  upside: "Upside",
  intel: "Late Intel",
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

const formatWeight = (weight: string | null | undefined) => {
  const normalizedWeight = formatOptionalValue(weight, "Weight pending");
  return normalizedWeight.toLowerCase().includes("lb") ? normalizedWeight : `${normalizedWeight} lbs`;
};

const findTeamProfile = (teams: TeamProfile[], pick: DraftPick) =>
  teams.find((team) => team.pick === pick.pick) ??
  teams.find((team) => team.team.toLowerCase() === pick.team.toLowerCase());

function App() {
  const appRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const insightRef = useRef<HTMLElement | null>(null);
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
  const [status, setStatus] = useState("Loading official Agent board...");

  const milestones = useMemo(() => generateMilestones(board), [board]);
  const health = useMemo(() => getBoardHealth(board), [board]);
  const selectedPick = board.find((pick) => pick.pick === selectedPickNumber) ?? board[0];
  const selectedTeam = findTeamProfile(teamProfiles, selectedPick);
  const prospectProfile = Object.entries(selectedPick.prospect.profile);
  const selectedPositions = formatPositions(selectedPick.prospect.positions);
  const playerRoleTags = withTextFallback(selectedPick.prospect.roleTags, "Agent role tags pending.");
  const evidenceItems = withTextFallback(selectedPick.evidence, "No evidence text retained for this pick.");
  const riskNotes = withTextFallback(selectedPick.prospect.risks, "No risk flag in current bundle.");
  const warningNotes = withTextFallback(selectedPick.warnings, WARNING_FALLBACK);
  const teamNeeds = withTextFallback(selectedTeam?.needs, "Agent team context pending.");
  const priorityTags = withTextFallback(selectedTeam?.priorityTags, "Agent priority context pending.");
  const strengthNotes = withTextFallback(selectedPick.prospect.strengths, "No strength tag in current bundle.");
  const sourceNotes = withTextFallback(selectedPick.prospect.sourceNotes, "No extra source note in current bundle.");
  const teamNote = formatOptionalValue(selectedTeam?.notes, "Agent team note pending for this slot.");
  const tradeSlot = selectedPick.acquiredFrom ? `from ${selectedPick.acquiredFrom}` : ORIGINAL_PICK_LABEL;
  const boardAverage = board.length
    ? Math.round(board.reduce((sum, pick) => sum + pick.confidence, 0) / board.length)
    : 0;
  const tradedPickCount = board.filter((pick) => pick.acquiredFrom).length;
  const warningPickCount = board.filter((pick) => pick.warnings.length > 0).length;
  const filteredBoard = board.filter((pick) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [pick.team, pick.prospect.name, pick.prospect.school, pick.roleFit]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const overviewMetrics = [
    {
      label: "Official Audit",
      value: health.hasThirtyPicks && health.noDuplicates ? "30/30 PASS" : "Review",
      detail: "NBA.com prospect gate",
      icon: <ShieldCheck size={22} />,
    },
    {
      label: "Board Confidence",
      value: `${boardAverage}%`,
      detail: "Average model confidence",
      icon: <Gauge size={22} />,
    },
    {
      label: "Agent Control",
      value: isAgentLoading ? "Loading" : "Locked",
      detail: "No manual overrides",
      icon: <BrainCircuit size={22} />,
    },
    {
      label: "Risk Watch",
      value: String(warningPickCount),
      detail: "Picks with warning notes",
      icon: <AlertTriangle size={22} />,
    },
    {
      label: "Traded Picks",
      value: String(tradedPickCount),
      detail: "Acquired-from slots",
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
        const nextStatus = `Agent board applied: ${artifact.scenario?.label ?? "balanced baseline"} · ${importedTeams.length} teams · ${importedProspects.length} official prospects.`;

        if (cancelled) return;
        setTeamProfiles(importedTeams);
        setBoard(artifactBoard);
        setSelectedPickNumber(artifactBoard[0]?.pick ?? 1);
        setAgentMeta({
          label: artifact.scenario?.label ?? "balanced baseline",
          generatedBy: artifact.generatedBy ?? "A7 Board Simulation Agent",
          generatedAt: artifact.generatedAt ?? "",
        });
        setStatus(nextStatus);
      } catch {
        if (!cancelled) {
          setStatus("Agent board could not be loaded from public/data. Fallback seed board is active.");
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
    setStatus("Submission JSON exported.");
  };

  const exportBrief = () => {
    downloadText("draftops-brief.md", buildMarkdownBrief(board, milestones));
    setStatus("Markdown brief exported.");
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
            <span>2026 NBA Draft War Room</span>
          </div>
        </div>
        <nav className="command-nav" aria-label="Page sections">
          <a href="#board">Board</a>
          <a href="#milestones">Milestones</a>
          <a href="#aws">AWS</a>
        </nav>
        <div className="topbar-actions">
          <button className="button secondary" type="button" onClick={exportBrief} title="Export pitch brief">
            <FileInput size={18} />
            Brief
          </button>
          <button className="button primary" type="button" onClick={exportSubmission} title="Export submission JSON">
            <Download size={18} />
            Submission
          </button>
        </div>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyeline">
            <Clock3 size={18} />
            <span>{formatCountdown()}</span>
          </div>
          <h1>Official-data draft board, tuned by multi-agent debate.</h1>
          <p className="hero-status" aria-live="polite">
            {status}
          </p>
        </div>
        <div className="scenario-card">
          <span>Active scenario</span>
          <strong>{isAgentLoading ? "Loading" : agentMeta.label}</strong>
          <p>Agent-only board</p>
          <small>{agentMeta.generatedBy}</small>
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
              <span className="section-kicker">Round 1</span>
              <h2>Prediction Board</h2>
            </div>
            <div className="board-tools">
              <label className="search-box" htmlFor="board-search">
                <Search size={18} />
                <input
                  id="board-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search team, player, fit"
                />
              </label>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pick</th>
                  <th>Team</th>
                  <th>Player</th>
                  <th>Market</th>
                  <th>Fit</th>
                  <th>Confidence</th>
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
                      <strong>{pick.team}</strong>
                      {pick.acquiredFrom && <span>from {pick.acquiredFrom}</span>}
                    </td>
                    <td>
                      <strong>{pick.prospect.name}</strong>
                      <span>
                        {formatPositions(pick.prospect.positions)} · {pick.prospect.school}
                      </span>
                    </td>
                    <td>
                      <strong>#{pick.prospect.consensusRank}</strong>
                      <span>{pick.prospect.mockHeat}/100 heat</span>
                    </td>
                    <td>{pick.roleFit}</td>
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
                  <span className="section-kicker">Submission helpers</span>
                  <h2>Milestones</h2>
                </div>
              </div>
              <div className="milestone-grid">
                {milestones.map((milestone) => (
                  <article key={milestone.id} className="milestone">
                    <span>{milestone.type.replace("_", "/")}</span>
                    <h3>{milestone.prompt}</h3>
                    <strong>{milestone.answer}</strong>
                    <p>{milestone.evidence.slice(0, 2).map(hideAgentParameters).join(" · ")}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="aws" className="panel aws-panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">Architecture</span>
                  <h2>AWS Plan</h2>
                </div>
              </div>
              <div className="aws-rail">
                <div>
                  <Server size={22} />
                  <strong>App Runner / ECS</strong>
                  <span>Web API and static serving</span>
                </div>
                <div>
                  <Database size={22} />
                  <strong>S3 + DynamoDB</strong>
                  <span>Data files and board snapshots</span>
                </div>
                <div>
                  <BrainCircuit size={22} />
                  <strong>Bedrock</strong>
                  <span>Evidence summaries and Q&A</span>
                </div>
              </div>
              <div className="cost-bar">
                <span style={{ width: "32%" }} />
              </div>
              <p className="cost-note">$170 credit target: keep model calls batched and cache generated summaries.</p>
            </section>
          </section>

          <section id="brief" className="brief-band">
            <div>
              <span className="section-kicker">Roadshow</span>
              <h2>6-Minute Pitch Spine</h2>
              <p>
                Problem definition 40s · data 60s · scoring method 100s · demo 100s · AWS architecture 40s · final board
                20s.
              </p>
            </div>
            <div className="source-list">
              {sourceLinks.map((source) => (
                <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              ))}
            </div>
          </section>
        </div>

        <aside className="insight-rail" ref={insightRef}>
          <section className="panel pick-panel">
            <div className="pick-hero">
              <div>
                <span>Pick {selectedPick.pick}</span>
                <h2>{selectedPick.prospect.name}</h2>
                <p>{selectedPick.team}</p>
              </div>
              <strong>{selectedPick.score}</strong>
            </div>
            <p className="player-line">
              {selectedPositions} · {formatOptionalValue(selectedPick.prospect.height, "Height pending")} ·{" "}
              {formatWeight(selectedPick.prospect.weight)} · {formatOptionalValue(selectedPick.prospect.origin, "Origin pending")}
            </p>
            <div className="lock-note">Agent locked pick · human override disabled</div>
            <div className="profile-ribbon">
              <div>
                <span>Consensus</span>
                <strong>#{selectedPick.prospect.consensusRank}</strong>
              </div>
              <div>
                <span>Heat</span>
                <strong>{selectedPick.prospect.mockHeat}</strong>
              </div>
              <div>
                <span>Age</span>
                <strong>{selectedPick.prospect.age}</strong>
              </div>
              <div>
                <span>Margin</span>
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
                <span className="section-kicker">Why this pick</span>
                <h2>Evidence</h2>
              </div>
              <Activity size={22} />
            </div>
            <div className="breakdown">
              {Object.entries(selectedPick.breakdown).map(([key, value]) => (
                <div key={key}>
                  <span>{weightLabels[key as keyof Weights]}</span>
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
              <span>Risk notes</span>
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
                <span className="section-kicker">Team file</span>
                <h2>Fit Context</h2>
              </div>
              <BrainCircuit size={22} />
            </div>
            <div className="context-grid">
              <div>
                <span>Draft zone</span>
                <strong>{selectedPick.zone}</strong>
              </div>
              <div>
                <span>Team phase</span>
                <strong>{formatOptionalValue(selectedTeam?.phase, "agent inferred")}</strong>
              </div>
              <div>
                <span>Risk tolerance</span>
                <strong>{formatOptionalValue(selectedTeam?.riskTolerance, "agent pending")}</strong>
              </div>
              <div>
                <span>Trade slot</span>
                <strong>{tradeSlot}</strong>
              </div>
            </div>
            <div className="signal-section">
              <span>Team needs</span>
              <div className="tag-cloud compact">
                {teamNeeds.map((need) => (
                  <span key={need}>{need}</span>
                ))}
              </div>
            </div>
            <div className="signal-section">
              <span>Priority tags</span>
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
                <span className="section-kicker">Player file</span>
                <h2>Profile Signals</h2>
              </div>
              <Gauge size={22} />
            </div>
            <div className="profile-bars">
              {prospectProfile.map(([key, value]) => (
                <div className="profile-bar" key={key}>
                  <span>
                    {key} <strong>{value}</strong>
                  </span>
                  <div>
                    <i style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="signal-section">
              <span>Strengths</span>
              <ul className="compact-list">
                {strengthNotes.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </div>
            <div className="signal-section">
              <span>Source notes</span>
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
                <span className="section-kicker">Runner-up check</span>
                <h2>Alternatives</h2>
              </div>
              <TrendingUp size={22} />
            </div>
            <div className="candidate-list">
              {selectedPick.alternatives.length ? (
                selectedPick.alternatives.map((candidate, index) => (
                  <div className="candidate-row" key={candidate.prospectId}>
                    <strong>{index + 2}</strong>
                    <span>{candidate.name}</span>
                    <small>{candidate.roleFit}</small>
                    <b>{candidate.score}</b>
                  </div>
                ))
              ) : (
                <div className="candidate-empty">{NO_ALTERNATIVE_FALLBACK}</div>
              )}
            </div>
            <p className="context-note">
              Agent margin: {selectedPick.margin} points. Confidence: {selectedPick.confidence}%.
            </p>
          </section>

        </aside>
      </section>

    </main>
  );
}

export default App;
