# Project Contract

## Conflict Policy

- Never copy or merge `global_config.toml`.
- Never copy `assets/AGENTS.md` into a target or implement a second
  Graphify-specific merge. It is a reference sample of the expected native
  Graphify guidance only.
- Let `graphify codex install` own its `AGENTS.md` section and
  `.codex/hooks.json` entry. Do not add a duplicate JSWORK-managed Graphify
  section or hook.
- Do not treat absent Graphify integration as a JSWORK failure when the target
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
Sequential Thinking MCP, `gpt-5.6-terra` for both memory models, and the source
repository's sandbox, tool, agent, application, shell-environment, and defaults.

For a target with an existing valid configuration, its prior settings and
comments remain intact. In both cases the effective JSWORK-required value is:

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
`gpt-5.6-luna`, high reasoning effort, and a read-only sandbox. The reusable
developer profile requests `gpt-5.6-terra`, medium reasoning effort, and
a `workspace-write` sandbox.

The orchestrator uses the shared developer profile for two separate spawned
sessions. Each spawn's initial prompt and stable task name identifies that
session as Developer 1 or Developer 2. The role TOMLs are self-contained for
their individual behavior and boundaries; the `orcheestrate-team` Skill owns
the fixed roster, task assignment, coordination, and review flow.

When Graphify was already enabled for the target, its native Codex integration
also leaves one managed Graphify guidance section in root `AGENTS.md` and one
compatible `PreToolUse` `hook-check` registration in `.codex/hooks.json`.

The final setup report distinguishes source, project, installed-package, and
active-session evidence. A passing initializer check is never reported as
proof that changed plugin Skill content is installed or active.
