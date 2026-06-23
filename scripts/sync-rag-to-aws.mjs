import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rootDir } from "./lib/draftops-manifest.mjs";

const loadEnvFile = async (path) => {
  const content = await readFile(path, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
};

await loadEnvFile(resolve(rootDir, ".env.local"));
await loadEnvFile(resolve(rootDir, ".env"));

const today = "20260623";
const reportPath = resolve(rootDir, "data", "reports", `aws_rag_sync_${today}.md`);
const tempDir = resolve(rootDir, ".draftops-watch", "aws-rag-sync");

const run = (command, args, options = {}) =>
  new Promise((resolveRun, rejectRun) => {
    execFile(command, args, { cwd: rootDir, windowsHide: true, ...options }, (error, stdout, stderr) => {
      if (error) {
        const message = [error.message, stderr?.trim()].filter(Boolean).join("\n");
        rejectRun(new Error(message));
        return;
      }
      resolveRun({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });

const aws = async (args, options) => {
  if (process.platform === "win32") {
    return run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "aws", ...args], options);
  }
  return run("aws", args, options);
};

const fileSha256 = async (relativePath) => {
  const bytes = await readFile(resolve(rootDir, relativePath));
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
};

const json = async (relativePath) => JSON.parse(await readFile(resolve(rootDir, relativePath), "utf8"));

const scalarToAttribute = (value) => {
  if (value === null || value === undefined) return { NULL: true };
  if (typeof value === "string") return value ? { S: value } : { NULL: true };
  if (typeof value === "number") return Number.isFinite(value) ? { N: String(value) } : { NULL: true };
  if (typeof value === "boolean") return { BOOL: value };
  if (Array.isArray(value)) return { L: value.slice(0, 100).map(scalarToAttribute) };
  if (typeof value === "object") {
    return {
      M: Object.fromEntries(
        Object.entries(value)
          .slice(0, 100)
          .map(([key, child]) => [key, scalarToAttribute(child)]),
      ),
    };
  }
  return { S: String(value) };
};

const compactPlayerRecord = (player) => ({
  poolOrdinal: player.poolOrdinal,
  nameZh: player.nameZh,
  stablePlayerKey: player.stablePlayerKey,
  sourceRows: player.sourceRows,
  baseProfile: player.baseProfile,
  measurements: player.measurements,
  athleticAgility: player.athleticAgility,
  shootingDrill: player.shootingDrill,
  derived: player.derived,
  percentilesCurrentClass: player.percentilesCurrentClass,
  percentilesHistoricalCombine: player.percentilesHistoricalCombine,
  sourceCoverage: player.sourceCoverage,
  notes: player.notes,
  ranksWithinPool: player.ranksWithinPool,
});

const putBatch = async (tableName, batch, batchNumber) => {
  const requestItems = {
    [tableName]: batch.map((player) => {
      const record = compactPlayerRecord(player);
      return {
        PutRequest: {
          Item: {
            playerKey: { S: player.stablePlayerKey },
            recordType: { S: "player-feature-reference-124" },
            playerOrdinal: { N: String(player.poolOrdinal) },
            nameZh: { S: player.nameZh },
            positionGroup: { S: player.baseProfile?.positionGroup ?? "unknown" },
            age: Number.isFinite(player.baseProfile?.age) ? { N: String(player.baseProfile.age) } : { NULL: true },
            barefootHeightIn: Number.isFinite(player.measurements?.barefootHeightIn)
              ? { N: String(player.measurements.barefootHeightIn) }
              : { NULL: true },
            wingspanIn: Number.isFinite(player.measurements?.wingspanIn) ? { N: String(player.measurements.wingspanIn) } : { NULL: true },
            weightLbs: Number.isFinite(player.measurements?.weightLbs) ? { N: String(player.measurements.weightLbs) } : { NULL: true },
            referenceScore: Number.isFinite(player.derived?.referenceScore) ? { N: String(player.derived.referenceScore) } : { NULL: true },
            sourceFile: { S: "data/normalized/normalized_2026_player_feature_reference_124.json" },
            syncedAt: { S: new Date().toISOString() },
            featureRecord: scalarToAttribute(record),
          },
        },
      };
    }),
  };
  const filePath = resolve(tempDir, `dynamodb-batch-${String(batchNumber).padStart(2, "0")}.json`);
  await writeFile(filePath, `${JSON.stringify(requestItems)}\n`, "utf8");
  const result = await aws(["dynamodb", "batch-write-item", "--request-items", `file://${filePath}`]);
  const payload = result.stdout ? JSON.parse(result.stdout) : {};
  const unprocessed = payload.UnprocessedItems?.[tableName]?.length ?? 0;
  if (unprocessed) throw new Error(`DynamoDB batch ${batchNumber} left ${unprocessed} unprocessed items.`);
};

const bucketExists = async (bucket) => {
  try {
    await aws(["s3api", "head-bucket", "--bucket", bucket]);
    return true;
  } catch {
    return false;
  }
};

const tableExists = async (tableName) => {
  try {
    await aws(["dynamodb", "describe-table", "--table-name", tableName]);
    return true;
  } catch {
    return false;
  }
};

const sync = async () => {
  await mkdir(tempDir, { recursive: true });
  const identity = JSON.parse((await aws(["sts", "get-caller-identity"])).stdout);
  const configuredRegion = (await aws(["configure", "get", "region"])).stdout || process.env.AWS_REGION || "us-east-1";
  const accountId = identity.Account;
  const region = configuredRegion.trim();
  const bucket = process.env.DRAFTOPS_RAG_S3_BUCKET || `draftops-rag-${accountId}-${region}`;
  const tableName =
    process.env.DRAFTOPS_RAG_DYNAMODB_TABLE ||
    process.env.DRAFTOPS_RAG_DYNAMODB_TABLES ||
    "DraftOpsPlayerFeatureReference124";

  const created = {
    bucket: false,
    table: false,
  };

  if (!(await bucketExists(bucket))) {
    const args = ["s3api", "create-bucket", "--bucket", bucket, "--region", region];
    if (region !== "us-east-1") {
      args.push("--create-bucket-configuration", `LocationConstraint=${region}`);
    }
    await aws(args);
    created.bucket = true;
  }

  if (!(await tableExists(tableName))) {
    await aws([
      "dynamodb",
      "create-table",
      "--table-name",
      tableName,
      "--attribute-definitions",
      "AttributeName=playerKey,AttributeType=S",
      "--key-schema",
      "AttributeName=playerKey,KeyType=HASH",
      "--billing-mode",
      "PAY_PER_REQUEST",
    ]);
    await aws(["dynamodb", "wait", "table-exists", "--table-name", tableName], { timeout: 180000 });
    created.table = true;
  }

  const s3Files = [
    "data/rag/rag-core-board.json",
    "data/rag/rag-team-preference.json",
    "data/rag/rag-prospect-evidence.json",
    "data/rag/rag-milestone.json",
    "data/rag/rag-architecture.json",
    "data/rag/rag-manifest.json",
    "data/normalized/normalized_2026_local_player_pool_124.json",
    "data/normalized/normalized_2026_player_feature_reference_124.json",
    "data/normalized/normalized_2026_online_player_list_reverification_20260623.json",
    "data/reports/player_feature_parameter_reference_124_20260623.md",
    "data/reports/player_feature_parameter_reference_124_20260623.csv",
    "data/reports/online_full_player_list_reverification_20260623.md",
  ];

  const uploaded = [];
  for (const relativePath of s3Files) {
    await aws(["s3", "cp", relativePath, `s3://${bucket}/${relativePath}`, "--only-show-errors"]);
    uploaded.push({
      key: relativePath,
      sha256: await fileSha256(relativePath),
    });
  }

  const featureReference = await json("data/normalized/normalized_2026_player_feature_reference_124.json");
  const players = featureReference.players ?? [];
  let batchNumber = 1;
  for (let index = 0; index < players.length; index += 25) {
    await putBatch(tableName, players.slice(index, index + 25), batchNumber);
    batchNumber += 1;
  }

  const ragManifest = await json("data/rag/rag-manifest.json");
  const prospectIndex = await json("data/rag/rag-prospect-evidence.json");
  const tableDescription = JSON.parse((await aws(["dynamodb", "describe-table", "--table-name", tableName])).stdout);
  const tableScanCount = Number((await aws(["dynamodb", "scan", "--table-name", tableName, "--select", "COUNT", "--query", "Count", "--output", "text"])).stdout);

  const report = `# AWS RAG Sync ${today}

## Targets

- AWS account: ${accountId}
- Region: ${region}
- S3 bucket: \`${bucket}\` ${created.bucket ? "(created)" : "(existing)"}
- DynamoDB table: \`${tableName}\` ${created.table ? "(created)" : "(existing)"}

## Vector Index

- Rebuilt manifest indexes: ${ragManifest.indexes.length}
- Total chunks: ${ragManifest.indexes.reduce((sum, item) => sum + Number(item.chunkCount ?? 0), 0)}
- Prospect evidence chunks: ${prospectIndex.chunkCount}
- Embedding provider: ${prospectIndex.embeddingProvider}
- Embedding dimensions: ${prospectIndex.embeddingDimensions}
- Feature-reference chunks: ${prospectIndex.chunks.filter((chunk) => String(chunk.source).includes("player_feature_reference_124")).length}
- Online-reverification chunks: ${prospectIndex.chunks.filter((chunk) => String(chunk.source).includes("online_player_list_reverification")).length}

## S3 Objects

| Key | SHA-256 |
| --- | --- |
${uploaded.map((item) => `| ${item.key} | ${item.sha256} |`).join("\n")}

## DynamoDB

- Player feature records written: ${players.length}
- Table item count from realtime scan: ${Number.isFinite(tableScanCount) ? tableScanCount : "unknown"}
- Table item count from describe-table may lag; latest describe value: ${tableDescription.Table?.ItemCount ?? "unknown"}
- Key schema: \`playerKey\`
- Includes top-level age, barefoot height, wingspan, weight, reference score, and full nested feature record.

## Runtime Env

Use these non-secret values for deployed Lambda/local RAG:

\`\`\`env
DRAFTOPS_RAG_S3_BUCKET=${bucket}
DRAFTOPS_RAG_DYNAMODB_TABLES=${tableName}
DRAFTOPS_RAG_S3_KEYS=${s3Files.slice(0, 9).join(",")}
\`\`\`
`;

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, report, "utf8");

  console.log(JSON.stringify({
    accountId,
    region,
    bucket,
    tableName,
    created,
    uploadedCount: uploaded.length,
    dynamodbPlayerRecords: players.length,
    dynamodbScanCount: Number.isFinite(tableScanCount) ? tableScanCount : null,
    reportPath: "data/reports/aws_rag_sync_20260623.md",
    prospectIndex: {
      chunkCount: prospectIndex.chunkCount,
      embeddingProvider: prospectIndex.embeddingProvider,
      embeddingDimensions: prospectIndex.embeddingDimensions,
      featureChunks: prospectIndex.chunks.filter((chunk) => String(chunk.source).includes("player_feature_reference_124")).length,
      onlineReverificationChunks: prospectIndex.chunks.filter((chunk) => String(chunk.source).includes("online_player_list_reverification")).length,
    },
  }, null, 2));
};

sync().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
