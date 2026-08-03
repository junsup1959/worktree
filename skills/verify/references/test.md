# Test evidence mode

Use this reference for completed changes, acceptance or regression claims,
existing tests or checks, and developer verification reports.

## Evidence MVP

- Restate the precise claim and identify the closest existing check that can
  observe it.
- Run the narrowest relevant check first. Expand to existing regression checks
  only when the affected boundary or risk justifies it.
- Capture the exact command, revision or workspace state when relevant, exit
  result, failures, skips, and meaningful output.
- Distinguish passed, failed, skipped, and not-run checks. A suite name or pass
  count alone does not prove coverage of the claim.
- Compare a developer's report with current evidence rather than accepting the
  report as proof.
- If the claim has no usable existing check, report a verification gap and
  describe the smallest missing scenario or command. Do not create the test.

Bound a passing conclusion to the behavior, environment, and checks actually
observed. Report unrelated failures separately from the target claim.
