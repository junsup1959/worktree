# Baseline judgment

Read this reference when the comparison point is unclear or when correct
behavior depends on more than a code revision.

Separate two kinds of baseline:

- **Code baseline:** commit, merge base, branch, tag, directory, file, or patch
  side used to identify what changed.
- **Behavior baseline:** the user's original request, explicit follow-up
  decisions, acceptance criteria, public API, schema, test, safety invariant,
  documented default, or established observable behavior used to judge whether
  the result is wrong.

Give direct user instructions and explicit clarifications priority when judging
intent. Use issues, specifications, tests, and documentation as supporting
evidence unless the user designated one as authoritative. Do not treat the
implementation itself as proof of intended behavior.

For each material requirement, identify the implementing path and the evidence
that confirms or contradicts it. Include omissions and explicitly forbidden or
out-of-scope behavior; a technically correct implementation can still fail the
requested contract.

Prefer an explicit user baseline. Otherwise select the repository evidence that
best matches the request: commonly a merge base for a branch, a parent for one
commit, `HEAD` for current worktree changes, or the named left side for A/B
input. Verify rather than assume when multiple choices would materially change
the findings.

Tests and documentation may be incomplete or stale. Reconcile them with the
user's request, implementation, and consumers, and expose material conflicts
instead of silently choosing the convenient source.

When no trustworthy behavior baseline exists, review the current state. Do not
invent user intent or assert that behavior regressed, a deletion was accidental,
or compatibility changed. Briefly name the chosen baseline and any limitation
that affects the conclusion.
