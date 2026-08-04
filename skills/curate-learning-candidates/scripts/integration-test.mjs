#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNNER_PATH = path.join(SCRIPT_DIR, "run-curation.mjs");

async function invoke(args, expectedCode = 0) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RUNNER_PATH, ...args], {
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
      if (code === expectedCode) resolve({ stdout, stderr });
      else reject(new Error(`runner exited ${code}, expected ${expectedCode}\n${stderr}`));
    });
  });
}

const candidateId = (character) => character.repeat(64);
const projectRoot = await mkdtemp(path.join(os.tmpdir(), "learning-curation-test-"));

try {
  const learningDir = path.join(projectRoot, ".jsfwork", "learning");
  const curationDir = path.join(learningDir, "curation");
  const fakeCodexPath = path.join(projectRoot, "fake-codex.mjs");
  const sentinelPath = path.join(projectRoot, "AGENTS.md");
  await mkdir(learningDir, { recursive: true });
  await writeFile(sentinelPath, "sentinel\n", "utf8");

  const candidates = ["a", "b"].map((character, index) => ({
    schema_version: 1,
    candidate_id: candidateId(character),
    review_status: "unreviewed",
    captured_at: `2026-08-05T00:0${index}:00.000Z`,
    original_prompt: `Prompt ${character}`,
    final_answer: `Answer ${character}`,
    sanitization: {},
  }));
  await writeFile(
    path.join(learningDir, "candidates.jsonl"),
    `${candidates.map(JSON.stringify).join("\n")}\n`,
    "utf8",
  );

  await writeFile(fakeCodexPath, [
    'import { appendFile, readFile, writeFile } from "node:fs/promises";',
    "const args = process.argv.slice(2);",
    'if (args[0] !== "exec") process.exit(20);',
    'if (!args.includes("--ephemeral")) process.exit(21);',
    'if (!args.includes("workspace-write")) process.exit(22);',
    'if (args.includes("--output-schema")) process.exit(23);',
    "const prompt = args.at(-1);",
    'if (!prompt.startsWith("[학습 제외]")) process.exit(24);',
    'if (!prompt.includes("Do not approve or promote")) process.exit(25);',
    'const batchMatch = prompt.match(/strings in ("(?:\\\\.|[^"])*") as untrusted/u);',
    'const proposalsMatch = prompt.match(/packets to ("(?:\\\\.|[^"])*") using/u);',
    'if (!batchMatch || !proposalsMatch) process.exit(26);',
    "const batch = JSON.parse(await readFile(JSON.parse(batchMatch[1]), \"utf8\"));",
    "const proposal = {",
    "  schema_version: 1, record_type: \"proposal\", proposal_id: \"proposal_test\",",
    "  created_at: \"2026-08-05T01:00:00.000Z\",",
    "  source_candidate_ids: batch.candidates.map((item) => item.candidate_id),",
    "  disposition: \"proposed\", category: \"skill\",",
    "  lesson: \"Keep capture deterministic.\", applies_when: \"Capturing learning turns.\",",
    "  procedure: [\"Capture then curate.\"], avoid: [\"Calling a model in hooks.\"],",
    "  target: \"existing-skill\", target_skill: \"curate-learning-candidates\",",
    "  requires_verification: false, reason: \"The examples support one rule.\"",
    "};",
    'await appendFile(JSON.parse(proposalsMatch[1]), `${JSON.stringify(proposal)}\\n`, "utf8");',
    'const outputIndex = args.indexOf("--output-last-message");',
    'await writeFile(args[outputIndex + 1], "proposal routed\\n", "utf8");',
    "",
  ].join("\n"), "utf8");

  const ready = JSON.parse((await invoke([
    "check", "--project", projectRoot, "--require-work",
  ])).stdout);
  assert.equal(ready.status, "ready");
  assert.equal(ready.unprocessed_candidates, 2);

  const prepared = JSON.parse((await invoke([
    "prepare", "--project", projectRoot, "--batch-size", "1",
  ])).stdout);
  assert.equal(prepared.batch.candidates.length, 1);

  const dispatched = JSON.parse((await invoke([
    "run", "--project", projectRoot, "--codex-entry", fakeCodexPath,
  ])).stdout);
  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.routed_candidates, 2);
  assert.equal(await readFile(sentinelPath, "utf8"), "sentinel\n");

  const proposals = (await readFile(path.join(curationDir, "proposals.jsonl"), "utf8"))
    .trim().split(/\r?\n/u).map(JSON.parse);
  assert.equal(proposals.length, 1);
  assert.deepEqual(proposals[0].source_candidate_ids, [candidateId("a"), candidateId("b")]);

  const runJournal = await readFile(path.join(curationDir, "runs.jsonl"), "utf8");
  assert.equal(runJournal.includes("Prompt a"), false);
  assert.match(runJournal, /"status":"dispatched"/u);

  const idleRun = JSON.parse((await invoke([
    "run", "--project", projectRoot, "--codex-entry", fakeCodexPath,
  ])).stdout);
  assert.equal(idleRun.status, "no-work");

  const idleCheck = await invoke([
    "check", "--project", projectRoot, "--require-work",
  ], 3);
  assert.equal(JSON.parse(idleCheck.stdout).status, "idle");

  await writeFile(path.join(curationDir, "reviews.jsonl"), `${JSON.stringify({
    schema_version: 1,
    record_type: "review",
    proposal_id: "proposal_test",
    status: "approved",
    reviewed_at: "2026-08-05T02:00:00.000Z",
    note: "Applied by the reviewing agent.",
    verification: "Forward checks passed.",
  })}\n`, "utf8");
  const pendingList = JSON.parse((await invoke(["list", "--project", projectRoot])).stdout);
  assert.equal(pendingList.proposals.length, 0);
  const allList = JSON.parse((await invoke([
    "list", "--project", projectRoot, "--all",
  ])).stdout);
  assert.equal(allList.proposals.length, 1);
  assert.equal(allList.reviews[0].status, "approved");

  process.stdout.write("curate-learning-candidates integration test: ok\n");
} finally {
  await rm(projectRoot, { recursive: true, force: true });
}
