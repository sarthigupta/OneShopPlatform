import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

function executable(command) {
  return isWindows && ["npm", "helm"].includes(command) ? `${command}.cmd` : command;
}

function run(command, args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable(command), args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: isWindows,
    });

    child.once("error", (error) => reject(new Error(`Could not run ${command}: ${error.message}`)));
    child.once("exit", (code, signal) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0 && !allowFailure) {
        reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? `code ${exitCode}`}`));
        return;
      }
      resolve(exitCode);
    });
  });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureEnvironmentFiles() {
  const examplePath = path.join(projectRoot, ".env.example");
  const rootEnvPath = path.join(projectRoot, ".env");
  const sourcePath = (await exists(rootEnvPath)) ? rootEnvPath : examplePath;
  const source = await readFile(sourcePath, "utf8");

  const apiEnvPath = path.join(projectRoot, "apps", "api", ".env");
  if (!(await exists(apiEnvPath))) {
    await mkdir(path.dirname(apiEnvPath), { recursive: true });
    const generatedSecret = randomBytes(32).toString("base64url");
    const apiEnv = /^SESSION_SECRET=.*$/m.test(source)
      ? source.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${generatedSecret}`)
      : `${source.trimEnd()}\nSESSION_SECRET=${generatedSecret}\n`;
    await writeFile(apiEnvPath, apiEnv, "utf8");
    console.log("Created apps/api/.env with a generated local session secret.");
  }

  const workerEnvPath = path.join(projectRoot, "apps", "worker", ".env");
  if (!(await exists(workerEnvPath))) {
    await mkdir(path.dirname(workerEnvPath), { recursive: true });
    await copyFile(sourcePath, workerEnvPath);
    console.log("Created apps/worker/.env from the local environment configuration.");
  }

  const webEnvPath = path.join(projectRoot, "apps", "web", ".env.local");
  if (!(await exists(webEnvPath))) {
    await mkdir(path.dirname(webEnvPath), { recursive: true });
    await writeFile(webEnvPath, "API_URL=http://localhost:4000\n", "utf8");
    console.log("Created apps/web/.env.local.");
  }
}

async function ensureKindCluster() {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(executable("kind"), ["get", "clusters"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "inherit"],
      shell: isWindows,
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (output += chunk));
    child.once("error", (error) => reject(new Error(`Could not check kind clusters: ${error.message}`)));
    child.once("exit", (code) => {
      if (code !== 0) reject(new Error("kind get clusters failed"));
      else resolve(output);
    });
  });

  const clusters = String(result).split(/\r?\n/).map((name) => name.trim());
  if (!clusters.includes("oneshop")) {
    console.log("Creating kind cluster 'oneshop'...");
    await run("kind", ["create", "cluster", "--name", "oneshop", "--config", "infra/kind/cluster.yaml", "--wait", "90s"]);
  } else {
    console.log("Reusing kind cluster 'oneshop'.");
  }

  await run("kubectl", ["config", "use-context", "kind-oneshop"]);
  await run("kubectl", ["apply", "-f", "infra/kubernetes/namespace.yaml"]);
  await run("kubectl", ["apply", "-f", "infra/kubernetes/worker-rbac.yaml"]);
}

async function ensureTraefik() {
  const installed = await run("helm", ["status", "traefik", "--namespace", "traefik"], { allowFailure: true });
  if (installed === 0) {
    console.log("Traefik is already installed.");
    await run("kubectl", ["rollout", "status", "deployment/traefik", "-n", "traefik", "--timeout=180s"]);
    return;
  }

  console.log("Installing Traefik (this first-time step requires internet access)...");
  await run("helm", ["repo", "add", "traefik", "https://traefik.github.io/charts", "--force-update"]);
  await run("helm", ["repo", "update"]);
  await run("helm", [
    "upgrade", "--install", "traefik", "traefik/traefik",
    "--namespace", "traefik", "--create-namespace",
    "--values", "infra/kubernetes/traefik-values.yaml",
  ]);
  await run("kubectl", ["rollout", "status", "deployment/traefik", "-n", "traefik", "--timeout=180s"]);
}

async function main() {
  console.log("Preparing OneShop local development stack...");
  await ensureEnvironmentFiles();

  console.log("Starting PostgreSQL...");
  await run("docker", ["compose", "up", "-d", "--wait", "postgres"]);

  await ensureKindCluster();
  await ensureTraefik();

  console.log("Building and loading the sample shop image...");
  await run("docker", ["build", "-t", "oneshop/shop:local", "-f", "apps/shop/Dockerfile", "apps/shop"]);
  await run("kind", ["load", "docker-image", "oneshop/shop:local", "--name", "oneshop"]);

  console.log("Generating Prisma client and applying database migrations...");
  await run("npm", ["--workspace", "@oneshop/api", "run", "prisma:generate"]);
  await run("npm", ["--workspace", "@oneshop/api", "run", "prisma:migrate:deploy"]);

  console.log("Starting web, API, and provisioning worker. Press Ctrl+C to stop them.");
  console.log("Dashboard: http://localhost:3000");
  console.log("Shop routes: http://localhost:8080/shops/<slug>");
  await run("npm", ["run", "dev:all"]);
}

main().catch((error) => {
  console.error(`\nOneShop could not start: ${error.message}`);
  process.exitCode = 1;
});
