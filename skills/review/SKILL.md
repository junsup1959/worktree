---
name: review
description: Review code changes or current code state for evidence-backed defects, logical errors, regressions, compatibility risks, and operational hazards. Use when Codex is asked to review commits, branches, working-tree changes, files or directories, supplied patches, or a repository or package without a comparison baseline.
---

# Review

Find defects and risks that can be tied to code behavior. Use judgment rather
than mechanically completing a checklist. Keep the inspected context as small
as the requested scope and the evidence allow.

## Select the input mode

Treat a mode only as a signal for which context to load. Read the matching
reference, or the smallest useful combination.

| Input signal | Read |
| --- | --- |
| Commit, branch, tag, or revision range | [references/git.md](references/git.md) |
| Current staged, unstaged, or untracked changes; two worktrees | [references/worktree.md](references/worktree.md) |
| One or more files, or file/directory A/B comparison | [references/file.md](references/file.md) |
| Supplied diff or patch | [references/patch.md](references/patch.md) |
| Package or repository state with no change set | [references/state.md](references/state.md) |

Also read [references/baseline.md](references/baseline.md) when the comparison
point is ambiguous or behavior requirements matter. Read
[references/review-mvp.md](references/review-mvp.md) only when domain signals
such as UI, privacy, localization, observability, or dependencies are relevant.

Keep a short working note when it helps focus attention:

```yaml
mode: worktree
target: current changes
baseline: HEAD and repository behavior
focus: changed public API and failure paths
limits: untracked binary contents not inspected
```

This is an optional attention aid. Omit unknown fields instead of guessing them.

## Apply the defect MVP

Inspect the relevant categories, prioritizing those signaled by the code:

- **Correctness and logic:** wrong branches, calculations, boundaries, or order.
- **Compatibility:** broken consumers of public APIs, types, schemas, CLI, or defaults.
- **Failure and recovery:** partial state, cleanup gaps, or unsafe retries.
- **State and concurrency:** invalid transitions, lost atomicity, races, or duplicates.
- **Security:** injection, traversal, authorization bypass, or secret exposure.
- **Data integrity:** loss, duplication, corruption, precision, or encoding damage.
- **Resources and performance:** input-driven time, memory, handle, or query growth.
- **Configuration and operations:** platform, permissions, environment, deploy, or recovery failures.

Inspect surrounding validation, callers, tests, configuration, and failure paths
only as needed to confirm or reject a candidate. Do not report style preferences,
generic hardening ideas, or possibilities without a realistic trigger and impact.

## Judge and report evidence

Before reporting a finding, establish as much of the following as the available
evidence permits:

- the location and input or state that triggers the problem,
- the observable wrong result or concrete risk,
- the code, test, requirement, or safety invariant supporting the judgment,
- whether surrounding validation or a caller already prevents it,
- a practical reproduction, test, or static trace that could verify it.

Lead with findings, ordered by user impact. Give a precise file and line when
available, then explain the trigger, impact, evidence, and verification concisely.
Adapt the presentation to the request and the evidence.

State the baseline, inspected scope, and material limitations briefly. If no
finding survives validation, say that no verifiable defect was found in the
inspected scope; do not imply that the entire codebase is defect-free. Never
claim that a check ran or passed without current evidence.