# JSFWORK Codex initialization

Codex plugin installation makes the plugin's skills and MCP declarations
available, but it does not copy repository settings or custom agent profiles
into a target project. For a project without `.codex/config.toml`, this
initializer creates the canonical project configuration packaged at
`init-script/templates/codex/config.toml`. That template is kept byte-for-byte
aligned with this source repository's `.codex/config.toml` and includes the
models, sandbox, project-scoped Sequential Thinking MCP, tools, memories,
history, agents, apps, shell environment, and feature defaults used here,
including `features.hooks = true`.

For a project that already has a valid `.codex/config.toml`, initialization is
preservation-first: it does not replace the project with those defaults. It
keeps the existing settings and comments and adds only the JSFWORK-required
features when either is absent:

```toml
[features]
multi_agent = true
hooks = true
```

It also installs these project-local custom agent profiles:

```text
.codex/agents/explore.toml
.codex/agents/orcheestrate-team-pl.toml
.codex/agents/orcheestrate-team-developer.toml
.codex/agents/orcheestrate-team-qa.toml
```

The `explore` profile requests `gpt-5.3-codex-spark` with low reasoning effort.
It uses a `workspace-write` sandbox only to create the single summary-source
file designated by the caller. Its instructions prohibit Codex memory use and
all other filesystem mutations. When one session is insufficient, the main
thread may spawn several sessions from this one profile.

The team PL and QA request `gpt-5.6-luna` with high reasoning effort and a read-only
sandbox. The reusable team developer profile requests
`gpt-5.6-terra` with medium reasoning effort and a `workspace-write`
sandbox. The orchestrator spawns two sessions from that one profile; each
spawn's initial prompt and stable task name assign its Developer 1 or Developer
2 runtime identity. Skills must record the actual model or runtime override
when the host cannot honor a requested profile.

Each team role TOML contains enough behavior and boundaries to run that role
without assuming the entire orchestration Skill text was inherited. The
`orcheestrate-team` Skill remains responsible for the five-member roster,
assignment and coordination flow, and review gates.

It never imports `global_config.toml` or edits the user's global Codex
configuration. There is no global initialization mode: the user home
directory, a filesystem root, and any target that would resolve to the
effective `CODEX_HOME/config.toml` are rejected before preview or apply.

## Recommended flow

After installing or updating the JSFWORK plugin, open the target repository and
ask Codex:

```text
Use $jswork:setup to configure and verify JSWORK for this repository.
```

Project initialization and plugin activation are separate. The initializer
updates or verifies only the target project's `.codex/config.toml` and four
agent profiles; it does not copy changed Skills, refresh an installed plugin
cache, or reload the active Codex session. In the JSWORK source checkout, setup
therefore compares the source, the repository-local generated files, the exact
installed package root used by the Skill, and fresh-session evidence as four
separate states. A passing `--check` proves only the project state. Updating
source files or marketplace metadata alone does not prove that changed Skill
content is installed or active.

The skill resolves the current project to
`<project>/.codex/config.toml` and previews the exact change. A Skill does not
grant filesystem permissions, and some Codex sandboxes keep `.codex/`
read-only even when the rest of the workspace is writable. The skill therefore
applies the change only when the Codex host grants a narrowly scoped write. If
an actual access-denied error occurs, it requests approval once for only the
failed command and exact repository-local paths, then retries once. If that
approval path is unavailable or denied, it gives you the exact command to run
in a regular PowerShell terminal outside the Codex sandbox. Invalid TOML,
profile conflicts, missing commands, and Graphify validation errors are not
misreported as permission failures.

When Graphify is already enabled in the target project, the skill also composes
with Graphify's native Codex installer:

```powershell
graphify codex install
```

It runs that command from the target project after write permission is
available. The Graphify command, not `init_codex.py`, owns the managed Graphify
section in root `AGENTS.md` and the `PreToolUse` `hook-check` registration in
`.codex/hooks.json`. This is intentional: Codex Desktop rejects
`additionalContext` on `PreToolUse`, so the usable Graphify CLI guidance comes
from `AGENTS.md`.

