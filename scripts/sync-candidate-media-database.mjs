import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

const rootDir = process.cwd();
const updatedAt = "2026-06-24T10:45:00+08:00";

const paths = {
  publicBundle: resolve(rootDir, "public", "data", "expanded_import_bundle.json"),
  finalExpandedBundle: resolve(rootDir, "data", "final", "expanded_import_bundle.json"),
  localPoolBundle: resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json"),
  finalBundle: resolve(rootDir, "data", "final", "final_import_bundle.json"),
  publicFinalBundle: resolve(rootDir, "public", "data", "final_import_bundle.json"),
  board: resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json"),
  mediaSource: resolve(rootDir, "data", "media", "prospect_media.json"),
  publicMedia: resolve(rootDir, "public", "data", "prospect_media.json"),
  officialProspects: resolve(rootDir, "data", "normalized", "normalized_2026_official_prospects_101.json"),
  mediaDir: resolve(rootDir, "public", "data", "media", "prospects"),
  reportJson: resolve(rootDir, "data", "reports", "candidate_media_database_sync_20260624.json"),
  reportMd: resolve(rootDir, "data", "reports", "candidate_media_database_sync_20260624.md"),
};

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const writeJson = async (filePath, value) => writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const normalizeKey = (value = "") =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const slugify = (value = "") => normalizeKey(value).replace(/\s+/g, "-");

const unique = (values) => [...new Set(values.filter(Boolean))];

const extensionFromContentType = (contentType, fallbackUrl) => {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/jpeg") || normalized.includes("image/jpg")) return "jpg";
  const extension = extname(new URL(fallbackUrl).pathname).replace(".", "").toLowerCase();
  return extension || "jpg";
};

