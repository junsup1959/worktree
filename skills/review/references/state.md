# Current-state input

Use this reference when reviewing a package, module, or repository without a
change set or historical comparison.

- Frame conclusions as defects or risks in the current state, not regressions.
- Keep the scope explicit and prioritize externally reachable entry points,
  trust boundaries, persistence, state transitions, and failure or recovery
  paths.
- Use tests, public APIs, schemas, configuration, and documentation as behavior
  evidence, while allowing for stale or incomplete documentation.
- Trace only enough consumers and dependencies to validate realistic triggers
  and impact. Do not imply exhaustive repository coverage from a sampled path.
- Distinguish confirmed defects from structural concerns that still need a
  reproduction or runtime evidence.

If a trustworthy baseline becomes available, add `baseline.md` and the matching
Git, worktree, or file reference. Otherwise state that deletion, compatibility,
and regression coverage is necessarily limited.
