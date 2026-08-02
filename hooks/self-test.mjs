#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_DIR = path.dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = path.join(HOOK_DIR, "capture-learning-turn.mjs");
const HOOKS_CONFIG_PATH = path.join(HOOK_DIR, "hooks.json");
const PLUGIN_MANIFEST_PATH = path.join(
  HOOK_DIR,
  "..",
  ".codex-plugin",
  "plugin.json",
);
const PLUGIN_ROOT = path.join(HOOK_DIR, "..");
const WINDOWS_HOOK_SCRIPT =
  "$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop';try{& node (Join-Path $env:PLUGIN_ROOT 'hooks\\capture-learning-turn.mjs');exit $LASTEXITCODE}catch{[Console]::Error.WriteLine($_);exit 1}";
const WINDOWS_HOOK_COMMAND =
  "powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand " +
  Buffer.from(WINDOWS_HOOK_SCRIPT, "utf16le").toString("base64");

async function invokeProcess(program, args, event, env = process.env) {
  return await new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      env,
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

async function invoke(event) {
  return await invokeProcess(process.execPath, [HOOK_PATH], event);
}

async function invokeThroughShell(program, args, command, event) {
  return await invokeProcess(program, [...args, command], event, {
    ...process.env,
    PLUGIN_ROOT,
  });
}

async function firstAccessible(paths) {
  for (const candidate of paths.filter(Boolean)) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }
  return null;
}

const pluginManifest = JSON.parse(await readFile(PLUGIN_MANIFEST_PATH, "utf8"));
assert.equal(pluginManifest.name, "jswork");
assert.equal(pluginManifest.hooks, "./hooks/hooks.json");
assert.ok(
  pluginManifest.interface.defaultPrompt.includes(
    "Use $jswork:setup to configure and verify JSWORK for this repository.",
  ),
);

const hooksConfig = JSON.parse(await readFile(HOOKS_CONFIG_PATH, "utf8"));
assert.deepEqual(
  Object.keys(hooksConfig.hooks).sort(),
  ["SessionEnd", "Stop", "UserPromptSubmit"].sort(),
);
for (const eventName of ["UserPromptSubmit", "Stop", "SessionEnd"]) {
  const handlers = hooksConfig.hooks[eventName].flatMap((group) => group.hooks);
  assert.equal(handlers.length, 1, eventName);
  assert.match(handlers[0].command, /\$\{PLUGIN_ROOT\}/u, eventName);
  assert.equal(handlers[0].commandWindows, WINDOWS_HOOK_COMMAND, eventName);
  assert.equal(handlers[0].command.includes(".jsfwork"), false, eventName);
  assert.equal(handlers[0].commandWindows.includes(".jsfwork"), false, eventName);
}

const projectRoot = await mkdtemp(path.join(os.tmpdir(), "learning-hook-test-"));

try {
  const common = {
    session_id: "session-test",
    turn_id: "turn-one",
    cwd: projectRoot,
  };
  const commandSmokeEvent = {
    ...common,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "Shell portability smoke test.",
  };
  const stopHandler = hooksConfig.hooks.Stop[0].hooks[0];

  if (process.platform === "win32") {
    const windowsShells = [
      ["PowerShell", "powershell.exe", ["-NoProfile", "-Command"]],
      ["cmd.exe", process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c"]],
    ];
    const gitBash = await firstAccessible([
      process.env.ProgramFiles &&
        path.join(process.env.ProgramFiles, "Git", "bin", "bash.exe"),
      process.env.LOCALAPPDATA &&
        path.join(
          process.env.LOCALAPPDATA,
          "Programs",
          "Git",
          "bin",
          "bash.exe",
        ),
    ]);
    if (gitBash) {
      windowsShells.push([
        "Git Bash",
        gitBash,
        ["--noprofile", "--norc", "-c"],
      ]);
    }

    for (const [shellName, program, args] of windowsShells) {
      const result = await invokeThroughShell(
        program,
        args,
        stopHandler.commandWindows,
        commandSmokeEvent,
      );
      assert.equal(result.stdout.trim(), "{}", shellName);
      assert.equal(result.stderr, "", shellName);
    }
  } else {
    const result = await invokeThroughShell(
      "/bin/sh",
      ["-c"],
      stopHandler.command,
      commandSmokeEvent,
    );
    assert.equal(result.stdout.trim(), "{}");
    assert.equal(result.stderr, "");
  }

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
  await Promise.all([
    invoke({
      session_id: "session-test",
      cwd: projectRoot,
      hook_event_name: "SessionEnd",
      reason: "other",
    }),
    invoke({
      session_id: "session-test",
      cwd: projectRoot,
      hook_event_name: "SessionEnd",
      reason: "other",
    }),
  ]);

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
