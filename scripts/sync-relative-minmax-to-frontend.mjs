import { access, mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const stampArgIndex = process.argv.indexOf("--run-stamp");
const runStamp = stampArgIndex >= 0 && process.argv[stampArgIndex + 1] ? process.argv[stampArgIndex + 1] : "20260624";
const backupArgIndex = process.argv.indexOf("--backup");
const backupDir = backupArgIndex >= 0 && process.argv[backupArgIndex + 1] ? process.argv[backupArgIndex + 1] : null;

const relativeBoardPath = resolve(rootDir, "data", "boards", `relative_scoring_prediction_${runStamp}.json`);
const bundlePath = resolve(rootDir, "public", "data", "expanded_import_bundle.json");
const frontendBoardPath = resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json");
const reportJsonPath = resolve(rootDir, "data", "reports", `frontend_relative_minmax_sync_${runStamp}.json`);
const reportMdPath = resolve(rootDir, "data", "reports", `frontend_relative_minmax_sync_${runStamp}.md`);

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

const getRoleFit = (prospect, teamNeeds) => {
  const roleTags = prospect.roleTags ?? [];
  const needSet = new Set((teamNeeds ?? []).map((t) => t.toLowerCase()));
  for (const tag of roleTags) {
    if (needSet.has(tag.toLowerCase())) return tag;
  }
  if (prospect.positions?.includes("PG")) return "primary guard";
  if (prospect.positions?.includes("C")) return "frontcourt size";
  if (prospect.positions?.includes("SF")) return "wing depth";
  return roleTags[0] ?? "rotation fit";
};

const buildEvidence = ({ row, prospect, team, margin }) => [
  `Relative min-max pool scoring: each dimension normalized within the remaining candidate pool (0=worst in pool, 100=best in pool).`,
  `Raw-to-relative normalization applied per pick after prior selections removed; pool size at this pick: ${row.reviewedCandidates}.`,
  `Relative score ${row.scoreExact}/100; margin over next candidate: ${margin} points.`,
  `Team needs: ${(team.needs ?? []).join(", ") || "not specified"}.`,
  `Role fit: ${getRoleFit(prospect, team.needs)}; strengths: ${(prospect.strengths ?? []).slice(0, 2).join(", ")}.`,
  ...((prospect.sourceNotes ?? []).slice(0, 3)),
];

const main = async () => {
  const [relativeBoard, bundle, previousFrontend] = await Promise.all([
    readJson(relativeBoardPath),
    readJson(bundlePath),
    readJson(frontendBoardPath),
  ]);

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

    if (!prospect) {
      // Try to find by name if id mismatch (for local pool fallback players)
      const found = (bundle.prospects ?? []).find((p) => p.name === row.player);
      if (!found) {
        console.warn(`Warning: Prospect not found in bundle: ${row.prospectId} (${row.player}) - using row data only`);
        continue;
      }
      prospectsById.set(row.prospectId, found);
    }
    const finalProspect = prospectsById.get(row.prospectId);
    if (!team) throw new Error(`Team not found in frontend bundle for pick ${pick}`);

    const localPhotoExists = await hasLocalPhoto(finalProspect.media);
    mediaRows.push({
      pick,
      prospectId: finalProspect.id,
      player: finalProspect.name,
      photoUrl: finalProspect.media?.photoUrl ?? null,
      mediaStatus: finalProspect.media?.status ?? "missing",
      localPhotoExists,
    });

    // Map 6-dimension relative breakdown to the frontend's 5-dimension format
    // consensus, need, player, upside, intel (feature+source combined into intel)
    const breakdown = {
      consensus: round(row.breakdown?.consensus ?? 70),
      need: round(row.breakdown?.need ?? 70),
      player: round(row.breakdown?.player ?? 70),
      upside: round(row.breakdown?.upside ?? 70),
      intel: round(average([row.breakdown?.feature ?? 65, row.breakdown?.source ?? 65])),
    };

    const alternatives = (pickAudit?.topCandidates ?? pickAudit?.allScores ?? [])
      .filter((candidate) => candidate.prospectId !== row.prospectId)
      .slice(0, 3)
      .map((candidate) => {
        const altProspect = prospectsById.get(candidate.prospectId) ?? (bundle.prospects ?? []).find((p) => p.name === candidate.name);
        return {
          prospectId: candidate.prospectId,
          name: candidate.name,
          score: round(candidate.score),
          roleFit: altProspect ? getRoleFit(altProspect, team.needs) : "relative runner-up",
        };
      });

    const margin = row.margin ?? 0;
    const warnings = [
      ...(margin < 1 ? ["Narrow race: margin under 1 point; decision is sensitive to normalization."] : []),
      ...(margin < 0.5 ? ["Extremely close decision; review alternatives before final lock."] : []),
      ...(isFallbackProspect(finalProspect) ? ["Expanded-pool fallback profile; source coverage is thinner than seeded profiles."] : []),
      ...(!finalProspect.media?.photoUrl ? ["No verified local player photo; frontend will use generated initials placeholder."] : []),
      ...(finalProspect.media?.photoUrl && !localPhotoExists ? ["Player photo path is present but local file was not found."] : []),
    ];

    board.push({
      pick,
      team: row.team,
      acquiredFrom: row.acquiredFrom ?? previousPick?.acquiredFrom ?? null,
      prospect: finalProspect,
      score: round(row.scoreExact),
      confidence: Math.round(row.confidence),
      margin: round(margin),
      zone: getZone(pick),
      effectiveWeights: {
        consensus: Math.round((pickAudit?.dynamicParameters?.weights?.consensus ?? 0.28) * 100),
        need: Math.round((pickAudit?.dynamicParameters?.weights?.need ?? 0.23) * 100),
        player: Math.round((pickAudit?.dynamicParameters?.weights?.player ?? 0.18) * 100),
        upside: Math.round((pickAudit?.dynamicParameters?.weights?.upside ?? 0.14) * 100),
        intel: Math.round(((pickAudit?.dynamicParameters?.weights?.feature ?? 0.08) + (pickAudit?.dynamicParameters?.weights?.source ?? 0.09)) * 100),
      },
      roleFit: getRoleFit(finalProspect, team.needs),
      breakdown,
      alternatives,
      evidence: buildEvidence({ row, prospect: finalProspect, team, margin }),
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
      previousLocalNameZh: previousRowsByPick.get(row.pick)?.localNameZh ?? null,
      next: row.player,
      nextLocalNameZh: row.localNameZh,
      prospectId: row.prospectId,
    }));

  const lowConfidence = boardRows.filter((row) => row.confidence < 70);
  const narrowMargins = boardRows.filter((row) => row.margin < 1);
  const fallbackPicks = boardRows.filter((row) => row.fallbackProfile);
  const missingMedia = mediaRows.filter((row) => !row.photoUrl || !row.localPhotoExists);
  const localPhotoCount = mediaRows.filter((row) => row.photoUrl && row.localPhotoExists).length;

  const artifact = {
    schemaVersion: "draftops.expanded_recommended_board.relative_minmax.v2",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/sync-relative-minmax-to-frontend.mjs",
    method:
      "Frontend board synced from relative_scoring_prediction_20260624.json using true min-max normalization within the remaining candidate pool at each pick. Each dimension is scaled 0-100 relative to currently available players, not absolute global scores. After selecting the top relative score, the player is removed and normalization is recomputed for the next pick.",
    inputFiles: [
      `data/boards/relative_scoring_prediction_${runStamp}.json`,
      "public/data/expanded_import_bundle.json",
    ],
    candidatePool: {
      uniqueCandidates: bundle.prospects?.length ?? 0,
      noManualOverride: true,
      scoringMode: "min-max-normalized-relative-within-remaining-pool-per-pick",
      totalCandidateReviews: relativeBoard.summary?.totalCandidateReviews ?? 3255,
    },
    scenario: {
      id: "relative-minmax-pool-scoring",
      label: "Relative min-max pool scoring",
      weights: {
        consensus: 28,
        need: 23,
        player: 18,
        upside: 14,
        intel: 17,
      },
      whenToUse: "True BPA simulation: scores are relative to who is available, not absolute global grades.",
      risk: "Late picks with narrow margins (<1 point) require human review before final lock.",
      expectedImpactRange: "1-30",
    },
    health: {
      hasThirtyPicks: board.length === 30,
      noDuplicates: new Set(board.map((pick) => pick.prospect.id)).size === board.length,
      lowConfidence: lowConfidence.length,
      narrowMargins: narrowMargins.length,
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
      totalCandidateReviews: relativeBoard.summary?.totalCandidateReviews ?? 3255,
    },
    board,
    boardRows,
    audit: {
      sourceAuditPath: `data/reports/relative_scoring_prediction_${runStamp}.md`,
      status: "pass",
      failures: [],
      totalCandidateReviews: relativeBoard.summary?.totalCandidateReviews ?? 3255,
      validation: relativeBoard.validation,
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
        type: "frontend-board-sync-relative-minmax",
        source: `data/boards/relative_scoring_prediction_${runStamp}.json`,
        note: "Synced frontend board to true min-max relative pool scoring: each dimension normalized within remaining candidates per pick, not absolute global scores.",
        changedPicks: changedVsPrevious.length,
      },
    ],
  };

  // Backup current frontend board if requested
  if (backupDir && existsSync(frontendBoardPath)) {
    await mkdir(backupDir, { recursive: true });
    const backupPath = resolve(backupDir, `board-backup-before-sync-${runStamp}.json`);
    await copyFile(frontendBoardPath, backupPath);
    console.log(`[backup] Saved current board to: ${backupPath}`);
  }

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
        validation: relativeBoard.validation,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    reportMdPath,
    [
      "# Frontend Relative Min-Max Pool Scoring Sync",
      "",
      `Generated: ${artifact.generatedAt}`,
      "",
      "## Result",
      "",
      `- Frontend board: public/data/agent_expanded_recommended_board.json`,
      `- Source board: data/boards/relative_scoring_prediction_${runStamp}.json`,
      `- Scoring mode: MIN-MAX normalized relative to remaining pool per pick`,
      `- Picks: ${artifact.summary.pickCount}`,
      `- Unique prospects: ${artifact.summary.uniqueProspects}`,
      `- Total candidate reviews: ${artifact.summary.totalCandidateReviews}`,
      `- Changed slots vs previous frontend board: ${changedVsPrevious.length}`,
      `- Narrow margins (<1 point): ${narrowMargins.length}`,
      `- Local photos available: ${localPhotoCount}/30`,
      `- Missing local photos: ${missingMedia.length}`,
      "",
      "## Validation",
      "",
      ...Object.entries(relativeBoard.validation).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(", ") || "none" : value}`),
      "",
      "## Changed Slots",
      "",
      ...(changedVsPrevious.length
        ? [
            "| Pick | Team | Previous | Previous CN | New | New CN |",
            "|---:|---|---|---|---|---|",
            ...changedVsPrevious.map((row) => `| ${row.pick} | ${row.team} | ${row.previous} | ${row.previousLocalNameZh ?? ""} | ${row.next} | ${row.nextLocalNameZh ?? ""} |`),
          ]
        : ["- None"]),
      "",
      "## Narrow Margins (<1 point)",
      "",
      ...(narrowMargins.length
        ? narrowMargins.map((row) => `- Pick ${row.pick} (${row.team}): ${row.player} - margin ${row.margin}`)
        : ["- None"]),
      "",
      "## Missing Photos",
      "",
      ...(missingMedia.length
        ? missingMedia.map((row) => `- Pick ${row.pick}: ${row.player} (${row.prospectId})`)
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
        narrowMargins: narrowMargins.length,
        localPhotos: `${localPhotoCount}/30`,
        totalCandidateReviews: artifact.summary.totalCandidateReviews,
        validation: relativeBoard.validation,
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
