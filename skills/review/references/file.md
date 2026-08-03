# File input

Use this reference for selected files, a file list, or direct file/directory A/B
comparison.

- Preserve the user's stated scope. Expand only to definitions, consumers,
  tests, schemas, or configuration needed to validate a candidate defect.
- For A/B input, identify which side is the baseline or describe the comparison
  neutrally when direction is not known.
- For a current file with no earlier version, review its present behavior. Do
  not call an issue a regression without historical or behavioral evidence.
- Read enough surrounding code to understand control flow, error handling,
  ownership, and data boundaries; a suspicious line alone is rarely evidence.
- Check imports and external interfaces when a local change can break callers or
  serialized data, but do not turn a focused file review into an unbounded
  repository audit.
- Treat generated, vendored, minified, and binary files as limitations unless
  their source or behavior is available and relevant.

When the repository has Git history and the user expects a change review,
combine this reference with `git.md`. When only current quality matters, combine
it with `state.md` as needed.
