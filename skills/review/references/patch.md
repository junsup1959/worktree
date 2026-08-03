# Patch input

Use this reference when the supplied diff or patch is the main available input.

- Extract candidate files, hunks, renames, additions, deletions, mode changes,
  and binary markers from the patch.
- If the repository is available, open the current source and the narrow set of
  callers, tests, and configuration needed to interpret each candidate.
- Confirm that unchanged validation or a caller does not prevent the suspected
  trigger before reporting a finding.
- Notice behavior that a patch may omit: untracked files, generated artifacts,
  lockfiles, submodules, build outputs, or changes outside the supplied range.
- When only the patch is available, reason from visible evidence and label
  missing surrounding context. Do not claim whole-file or whole-repository
  coverage.

A hunk is a candidate map, not proof of a defect. Prefer a smaller supported
finding over a broad conclusion that depends on code the patch does not show.
