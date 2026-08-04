#!/usr/bin/env python3
"""Safely initialize repository-local Codex defaults for JSFWORK."""

from __future__ import annotations

import argparse
import difflib
import os
import re
import shutil
import stat
import sys
import tempfile
import tomllib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
TEMPLATE_PATH = SCRIPT_DIR / "templates" / "codex" / "config.toml"
AGENT_TEMPLATE_DIR = SCRIPT_DIR / "templates" / "codex" / "agents"
REQUIRED_AGENT_PROFILES = {
    "explore": {
        "model": "gpt-5.3-codex-spark",
        "model_reasoning_effort": "low",
        "sandbox_mode": "workspace-write",
    },
    "orcheestrate-team-pl": {
        "model": "gpt-5.6-luna",
        "model_reasoning_effort": "high",
        "sandbox_mode": "read-only",
    },
    "orcheestrate-team-developer": {
        "model": "gpt-5.6-terra",
        "model_reasoning_effort": "medium",
        "sandbox_mode": "workspace-write",
    },
    "orcheestrate-team-qa": {
        "model": "gpt-5.6-luna",
        "model_reasoning_effort": "high",
        "sandbox_mode": "read-only",
    },
}
REQUIRED_AGENT_NAMES = tuple(REQUIRED_AGENT_PROFILES)
REQUIRED_FEATURE_NAMES = ("multi_agent", "hooks")
LEGACY_TEAM_DEVELOPER_PROFILE_NAMES = (
    "orcheestrate-team-developer-1",
    "orcheestrate-team-developer-2",
)
LEGACY_EXPLORER_PROFILE_NAMES = (
    "base-explorer",
    "code-explorer",
    "data-explorer",
    "doc-explorer",
)
UTF8_BOM = b"\xef\xbb\xbf"

FEATURES_HEADER_RE = re.compile(
    r"(?m)^[ \t]*\[[ \t]*features[ \t]*\][ \t]*(?:#.*)?(?:\r?\n|$)"
)
NEXT_TABLE_RE = re.compile(r"(?m)^[ \t]*\[{1,2}[^\r\n]+")
DOTTED_FEATURE_RE = re.compile(
    r"""(?mx)
    ^[ \t]*(?:"features"|'features'|features)[ \t]*\.
    """
)


class InitError(RuntimeError):
    """Expected initialization failure with a user-actionable message."""


class InitPermissionError(InitError):
    """Initialization failure caused by repository filesystem permissions."""


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Preview or apply repository-local Codex defaults and agent "
            "profiles required by JSFWORK."
        )
    )
    parser.add_argument(
        "--target",
        type=Path,
        default=Path.cwd(),
        help="Repository root to initialize (default: current directory).",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Apply the proposed change. The default is preview-only.",
    )
    mode.add_argument(
        "--check",
        action="store_true",
        help="Verify that the target is already configured; do not write.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "With --apply, replace an explicit false value for a required "
            "feature (multi_agent or hooks). "
            "Never implied by normal initialization."
        ),
    )
    parser.add_argument(
        "--remove-legacy-explorers",
        action="store_true",
        help=(
            "Remove only the four retired Explorer agent profiles. "
            "Preview-only unless combined with --apply."
        ),
    )
    args = parser.parse_args(argv)
    if args.force and not args.apply:
        parser.error("--force requires --apply")
    return args


def parse_toml(text: str, label: str) -> dict[str, Any]:
    try:
        return tomllib.loads(text)
    except tomllib.TOMLDecodeError as exc:
        raise InitError(f"{label} is not valid TOML: {exc}") from exc


def read_utf8(path: Path) -> tuple[str, bool]:
    raw = path.read_bytes()
    has_bom = raw.startswith(UTF8_BOM)
    if has_bom:
        raw = raw[len(UTF8_BOM) :]
    try:
        return raw.decode("utf-8"), has_bom
    except UnicodeDecodeError as exc:
        raise InitError(f"{path} must be UTF-8 encoded: {exc}") from exc


