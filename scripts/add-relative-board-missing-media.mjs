import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = process.cwd();
const updatedAt = "2026-06-24T02:55:00+08:00";

const mediaRows = [
  {
    id: "malachi-moreno",
    name: "Malachi Moreno",
    photoUrl: "https://cdn.nba.com/manage/2026/05/Moreno-Malachi.jpg",
    localPhotoUrl: "/data/media/prospects/malachi-moreno.jpg",
    sourceUrl: "https://www.nba.com/draft/2026/prospects/malachi-moreno",
    sourceLabel: "NBA.com 2026 Draft prospect profile",
    provider: "NBA.com",
    status: "verified",
  },
  {
    id: "jack-kayil",
    name: "Jack Kayil",
    photoUrl: "https://cdn.nba.com/manage/2026/06/Jack-Kayil.jpg",
    localPhotoUrl: "/data/media/prospects/jack-kayil.jpg",
    sourceUrl: "https://www.nba.com/draft/2026/prospects/jack-kayil",
    sourceLabel: "NBA.com 2026 Draft prospect profile",
    provider: "NBA.com",
    status: "verified",
  },
];

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const upsertMediaRows = (mediaSource, isPublic) => {
  const existing = new Map((mediaSource.players ?? []).map((player) => [player.id, player]));
  for (const row of mediaRows) {
    existing.set(row.id, {
      id: row.id,
      name: row.name,
      photoUrl: isPublic ? row.localPhotoUrl : row.photoUrl,
      sourceUrl: row.sourceUrl,
      sourceLabel: row.sourceLabel,
      provider: row.provider,
      status: row.status,
      ...(isPublic ? { remotePhotoUrl: row.photoUrl } : {}),
    });
  }
  return {
    ...mediaSource,
    updatedAt,
    players: [...existing.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
};

const downloadPhoto = async (row) => {
  const response = await fetch(row.photoUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`Could not download ${row.id}: ${response.status} ${response.statusText}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Photo for ${row.id} did not return image content-type: ${contentType}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(resolve(rootDir, "public", row.localPhotoUrl.replace(/^\//, "")), bytes);
};

const applyPublicMediaToProspects = (artifact, publicMediaById) => {
  if (Array.isArray(artifact.prospects)) {
    return {
      ...artifact,
      prospects: artifact.prospects.map((prospect) => ({
        ...prospect,
        ...(publicMediaById.has(prospect.id) ? { media: { ...publicMediaById.get(prospect.id), updatedAt } } : {}),
      })),
      metadata: {
        ...(artifact.metadata ?? {}),
        media: {
          ...((artifact.metadata ?? {}).media ?? {}),
          updatedAt,
          matchedProspects: artifact.prospects.filter((prospect) => publicMediaById.has(prospect.id)).length,
        },
      },
    };
  }
  if (Array.isArray(artifact.board)) {
    return {
      ...artifact,
      board: artifact.board.map((pick) => ({
        ...pick,
        prospect:
          pick.prospect && publicMediaById.has(pick.prospect.id)
            ? { ...pick.prospect, media: { ...publicMediaById.get(pick.prospect.id), updatedAt } }
            : pick.prospect,
      })),
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
        updatedAt,
      },
    };
  }
  return artifact;
};

const main = async () => {
  const paths = {
    sourceMedia: resolve(rootDir, "data", "media", "prospect_media.json"),
    publicMedia: resolve(rootDir, "public", "data", "prospect_media.json"),
    publicBundle: resolve(rootDir, "public", "data", "expanded_import_bundle.json"),
    finalBundle: resolve(rootDir, "data", "final", "expanded_import_bundle.json"),
    localBundle: resolve(rootDir, "data", "final", "local_pool_124_import_bundle.json"),
    frontendBoard: resolve(rootDir, "public", "data", "agent_expanded_recommended_board.json"),
  };

  await mkdir(resolve(rootDir, "public", "data", "media", "prospects"), { recursive: true });
  await Promise.all(mediaRows.map(downloadPhoto));

  const [sourceMedia, publicMedia] = await Promise.all([readJson(paths.sourceMedia), readJson(paths.publicMedia)]);
  const nextSourceMedia = upsertMediaRows(sourceMedia, false);
  const nextPublicMedia = upsertMediaRows(publicMedia, true);
  await Promise.all([writeJson(paths.sourceMedia, nextSourceMedia), writeJson(paths.publicMedia, nextPublicMedia)]);

  const publicMediaById = new Map(nextPublicMedia.players.map((player) => [player.id, player]));
  for (const path of [paths.publicBundle, paths.finalBundle, paths.localBundle, paths.frontendBoard]) {
    const artifact = await readJson(path);
    await writeJson(path, applyPublicMediaToProspects(artifact, publicMediaById));
  }

  console.log(
    JSON.stringify(
      {
        updatedAt,
        added: mediaRows.map(({ id, localPhotoUrl }) => ({ id, localPhotoUrl })),
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
