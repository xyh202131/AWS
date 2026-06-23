import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const paths = {
  media: path.join(rootDir, "data", "media", "prospect_media.json"),
  publicMedia: path.join(rootDir, "public", "data", "prospect_media.json"),
  cacheDir: path.join(rootDir, "public", "data", "media", "prospects"),
  bundles: [
    path.join(rootDir, "data", "final", "final_import_bundle.json"),
    path.join(rootDir, "public", "data", "final_import_bundle.json"),
    path.join(rootDir, "data", "final", "expanded_import_bundle.json"),
    path.join(rootDir, "public", "data", "expanded_import_bundle.json"),
  ],
  boards: [
    path.join(rootDir, "data", "boards", "board_balanced_parameter_test.json"),
    path.join(rootDir, "data", "boards", "board_expanded_101_baseline.json"),
    path.join(rootDir, "public", "data", "agent_balanced_board.json"),
    path.join(rootDir, "public", "data", "agent_expanded_board.json"),
    path.join(rootDir, "public", "data", "agent_expanded_recommended_board.json"),
  ],
  report: path.join(rootDir, "data", "reports", "prospect_media_import_report.md"),
};

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const writeJson = async (filePath, value) => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const normalizeMedia = (mediaEntry, updatedAt) => ({
  photoUrl: mediaEntry.photoUrl,
  remotePhotoUrl: mediaEntry.remotePhotoUrl,
  sourceUrl: mediaEntry.sourceUrl,
  sourceLabel: mediaEntry.sourceLabel,
  provider: mediaEntry.provider,
  status: mediaEntry.status,
  updatedAt,
});

const extensionFromContentType = (contentType, fallbackUrl) => {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/jpeg") || normalized.includes("image/jpg")) return "jpg";

  const extension = path.extname(new URL(fallbackUrl).pathname).replace(".", "").toLowerCase();
  return extension || "jpg";
};