The skill considers Graphify project-enabled only when the CLI is available and
the target also has a project signal such as
`.codex/skills/graphify/SKILL.md`, `graphify-out/graph.json`, or an existing
`## graphify` section in `AGENTS.md`. A globally installed executable alone
does not opt every repository into Graphify.

For this source repository, the resolved destination is:

```text
C:\project\worktree\.codex\config.toml
```

## Direct command

Python 3.11 or newer is required.

This is the canonical fallback when Codex cannot write the protected `.codex/`
path. Run it from your own PowerShell session:

```powershell
# Current directory becomes the target project
python .\init-script\init_codex.py

# Apply to C:\project\worktree\.codex\config.toml and then verify
python .\init-script\init_codex.py --target C:\project\worktree --apply
python .\init-script\init_codex.py --target C:\project\worktree --check

# If Graphify is already project-enabled, install or refresh its Codex files
Set-Location C:\project\worktree
graphify codex install

# Explicit migration: preview, remove only retired Explorer agents, then verify
python .\init-script\init_codex.py --target C:\project\worktree --remove-legacy-explorers
python .\init-script\init_codex.py --target C:\project\worktree --apply --remove-legacy-explorers
python .\init-script\init_codex.py --target C:\project\worktree --check --remove-legacy-explorers
```

The initializer preserves valid existing configuration TOML and comments; the
canonical full template is used only when `config.toml` does not exist.
Before changing an existing `config.toml`, it creates a timestamped
`config.toml.jsfwork-<timestamp>.bak` next to it and writes the replacement
atomically. Configuration and profile changes are treated as one file set; if
a later write fails, earlier writes are restored to their exact prior content.
A backup created by that failed transaction is removed after a complete
rollback; if rollback is incomplete, the backup is retained and reported for
manual recovery. Successful-run and older backups are never removed
automatically.
Destinations that escape the target project or traverse a symlink or directory
junction are rejected. An existing project agent profile with different
content is a conflict and is never overwritten; rename or reconcile it
explicitly and rerun the initializer.

For a new project, the initializer creates exactly the four profiles listed
above. By default, it does not delete unrecognized or legacy project profiles.
When the user explicitly requests removal of the retired Explorer family,
`--remove-legacy-explorers` previews or removes only `base-explorer.toml`,
`code-explorer.toml`, `data-explorer.toml`, and `doc-explorer.toml`; deletions
participate in the same rollback transaction as writes. With `--check`, the
flag verifies that none of those four files remain. Other custom profiles stay
untouched.

If a previous initialization left `orcheestrate-team-developer-1.toml` or
`orcheestrate-team-developer-2.toml`, both files remain untouched; review and
remove or reconcile them explicitly after adopting the shared developer
profile. Preview, `--apply`, and `--check` emit a non-failing reconciliation
warning while either legacy file remains.

The reference file at `skills/setup/assets/AGENTS.md` shows the expected
native Graphify guidance. Do not copy or merge it into a project directly;
`graphify codex install` performs the idempotent update and preserves the
native ownership boundary.

Plugin installation and project initialization have different scopes. The
JSFWORK plugin may be discovered through the personal marketplace, while this
workflow writes only the selected project's JSFWORK configuration and profiles,
plus the native Graphify Codex files when that project already enabled
Graphify.

Hook registration follows the same boundary. The installed `jswork` package
registers its learning hooks through `.codex-plugin/plugin.json` and
`hooks/hooks.json`; the initializer never copies those handlers into the target
project's `.codex/hooks.json` and never creates `.jsfwork`. Setting
`features.hooks = true` only enables hook support. In this workflow, any
project-local `.codex/hooks.json` entry is preserved, and Graphify alone owns
its `PreToolUse` `hook-check` registration.

An existing `features.multi_agent = false` or `features.hooks = false` is
treated as an explicit repository decision and is not overwritten. Override
either only when intentional:

```powershell
python .\init-script\init_codex.py --target C:\path\to\repository --apply --force
```

Invalid TOML is reported without modifying or backing up the file. `--force`
can override only an explicit false value for the two required features; it
never overwrites an agent profile.
