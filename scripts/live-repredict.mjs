#!/usr/bin/env node
/**
 * 现场一键重预测脚本 v2
 * 功能：备份当前板 → 运行相对评分预测 → 同步到前端
 * 用法：node scripts/live-repredict.mjs [--stamp <timestamp>] [--no-backup]
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

// Parse arguments
const args = process.argv.slice(2);
const stampArgIndex = args.indexOf("--stamp");
const runStamp = stampArgIndex >= 0 && args[stampArgIndex + 1] ? args[stampArgIndex + 1] : `live-${timestamp}`;
const skipBackup = args.includes("--no-backup");

const backupDir = resolve(rootDir, "data", "boards", "backups");

const log = (message, type = "info") => {
  const prefix = {
    info: "ℹ️ ",
    success: "✅ ",
    warn: "⚠️ ",
    error: "❌ ",
    step: "🔄 ",
  }[type] ?? "• ";
  console.log(`${prefix} ${message}`);
};

const runScript = (label, scriptPath, scriptArgs = []) =>
  new Promise((resolvePromise, reject) => {
    log(`${label}...`, "step");
    const start = Date.now();
    const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        log(`${label} 完成 (${((Date.now() - start) / 1000).toFixed(1)}s)`, "success");
        resolvePromise();
      } else {
        reject(new Error(`${label} failed with code ${code}`));
      }
    });
    child.on("error", reject);
  });

const main = async () => {
  log("=== DraftOps 现场一键重预测 v2 ===", "info");
  log(`运行标识: ${runStamp}`);
  log(`时间: ${new Date().toLocaleString("zh-CN")}`);
  console.log("");

  if (!skipBackup) {
    await mkdir(backupDir, { recursive: true });
  }

  // Step 1: Run relative scoring prediction with --force flag
  await runScript(
    "步骤1/2: 运行相对评分预测 (3255次候选评估)",
    resolve(rootDir, "scripts", "relative-scoring-prediction.mjs"),
    ["--run-stamp", runStamp, "--force"]
  );

  // Step 2: Sync to frontend with backup
  const syncArgs = ["--run-stamp", runStamp];
  if (!skipBackup) {
    syncArgs.push("--backup", backupDir);
  }
  await runScript(
    "步骤2/2: 同步预测结果到前端",
    resolve(rootDir, "scripts", "sync-relative-minmax-to-frontend.mjs"),
    syncArgs
  );

  console.log("");
  log("=== 重预测完成 ===", "success");
  log(`运行标识: ${runStamp}`);
  if (!skipBackup) {
    log(`备份位置: ${backupDir}`);
  }
  log("");
  log("下一步操作:", "info");
  log("1. 刷新浏览器页面查看新预测");
  log("2. 清空DeepSeek缓存: npm run agent:deepseek:cache:clear");
  log("3. 或调用API重载: npm run agent:deepseek:board:reload");
};

main().catch((error) => {
  console.error("");
  log(`重预测失败: ${error.message}`, "error");
  console.error(error);
  process.exit(1);
});