const cachePhoto = async (mediaEntry) => {
  const response = await fetch(mediaEntry.photoUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Could not download ${mediaEntry.id} photo: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Photo URL for ${mediaEntry.id} did not return an image content-type: ${contentType}`);
  }

  const extension = extensionFromContentType(contentType, mediaEntry.photoUrl);
  const fileName = `${mediaEntry.id}.${extension}`;
  const publicPath = `/data/media/prospects/${fileName}`;
  const targetPath = path.join(paths.cacheDir, fileName);
  const bytes = Buffer.from(await response.arrayBuffer());

  await writeFile(targetPath, bytes);

  return {
    ...mediaEntry,
    remotePhotoUrl: mediaEntry.photoUrl,
    photoUrl: publicPath,
  };
};

const applyToProspects = (prospects, mediaById, updatedAt) => {
  const missing = [];
  const matched = prospects.map((prospect) => {
    const media = mediaById.get(prospect.id);
    if (!media) {
      missing.push({ id: prospect.id, name: prospect.name });
      return prospect;
    }

    return {
      ...prospect,
      media: normalizeMedia(media, updatedAt),
    };
  });

  return { prospects: matched, missing };
};

const applyToBundle = (bundle, mediaById, mediaSource) => {
  const prospects = Array.isArray(bundle.prospects) ? bundle.prospects : [];
  const result = applyToProspects(prospects, mediaById, mediaSource.updatedAt);

  return {
    ...bundle,
    prospects: result.prospects,
    metadata: {
      ...(bundle.metadata ?? {}),
      media: {
        schemaVersion: mediaSource.schemaVersion,
        updatedAt: mediaSource.updatedAt,
        sourceFile: "data/media/prospect_media.json",
        matchedProspects: result.prospects.length - result.missing.length,
        missingMedia: result.missing,
        primaryRule: mediaSource.primaryRule,
      },
    },
  };
};

const applyToBoard = (artifact, mediaById, mediaSource) => {
  const board = Array.isArray(artifact.board) ? artifact.board : [];
  const missing = [];
  const nextBoard = board.map((pick) => {
    const prospect = pick.prospect;
    const media = prospect ? mediaById.get(prospect.id) : undefined;
    if (!media) {
      if (prospect) missing.push({ id: prospect.id, name: prospect.name, pick: pick.pick });
      return pick;
    }

    return {
      ...pick,
      prospect: {
        ...prospect,
        media: normalizeMedia(media, mediaSource.updatedAt),
      },
    };
  });

  return {
    ...artifact,
    board: nextBoard,
    mediaMetadata: {
      schemaVersion: mediaSource.schemaVersion,
      updatedAt: mediaSource.updatedAt,
      sourceFile: "data/media/prospect_media.json",
      matchedProspects: nextBoard.length - missing.length,
      missingMedia: missing,
      primaryRule: mediaSource.primaryRule,
    },
  };
};

const mediaSource = await readJson(paths.media);
const players = Array.isArray(mediaSource.players) ? mediaSource.players : [];

if (!players.length) {
  throw new Error("No player media rows found in data/media/prospect_media.json.");
}

const duplicateIds = players
  .map((player) => player.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);

if (duplicateIds.length) {
  throw new Error(`Duplicate player media ids: ${[...new Set(duplicateIds)].join(", ")}`);
}

await mkdir(paths.cacheDir, { recursive: true });
const cachedPlayers = await Promise.all(players.map((player) => cachePhoto(player)));
const publicMediaSource = {
  ...mediaSource,
  players: cachedPlayers,
};
const mediaById = new Map(cachedPlayers.map((player) => [player.id, player]));

const bundleResults = await Promise.all(
  paths.bundles.filter((filePath) => existsSync(filePath)).map(async (filePath) => ({
    filePath,
    artifact: applyToBundle(await readJson(filePath), mediaById, publicMediaSource),
  })),
);
const boardResults = await Promise.all(
  paths.boards.filter((filePath) => existsSync(filePath)).map(async (filePath) => ({
    filePath,
    artifact: applyToBoard(await readJson(filePath), mediaById, publicMediaSource),
  })),
);

await mkdir(path.dirname(paths.publicMedia), { recursive: true });
await writeJson(paths.publicMedia, publicMediaSource);
await Promise.all([
  ...bundleResults.map(({ filePath, artifact }) => writeJson(filePath, artifact)),
  ...boardResults.map(({ filePath, artifact }) => writeJson(filePath, artifact)),
]);

const allMissing = [
  ...bundleResults.flatMap(({ artifact }) => artifact.metadata.media.missingMedia ?? []),
  ...boardResults.flatMap(({ artifact }) => artifact.mediaMetadata.missingMedia ?? []),
];
const verifiedCount = players.filter((player) => player.status === "verified").length;
const fallbackCount = players.filter((player) => player.status === "fallback").length;
const updatedFiles = [
  ...bundleResults.map(({ filePath }) => path.relative(rootDir, filePath).replaceAll("\\", "/")),
  ...boardResults.map(({ filePath }) => path.relative(rootDir, filePath).replaceAll("\\", "/")),
];

await writeFile(
  paths.report,
  [
    "# Prospect Media Import Report",
    "",
    `- Updated at: ${mediaSource.updatedAt}`,
    `- Media rows: ${players.length}`,
    `- NBA.com verified rows: ${verifiedCount}`,
    `- Official fallback rows: ${fallbackCount}`,
    `- Missing rows after import: ${allMissing.length}`,
    `- Cached static image files: ${cachedPlayers.length}`,
    "",
    "## Source Rule",
    "",
    mediaSource.primaryRule,
    "",
    "## Files Updated",
    "",
    ...updatedFiles.map((filePath) => `- ${filePath}`),
    "- public/data/prospect_media.json",
    "- public/data/media/prospects/*.jpg|*.png|*.webp",
    "",
  ].join("\n"),
  "utf8",
);

console.log(
  `Imported ${players.length} prospect media rows: ${verifiedCount} NBA.com verified, ${fallbackCount} official fallback, ${allMissing.length} missing, ${cachedPlayers.length} cached images.`,
);
