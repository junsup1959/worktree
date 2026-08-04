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
  parseTaskXml,
  resolveSchedulerConfig,
} from "./manage-scheduler.mjs";

const parsed = parseSchedulerCli([
  "ensure", "--project", "C:/project/example", "--time", "03:15",
]);
assert.equal(parsed.command, "ensure");
assert.equal(parsed.time, "03:15");
assert.throws(
  () => parseSchedulerCli(["ensure", "--time", "25:00"]),
  /24-hour HH:mm/u,
);

const taskName = deriveTaskName("C:/project/example");
assert.equal(taskName, deriveTaskName("C:/project/example"));
assert.notEqual(taskName, deriveTaskName("C:/project/other"));
assert.match(taskName, /^Codex-CurateLearningCandidates-example-[a-f0-9]{10}$/u);

const config = resolveSchedulerConfig({
  project: "C:/project/example",
  time: "02:00",
  taskName: "Codex-CurateLearningCandidates-example-test",
  nodePath: "C:/Program Files/nodejs/node.exe",
  runnerPath: path.resolve("skills/curate-learning-candidates/scripts/run-curation.mjs"),
});
assert.equal(buildTaskAction(config), config.action);
assert.equal(buildCreateArgs(config).includes("/F"), false);

function taskXml({
  command = config.command,
  argumentsText = config.arguments,
  time = config.time,
  daily = true,
} = {}) {
  const encode = (value) => value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `<?xml version="1.0"?><Task><Triggers><CalendarTrigger><StartBoundary>2026-08-05T${time}:00</StartBoundary>${daily ? "<ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>" : ""}</CalendarTrigger></Triggers><Actions><Exec><Command>${encode(command)}</Command><Arguments>${encode(argumentsText)}</Arguments></Exec></Actions></Task>`;
}

assert.deepEqual(parseTaskXml(taskXml()), {
  command: config.command,
  arguments: config.arguments,
  frequency: "daily",
  time: "02:00",
});

const exactCalls = [];
const exact = await ensureScheduler(config, {
  platform: "win32",
  executeSchtasks: async (args) => {
    exactCalls.push(args);
    return { code: 0, stdout: taskXml(), stderr: "" };
  },
});
assert.equal(exact.status, "registered");
assert.equal(exact.configuration_matches, true);
assert.equal(exact.created, false);
assert.equal(exact.existing_configuration_preserved, true);
assert.deepEqual(exactCalls[0], ["/Query", "/TN", config.taskName, "/XML"]);

const stale = await ensureScheduler(config, {
  platform: "win32",
  executeSchtasks: async () => ({
    code: 0,
    stdout: taskXml({ time: "03:00" }),
    stderr: "",
  }),
});
assert.equal(stale.status, "stale");
assert.equal(stale.configuration_matches, false);
assert.deepEqual(stale.mismatches, ["schedule.time"]);
assert.equal(stale.existing_configuration_preserved, true);

const spacingMismatch = await getSchedulerStatus(config, {
  platform: "win32",
  executeSchtasks: async () => ({
    code: 0,
    stdout: taskXml({
      argumentsText: config.arguments.replace("C:\\project\\example", "C:\\project\\example  moved"),
    }),
    stderr: "",
  }),
});
assert.equal(spacingMismatch.status, "stale");
assert.deepEqual(spacingMismatch.mismatches, ["action.arguments"]);

let queryCount = 0;
const created = await ensureScheduler(config, {
  platform: "win32",
  executeSchtasks: async (args) => {
    if (args[0] === "/Query") {
      queryCount += 1;
      return queryCount === 1
        ? { code: 1, stdout: "", stderr: "" }
        : { code: 0, stdout: taskXml(), stderr: "" };
    }
    assert.equal(args[0], "/Create");
    assert.equal(args.includes("/F"), false);
    return { code: 0, stdout: "SUCCESS", stderr: "" };
  },
});
assert.equal(created.status, "registered");
assert.equal(created.configuration_matches, true);
assert.equal(created.created, true);
assert.equal(queryCount, 2);

const unverified = await getSchedulerStatus(config, {
  platform: "win32",
  executeSchtasks: async () => ({ code: 0, stdout: "not xml", stderr: "" }),
});
assert.equal(unverified.status, "unverified");
assert.equal(unverified.registered, true);

const missing = await getSchedulerStatus(config, {
  platform: "win32",
  executeSchtasks: async () => ({ code: 1, stdout: "", stderr: "" }),
});
assert.equal(missing.status, "missing");

const unsupported = await ensureScheduler(config, { platform: "linux" });
assert.equal(unsupported.status, "unsupported");

process.stdout.write("curate-learning-candidates scheduler self-test: ok\n");
