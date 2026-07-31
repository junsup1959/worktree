#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNNER = path.join(SCRIPT_DIR, "run-curation.mjs");
const DEFAULT_TIME = "02:00";
const TASK_PREFIX = "Codex-CurateLearningCandidates";
const MAX_DIAGNOSTIC_LENGTH = 4_000;

function usage() {
  return `Usage:
  node manage-scheduler.mjs status --project <project-root> [--time HH:mm]
  node manage-scheduler.mjs ensure --project <project-root> [--time HH:mm]

Options:
  --task-name <name>  Override the deterministic project task name.
  --node <path>       Override the Node.js executable used by the task.
  --runner <path>     Override the run-curation.mjs path used by the task.
`;
}

function takeValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

export function parseSchedulerCli(argv) {
  const options = {
    command: "status",
    project: process.cwd(),
    time: DEFAULT_TIME,
    taskName: null,
    nodePath: process.execPath,
    runnerPath: DEFAULT_RUNNER,
  };

  let index = 0;
  if (argv[0] && !argv[0].startsWith("--")) {
    options.command = argv[0];
    index = 1;
  }

  while (index < argv.length) {
    const name = argv[index];

    switch (name) {
      case "--project":
        options.project = takeValue(argv, index, name);
        index += 2;
        break;
      case "--time":
        options.time = takeValue(argv, index, name);
        index += 2;
        break;
      case "--task-name":
        options.taskName = takeValue(argv, index, name);
        index += 2;
        break;
      case "--node":
        options.nodePath = takeValue(argv, index, name);
        index += 2;
        break;
      case "--runner":
        options.runnerPath = takeValue(argv, index, name);
        index += 2;
        break;
      case "--help":
      case "-h":
        options.command = "help";
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${name}`);
    }
  }

  if (!new Set(["status", "ensure", "help"]).has(options.command)) {
    throw new Error(`Unknown command: ${options.command}\n${usage()}`);
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(options.time)) {
    throw new Error("--time must use 24-hour HH:mm format");
  }
  if (options.taskName && /[<>:"|?*\u0000-\u001f]/u.test(options.taskName)) {
    throw new Error("--task-name contains characters unsupported by Task Scheduler");
  }

  return options;
}

function normalizeIdentityPath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function deriveTaskName(projectRoot) {
  const identity = normalizeIdentityPath(projectRoot);
  const projectName =
    path
      .basename(path.resolve(projectRoot))
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "project";
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 10);
  return `${TASK_PREFIX}-${projectName}-${digest}`;
}

function quoteTaskToken(value) {
  if (value.includes('"')) {
    throw new Error("Task action paths may not contain double quotes");
  }
  return `"${value}"`;
}

export function buildTaskAction({
  nodePath,
  runnerPath,
  projectRoot,
}) {
  return [
    quoteTaskToken(nodePath),
    quoteTaskToken(runnerPath),
    "run",
    "--project",
    quoteTaskToken(projectRoot),
  ].join(" ");
}

export function buildCreateArgs({ taskName, action, time }) {
  return [
    "/Create",
    "/TN",
    taskName,
    "/TR",
    action,
    "/SC",
    "DAILY",
    "/ST",
    time,
    "/RL",
    "LIMITED",
  ];
}

export function resolveSchedulerConfig(options) {
  const projectRoot = path.resolve(options.project);
  const nodePath = path.resolve(options.nodePath);
  const runnerPath = path.resolve(options.runnerPath);
  const taskName = options.taskName || deriveTaskName(projectRoot);

  return {
    projectRoot,
    nodePath,
    runnerPath,
    taskName,
    time: options.time,
    action: buildTaskAction({ nodePath, runnerPath, projectRoot }),
  };
}

function truncateDiagnostic(value) {
  const normalized = String(value ?? "").trim();
  return normalized.slice(0, MAX_DIAGNOSTIC_LENGTH);
}

async function runSchtasks(args) {
  return await new Promise((resolve, reject) => {
    const child = spawn("schtasks.exe", args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: truncateDiagnostic(stdout),
        stderr: truncateDiagnostic(stderr),
      });
    });
  });
}

function queryArgs(taskName) {
  return ["/Query", "/TN", taskName, "/FO", "CSV", "/NH"];
}

export async function getSchedulerStatus(
  config,
  {
    platform = process.platform,
    executeSchtasks = runSchtasks,
  } = {},
) {
  if (platform !== "win32") {
    return {
      status: "unsupported",
      registered: false,
      task_name: config.taskName,
      project_root: config.projectRoot,
      reason: "Windows Task Scheduler is only available on win32.",
    };
  }

  const query = await executeSchtasks(queryArgs(config.taskName));
  return {
    status: query.code === 0 ? "registered" : "missing",
    registered: query.code === 0,
    task_name: config.taskName,
    project_root: config.projectRoot,
  };
}

export async function ensureScheduler(
  config,
  {
    platform = process.platform,
    executeSchtasks = runSchtasks,
  } = {},
) {
  const current = await getSchedulerStatus(config, {
    platform,
    executeSchtasks,
  });

  if (current.status === "unsupported") {
    return current;
  }
  if (current.registered) {
    return {
      ...current,
      created: false,
      existing_configuration_preserved: true,
    };
  }

  const created = await executeSchtasks(buildCreateArgs(config));
  if (created.code === 0) {
    return {
      status: "registered",
      registered: true,
      created: true,
      task_name: config.taskName,
      project_root: config.projectRoot,
      schedule: {
        frequency: "daily",
        time: config.time,
      },
      action: config.action,
    };
  }

  // A concurrent invocation may have created the same deterministic task.
  const afterFailure = await executeSchtasks(queryArgs(config.taskName));
  if (afterFailure.code === 0) {
    return {
      status: "registered",
      registered: true,
      created: false,
      task_name: config.taskName,
      project_root: config.projectRoot,
      existing_configuration_preserved: true,
    };
  }

  const detail = created.stderr || created.stdout || "schtasks.exe failed";
  throw new Error(`Unable to register scheduled task: ${detail}`);
}

async function validatePaths(config) {
  await access(config.projectRoot).catch(() => {
    throw new Error(`Project root does not exist: ${config.projectRoot}`);
  });
  await access(config.nodePath).catch(() => {
    throw new Error(`Node.js executable does not exist: ${config.nodePath}`);
  });
  await access(config.runnerPath).catch(() => {
    throw new Error(`Curation runner does not exist: ${config.runnerPath}`);
  });
}

async function main() {
  const options = parseSchedulerCli(process.argv.slice(2));
  if (options.command === "help") {
    process.stdout.write(usage());
    return;
  }

  const config = resolveSchedulerConfig(options);
  await validatePaths(config);
  const result =
    options.command === "ensure"
      ? await ensureScheduler(config)
      : await getSchedulerStatus(config);

  console.log(JSON.stringify(result, null, 2));
  if (result.status === "unsupported") {
    process.exitCode = 2;
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    process.stderr.write(`curate-learning-candidates scheduler: ${error.message}\n`);
    process.exitCode = 1;
  });
}