const isLocalPhotoUrl = (value = "") => value.startsWith("/data/media/prospects/");
const publicFilePathFromUrl = (photoUrl) => resolve(rootDir, "public", photoUrl.replace(/^\//, ""));

const isUsableNbaProspectUrl = (value = "") => {
  if (!value.startsWith("https://www.nba.com/draft/2026/prospects/")) return false;
  const slug = new URL(value).pathname.split("/").filter(Boolean).at(-1) ?? "";
  return slug.length >= 4 && !slug.startsWith("local-pool-");
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const genericImagePatterns = [
  /nba-draft/i,
  /finals/i,
  /bracket/i,
  /logo/i,
  /desktop/i,
  /mobile/i,
  /placeholder/i,
];

const chooseProfileImage = (imageUrls, prospect) => {
  const nonGeneric = imageUrls.filter((url) => !genericImagePatterns.some((pattern) => pattern.test(url)));
  if (!nonGeneric.length) return null;

  const tokens = new Set(
    normalizeKey(`${prospect.id} ${prospect.name}`)
      .split(" ")
      .filter((token) => token.length > 1 && !["jr", "sr", "ii", "iii", "iv"].includes(token)),
  );

  const scored = nonGeneric.map((url, index) => {
    const fileTokens = normalizeKey(basename(new URL(url).pathname)).split(" ");
    const overlap = fileTokens.filter((token) => tokens.has(token)).length;
    const designPenalty = /untitled-design/i.test(url) ? 0.2 : 0;
    return { url, score: overlap - designPenalty - index / 1000 };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.url ?? null;
};

const extractProfileImage = async (sourceUrl, prospect) => {
  const response = await fetchWithTimeout(sourceUrl, { redirect: "follow" }, 12000);
  if (!response.ok) return { ok: false, reason: `${response.status} ${response.statusText}` };
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) return { ok: false, reason: `not html: ${contentType}` };

  const html = await response.text();
  const imageUrls = unique(
    [...html.matchAll(/https:\/\/cdn\.nba\.com\/manage\/2026\/[^"'\\\s<>]+?\.(?:jpg|jpeg|png|webp)/gi)].map((match) =>
      match[0].replace(/\\u002F/g, "/"),
    ),
  );
  const remotePhotoUrl = chooseProfileImage(imageUrls, prospect);
  if (!remotePhotoUrl) return { ok: false, reason: "no stable profile image found" };
  return { ok: true, remotePhotoUrl };
};

const downloadPhoto = async (remotePhotoUrl, prospectId) => {
  const response = await fetchWithTimeout(remotePhotoUrl, { redirect: "follow" }, 18000);
  if (!response.ok) throw new Error(`Could not download ${prospectId}: ${response.status} ${response.statusText}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Photo for ${prospectId} did not return an image content-type: ${contentType}`);
  }

  const extension = extensionFromContentType(contentType, remotePhotoUrl);
  const photoUrl = `/data/media/prospects/${prospectId}.${extension}`;
  await writeFile(publicFilePathFromUrl(photoUrl), Buffer.from(await response.arrayBuffer()));
  return photoUrl;
};

const normalizePublicMediaRow = (row) => ({
  id: row.id,
  name: row.name,
  ...(row.photoUrl ? { photoUrl: row.photoUrl } : {}),
  ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
  ...(row.sourceLabel ? { sourceLabel: row.sourceLabel } : {}),
  ...(row.provider ? { provider: row.provider } : {}),
  status: row.status,
  ...(row.remotePhotoUrl ? { remotePhotoUrl: row.remotePhotoUrl } : {}),
});

const normalizeSourceMediaRow = (row) => ({
  id: row.id,
  name: row.name,
  ...(row.remotePhotoUrl || row.photoUrl ? { photoUrl: row.remotePhotoUrl ?? row.photoUrl } : {}),
  ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
  ...(row.sourceLabel ? { sourceLabel: row.sourceLabel } : {}),
  ...(row.provider ? { provider: row.provider } : {}),
  status: row.status,
});

const mediaForProspect = (publicRow) => ({
  ...(publicRow.photoUrl ? { photoUrl: publicRow.photoUrl } : {}),
  ...(publicRow.remotePhotoUrl ? { remotePhotoUrl: publicRow.remotePhotoUrl } : {}),
  ...(publicRow.sourceUrl ? { sourceUrl: publicRow.sourceUrl } : {}),
  ...(publicRow.sourceLabel ? { sourceLabel: publicRow.sourceLabel } : {}),
  ...(publicRow.provider ? { provider: publicRow.provider } : {}),
  status: publicRow.status,
  updatedAt,
});

const applyMediaToProspects = (prospects, publicMediaById) =>
  prospects.map((prospect) => ({
    ...prospect,
    ...(publicMediaById.has(prospect.id) ? { media: mediaForProspect(publicMediaById.get(prospect.id)) } : {}),
  }));

const applyMediaToBundle = (bundle, publicMediaById, report) => {
  const prospects = Array.isArray(bundle.prospects) ? bundle.prospects : [];
  const nextProspects = applyMediaToProspects(prospects, publicMediaById);
  return {
    ...bundle,
    prospects: nextProspects,
    metadata: {
      ...(bundle.metadata ?? {}),
      media: {
        schemaVersion: "draftops.prospect_media.v1",
        updatedAt,
        sourceFile: "data/media/prospect_media.json",
        candidatePoolRows: report.candidatePoolRows,
        mediaRows: report.mediaRows,
        localPhotoRows: report.localPhotoRows,
        missingMediaRows: report.missingMediaRows,
        primaryRule: report.primaryRule,
      },
    },
  };
};

const applyMediaToBoard = (artifact, publicMediaById, report) => ({
  ...artifact,
  board: Array.isArray(artifact.board)
    ? artifact.board.map((pick) => ({
        ...pick,
        prospect:
          pick.prospect && publicMediaById.has(pick.prospect.id)
            ? { ...pick.prospect, media: mediaForProspect(publicMediaById.get(pick.prospect.id)) }
            : pick.prospect,
      }))
    : artifact.board,
  boardRows: Array.isArray(artifact.boardRows)
    ? artifact.boardRows.map((row) => ({
        ...row,
        media: publicMediaById.has(row.prospectId)
          ? {
              photoUrl: publicMediaById.get(row.prospectId).photoUrl,
              status: publicMediaById.get(row.prospectId).status,
            }
          : row.media,
      }))
    : artifact.boardRows,
  mediaMetadata: {
    ...(artifact.mediaMetadata ?? {}),
    schemaVersion: "draftops.prospect_media.v1",
    updatedAt,
    sourceFile: "data/media/prospect_media.json",
    candidatePoolRows: report.candidatePoolRows,
    mediaRows: report.mediaRows,
    localPhotoRows: report.localPhotoRows,
    missingMediaRows: report.missingMediaRows,
    primaryRule: report.primaryRule,
  },
});

const main = async () => {
  const [bundle, officialSource, sourceMedia, publicMedia] = await Promise.all([
    readJson(paths.publicBundle),
    readJson(paths.officialProspects),
    readJson(paths.mediaSource),
    readJson(paths.publicMedia),
  ]);

  const prospects = Array.isArray(bundle.prospects) ? bundle.prospects : [];
  if (!prospects.length) throw new Error("No prospects found in public/data/expanded_import_bundle.json.");

  await mkdir(paths.mediaDir, { recursive: true });
  await mkdir(dirname(paths.reportJson), { recursive: true });

  const officialByName = new Map((officialSource.prospects ?? []).map((prospect) => [normalizeKey(prospect.name), prospect]));
  const existingPublicById = new Map((publicMedia.players ?? []).map((row) => [row.id, row]));
  const discovered = [];
  const missing = [];
  const reused = [];

  const processProspect = async (prospect) => {
    const existing = existingPublicById.get(prospect.id);
    if (existing?.photoUrl && isLocalPhotoUrl(existing.photoUrl) && existsSync(publicFilePathFromUrl(existing.photoUrl))) {
      const row = {
        ...existing,
        name: prospect.name,
      };
      return { kind: "reused", prospect, publicRow: normalizePublicMediaRow(row), sourceRow: normalizeSourceMediaRow(row) };
    }

    const official = officialByName.get(normalizeKey(prospect.name));
    const nameSlug = slugify(prospect.name);
    const safeNameSlug = nameSlug.length >= 4 ? nameSlug : "";
    const candidateProfileUrls = unique([
      isUsableNbaProspectUrl(existing?.sourceUrl) ? existing.sourceUrl : null,
      official?.profileUrl,
      prospect.id.startsWith("local-pool-") ? null : `https://www.nba.com/draft/2026/prospects/${prospect.id}`,
      safeNameSlug ? `https://www.nba.com/draft/2026/prospects/${safeNameSlug}` : null,
    ]).filter(isUsableNbaProspectUrl);

    let resolved = null;
    const attempts = [];
    for (const sourceUrl of candidateProfileUrls) {
      try {
        const result = await extractProfileImage(sourceUrl, prospect);
        attempts.push({ sourceUrl, ...result });
        if (result.ok) {
          const photoUrl = await downloadPhoto(result.remotePhotoUrl, prospect.id);
          resolved = {
            id: prospect.id,
            name: prospect.name,
            photoUrl,
            sourceUrl,
            sourceLabel: "NBA.com 2026 Draft prospect profile",
            provider: "NBA.com",
            status: "verified",
            remotePhotoUrl: result.remotePhotoUrl,
          };
          break;
        }
      } catch (error) {
        attempts.push({ sourceUrl, ok: false, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    if (resolved) {
      return {
        kind: "discovered",
        prospect,
        publicRow: normalizePublicMediaRow(resolved),
        sourceRow: normalizeSourceMediaRow(resolved),
        discovered: { id: prospect.id, name: prospect.name, sourceUrl: resolved.sourceUrl, photoUrl: resolved.photoUrl },
      };
    }

    const missingRow = {
      id: prospect.id,
      name: prospect.name,
      ...(candidateProfileUrls[0] ? { sourceUrl: candidateProfileUrls[0] } : {}),
      sourceLabel: candidateProfileUrls[0]
        ? "NBA.com 2026 Draft prospect profile; no stable headshot extracted"
        : "Local candidate pool row; no verified headshot source",
      provider: candidateProfileUrls[0] ? "NBA.com" : "DraftOps",
      status: "missing",
    };
    return {
      kind: "missing",
      prospect,
      publicRow: normalizePublicMediaRow(missingRow),
      sourceRow: normalizeSourceMediaRow(missingRow),
      missing: { id: prospect.id, name: prospect.name, attempts },
    };
  };

  const results = [];
  let cursor = 0;
  let completed = 0;
  const workerCount = Math.min(8, prospects.length);
  const runWorker = async () => {
    while (cursor < prospects.length) {
      const index = cursor;
      cursor += 1;
      const result = await processProspect(prospects[index]);
      results[index] = result;
      completed += 1;
      console.error(`[media] ${String(completed).padStart(3, " ")}/${prospects.length} ${result.kind}: ${result.prospect.name}`);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, runWorker));

  const nextPublicRows = [];
  const nextSourceRows = [];
  for (const result of results) {
    nextPublicRows.push(result.publicRow);
    nextSourceRows.push(result.sourceRow);
    if (result.kind === "reused") reused.push(result.prospect.id);
    if (result.discovered) discovered.push(result.discovered);
    if (result.missing) missing.push(result.missing);
  }

  nextPublicRows.sort((left, right) => left.id.localeCompare(right.id));
  nextSourceRows.sort((left, right) => left.id.localeCompare(right.id));

  const primaryRule =
    "Use official NBA.com prospect pages first. Store every local candidate-pool player in the media database; if no stable headshot is extracted, keep a missing-status row instead of omitting media.";

  const nextPublicMedia = {
    ...publicMedia,
    schemaVersion: "draftops.prospect_media.v1",
    updatedAt,
    primaryRule,
    players: nextPublicRows,
  };
  const nextSourceMedia = {
    ...sourceMedia,
    schemaVersion: "draftops.prospect_media.v1",
    updatedAt,
    primaryRule,
    players: nextSourceRows,
  };

  const report = {
    generatedAt: updatedAt,
    primaryRule,
    candidatePoolRows: prospects.length,
    mediaRows: nextPublicRows.length,
    localPhotoRows: nextPublicRows.filter((row) => row.photoUrl && isLocalPhotoUrl(row.photoUrl)).length,
    verifiedRows: nextPublicRows.filter((row) => row.status === "verified").length,
    fallbackRows: nextPublicRows.filter((row) => row.status === "fallback").length,
    missingMediaRows: nextPublicRows.filter((row) => row.status === "missing").length,
    reusedRows: reused.length,
    discoveredRows: discovered.length,
    discovered,
    missing,
  };

  const publicMediaById = new Map(nextPublicRows.map((row) => [row.id, row]));

  await Promise.all([writeJson(paths.mediaSource, nextSourceMedia), writeJson(paths.publicMedia, nextPublicMedia)]);

  const bundlePaths = [
    paths.publicBundle,
    paths.finalExpandedBundle,
    paths.localPoolBundle,
    paths.finalBundle,
    paths.publicFinalBundle,
  ].filter((filePath) => existsSync(filePath));
  for (const filePath of bundlePaths) {
    await writeJson(filePath, applyMediaToBundle(await readJson(filePath), publicMediaById, report));
  }
  if (existsSync(paths.board)) {
    await writeJson(paths.board, applyMediaToBoard(await readJson(paths.board), publicMediaById, report));
  }

  await writeJson(paths.reportJson, report);
  await writeFile(
    paths.reportMd,
    [
      "# Candidate Media Database Sync",
      "",
      `- Generated at: ${updatedAt}`,
      `- Candidate pool rows: ${report.candidatePoolRows}`,
      `- Media database rows: ${report.mediaRows}`,
      `- Local photo rows: ${report.localPhotoRows}`,
      `- Reused existing rows: ${report.reusedRows}`,
      `- Newly discovered NBA.com photos: ${report.discoveredRows}`,
      `- Missing media rows retained in database: ${report.missingMediaRows}`,
      "",
      "## Rule",
      "",
      primaryRule,
      "",
      "## Newly Cached Photos",
      "",
      ...(discovered.length
        ? discovered.map((row) => `- ${row.name} (${row.id}) -> ${row.photoUrl}`)
        : ["- None"]),
      "",
      "## Missing Rows",
      "",
      ...(missing.length ? missing.map((row) => `- ${row.name} (${row.id})`) : ["- None"]),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
