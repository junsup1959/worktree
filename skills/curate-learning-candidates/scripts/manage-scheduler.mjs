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
  if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(options.time)) {
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
    path.basename(path.resolve(projectRoot))
      .replace(/[^A-Za-z0-9_-]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
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

export function buildTaskInvocation({ nodePath, runnerPath, projectRoot }) {
  return {
    command: nodePath,
    arguments: [
      quoteTaskToken(runnerPath),
      "run",
      "--project",
      quoteTaskToken(projectRoot),
    ].join(" "),
  };
}

export function buildTaskAction(config) {
  const invocation = buildTaskInvocation(config);
  return `${quoteTaskToken(invocation.command)} ${invocation.arguments}`;
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
  const invocation = buildTaskInvocation({ nodePath, runnerPath, projectRoot });

  return {
    projectRoot,
    nodePath,
    runnerPath,
    taskName,
    time: options.time,
    ...invocation,
    action: buildTaskAction({ nodePath, runnerPath, projectRoot }),
  };
}

function truncateDiagnostic(value) {
  return String(value ?? "").trim().slice(0, MAX_DIAGNOSTIC_LENGTH);
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
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
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
  return ["/Query", "/TN", taskName, "/XML"];
}

function decodeXml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function xmlText(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "iu"));
  return match ? decodeXml(match[1].trim()) : null;
}

export function parseTaskXml(xml) {
  if (typeof xml !== "string" || !xml.trim()) {
    throw new Error("Task Scheduler returned empty XML");
  }
  const command = xmlText(xml, "Command");
  const argumentsText = xmlText(xml, "Arguments") ?? "";
  const startBoundary = xmlText(xml, "StartBoundary");
  const timeMatch = startBoundary?.match(/T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?/u);
  if (!command || !startBoundary || !timeMatch) {
    throw new Error("Task XML is missing Command or StartBoundary");
  }
  return {
    command,
    arguments: argumentsText,
    frequency: /<ScheduleByDay(?:\s[^>]*)?>/iu.test(xml) ? "daily" : "other",
    time: timeMatch[1],
  };
}

function normalizeWindowsPath(value) {
  return path.win32.normalize(value.trim()).replace(/[\\/]+$/u, "").toLowerCase();
}

function normalizeArguments(value) {
  return value.trim();
}

function compareConfiguration(config, observed) {
  const mismatches = [];
  if (normalizeWindowsPath(observed.command) !== normalizeWindowsPath(config.command)) {
    mismatches.push("action.command");
  }
  if (normalizeArguments(observed.arguments) !== normalizeArguments(config.arguments)) {
    mismatches.push("action.arguments");
  }
  if (observed.frequency !== "daily") mismatches.push("schedule.frequency");
  if (observed.time !== config.time) mismatches.push("schedule.time");
  return mismatches;
}

export async function getSchedulerStatus(
  config,
  { platform = process.platform, executeSchtasks = runSchtasks } = {},
) {
  const base = {
    task_name: config.taskName,
    project_root: config.projectRoot,
  };
  if (platform !== "win32") {
    return {
      ...base,
      status: "unsupported",
      registered: false,
      configuration_matches: false,
      reason: "Windows Task Scheduler is only available on win32.",
    };
  }

  const query = await executeSchtasks(queryArgs(config.taskName));
  if (query.code !== 0) {
    return { ...base, status: "missing", registered: false, configuration_matches: false };
  }

  let observed;
  try {
    observed = parseTaskXml(query.stdout);
  } catch (error) {
    return {
      ...base,
      status: "unverified",
      registered: true,
      configuration_matches: false,
      reason: error.message,
    };
  }

  const mismatches = compareConfiguration(config, observed);
  return {
    ...base,
    status: mismatches.length === 0 ? "registered" : "stale",
    registered: true,
    configuration_matches: mismatches.length === 0,
    schedule: { frequency: observed.frequency, time: observed.time },
    action: { command: observed.command, arguments: observed.arguments },
    ...(mismatches.length ? { mismatches } : {}),
  };
}

export async function ensureScheduler(
  config,
  { platform = process.platform, executeSchtasks = runSchtasks } = {},
) {
  const statusOptions = { platform, executeSchtasks };
  const current = await getSchedulerStatus(config, statusOptions);
  if (current.status === "unsupported") return current;
  if (current.registered) {
    return { ...current, created: false, existing_configuration_preserved: true };
  }

  const created = await executeSchtasks(buildCreateArgs(config));
  const verified = await getSchedulerStatus(config, statusOptions);
  if (verified.configuration_matches) {
    return { ...verified, created: created.code === 0 };
  }
  if (verified.registered) {
    return {
      ...verified,
      created: created.code === 0,
      existing_configuration_preserved: created.code !== 0,
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
  const result = options.command === "ensure"
    ? await ensureScheduler(config)
    : await getSchedulerStatus(config);
  console.log(JSON.stringify(result, null, 2));
  if (["unsupported", "unverified", "stale"].includes(result.status)) {
    process.exitCode = 2;
  } else if (result.status === "missing") {
    process.exitCode = 3;
  }
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`curate-learning-candidates scheduler: ${error.message}\n`);
    process.exitCode = 1;
  });
}