def load_template() -> str:
    text, _ = read_utf8(TEMPLATE_PATH)
    data = parse_toml(text, str(TEMPLATE_PATH))
    for feature_name in REQUIRED_FEATURE_NAMES:
        if get_feature(data, str(TEMPLATE_PATH), feature_name) is not True:
            raise InitError(
                f"{TEMPLATE_PATH} must define "
                f"[features].{feature_name} = true"
            )
    return text if text.endswith(("\n", "\r")) else text + "\n"


def load_agent_templates() -> dict[str, str]:
    templates: dict[str, str] = {}
    for agent_name in REQUIRED_AGENT_NAMES:
        path = AGENT_TEMPLATE_DIR / f"{agent_name}.toml"
        if not path.is_file():
            raise InitError(f"missing JSFWORK agent template: {path}")
        text, _ = read_utf8(path)
        data = parse_toml(text, str(path))
        expected = {
            "name": agent_name,
            **REQUIRED_AGENT_PROFILES[agent_name],
        }
        for key, value in expected.items():
            if data.get(key) != value:
                raise InitError(f"{path} must define {key} = {value!r}")
        if not isinstance(data.get("description"), str) or not data[
            "description"
        ].strip():
            raise InitError(f"{path} must define a non-empty description")
        if not isinstance(data.get("developer_instructions"), str) or not data[
            "developer_instructions"
        ].strip():
            raise InitError(
                f"{path} must define non-empty developer_instructions"
            )
        templates[agent_name] = (
            text if text.endswith(("\n", "\r")) else text + "\n"
        )
    return templates


def get_feature(
    data: dict[str, Any], label: str, feature_name: str
) -> bool | None:
    features = data.get("features")
    if features is None:
        return None
    if not isinstance(features, dict):
        raise InitError(f"{label}: 'features' must be a TOML table")
    if feature_name not in features:
        return None
    value = features[feature_name]
    if not isinstance(value, bool):
        raise InitError(
            f"{label}: features.{feature_name} must be a boolean"
        )
    return value


def newline_for(text: str) -> str:
    return "\r\n" if "\r\n" in text else "\n"


