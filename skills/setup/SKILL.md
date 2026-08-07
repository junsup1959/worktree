---
name: setup
description: Safely initialize or verify repository-local Codex configuration required by the jswork plugin, including package-hook integrity and native Codex integration when Graphify is already enabled for the project. Use when a user asks to set up, initialize, configure, install, enable, check, or repair jswork for the current repository after plugin installation.
---

# JSWORK Setup

## Overview

Configure the repository-local Codex defaults and custom agent profiles
required by the `jswork` plugin. For a project without `.codex/config.toml`,
create the canonical configuration packaged at
`<plugin-root>/init-script/templates/codex/config.toml`. It mirrors this plugin
source repository's project configuration; it is not the developer's global
configuration. The template includes `features.hooks = true`. For an existing
valid project configuration, preserve its settings and comments and merge only
the required `features.multi_agent` and `features.hooks` values. Keep plugin
installation separate from target-project initialization and provide no global
initialization mode.

When Graphify is already enabled for the target project, compose with its
native `graphify codex install` command. That command owns the Graphify section
in the repository-root `AGENTS.md` and the Graphify registration in
`.codex/hooks.json`. Do not duplicate its merge behavior in the JSWORK Python
initializer.

Keep three hook surfaces separate:

- The installed `jswork` package declares `hooks/hooks.json` through
  `.codex-plugin/plugin.json`. Every JSWORK learning handler must invoke
  `node "${PLUGIN_ROOT}/hooks/capture-learning-turn.mjs"` directly through its
  generic `command`. Do not define `commandWindows` or wrap the invocation with
  PowerShell, `pwsh`, or `EncodedCommand`. Codex loads these plugin hooks; never
  copy them into a target repository.
- `features.hooks = true` in `<target-project>/.codex/config.toml` enables hook
  support but does not register a hook or create `.codex/hooks.json`.
- Only Graphify may add its project-local `PreToolUse` `hook-check` entry to
  `<target-project>/.codex/hooks.json` in this workflow.

## Required References

- Before any preview, check, apply, or repair, read
  [validation-and-permissions.md](references/validation-and-permissions.md)
  completely. It defines hook ownership, reflection evidence, and permission
  handling.
- Before applying changes, forcing feature values, removing retired profiles,
  resolving a preview/check conflict, or validating fresh-project output, read
  [project-contract.md](references/project-contract.md) completely.

## Workflow

1. Resolve the plugin root as two directories above this `SKILL.md`, then use
   `<plugin-root>/init-script/init_codex.py`.
2. Treat the current working directory as the target project unless the user
   named another project. The JSWORK initializer destinations must always
   resolve under
   `<target-project>/.codex/`: `config.toml`, the single `explore` profile, and
   three `orcheestrate-team` role profiles under `agents/`. Reject the user home
   directory, a filesystem root, and any target whose configuration destination
   is the effective `CODEX_HOME/config.toml`. Reject destinations that escape
   through a symlink or directory junction. Do not require an existing Git
   repository because the target may be a newly created project.
3. Detect whether Graphify is enabled for this target. Require the `graphify`
   command plus at least one project-local signal: `.codex/skills/graphify/SKILL.md`,
   `graphify-out/graph.json`, or an existing `## graphify` section in
   `AGENTS.md`. A globally available CLI alone does not opt every project into
   Graphify. If Graphify is not enabled, skip its integration without failing
   JSWORK initialization. If the user explicitly asked to install Graphify
   itself, treat `graphify install --project --platform codex` as a separate
   requested action.
4. Run the initializer without `--apply` first and inspect its preview:

   ```powershell
   python "<plugin-root>\init-script\init_codex.py" --target "<target-project>"
   ```

   If the user explicitly requested removal of the retired Explorer agent
   family, append `--remove-legacy-explorers` to preview only those four exact
   deletions.

5. If the user requested only preview, readiness, or check, do not run
   `graphify codex install` because it has no read-only preview mode. Inspect
   `AGENTS.md` and `.codex/hooks.json` read-only instead.
6. If the user asked to initialize, configure, enable, install, or repair
   JSWORK, ask the Codex host for permission limited to the exact applicable
   writes. Run the JSWORK apply command when its preview contains a change:

   ```powershell
   python "<plugin-root>\init-script\init_codex.py" --target "<target-project>" --apply
   ```

   Preserve the preview's `--remove-legacy-explorers` flag on the apply command
   only when the user explicitly requested that migration.

   When Graphify was detected in step 3, also run this command with the working
   directory set exactly to `<target-project>`:

   ```powershell
   graphify codex install
   ```

   Let this native command idempotently manage the Graphify guidance in
   `AGENTS.md` and its `PreToolUse` hook in `.codex/hooks.json`. The hook is an
   intentional `hook-check`; Codex Desktop does not accept
   `additionalContext` from `PreToolUse`, so the actual usage guidance belongs
   in `AGENTS.md`.

   Run each command only after the required permission is granted. Do not treat
   the user's initialization request as proof that the sandbox granted a write.
   If an actual permission failure occurs and the host supports approval, ask
   once for approval limited to the failed command and its exact repository-local
   destinations, then retry that command once. Never request broader filesystem
   access or enter an approval/retry loop.
7. If permission cannot be requested, is denied, or the environment remains
   read-only after the one approved retry, do not retry again or claim success.
   Give the user every applicable command above with all resolved paths and
   flags, name `<target-project>` as the required working directory, and ask
   them to run the commands from a regular PowerShell terminal outside the
   Codex sandbox. Resume read-only verification only after they confirm
   completion.
8. Run `--check` after a successful JSWORK apply and report the exact
   configuration path:

   ```powershell
   python "<plugin-root>\init-script\init_codex.py" --target "<target-project>" --check
   ```

   Preserve `--remove-legacy-explorers` on the check command when that
   migration was requested so the absence of all four retired profiles is
   verified.

9. When Graphify was detected, verify without modifying files that:
   - the root `AGENTS.md` Graphify section directs codebase questions to
     `graphify query`, with `path`, `explain`, and `update` guidance; and
   - `.codex/hooks.json` preserves unrelated hooks and includes a `PreToolUse`
     command whose executable-specific prefix may vary but whose command ends
     in `hook-check`.
   - no JSWORK learning hook handler was copied into `.codex/hooks.json`.
   If JSWORK `--check` passes but this Graphify verification fails, report
   JSWORK as configured and Graphify integration as incomplete. Do not collapse
   the two states into a generic initialization success or failure.
10. Perform the Reflection Audit from
    [validation-and-permissions.md](references/validation-and-permissions.md)
    and report source, project, installed-package, and active-session status
    separately.
11. Tell the user to start a new Codex session in the repository after a project
    apply or package refresh so changed configuration and Skills are loaded.

If the user only asks what would change, how initialization works, or whether
the repository is ready, do not apply changes. Use preview or `--check`.
