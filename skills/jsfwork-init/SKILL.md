---
name: jsfwork-init
description: Safely initialize or verify repository-local Codex configuration required by the JSFWORK plugin, including native Codex integration when Graphify is already enabled for the project. Use when a user asks to initialize, configure, install, enable, check, or repair JSFWORK for the current repository after plugin installation.
---

# JSFWORK Init

## Overview

Configure the repository-local Codex defaults and custom agent profiles
required by JSFWORK. For a project without `.codex/config.toml`, create the
canonical configuration packaged at
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
`.codex/hooks.json`. Do not duplicate its merge behavior in the JSFWORK Python
initializer.

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

## Workflow

1. Resolve the plugin root as two directories above this `SKILL.md`, then use
   `<plugin-root>/init-script/init_codex.py`.
2. Treat the current working directory as the target project unless the user
   named another project. The JSFWORK initializer destinations must always
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
   JSFWORK initialization. If the user explicitly asked to install Graphify
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
   JSFWORK, ask the Codex host for permission limited to the exact applicable
   writes. Run the JSFWORK apply command when its preview contains a change:

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
8. Run `--check` after a successful JSFWORK apply and report the exact
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
   If JSFWORK `--check` passes but this Graphify verification fails, report
   JSFWORK as configured and Graphify integration as incomplete. Do not collapse
   the two states into a generic initialization success or failure.
10. Tell the user to start a new Codex session in the repository so project-local
   configuration is loaded.

If the user only asks what would change, how initialization works, or whether
the repository is ready, do not apply changes. Use preview or `--check`.

## Conflict Policy

- Never copy or merge `global_config.toml`.
- Never copy `assets/AGENTS.md` into a target or implement a second
  Graphify-specific merge. It is a reference sample of the expected native
  Graphify guidance only.
- Let `graphify codex install` own its `AGENTS.md` section and
  `.codex/hooks.json` entry. Do not add a duplicate JSFWORK-managed Graphify
  section or hook.
- Do not treat absent Graphify integration as a JSFWORK failure when the target
  project did not enable Graphify.
- Never edit a user-global Codex configuration.
- Never use the user home directory, a filesystem root, or `CODEX_HOME` as a
  project target.
- When `.codex/config.toml` is absent, create it from the packaged canonical
  template. When it exists, preserve its valid settings and comments instead
  of forcing it to match the template; merge only `features.multi_agent` and
  `features.hooks`.
- If either required feature is explicitly `false`, leave it unchanged and
  explain the conflict. Use `--apply --force` only when the user explicitly
  asks to override that value.
- Never overwrite an existing project agent profile with different content.
  Report the exact conflicting file so the user can rename or reconcile it.
  `--force` applies only to an explicit false value for the two required
  features; it does not override agent profiles.
- Never delete unrecognized project agent profiles. Retired Explorer profiles
  may be removed only after an explicit user request and only through
  `--remove-legacy-explorers`, which is limited to `base-explorer.toml`,
  `code-explorer.toml`, `data-explorer.toml`, and `doc-explorer.toml`.
  In particular, an existing `orcheestrate-team-developer-1.toml` or
  `orcheestrate-team-developer-2.toml` remains untouched when the shared
  developer profile is installed. Preview, apply, and check report these exact
  files with a non-failing warning so they can be reconciled explicitly instead
  of silently treating them as migrated. Do not emit that legacy warning for
  unrelated custom profiles.
- Treat configuration and profile writes as one file set. If any write fails,
  restore earlier writes before reporting failure. Remove only a backup newly
  created by that same failed transaction when rollback succeeds; retain and
  report it when rollback is incomplete.
- If existing TOML is invalid, stop without editing it. Report the parse error
  and let the user decide whether to repair the file.
- Do not delete successful-run or older initializer backup files unless the
  user explicitly requests their removal.

## Expected Result

For a fresh target, `.codex/config.toml` is an exact copy of the packaged
canonical template, including `features.hooks = true`, the project-scoped
Sequential Thinking MCP, and the source repository's model, sandbox, tool,
memory, agent, application, shell-environment, and feature defaults.

For a target with an existing valid configuration, its prior settings and
comments remain intact. In both cases the effective JSFWORK-required value is:

```toml
[features]
multi_agent = true
hooks = true
```

It also has the `explore` project profile under `.codex/agents/`. It requests
`gpt-5.3-codex-spark`, low reasoning effort, and a `workspace-write` sandbox
only so it can create the one summary-source file designated by the caller.
Its instructions prohibit Codex memory use and all other filesystem mutations.
The main thread may start several sessions from this one profile when a single
session is insufficient for the assigned scope.

The same directory has `orcheestrate-team-pl`,
`orcheestrate-team-developer`, and `orcheestrate-team-qa`. PL and QA request
`gpt-5.4`, high reasoning effort, and a read-only sandbox. The reusable
developer profile requests `gpt-5.3-codex-spark`, medium reasoning effort, and
a `workspace-write` sandbox.

The orchestrator uses the shared developer profile for two separate spawned
sessions. Each spawn's initial prompt and stable task name identifies that
session as Developer 1 or Developer 2. The role TOMLs are self-contained for
their individual behavior and boundaries; the `orcheestrate-team` Skill owns
the fixed roster, task assignment, coordination, and review flow.

When Graphify was already enabled for the target, its native Codex integration
also leaves one managed Graphify guidance section in root `AGENTS.md` and one
compatible `PreToolUse` `hook-check` registration in `.codex/hooks.json`.
