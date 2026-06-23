import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const stamp = "20260624_relative";

const relativeBoardPath = resolve(rootDir, "data", "boards", `consensus_10_agent_prediction_${stamp}.json`);
const auditPath = resolve(rootDir, "data", "reports", `consensus_10_agent_prediction_audit_${stamp}.json`);
const bundlePath = resolve(rootDir, "public", "data", "expanded_import_bundle.json");
const frontendBoardPath = resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json");
const reportJsonPath = resolve(rootDir, "data", "reports", "frontend_relative_consensus_sync_20260624.json");
const reportMdPath = resolve(rootDir, "data", "reports", "frontend_relative_consensus_sync_20260624.md");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const average = (values) => {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
};

const getZone = (pick) => {
  if (pick <= 5) return "top-five";
  if (pick <= 14) return "lottery";
  return "late-first";
};

const isFallbackProspect = (prospect) => (prospect.risks ?? []).some((risk) => /fallback/i.test(risk));

const hasLocalPhoto = async (media) => {
  if (!media?.photoUrl) return false;
  const relativePath = media.photoUrl.replace(/^\/+/, "").replaceAll("/", "\\");
  try {
    await access(resolve(rootDir, "public", relativePath), constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const averageAgentComponent = (scoreRow, keys) =>
  round(
    average(
      (scoreRow?.agentScores ?? []).flatMap((agentScore) =>
        keys.map((key) => Number(agentScore.components?.[key])).filter(Number.isFinite),
      ),
    ),
  );

const topRelativeComponent = (scoreRow) => {
  const components = {};
  for (const agentScore of scoreRow?.agentScores ?? []) {
    for (const [key, value] of Object.entries(agentScore.components ?? {})) {
      components[key] = (components[key] ?? 0) + Number(value || 0);
    }
  }
  const entries = Object.entries(components).map(([key, value]) => [key, value / Math.max(1, scoreRow.agentScores?.length ?? 1)]);
  entries.sort((left, right) => right[1] - left[1]);
  return entries[0]?.[0] ?? "relative";
};

const roleFitForProspect = (prospect, scoreRow) => {
  const topComponent = topRelativeComponent(scoreRow);
  if (topComponent === "team") return prospect.roleTags?.[0] ?? "team fit";
  if (topComponent === "consensus") return "consensus value";
  if (topComponent === "upside") return "upside";
  if (topComponent === "risk") return "risk-adjusted";
  if (topComponent === "evidence") return "evidence-backed";
  if (topComponent === "board") return "history support";
  return prospect.roleTags?.[0] ?? topComponent;
};

const buildBreakdown = (scoreRow) => ({
  consensus: averageAgentComponent(scoreRow, ["consensus"]),
  need: averageAgentComponent(scoreRow, ["team"]),
  player: averageAgentComponent(scoreRow, ["profile", "feature"]),
  upside: averageAgentComponent(scoreRow, ["upside"]),
  intel: averageAgentComponent(scoreRow, ["board", "evidence", "scarcity", "international", "program"]),
});

const buildEvidence = ({ row, prospect, scoreRow, team }) => [
  `Relative 10-agent consensus: ${row.voteCount}/10 votes in round ${row.consensusRound}; relative score ${row.scoreExact}/100.`,
  `Every score was recomputed against ${team.team}'s current remaining candidate pool after prior picks were removed.`,
  `Relative margin over next available candidate: ${row.margin} points.`,
  `Team needs: ${(team.needs ?? []).join(", ") || "not specified"}.`,
  `Primary fit signal: ${roleFitForProspect(prospect, scoreRow)}.`,
  ...((prospect.sourceNotes ?? []).slice(0, 3)),
];

const main = async () => {
  const [relativeBoard, audit, bundle, previousFrontend] = await Promise.all([
    readJson(relativeBoardPath),
    readJson(auditPath),
    readJson(bundlePath),
    readJson(frontendBoardPath),
  ]);

  if (audit.status !== "pass") throw new Error(`Relative board audit status is ${audit.status}, expected pass.`);
  if (!relativeBoard.summary?.allPicksReachedThreshold) throw new Error("Relative board did not reach 7/10 threshold for every pick.");

  const prospectsById = new Map((bundle.prospects ?? []).map((prospect) => [prospect.id, prospect]));
  const teamsByPick = new Map((bundle.teams ?? []).map((team) => [Number(team.pick), team]));
  const previousByPick = new Map((previousFrontend.board ?? []).map((pick) => [Number(pick.pick), pick]));
  const pickAuditsByPick = new Map((relativeBoard.pickAudits ?? []).map((auditRow) => [Number(auditRow.pick), auditRow]));
  const board = [];
  const mediaRows = [];

  for (const row of relativeBoard.boardRows) {
    const pick = Number(row.pick);
    const prospect = prospectsById.get(row.prospectId);
    const team = teamsByPick.get(pick);
    const previousPick = previousByPick.get(pick);
    const pickAudit = pickAuditsByPick.get(pick);
    const scoreRow = pickAudit?.allScores?.find((candidate) => candidate.prospectId === row.prospectId);
    if (!prospect) throw new Error(`Prospect not found in frontend bundle: ${row.prospectId}`);
    if (!team) throw new Error(`Team not found in frontend bundle for pick ${pick}`);

    const localPhotoExists = await hasLocalPhoto(prospect.media);
    mediaRows.push({
      pick,
      prospectId: prospect.id,
      player: prospect.name,
      photoUrl: prospect.media?.photoUrl ?? null,
      mediaStatus: prospect.media?.status ?? "missing",
      localPhotoExists,
    });

    const breakdown = buildBreakdown(scoreRow);
    const alternatives = (pickAudit?.allScores ?? [])
      .filter((candidate) => candidate.prospectId !== row.prospectId)
      .slice(0, 3)
      .map((candidate) => {
        const alternativeProspect = prospectsById.get(candidate.prospectId);
        return {
          prospectId: candidate.prospectId,
          name: candidate.player,
          score: round(candidate.averageScore),
          roleFit: alternativeProspect ? roleFitForProspect(alternativeProspect, candidate) : "relative runner-up",
        };
      });
    const warnings = [
      ...(row.voteCount < 8 ? ["Consensus reached the minimum threshold only; keep under review."] : []),
      ...(row.consensusRound > 1 ? ["Selection required a debate/concession round before reaching threshold."] : []),
      ...(isFallbackProspect(prospect) ? ["Expanded-pool fallback profile; source coverage is thinner than seeded profiles."] : []),
      ...(!prospect.media?.photoUrl ? ["No verified local player photo; frontend will use generated initials placeholder."] : []),
      ...(prospect.media?.photoUrl && !localPhotoExists ? ["Player photo path is present but local file was not found."] : []),
    ];

    board.push({
      pick,
      team: row.team,
      acquiredFrom: previousPick?.acquiredFrom ?? null,
      prospect,
      score: round(row.scoreExact),
      confidence: Math.round(row.confidence),
      margin: round(row.margin),
      zone: getZone(pick),
      effectiveWeights: {
        consensus: 0,
        need: 0,
        player: 0,
        upside: 0,
        intel: 0,
      },
      roleFit: roleFitForProspect(prospect, scoreRow),
      breakdown,
      alternatives,
      evidence: buildEvidence({ row, prospect, scoreRow, team }),
      warnings,
    });
  }

  const boardRows = board.map((pick) => ({
    pick: pick.pick,
    team: pick.team,
    acquiredFrom: pick.acquiredFrom,
    player: pick.prospect.name,
    prospectId: pick.prospect.id,
    localNameZh: pick.prospect.localPool?.nameZh ?? null,
    localOrdinal: pick.prospect.localPool?.ordinal ?? null,
    school: pick.prospect.school,
    origin: pick.prospect.origin,
    position: pick.prospect.positions.join("/"),
    consensusRank: pick.prospect.consensusRank,
    score: pick.score,
    confidence: pick.confidence,
    margin: pick.margin,
    voteCount: relativeBoard.boardRows.find((row) => row.pick === pick.pick)?.voteCount ?? null,
    consensusRound: relativeBoard.boardRows.find((row) => row.pick === pick.pick)?.consensusRound ?? null,
    fallbackProfile: isFallbackProspect(pick.prospect),
    matchStatus: pick.prospect.localPool?.matchStatus ?? null,
    warnings: pick.warnings,
    alternatives: pick.alternatives,
    breakdown: pick.breakdown,
    media: {
      photoUrl: pick.prospect.media?.photoUrl ?? null,
      status: pick.prospect.media?.status ?? "missing",
    },
  }));

  const previousRowsByPick = new Map((previousFrontend.boardRows ?? []).map((row) => [Number(row.pick), row]));
  const changedVsPrevious = boardRows
    .filter((row) => previousRowsByPick.get(row.pick)?.prospectId !== row.prospectId)
    .map((row) => ({
      pick: row.pick,
      team: row.team,
      previous: previousRowsByPick.get(row.pick)?.player ?? null,
      next: row.player,
      prospectId: row.prospectId,
    }));
  const lowConfidence = boardRows.filter((row) => row.confidence < 70);
  const narrowMargins = boardRows.filter((row) => row.voteCount < 8 || row.consensusRound > 1);
  const fallbackPicks = boardRows.filter((row) => row.fallbackProfile);
  const missingMedia = mediaRows.filter((row) => !row.photoUrl || !row.localPhotoExists);
  const localPhotoCount = mediaRows.filter((row) => row.photoUrl && row.localPhotoExists).length;

  const artifact = {
    schemaVersion: "draftops.expanded_recommended_board.relative.v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/sync-relative-consensus-to-frontend.mjs",
    method:
      "Frontend board synced from consensus_10_agent_prediction_20260624_relative.json. Picks are selected by per-team relative scoring over the current remaining candidate pool, not by global absolute scores.",
    inputFiles: [
      "data/boards/consensus_10_agent_prediction_20260624_relative.json",
      "data/reports/consensus_10_agent_prediction_audit_20260624_relative.json",
      "public/data/expanded_import_bundle.json",
    ],
    candidatePool: {
      uniqueCandidates: bundle.prospects?.length ?? 0,
      noManualOverride: true,
      scoringMode: "relative-within-current-team-and-remaining-candidate-pool",
    },
    scenario: {
      id: "consensus-10-agent-relative",
      label: "10-agent relative consensus",
      weights: {
        consensus: 0,
        need: 0,
        player: 0,
        upside: 0,
        intel: 0,
      },
      whenToUse: "Use when each team's board should be recomputed relative to the remaining candidate pool after prior selections.",
      risk: "Late picks with missing player photos or fallback profiles require visual/source review.",
      expectedImpactRange: "1-30",
    },
    health: {
      hasThirtyPicks: board.length === 30,
      noDuplicates: new Set(board.map((pick) => pick.prospect.id)).size === board.length,
      lowConfidence: lowConfidence.length,
      missingLocalPhotos: missingMedia.length,
      ready: board.length === 30 && new Set(board.map((pick) => pick.prospect.id)).size === board.length,
    },
    summary: {
      pickCount: board.length,
      uniqueProspects: new Set(board.map((pick) => pick.prospect.id)).size,
      averageConfidence: Math.round(average(board.map((pick) => pick.confidence))),
      averageScore: Math.round(average(board.map((pick) => pick.score))),
      lowConfidence,
      narrowMargins,
      fallbackPicks,
      changedVsPrevious,
      media: {
        localPhotoCount,
        missingLocalPhotoCount: missingMedia.length,
        missingMedia,
      },
      relativeRun: relativeBoard.summary,
    },
    board,
    boardRows,
    audit: {
      sourceAuditPath: "data/reports/consensus_10_agent_prediction_audit_20260624_relative.json",
      status: audit.status,
      failures: audit.failures ?? [],
      allPicksReachedThreshold: relativeBoard.summary?.allPicksReachedThreshold,
      totalCandidateReviews: relativeBoard.summary?.totalCandidateReviews,
    },
    mediaMetadata: {
      matchedProspects: localPhotoCount,
      missingMedia,
      note: "Missing photo rows intentionally render via PlayerPhoto initials fallback instead of broken image links.",
    },
    noManualOverride: true,
    revisions: [
      ...(previousFrontend.revisions ?? []),
      {
        generatedAt: new Date().toISOString(),
        type: "frontend-board-sync",
        source: "data/boards/consensus_10_agent_prediction_20260624_relative.json",
        note: "Synced frontend board to the relative-score 10-agent consensus run; preserved prospect media from expanded_import_bundle where available.",
      },
    ],
  };

  await writeFile(frontendBoardPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await mkdir(dirname(reportJsonPath), { recursive: true });
  await writeFile(
    reportJsonPath,
    `${JSON.stringify(
      {
        generatedAt: artifact.generatedAt,
        frontendBoardPath,
        source: relativeBoardPath,
        changedVsPrevious,
        media: artifact.summary.media,
        health: artifact.health,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    reportMdPath,
    [
      "# Frontend Relative Consensus Sync",
      "",
      `Generated: ${artifact.generatedAt}`,
      "",
      "## Result",
      "",
      `- Frontend board: public/data/agent_expanded_recommended_board.json`,
      `- Source board: data/boards/consensus_10_agent_prediction_20260624_relative.json`,
      `- Picks: ${artifact.summary.pickCount}`,
      `- Unique prospects: ${artifact.summary.uniqueProspects}`,
      `- Changed slots vs previous frontend board: ${changedVsPrevious.length}`,
      `- Local photos available: ${localPhotoCount}/30`,
      `- Missing local photos: ${missingMedia.length}`,
      "",
      "## Missing Photos",
      "",
      ...(missingMedia.length
        ? missingMedia.map((row) => `- Pick ${row.pick}: ${row.player} (${row.prospectId})`)
        : ["- None"]),
      "",
      "## Changed Slots",
      "",
      ...(changedVsPrevious.length
        ? changedVsPrevious.map((row) => `- ${row.pick}: ${row.previous} -> ${row.next}`)
        : ["- None"]),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        frontendBoardPath,
        picks: artifact.summary.pickCount,
        uniqueProspects: artifact.summary.uniqueProspects,
        changedVsPrevious: changedVsPrevious.length,
        localPhotos: `${localPhotoCount}/30`,
        missingMedia,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
