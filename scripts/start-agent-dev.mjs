import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

const start = (name, command, args) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
};

const shutdown = (code = 0) => {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("deepseek-chat-server", "node", ["scripts/deepseek-chat-server.mjs"]);
start("vite", npmCommand, ["run", "dev:local"]);
