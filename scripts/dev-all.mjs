import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const scripts = ["dev:web", "dev:api", "dev:worker"];
const children = scripts.map((script) =>
  spawn(npmCommand, ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
);

let stopping = false;

function stopAll(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const child of children) {
  child.once("error", (error) => {
    console.error("Could not start a development service", error);
    process.exitCode = 1;
    stopAll();
  });

  child.once("exit", (code) => {
    if (stopping) return;
    process.exitCode = code ?? 1;
    stopAll();
  });
}

process.once("SIGINT", () => stopAll("SIGINT"));
process.once("SIGTERM", () => stopAll("SIGTERM"));
