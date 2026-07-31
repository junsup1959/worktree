#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
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
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === expectedCode) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `runner exited ${code}, expected ${expectedCode}\nstdout=${stdout}\nstderr=${stderr}`,
          ),
        );
      }
    });
  });
}

const candidateId = (character) => character.repeat(64);
const projectRoot = await mkdtemp(
  path.join(os.tmpdir(), "learning-curation-test-"),
);

try {
  const candidatesDir = path.join(projectRoot, ".jsfwork", "learning");
  const existingSkillDir = path.join(projectRoot, "skills", "example-skill");
  const existingSkillPath = path.join(existingSkillDir, "SKILL.md");
  const fakeCodexPath = path.join(projectRoot, "fake-codex.mjs");
  await mkdir(candidatesDir, { recursive: true });
  await mkdir(existingSkillDir, { recursive: true });

  const initialSkill = [
    "---",
    "name: example-skill",
    "description: Apply deterministic example procedures.",
    "---",
    "",
    "# Example Skill",
    "",
  ].join("\n");
  await writeFile(existingSkillPath, initialSkill, "utf8");

  const candidates = [
    {
      schema_version: 1,
      candidate_id: candidateId("a"),
      review_status: "unreviewed",
      captured_at: "2026-07-29T00:00:00.000Z",
      original_prompt: "Keep capture hooks deterministic.",
      final_answer: "Run semantic curation outside the hook.",
      sanitization: {},
    },
    {
      schema_version: 1,
      candidate_id: candidateId("b"),
      review_status: "unreviewed",
      captured_at: "2026-07-29T00:01:00.000Z",
      original_prompt: "Do not call a model from Stop.",
      final_answer: "Schedule a separate proposal-only pass.",
      sanitization: {},
    },
  ];
  await writeFile(
    path.join(candidatesDir, "candidates.jsonl"),
    `${candidates.map((value) => JSON.stringify(value)).join("\n")}\n`,
    "utf8",
  );

  await writeFile(
    fakeCodexPath,
    [
      'import { readFile, writeFile } from "node:fs/promises";',
      'import path from "node:path";',
      "const args = process.argv.slice(2);",
      'if (args[0] !== "exec") process.exit(20);',
      'if (!args.includes("--ephemeral")) process.exit(21);',
      'if (!args.includes("read-only")) process.exit(22);',
      'if (args.includes("--json")) process.exit(23);',
      'const prompt = args.at(-1);',
      'if (!prompt.startsWith("[학습 제외]")) process.exit(24);',
      'const outputIndex = args.indexOf("--output-last-message");',
      'const schemaIndex = args.indexOf("--output-schema");',
      'if (outputIndex < 0 || schemaIndex < 0) process.exit(25);',
      'const batch = JSON.parse(await readFile(path.join(process.cwd(), "batch.json"), "utf8"));',
      "const result = {",
      "  schema_version: 1,",
      "  batch_id: batch.batch_id,",
      "  decisions: [{",
      "    source_candidate_ids: batch.candidates.map((candidate) => candidate.candidate_id),",
      '    disposition: "proposed",',
      '    category: "skill",',
      '    lesson: "Keep model calls outside lifecycle capture hooks.",',
      '    applies_when: "Collecting prompt and final-answer learning candidates.",',
      '    procedure: ["Capture deterministically.", "Curate in a separate scheduled pass."],',
      '    avoid: ["Calling a model from UserPromptSubmit or Stop."],',
      '    target: "existing-skill",',
      '    target_skill: "example-skill",',
      "    merge_proposal_id: null,",
      "    requires_verification: false,",
      '    reason: "Both candidates support the same reusable boundary."',
      "  }]",
      "};",
      'await writeFile(args[outputIndex + 1], `${JSON.stringify(result)}\\n`, "utf8");',
      "",
    ].join("\n"),
    "utf8",
  );

  const readyCheck = await invoke([
    "check",
    "--project",
    projectRoot,
    "--require-work",
  ]);
  assert.equal(JSON.parse(readyCheck.stdout).status, "ready");
  assert.equal(JSON.parse(readyCheck.stdout).unprocessed_candidates, 2);

  const runResult = await invoke([
    "run",
    "--project",
    projectRoot,
    "--codex-entry",
    fakeCodexPath,
  ]);
  assert.equal(JSON.parse(runResult.stdout).status, "completed");

  const statePath = path.join(
    candidatesDir,
    "curation",
    "state.json",
  );
  const state = JSON.parse(await readFile(statePath, "utf8"));
  assert.equal(state.proposals.length, 1);
  assert.equal(state.proposals[0].evidence_count, 2);
  assert.equal(state.proposals[0].status, "proposed");
  const proposalId = state.proposals[0].proposal_id;
  assert.equal(await readFile(existingSkillPath, "utf8"), initialSkill);

  const runJournal = await readFile(
    path.join(candidatesDir, "curation", "runs.jsonl"),
    "utf8",
  );
  assert.equal(runJournal.includes("Keep capture hooks deterministic."), false);

  const workEntries = await readdir(
    path.join(candidatesDir, "curation", "work"),
  );
  assert.deepEqual(workEntries, []);

  const noWorkResult = await invoke([
    "run",
    "--project",
    projectRoot,
    "--codex-entry",
    fakeCodexPath,
  ]);
  assert.equal(JSON.parse(noWorkResult.stdout).status, "no-work");
  assert.equal(JSON.parse(noWorkResult.stdout).should_run, false);

  const idleCheck = await invoke([
    "check",
    "--project",
    projectRoot,
  ]);
  assert.equal(JSON.parse(idleCheck.stdout).status, "idle");
  assert.equal(JSON.parse(idleCheck.stdout).pending_review_proposals, 1);

  const requiredIdleCheck = await invoke(
    [
      "check",
      "--project",
      projectRoot,
      "--require-work",
    ],
    3,
  );
  assert.equal(JSON.parse(requiredIdleCheck.stdout).status, "idle");

  const deniedApproval = await invoke(
    [
      "review",
      "--project",
      projectRoot,
      "--proposal",
      proposalId,
      "--status",
      "approved",
      "--note",
      "Validated the target change.",
    ],
    1,
  );
  assert.match(deniedApproval.stderr, /--target-updated/u);

  const promotedSkill = [
    initialSkill.trimEnd(),
    "",
    "## Capture lifecycle",
    "",
    "Keep model calls outside lifecycle capture hooks.",
    "",
  ].join("\n");
  await writeFile(existingSkillPath, promotedSkill, "utf8");
  assert.match(
    await readFile(existingSkillPath, "utf8"),
    /Keep model calls outside lifecycle capture hooks\./u,
  );

  await invoke([
    "review",
    "--project",
    projectRoot,
    "--proposal",
    proposalId,
    "--status",
    "approved",
    "--target-updated",
    "--note",
    "Validated the target change.",
  ]);

  const approvedState = JSON.parse(await readFile(statePath, "utf8"));
  assert.equal(approvedState.proposals[0].status, "approved");
  assert.equal(
    approvedState.candidates[candidateId("a")].status,
    "approved",
  );
  assert.equal(
    approvedState.candidates[candidateId("b")].status,
    "approved",
  );

  const repeatedApproval = await invoke(
    [
      "review",
      "--project",
      projectRoot,
      "--proposal",
      proposalId,
      "--status",
      "approved",
      "--target-updated",
      "--note",
      "Attempted duplicate approval.",
    ],
    1,
  );
  assert.match(repeatedApproval.stderr, /already terminal: approved/u);

  process.stdout.write("curate-learning-candidates integration test: ok\n");
} finally {
  await rm(projectRoot, { recursive: true, force: true });
}
