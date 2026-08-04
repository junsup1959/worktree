---
name: verify
description: Independently verify current behavior, suspected defects, completed changes, and test or runtime claims with read-only evidence. Use when Codex is asked to reproduce an issue, run or assess existing checks, confirm a developer's verification claim, or expose a verification gap without editing code. Do not use for implementing fixes or creating tests; use BDD for write-oriented behavior development and review for static code-change inspection.
---

# Verify

Determine what the current code actually does through the smallest useful
non-mutating evidence path. Keep context limited to the claim, target, and
relevant boundary. Do not edit source, tests, configuration, or generated
project files.

## Select the input mode

Read only the matching reference:

| Input signal | Reference |
| --- | --- |
| Suspected defect, error or log, runtime failure, intermittent behavior, or environment-specific mismatch | [debug.md](references/debug.md) |
| Completed change, acceptance or regression claim, existing test or check, or developer verification report | [test.md](references/test.md) |

Read both only when an existing check and a suspected runtime mismatch must be
correlated. Hand static change inspection to the review skill and
implementation or test creation to the BDD skill.

## Apply the verification MVP

- State the behavior or claim being verified and its target.
- Choose the narrowest repository-safe command, reproduction, or observation
  that can provide direct evidence.
- Record the actual input or command and the observed output, exit result, or
  behavior.
- Cross-check a surprising result once, or isolate the most plausible competing
  explanations with relevant code, configuration, logs, and environment facts.
- Conclude only what the evidence supports: a demonstrated mismatch, a bounded
  pass, an inconclusive result, or a verification gap. These are narrative
  conclusions, not workflow states.

## Preserve read-only boundaries

- Do not edit repository files, create tests, implement fixes, or change
  external state.
- Before running a command, identify expected writes such as caches, coverage,
  snapshots, build outputs, generated files, logs, or service and data changes.
- Run only checks that remain read-only within the active role, sandbox, and
  environment. User authorization does not expand those boundaries.
- If no non-mutating check exists, report the command or scenario as not run,
  explain the side effect or permission limit, and describe the smallest
  evidence gap instead of implementing it.
- Never claim that a check ran or passed without current evidence.

## Report evidence

Lead with the conclusion. Include the verified claim and target, commands or
inputs actually used, the observed result, relevant environment facts,
repeatability, and remaining limits. For a demonstrated defect, include the
trigger and impact. For a pass, bound the conclusion to exactly what was
observed.
