# Baseline judgment

Read this reference when the comparison point is unclear or when correct
behavior depends on more than a code revision.

Separate two kinds of baseline:

- **Code baseline:** commit, merge base, branch, tag, directory, file, or patch
  side used to identify what changed.
- **Behavior baseline:** user requirement, public API, schema, test, safety
  invariant, documented default, or established observable behavior used to
  judge whether the result is wrong.

Prefer an explicit user baseline. Otherwise select the repository evidence that
best matches the request: commonly a merge base for a branch, a parent for one
commit, `HEAD` for current worktree changes, or the named left side for A/B
input. Verify rather than assume when multiple choices would materially change
the findings.

Tests and documentation support a behavior baseline but may be incomplete or
stale. Reconcile them with implementations and consumers, and expose material
conflicts instead of silently choosing the convenient source.

When no trustworthy baseline exists, review the current state. Do not assert
that behavior regressed, a deletion was accidental, or compatibility changed.
Briefly name the chosen baseline and any limitation that affects the conclusion.