def reflow_newlines(text: str, newline: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").replace("\n", newline)


def append_template(existing: str, template: str, newline: str) -> str:
    rendered_template = reflow_newlines(template, newline).lstrip("\r\n")
    if not existing:
        return rendered_template

    separator = ""
    if not existing.endswith(("\n", "\r")):
        separator += newline
    if not (existing + separator).endswith(newline + newline):
        separator += newline
    return existing + separator + rendered_template


def add_to_features_table(
    existing: str, newline: str, feature_names: list[str]
) -> str | None:
    header = FEATURES_HEADER_RE.search(existing)
    if header is None:
        return None
    separator = "" if header.group(0).endswith(("\n", "\r")) else newline
    assignments = "".join(
        f"{feature_name} = true{newline}" for feature_name in feature_names
    )
    insertion = separator + assignments
    return existing[: header.end()] + insertion + existing[header.end() :]


def feature_false_re(feature_name: str, *, dotted: bool) -> re.Pattern[str]:
    key = re.escape(feature_name)
    feature_key = rf"(?:\"{key}\"|'{key}'|{key})"
    if dotted:
        prefix = rf"""
            [ \t]*(?:"features"|'features'|features)[ \t]*\.[ \t]*
            {feature_key}[ \t]*=[ \t]*
        """
    else:
        prefix = rf"[ \t]*{feature_key}[ \t]*=[ \t]*"
    return re.compile(
        rf"""(?mx)
        ^
        (?P<prefix>{prefix})
        (?P<value>false)
        (?P<suffix>[ \t]*(?:\#.*)?)
        (?=\r?$)
        """
    )


def replace_false(existing: str, feature_name: str) -> str:
    header = FEATURES_HEADER_RE.search(existing)
    if header is not None:
        next_table = NEXT_TABLE_RE.search(existing, header.end())
        section_end = next_table.start() if next_table else len(existing)
        section = existing[header.end() : section_end]
        matches = list(
            feature_false_re(feature_name, dotted=False).finditer(section)
        )
        if len(matches) == 1:
            match = matches[0]
            start = header.end() + match.start("value")
            end = header.end() + match.end("value")
            return existing[:start] + "true" + existing[end:]

    dotted_matches = list(
        feature_false_re(feature_name, dotted=True).finditer(existing)
    )
    if len(dotted_matches) == 1:
        match = dotted_matches[0]
        return (
            existing[: match.start("value")]
            + "true"
            + existing[match.end("value") :]
        )

    raise InitError(
        f"features.{feature_name} is false, but its formatting cannot be "
        "changed safely. Set it to true manually."
    )


def add_missing_features(
    existing: str,
    data: dict[str, Any],
    feature_names: list[str],
    newline: str,
) -> str:
    rendered = add_to_features_table(existing, newline, feature_names)
    if rendered is not None:
        return rendered

    assignments = "".join(
        f"{feature_name} = true{newline}" for feature_name in feature_names
    )
    if data.get("features") is None:
        block = f"[features]{newline}{assignments}"
        return append_template(existing, block, newline)

    dotted_feature = DOTTED_FEATURE_RE.search(existing)
    if dotted_feature is not None:
        dotted_assignments = "".join(
            f"features.{feature_name} = true{newline}"
            for feature_name in feature_names
        )
        return (
            existing[: dotted_feature.start()]
            + dotted_assignments
            + existing[dotted_feature.start() :]
        )

    names = ", ".join(f"features.{name}" for name in feature_names)
    raise InitError(
        f"cannot safely add {names} to the existing features declaration; "
        "add the boolean value(s) manually"
    )


def render_config(existing: str, template: str, label: str, force: bool) -> str:
    if not existing:
        rendered = template
        rendered_data = parse_toml(rendered, "generated configuration")
        for feature_name in REQUIRED_FEATURE_NAMES:
            if (
                get_feature(
                    rendered_data, "generated configuration", feature_name
                )
                is not True
            ):
                raise InitError(
                    "generated configuration did not enable " + feature_name
                )
        return rendered

    data = parse_toml(existing, label)
    states = {
        feature_name: get_feature(data, label, feature_name)
        for feature_name in REQUIRED_FEATURE_NAMES
    }
    disabled = [name for name, value in states.items() if value is False]
    if disabled:
        if not force:
            names = ", ".join(f"features.{name}" for name in disabled)
            raise InitError(
                f"{label} explicitly sets {names} = false; "
                "leaving it unchanged. Re-run with --apply --force only if "
                "you intend to override those repository decisions."
            )
        rendered = existing
        for feature_name in disabled:
            rendered = replace_false(rendered, feature_name)
    else:
        rendered = existing

    rendered_data = parse_toml(rendered, "generated configuration")
    missing = [
        feature_name
        for feature_name in REQUIRED_FEATURE_NAMES
        if get_feature(
            rendered_data, "generated configuration", feature_name
        )
        is None
    ]
    if missing:
        newline = newline_for(existing)
        rendered = add_missing_features(
            rendered, rendered_data, missing, newline
        )

    rendered_data = parse_toml(rendered, "generated configuration")
    for feature_name in REQUIRED_FEATURE_NAMES:
        if (
            get_feature(
                rendered_data, "generated configuration", feature_name
            )
            is not True
        ):
            raise InitError(
                "generated configuration did not enable " + feature_name
            )
    return rendered


def make_backup(config_path: Path) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_path = config_path.with_name(
        f"{config_path.name}.jsfwork-{timestamp}.bak"
    )
    try:
        shutil.copy2(config_path, backup_path)
    except Exception as exc:
        try:
            backup_path.unlink(missing_ok=True)
        except OSError as cleanup_exc:
            raise InitError(
                "backup creation failed and cleanup was incomplete: "
                f"{backup_path}: {cleanup_exc}"
            ) from exc
        raise
    return backup_path


def atomic_write(
    path: Path, text: str, *, with_bom: bool, existing_mode: int | None
) -> None:
    payload = (UTF8_BOM if with_bom else b"") + text.encode("utf-8")
    atomic_write_bytes(path, payload, existing_mode=existing_mode)


def atomic_write_bytes(
    path: Path, payload: bytes, *, existing_mode: int | None
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            prefix=f".{path.name}.jsfwork-",
            suffix=".tmp",
            dir=path.parent,
            delete=False,
        ) as temporary:
            temporary.write(payload)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        if existing_mode is not None:
            os.chmod(temporary_path, existing_mode)
        os.replace(temporary_path, path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def print_diff(path: Path, existing: str, rendered: str) -> None:
    old_name = str(path) if path.exists() else "/dev/null"
    diff = difflib.unified_diff(
        existing.splitlines(keepends=True),
        rendered.splitlines(keepends=True),
        fromfile=old_name,
        tofile=str(path),
    )
    output = "".join(diff)
    if output and not output.endswith("\n"):
        output += "\n"
    print(output, end="")


def check_config(config_path: Path) -> None:
    if not config_path.is_file():
        raise InitError(f"{config_path} does not exist")
    existing, _ = read_utf8(config_path)
    data = parse_toml(existing, str(config_path))
    disabled = [
        feature_name
        for feature_name in REQUIRED_FEATURE_NAMES
        if get_feature(data, str(config_path), feature_name) is not True
    ]
    if disabled:
        names = ", ".join(f"features.{name}" for name in disabled)
        raise InitError(
            f"{config_path} does not enable required feature(s): {names}"
        )
    print(f"JSFWORK Codex configuration is ready: {config_path}")


def prepare_agent_changes(
    target: Path, templates: dict[str, str]
) -> list[tuple[Path, str]]:
    changes: list[tuple[Path, str]] = []
    agent_dir = target / ".codex" / "agents"
    for agent_name, template in templates.items():
        destination = agent_dir / f"{agent_name}.toml"
        if not destination.exists():
            changes.append((destination, template))
            continue
        if not destination.is_file():
            raise InitError(
                f"agent profile destination is not a file: {destination}"
            )
        existing, _ = read_utf8(destination)
        existing_data = parse_toml(existing, str(destination))
        template_data = parse_toml(
            template, f"template for {agent_name}"
        )
        if existing_data != template_data:
            raise InitError(
                f"{destination} already exists with different content; "
                "JSFWORK will not overwrite a project agent profile. "
                "Rename or reconcile it explicitly, then run initialization "
                "again."
            )
    return changes


def check_agents(target: Path, templates: dict[str, str]) -> None:
    changes = prepare_agent_changes(target, templates)
    if changes:
        missing = ", ".join(str(path) for path, _ in changes)
        raise InitError(f"missing JSFWORK agent profiles: {missing}")
    print(
        "JSFWORK agent profiles are ready: "
        f"{target / '.codex' / 'agents'}"
    )


def legacy_explorer_paths(target: Path) -> list[Path]:
    agent_dir = target / ".codex" / "agents"
    return [
        agent_dir / f"{name}.toml"
        for name in LEGACY_EXPLORER_PROFILE_NAMES
    ]


def existing_legacy_explorer_paths(target: Path) -> list[Path]:
    paths: list[Path] = []
    for path in legacy_explorer_paths(target):
        if not path.exists():
            continue
        if not path.is_file():
            raise InitError(f"legacy Explorer profile is not a file: {path}")
        paths.append(path)
    return paths


def warn_legacy_team_developer_profiles(target: Path) -> None:
    agent_dir = target / ".codex" / "agents"
    legacy_paths = [
        agent_dir / f"{name}.toml"
        for name in LEGACY_TEAM_DEVELOPER_PROFILE_NAMES
        if (agent_dir / f"{name}.toml").exists()
    ]
    if not legacy_paths:
        return

    paths = ", ".join(str(path) for path in legacy_paths)
    print(
        "warning: legacy JSFWORK developer profile(s) remain unchanged: "
        f"{paths}. The shared orcheestrate-team-developer profile does not "
        "replace or delete them; reconcile or remove the legacy profile(s) "
        "explicitly.",
        file=sys.stderr,
    )


def effective_codex_home() -> Path:
    configured = os.environ.get("CODEX_HOME")
    if configured:
        return Path(configured).expanduser().resolve()
    return (Path.home() / ".codex").resolve()


def is_link_or_junction(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    return bool(is_junction and is_junction())


def validate_project_paths(target: Path, paths: list[Path]) -> None:
    for path in paths:
        resolved = path.resolve(strict=False)
        try:
            resolved.relative_to(target)
        except ValueError as exc:
            raise InitError(
                f"repository-local destination escapes project root: "
                f"{path} -> {resolved}"
            ) from exc

        relative = path.relative_to(target)
        current = target
        for part in relative.parts:
            current /= part
            if current.exists() and is_link_or_junction(current):
                raise InitError(
                    "repository-local destination traverses a symlink or "
                    f"junction: {current}"
                )


def validate_project_target(target: Path) -> Path:
    resolved = target.expanduser().resolve()
    if not resolved.is_dir():
        raise InitError(f"target project does not exist: {resolved}")
    if resolved == Path.home().resolve():
        raise InitError(
            "refusing to initialize the user home directory; choose a project "
            "root"
        )
    if resolved.parent == resolved:
        raise InitError(
            "refusing to initialize a filesystem root; choose a project root"
        )

    config_path = (resolved / ".codex" / "config.toml").resolve()
    global_config_path = (effective_codex_home() / "config.toml").resolve()
    if config_path == global_config_path:
        raise InitError(
            "refusing to write the effective global Codex configuration at "
            f"{global_config_path}; choose a project root whose .codex "
            "directory is separate from CODEX_HOME"
        )
    return resolved


def missing_parent_directories(target: Path, paths: list[Path]) -> list[Path]:
    missing: set[Path] = set()
    for path in paths:
        parent = path.parent
        while parent != target:
            if not parent.exists():
                missing.add(parent)
            parent = parent.parent
    return sorted(missing, key=lambda item: len(item.parts), reverse=True)


def apply_file_changes(
    target: Path,
    changes: list[tuple[Path, str | None, bool, int | None]],
    *,
    backup_config: Path | None = None,
) -> Path | None:
    """Apply writes/deletions and restore exact prior state on any failure.

    A backup created for this transaction is removed when rollback succeeds.
    If rollback is incomplete, the backup is retained for manual recovery.
    """

    snapshots: dict[Path, tuple[bool, bytes, int | None]] = {}
    paths = [path for path, *_ in changes]
    created_directories = missing_parent_directories(target, paths)
    for path in paths:
        if path.exists():
            snapshots[path] = (
                True,
                path.read_bytes(),
                stat.S_IMODE(path.stat().st_mode),
            )
        else:
            snapshots[path] = (False, b"", None)

    backup_path: Path | None = None
    try:
        if backup_config is not None:
            backup_path = make_backup(backup_config)
        for path, text, with_bom, existing_mode in changes:
            if text is None:
                path.unlink(missing_ok=True)
                continue
            atomic_write(
                path,
                text,
                with_bom=with_bom,
                existing_mode=existing_mode,
            )
    except Exception as exc:
        rollback_errors: list[str] = []
        for path in reversed(paths):
            existed, payload, original_mode = snapshots[path]
            try:
                if existed:
                    atomic_write_bytes(
                        path, payload, existing_mode=original_mode
                    )
                else:
                    path.unlink(missing_ok=True)
            except OSError as rollback_exc:
                rollback_errors.append(f"{path}: {rollback_exc}")
        if not rollback_errors and backup_path is not None:
            try:
                backup_path.unlink(missing_ok=True)
            except OSError as rollback_exc:
                rollback_errors.append(f"{backup_path}: {rollback_exc}")
        for directory in created_directories:
            try:
                directory.rmdir()
            except FileNotFoundError:
                pass
            except OSError:
                # Keep directories that are no longer empty or removable.
                pass
        if rollback_errors:
            details = "; ".join(rollback_errors)
            retained_backup = (
                f"; recovery backup retained at {backup_path}"
                if backup_path is not None and backup_path.exists()
                else ""
            )
            raise InitError(
                f"initialization failed ({exc}); rollback was incomplete: "
                f"{details}{retained_backup}"
            ) from exc
        if isinstance(exc, PermissionError):
            raise InitPermissionError(
                "permission denied while applying repository-local Codex changes; "
                f"all changes from this attempt were rolled back: {exc}"
            ) from exc
        raise InitError(
            f"initialization failed and all file changes were rolled back: "
            f"{exc}"
        ) from exc

    return backup_path


def run(argv: list[str]) -> int:
    args = parse_args(argv)
    target = validate_project_target(args.target)

    config_path = target / ".codex" / "config.toml"
    agent_templates = load_agent_templates()
    agent_paths = [
        target / ".codex" / "agents" / f"{name}.toml"
        for name in REQUIRED_AGENT_NAMES
    ]
    retired_explorer_paths = legacy_explorer_paths(target)
    validate_project_paths(
        target, [config_path, *agent_paths, *retired_explorer_paths]
    )
    warn_legacy_team_developer_profiles(target)
    if args.check:
        check_config(config_path)
        check_agents(target, agent_templates)
        if args.remove_legacy_explorers:
            remaining = existing_legacy_explorer_paths(target)
            if remaining:
                paths = ", ".join(str(path) for path in remaining)
                raise InitError(
                    f"retired Explorer agent profiles still exist: {paths}"
                )
        return 0

    template = load_template()
    existed = config_path.is_file()
    if existed:
        existing, with_bom = read_utf8(config_path)
        existing_mode = stat.S_IMODE(config_path.stat().st_mode)
    else:
        existing, with_bom, existing_mode = "", False, None

    rendered = render_config(
        existing, template, str(config_path), force=args.force
    )
    agent_changes = prepare_agent_changes(target, agent_templates)
    explorer_removals = (
        existing_legacy_explorer_paths(target)
        if args.remove_legacy_explorers
        else []
    )
    config_changed = rendered != existing

    if not args.apply:
        if config_changed:
            print_diff(config_path, existing, rendered)
        for agent_path, agent_template in agent_changes:
            print_diff(agent_path, "", agent_template)
        for retired_path in explorer_removals:
            retired_text, _ = read_utf8(retired_path)
            print_diff(retired_path, retired_text, "")
        if not config_changed and not agent_changes and not explorer_removals:
            print(f"Already configured: {config_path}")
            print(
                "JSFWORK agent profiles already configured: "
                f"{target / '.codex' / 'agents'}"
            )
            return 0
        print("Preview only; re-run with --apply to write this change.")
        return 0

    file_changes: list[tuple[Path, str | None, bool, int | None]] = []
    if config_changed:
        file_changes.append(
            (config_path, rendered, with_bom, existing_mode)
        )
    file_changes.extend(
        (agent_path, agent_template, False, None)
        for agent_path, agent_template in agent_changes
    )
    file_changes.extend(
        (retired_path, None, False, None)
        for retired_path in explorer_removals
    )
    backup_path = apply_file_changes(
        target,
        file_changes,
        backup_config=config_path if existed and config_changed else None,
    )

    if config_changed:
        print(f"Configured: {config_path}")
    else:
        print(f"Already configured: {config_path}")
    if backup_path is not None:
        print(f"Backup: {backup_path}")
    for agent_path, _ in agent_changes:
        print(f"Configured JSFWORK agent: {agent_path}")
    for retired_path in explorer_removals:
        print(f"Removed retired Explorer agent: {retired_path}")
    if not agent_changes:
        print(
            "JSFWORK agent profiles already configured: "
            f"{target / '.codex' / 'agents'}"
        )
    print("Start a new Codex session in this repository to load the setting.")
    return 0


def powershell_quote(value: str) -> str:
    """Quote one argument for a copy-pasteable PowerShell command."""

    return "'" + value.replace("'", "''") + "'"


def print_permission_recovery(exc: BaseException, argv: list[str]) -> None:
    command_parts = [sys.executable, str(Path(__file__).resolve()), *argv]
    command = " ".join(powershell_quote(part) for part in command_parts)
    print(f"error: {exc}", file=sys.stderr)
    print(
        "Approve only the repository-local access required by this command, "
        "or run these exact commands from a regular PowerShell terminal:",
        file=sys.stderr,
    )
    print(f"  Set-Location {powershell_quote(str(Path.cwd()))}", file=sys.stderr)
    print(f"  {command}", file=sys.stderr)
    print(
        "Then rerun the initializer with --check; do not treat initialization "
        "as successful until that check passes.",
        file=sys.stderr,
    )


def main() -> int:
    argv = sys.argv[1:]
    try:
        return run(argv)
    except InitPermissionError as exc:
        print_permission_recovery(exc, argv)
        return 1
    except InitError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except PermissionError as exc:
        print_permission_recovery(exc, argv)
        return 1
    except OSError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
