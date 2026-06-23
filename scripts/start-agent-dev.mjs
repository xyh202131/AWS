import { spawn } from "node:child_process";
import net from "node:net";

const npmCommand = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const npmArgs = (args) => (process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd", ...args] : args);
const host = "127.0.0.1";
const children = [];

const isPortAvailable = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, host);
  });

const findAvailablePort = async (startPort, attempts = 40) => {
  for (let port = startPort; port < startPort + attempts; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available local port from ${startPort} to ${startPort + attempts - 1}.`);
};

const preferredClientPort = Number(process.env.DRAFTOPS_CLIENT_PORT ?? 3002);
const preferredAgentPort = Number(process.env.DEEPSEEK_AGENT_PORT ?? 4318);
const clientPort = await findAvailablePort(preferredClientPort);
const agentPort = await findAvailablePort(preferredAgentPort);
const clientOrigin = `http://${host}:${clientPort}`;
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key, value]) => key && !key.startsWith("=") && typeof value === "string"),
);
const childEnv = {
  ...inheritedEnv,
  DEEPSEEK_AGENT_PORT: String(agentPort),
  DRAFTOPS_CLIENT_ORIGIN: clientOrigin,
  VITE_DEEPSEEK_AGENT_PORT: String(agentPort),
};

const start = (name, command, args) => {
  const child = spawn(command, args, {
    env: childEnv,
    stdio: "inherit",
    shell: false,
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

console.log(`DraftOps dev server target: ${clientOrigin}/`);
console.log(`DeepSeek chat proxy target: http://${host}:${agentPort}`);

start("deepseek-chat-server-v2", "node", ["scripts/deepseek-chat-server-v2.mjs"]);
start("vite", npmCommand, npmArgs(["run", "dev", "--", "--host", host, "--port", String(clientPort), "--strictPort"]));
