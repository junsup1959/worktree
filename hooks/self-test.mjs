#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "capture-learning-turn.mjs",
);

async function invoke(event) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [HOOK_PATH], {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
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
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`hook exited ${code}: ${stderr}`));
      }
    });

    child.stdin.end(JSON.stringify(event));
  });
}

const projectRoot = await mkdtemp(path.join(os.tmpdir(), "learning-hook-test-"));

try {
  const common = {
    session_id: "session-test",
    turn_id: "turn-one",
    cwd: projectRoot,
  };

  const promptResult = await invoke({
    ...common,
    hook_event_name: "UserPromptSubmit",
    prompt: "Keep this original prompt. api_key=super-secret-value",
  });
  assert.equal(promptResult.stdout, "");

  const stopResult = await invoke({
    ...common,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "Draft before another Stop hook continues the turn.",
  });
  assert.equal(stopResult.stdout.trim(), "{}");

  const candidatesPath = path.join(
    projectRoot,
    ".jsfwork",
    "learning",
    "candidates.jsonl",
  );
  await assert.rejects(access(candidatesPath), { code: "ENOENT" });

  const continuedStopResult = await invoke({
    ...common,
    hook_event_name: "Stop",
    stop_hook_active: true,
    last_assistant_message: "Use deterministic capture and curate later.",
  });
  assert.equal(continuedStopResult.stdout.trim(), "{}");
  await assert.rejects(access(candidatesPath), { code: "ENOENT" });

  const turnTwo = {
    session_id: "session-test",
    turn_id: "turn-two",
    cwd: projectRoot,
  };
  await invoke({
    ...turnTwo,
    hook_event_name: "UserPromptSubmit",
    prompt: "Capture this turn at session end.",
  });

  const lines = (await readFile(candidatesPath, "utf8"))
    .trim()
    .split(/\r?\n/u);
  assert.equal(lines.length, 1);

  const candidate = JSON.parse(lines[0]);
  assert.equal(candidate.review_status, "unreviewed");
  assert.equal(candidate.original_prompt.includes("super-secret-value"), false);
  assert.equal(candidate.original_prompt.includes("[REDACTED_SECRET]"), true);
  assert.equal(candidate.final_answer, "Use deterministic capture and curate later.");
  assert.equal("session_id" in candidate, false);
  assert.equal("turn_id" in candidate, false);

  await invoke({
    ...turnTwo,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "SessionEnd should finalize this answer.",
  });
  await invoke({
    session_id: "session-test",
    cwd: projectRoot,
    hook_event_name: "SessionEnd",
    reason: "other",
  });

  const afterSessionEnd = (await readFile(candidatesPath, "utf8"))
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
  assert.equal(afterSessionEnd.length, 2);
  assert.equal(
    afterSessionEnd[1].final_answer,
    "SessionEnd should finalize this answer.",
  );

  const optedOut = {
    session_id: "session-test",
    turn_id: "turn-three",
    cwd: projectRoot,
  };
  await invoke({
    ...optedOut,
    hook_event_name: "UserPromptSubmit",
    prompt: "[학습 제외] Do not retain this turn.",
  });
  await invoke({
    ...optedOut,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "This must not become a candidate.",
  });
  await invoke({
    session_id: "session-test",
    cwd: projectRoot,
    hook_event_name: "SessionEnd",
    reason: "other",
  });

  const afterOptOut = (await readFile(candidatesPath, "utf8"))
    .trim()
    .split(/\r?\n/u);
  assert.equal(afterOptOut.length, 2);

  process.stdout.write("learning capture hook self-test: ok\n");
} finally {
  await rm(projectRoot, { recursive: true, force: true });
}
