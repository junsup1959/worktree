#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import {
  buildCreateArgs,
  buildTaskAction,
  deriveTaskName,
  ensureScheduler,
  getSchedulerStatus,
  parseSchedulerCli,
  resolveSchedulerConfig,
} from "./manage-scheduler.mjs";

const parsed = parseSchedulerCli([
  "ensure",
  "--project",
  "C:/project/example",
  "--time",
  "03:15",
]);
assert.equal(parsed.command, "ensure");
assert.equal(parsed.time, "03:15");

assert.throws(
  () =>
    parseSchedulerCli([
      "ensure",
      "--project",
      "C:/project/example",
      "--time",
      "25:00",
    ]),
  /24-hour HH:mm/,
);

const firstTaskName = deriveTaskName("C:/project/example");
const secondTaskName = deriveTaskName("C:/project/example");
const otherTaskName = deriveTaskName("C:/project/other");
assert.equal(firstTaskName, secondTaskName);
assert.notEqual(firstTaskName, otherTaskName);
assert.match(firstTaskName, /^Codex-CurateLearningCandidates-example-[a-f0-9]{10}$/);

const action = buildTaskAction({
  nodePath: "C:\\Program Files\\nodejs\\node.exe",
  runnerPath: "C:\\project\\worktree\\skills\\curate-learning-candidates\\scripts\\run-curation.mjs",
  projectRoot: "C:\\project\\worktree",
});
assert.equal(
  action,
  '"C:\\Program Files\\nodejs\\node.exe" "C:\\project\\worktree\\skills\\curate-learning-candidates\\scripts\\run-curation.mjs" run --project "C:\\project\\worktree"',
);

const config = {
  projectRoot: "C:\\project\\worktree",
  nodePath: "C:\\Program Files\\nodejs\\node.exe",
  runnerPath: "C:\\project\\worktree\\skills\\curate-learning-candidates\\scripts\\run-curation.mjs",
  taskName: "Codex-CurateLearningCandidates-worktree-test",
  time: "02:00",
  action,
};

const createArgs = buildCreateArgs(config);
assert.deepEqual(createArgs.slice(0, 5), [
  "/Create",
  "/TN",
  config.taskName,
  "/TR",
  action,
]);
assert.equal(createArgs.includes("/F"), false);

const existingCalls = [];
const existing = await ensureScheduler(config, {
  platform: "win32",
  executeSchtasks: async (args) => {
    existingCalls.push(args);
    return { code: 0, stdout: "", stderr: "" };
  },
});
assert.equal(existing.registered, true);
assert.equal(existing.created, false);
assert.equal(existing.existing_configuration_preserved, true);
assert.equal("schedule" in existing, false);
assert.equal(existingCalls.length, 1);
assert.equal(existingCalls[0][0], "/Query");

const createCalls = [];
const created = await ensureScheduler(config, {
  platform: "win32",
  executeSchtasks: async (args) => {
    createCalls.push(args);
    return args[0] === "/Query"
      ? { code: 1, stdout: "", stderr: "" }
      : { code: 0, stdout: "", stderr: "" };
  },
});
assert.equal(created.registered, true);
assert.equal(created.created, true);
assert.deepEqual(created.schedule, {
  frequency: "daily",
  time: "02:00",
});
assert.equal(created.action, action);
assert.deepEqual(
  createCalls.map((args) => args[0]),
  ["/Query", "/Create"],
);
assert.equal(createCalls[1].includes("/F"), false);

const missing = await getSchedulerStatus(config, {
  platform: "win32",
  executeSchtasks: async () => ({ code: 1, stdout: "", stderr: "" }),
});
assert.equal(missing.status, "missing");
assert.equal(missing.registered, false);

const unsupported = await ensureScheduler(config, {
  platform: "linux",
  executeSchtasks: async () => {
    throw new Error("must not be called");
  },
});
assert.equal(unsupported.status, "unsupported");

let queryCount = 0;
await assert.rejects(
  () =>
    ensureScheduler(config, {
      platform: "win32",
      executeSchtasks: async (args) => {
        if (args[0] === "/Query") {
          queryCount += 1;
          return { code: 1, stdout: "", stderr: "" };
        }
        return { code: 5, stdout: "", stderr: "Access is denied." };
      },
    }),
  /Access is denied/,
);
assert.equal(queryCount, 2);

const resolved = resolveSchedulerConfig({
  project: "C:/project/example",
  time: "04:30",
  taskName: null,
  nodePath: process.execPath,
  runnerPath: path.join(process.cwd(), "runner.mjs"),
});
assert.equal(resolved.time, "04:30");
assert.equal(resolved.taskName, deriveTaskName(resolved.projectRoot));

process.stdout.write("curate-learning-candidates scheduler self-test: ok\n");
