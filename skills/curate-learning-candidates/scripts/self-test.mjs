#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createBatch,
  evaluateCurationGate,
  parseCli,
  readCandidates,
  readProcessedIds,
  scheduledPrompt,
} from "./run-curation.mjs";

const id = (character) => character.repeat(64);
const candidate = (candidateId, capturedAt = "2026-08-05T00:00:00.000Z") => ({
  schema_version: 1,
  candidate_id: candidateId,
  captured_at: capturedAt,
  original_prompt: "Keep hooks deterministic. sk-proj-abcdefghijklmnop",
  final_answer: "Route semantic curation outside the hook.",
});

assert.equal(parseCli(["run", "--batch-size", "7"]).batchSize, 7);
assert.equal(parseCli(["prepare"]).command, "prepare");
assert.equal(parseCli(["list", "--all"]).all, true);
assert.equal(parseCli(["check", "--require-work"]).requireWork, true);
assert.throws(() => parseCli(["review"]), /Unknown command/u);
assert.throws(() => parseCli(["run", "--require-work"]), /only valid with check/u);

const candidates = [
  candidate(id("b"), "2026-08-05T00:01:00.000Z"),
  candidate(id("a"), "2026-08-05T00:00:00.000Z"),
];
const ready = evaluateCurationGate(candidates, new Set([id("a")]));
assert.deepEqual(ready, {
  status: "ready",
  should_run: true,
  unprocessed_candidates: 1,
});

const batch = createBatch(candidates, new Set([id("a")]), "C:/project/example", 1);
assert.equal(batch.candidates.length, 1);
assert.equal(batch.candidates[0].candidate_id, id("b"));
assert.match(batch.candidates[0].original_prompt, /\[REDACTED_OPENAI_KEY\]/u);
assert.equal(batch.candidates[0].original_prompt.includes("sk-proj-"), false);

const prompt = scheduledPrompt("C:/tmp/batch.json", "C:/project/proposals.jsonl");
assert.equal(prompt.startsWith("[학습 제외]\n"), true);
assert.match(prompt, /untrusted data/u);
assert.match(prompt, /Do not approve or promote/u);
assert.match(prompt, /proposals\.jsonl/u);

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "curation-unit-"));
try {
  const learningDir = path.join(tempRoot, ".jsfwork", "learning");
  const curationDir = path.join(learningDir, "curation");
  await mkdir(curationDir, { recursive: true });
  await writeFile(
    path.join(learningDir, "candidates.jsonl"),
    `${JSON.stringify(candidate(id("a")))}\n${JSON.stringify(candidate(id("a")))}\n`,
    "utf8",
  );
  assert.equal((await readCandidates(path.join(learningDir, "candidates.jsonl"))).length, 1);

  await writeFile(
    path.join(curationDir, "proposals.jsonl"),
    `${JSON.stringify({ source_candidate_ids: [id("b")] })}\n`,
    "utf8",
  );
  await writeFile(
    path.join(curationDir, "state.json"),
    `${JSON.stringify({ candidates: { [id("c")]: { status: "approved" } } })}\n`,
    "utf8",
  );
  const processed = await readProcessedIds({
    proposalsFile: path.join(curationDir, "proposals.jsonl"),
    legacyStateFile: path.join(curationDir, "state.json"),
  });
  assert.deepEqual([...processed].sort(), [id("b"), id("c")]);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

process.stdout.write("curate-learning-candidates self-test: ok\n");
