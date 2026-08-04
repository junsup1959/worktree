# Debug evidence mode

Use this reference when the input is a suspected defect, error, log, runtime
failure, intermittent behavior, or environment-specific mismatch.

## Evidence MVP

- Identify the expected boundary and the exact observed mismatch.
- Reproduce from the closest user-visible or public interface with the smallest
  safe input. Capture the command or action, exit result, output, and relevant
  environment or configuration facts.
- Change one variable at a time when comparing working and failing cases.
- Repeat once when practical. If behavior is intermittent, report frequency and
  conditions instead of presenting one run as deterministic.
- Inspect only the code, configuration, and logs needed to explain the
  observation. A nearby log line or correlation is not proof of cause.
- Stop at evidence: report the demonstrated trigger and impact, or explain why
  the result remains inconclusive. Do not implement a fix.

Before running a diagnostic, identify its expected repository and external
state effects. Do not run a diagnostic that writes state or exceeds the active
role or sandbox; report it as not run and state the verification limit.
