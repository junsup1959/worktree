#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  applyModelResult,
  evaluateCurationGate,
  isLockRecoverable,
  parseCli,
  validateModelResult,
} from "./run-curation.mjs";

const id = (character) => character.repeat(64);
const candidate = (candidateId) => ({
  candidate_id: candidateId,
  captured_at: "2026-07-29T00:00:00.000Z",
  original_prompt: "Please keep hook capture deterministic.",
  final_answer: "The hook should capture raw pairs and curate later.",
});

const baseDecision = {
  source_candidate_ids: [id("a"), id("b")],
  disposition: "proposed",
  category: "skill",
  lesson: "Keep semantic model calls outside latency-sensitive capture hooks.",
  applies_when: "Capturing project learning candidates from lifecycle hooks.",
  procedure: [
    "Capture the original prompt and final answer.",
    "Run semantic curation in a separate scheduled process.",
  ],
  avoid: ["Calling an LLM from UserPromptSubmit or Stop."],
  target: "existing-skill",
  target_skill: "curate-learning-candidates",
  merge_proposal_id: null,
  requires_verification: false,
  reason: "Two candidates support the same reusable boundary.",
};

const emptyState = {
  schema_version: 1,
  updated_at: null,
  candidates: {},
  proposals: [],
};

const batchOne = "batch_test_one";
const resultOne = {
  schema_version: 1,
  batch_id: batchOne,
  decisions: [baseDecision],
};
const candidatesOne = [candidate(id("a")), candidate(id("b"))];
const stateOne = applyModelResult(
  emptyState,
  candidatesOne,
  resultOne,
  batchOne,
  "2026-07-29T01:00:00.000Z",
);

assert.equal(stateOne.proposals.length, 1);
assert.equal(stateOne.proposals[0].evidence_count, 2);
assert.equal(stateOne.candidates[id("a")].status, "proposed");

const proposalId = stateOne.proposals[0].proposal_id;
const batchTwo = "batch_test_two";
const resultTwo = {
  schema_version: 1,
  batch_id: batchTwo,
  decisions: [
    {
      ...baseDecision,
      source_candidate_ids: [id("c")],
      merge_proposal_id: proposalId,
      reason: "A third candidate confirms the existing proposal.",
    },
  ],
};
const stateTwo = applyModelResult(
  stateOne,
  [candidate(id("c"))],
  resultTwo,
  batchTwo,
  "2026-07-29T02:00:00.000Z",
);

assert.equal(stateTwo.proposals.length, 1);
assert.equal(stateTwo.proposals[0].evidence_count, 3);
assert.deepEqual(stateTwo.proposals[0].source_candidate_ids, [
  id("a"),
  id("b"),
  id("c"),
]);

const approvedState = structuredClone(stateOne);
approvedState.proposals[0].status = "approved";
approvedState.proposals[0].reviewed_at = "2026-07-29T01:30:00.000Z";
approvedState.proposals[0].review_note = "Applied and validated.";
approvedState.candidates[id("a")].status = "approved";
approvedState.candidates[id("b")].status = "approved";

const newEvidenceResult = {
  schema_version: 1,
  batch_id: "batch_after_approval",
  decisions: [
    {
      ...baseDecision,
      source_candidate_ids: [id("c")],
      merge_proposal_id: null,
      reason: "New evidence must be reviewed separately.",
    },
  ],
};
const stateAfterApproval = applyModelResult(
  approvedState,
  [candidate(id("c"))],
  newEvidenceResult,
  "batch_after_approval",
  "2026-07-29T02:00:00.000Z",
);

assert.equal(stateAfterApproval.proposals.length, 2);
assert.equal(stateAfterApproval.proposals[0].status, "approved");
assert.equal(stateAfterApproval.proposals[0].evidence_count, 2);
const followUpProposal = stateAfterApproval.proposals.find(
  (proposal) => proposal.proposal_id !== proposalId,
);
assert.equal(followUpProposal.status, "proposed");
assert.deepEqual(followUpProposal.source_candidate_ids, [id("c")]);
assert.equal(stateAfterApproval.candidates[id("c")].status, "proposed");

assert.throws(
  () =>
    validateModelResult(
      {
        ...newEvidenceResult,
        decisions: [
          {
            ...newEvidenceResult.decisions[0],
            merge_proposal_id: proposalId,
          },
        ],
      },
      "batch_after_approval",
      [id("c")],
      approvedState,
    ),
  /unavailable proposal/,
);

const rejectedResult = {
  schema_version: 1,
  batch_id: "batch_rejected",
  decisions: [
    {
      source_candidate_ids: [id("d")],
      disposition: "rejected",
      category: "temporary",
      lesson: null,
      applies_when: null,
      procedure: [],
      avoid: [],
      target: "discard",
      target_skill: null,
      merge_proposal_id: null,
      requires_verification: false,
      reason: "The candidate contains no reusable guidance.",
    },
  ],
};
const rejectedState = applyModelResult(
  stateTwo,
  [candidate(id("d"))],
  rejectedResult,
  "batch_rejected",
);
assert.equal(rejectedState.candidates[id("d")].status, "rejected");

assert.throws(
  () =>
    validateModelResult(
      {
        schema_version: 1,
        batch_id: "batch_duplicate",
        decisions: [
          {
            ...baseDecision,
            source_candidate_ids: [id("e"), id("e")],
          },
        ],
      },
      "batch_duplicate",
      [id("e")],
      emptyState,
    ),
  /more than once/,
);

const parsed = parseCli([
  "run",
  "--project",
  "C:/project/example",
  "--batch-size",
  "7",
]);
assert.equal(parsed.command, "run");
assert.equal(parsed.batchSize, 7);

const readyGate = evaluateCurationGate(candidatesOne, emptyState);
assert.equal(readyGate.status, "ready");
assert.equal(readyGate.should_run, true);
assert.equal(readyGate.unprocessed_candidates, 2);

const idleGate = evaluateCurationGate(candidatesOne, stateOne);
assert.equal(idleGate.status, "idle");
assert.equal(idleGate.should_run, false);
assert.equal(idleGate.pending_review_proposals, 1);

const parsedCheck = parseCli([
  "check",
  "--project",
  "C:/project/example",
  "--require-work",
]);
assert.equal(parsedCheck.command, "check");
assert.equal(parsedCheck.requireWork, true);

const threeHours = 3 * 60 * 60 * 1_000;
assert.equal(
  isLockRecoverable({ pid: 42 }, 0, threeHours, () => true),
  false,
);
assert.equal(
  isLockRecoverable({ pid: 42 }, 0, threeHours, () => false),
  true,
);
assert.equal(
  isLockRecoverable({ pid: 42 }, threeHours - 1_000, threeHours, () => false),
  false,
);

process.stdout.write("curate-learning-candidates self-test: ok\n");
