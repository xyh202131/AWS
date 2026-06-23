#!/usr/bin/env node
/**
 * AWS部署脚本
 * 功能：构建前端 → 同步到S3 → 刷新CloudFront → 部署Lambda
 * 用法：node scripts/deploy-aws.mjs
 */
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

const rootDir = process.cwd();

const run = (command, args, options = {}) =>
  new Promise((resolveRun, rejectRun) => {
    console.log(`> ${command} ${args.join(" ")}`);
    execFile(command, args, { cwd: rootDir, windowsHide: true, ...options, shell: process.platform === "win32" }, (error, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (error) {
        rejectRun(error);
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

const WEB_BUCKET = "draftops-web-085710593039-us-east-1";
const RAG_BUCKET = "draftops-rag-085710593039-us-east-1";
const DATA_BUCKET = "draftops-data-085710593039-us-east-1";
const CF_DIST_ID = "E1PJK3IDKTVVSC";
const LAMBDA_FUNC = "draftops-ai-api";

const main = async () => {
  console.log("=== DraftOps AWS 部署脚本 ===\n");

  // Step 1: Build frontend
  console.log("📦 Step 1/5: 构建前端生产版本...");
  await run("npm", ["run", "build"]);

  // Step 2: Sync frontend assets to S3
  console.log("\n🚀 Step 2/5: 同步前端资源到 S3...");
  await aws(["s3", "sync", "dist/", `s3://${WEB_BUCKET}/`, "--delete"]);

  // Step 3: Sync public/data to S3
  console.log("\n📊 Step 3/5: 同步数据文件到 S3...");
  await aws(["s3", "sync", "public/data/", `s3://${WEB_BUCKET}/data/`, "--size-only"]);
  await aws(["s3", "cp", "public/data/agent_expanded_recommended_board.json", `s3://${RAG_BUCKET}/public-data/agent_expanded_recommended_board.json`]);

  // Step 4: Create CloudFront invalidation
  console.log("\n🔄 Step 4/5: 刷新 CloudFront 缓存...");
  await aws(["cloudfront", "create-invalidation", "--distribution-id", CF_DIST_ID, "--paths", "/*"]);

  // Step 5: Deploy Lambda
  console.log("\n⚡ Step 5/5: 部署 Lambda...");
  const lambdaDir = resolve(rootDir, "infra", "lambda", "draftops-ai-api");
  const deployDir = resolve(rootDir, ".draftops-watch", "deploy");
  await mkdir(deployDir, { recursive: true });
  const zipPath = resolve(deployDir, "lambda-deploy.zip");

  // Create zip using PowerShell Compress-Archive
  await run("powershell", [
    "-Command",
    `Compress-Archive -Path '${resolve(lambdaDir, "index.mjs")}','${resolve(lambdaDir, "node_modules")}' -DestinationPath '${zipPath}' -Force`,
  ]);

  // Upload to S3 and deploy
  await aws(["s3", "cp", zipPath, `s3://${DATA_BUCKET}/lambda-deploy/draftops-ai-api-latest.zip`]);
  await aws(["lambda", "update-function-code", "--function-name", LAMBDA_FUNC, "--s3-bucket", DATA_BUCKET, "--s3-key", "lambda-deploy/draftops-ai-api-latest.zip"]);

  console.log("\n✅ 部署完成！");
  console.log(`🌐 CloudFront: https://danh9kqqxu1oj.cloudfront.net/`);
  console.log(`🔧 API: https://acn9rbo8v1.execute-api.us-east-1.amazonaws.com/api/deepseek/health`);
};

main().catch((error) => {
  console.error("\n❌ 部署失败:", error.message);
  process.exit(1);
});
