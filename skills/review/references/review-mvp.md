# Conditional review perspectives

Use only the perspectives signaled by the changed or inspected code. This is an
extension of the common defect MVP, not a checklist for every review.

## Tests and observability

- Can important failure, retry, or recovery behavior be verified without
  relying on an internal implementation detail?
- Will logs, metrics, traces, or error messages expose the wrong state without
  leaking sensitive data or hiding the original failure?

## User interface and accessibility

- Can keyboard, focus, screen-reader, loading, empty, and error states produce a
  blocked or misleading interaction?
- Does feedback remain associated with the action and input that caused it?

## Locale, time, Unicode, and platform

- Check timezone boundaries, daylight-saving transitions, sorting, parsing,
  normalization, path separators, case sensitivity, encodings, and line endings
  when the data or platform makes them reachable.

## Privacy and lifecycle

- Check collection, logging, retention, deletion, redaction, and authorization
  when personal or sensitive data crosses the reviewed boundary.
- Look for copies in caches, backups, events, and derived records that make an
  advertised deletion incomplete.

## Dependencies, install, and build

- Check dependency/API compatibility, lockfile meaning, optional and platform
  variants, build-time versus runtime availability, and install-hook trust.
- Treat generated or bundled output as evidence only when it corresponds to the
  reviewed source and build configuration.

Report a finding only when a realistic trigger, observable impact, and code or
behavior evidence survive surrounding validation.
