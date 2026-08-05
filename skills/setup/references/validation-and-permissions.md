# Validation, Ownership, and Reflection

## Hook Ownership Guard

Before changing the target project, verify the installed package from the
resolved plugin root:

1. `.codex-plugin/plugin.json` has `name` set to `jswork` and `hooks` set to
   `./hooks/hooks.json`.
2. `hooks/hooks.json` exists and its JSWORK learning handlers use
   `${PLUGIN_ROOT}` on POSIX. Each Windows handler must use the package's
   shell-neutral `powershell.exe -EncodedCommand` launcher. Its decoded script
   resolves `$env:PLUGIN_ROOT` inside that nested PowerShell process and
   propagates Node's exit code. Never put `%PLUGIN_ROOT%`, `${PLUGIN_ROOT}`, or
   `$env:PLUGIN_ROOT` directly in the raw Windows command: Codex runs hook
   commands through the active session shell, which may be PowerShell, cmd.exe,
   or Git Bash.
3. Run the package self-test when Node.js is available:

   ```powershell
   node "<plugin-root>\hooks\self-test.mjs"
   ```

If package validation fails, report the plugin installation as incomplete and
stop. Never compensate by copying `hooks/hooks.json` or registering
`capture-learning-turn.mjs` in the target project's `.codex/hooks.json`.

Inspect an existing `<target-project>/.codex/hooks.json` read-only. Treat any
`UserPromptSubmit`, `Stop`, or `SessionEnd` handler for
`capture-learning-turn.mjs`, `${PLUGIN_ROOT}`, `%PLUGIN_ROOT%`, or
`$env:PLUGIN_ROOT` there as a misconfigured duplicate plugin hook. Report its
exact location and do not add another hook. Do not delete or rewrite it without
an explicit repair request.

## Reflection Audit

Initialization and plugin activation are separate evidence surfaces. Before
claiming that recent changes are reflected, report these states independently:

- **Source package:** the changed files and checks in the source checkout.
- **Project state:** `.codex/config.toml` and the four agent profiles generated
  from the resolved plugin root. Run `init_codex.py --check`; for the JSWORK
  source repository, also compare its project profiles and configuration with
  the packaged templates.
- **Installed package:** the exact resolved `<plugin-root>` used by this Skill.
  When the target is a JSWORK source checkout but that root is an installed
  cache elsewhere, compare the requested changed package files across both
  roots. A content mismatch means the installed package is stale even when the
  manifest version or marketplace metadata matches.
- **Active session:** a new Codex session after project apply or package refresh.
  Do not claim that the current session reloaded changed Skills or profiles.

The initializer never copies plugin Skills, manifests, hooks, or documentation
into a target and never refreshes the installed plugin cache. Its `--check`
proves only the project configuration and agent-profile state. Do not install,
update, reinstall, or edit cache content without an explicit user request. If
source, project, installed-package, or session evidence is missing or differs,
name the incomplete layer and the exact next action instead of reporting a
generic setup success.

## Permission Boundary

- A Skill supplies instructions; it does not receive filesystem privileges.
- Treat `<target-project>/.codex/` as a potentially protected path even when
  the rest of the repository is writable.
- Never weaken the sandbox, change approval policy, or try to bypass a denied
  write.
- Preview and check operations are read-only. An apply operation may require a
  narrowly scoped approval from the Codex host.
- Treat `graphify codex install` as a write operation. It may update both the
  repository-root `AGENTS.md` and `.codex/hooks.json`.
- Classify a failure as a permission problem only when the host denies the
  operation or the command reports an operating-system access-denied or
  `PermissionError`. Command-not-found, invalid TOML, profile conflicts, and
  Graphify validation failures are not permission problems.
