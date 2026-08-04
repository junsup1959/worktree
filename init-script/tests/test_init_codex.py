from __future__ import annotations

import importlib.util
import io
import os
import subprocess
import sys
import tempfile
import tomllib
import unittest
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "init_codex.py"
SPEC = importlib.util.spec_from_file_location("jsfwork_init_codex", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
INIT_CODEX = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INIT_CODEX)


class InitCodexTests(unittest.TestCase):
    def run_init(
        self,
        target: Path,
        *arguments: str,
        env: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--target",
                str(target),
                *arguments,
            ],
            capture_output=True,
            text=True,
            check=False,
            env=env,
        )

    def test_preview_does_not_write(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            result = self.run_init(target)

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("Preview only", result.stdout)
            self.assertFalse((target / ".codex" / "config.toml").exists())

    def test_apply_creates_and_check_accepts_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)

            applied = self.run_init(target, "--apply")
            checked = self.run_init(target, "--check")

            self.assertEqual(applied.returncode, 0, applied.stderr)
            self.assertEqual(checked.returncode, 0, checked.stderr)
            config = target / ".codex" / "config.toml"
            self.assertEqual(
                config.read_bytes(),
                INIT_CODEX.TEMPLATE_PATH.read_bytes(),
            )
            with config.open("rb") as stream:
                generated = tomllib.load(stream)
            self.assertIs(generated["features"]["multi_agent"], True)
            self.assertIs(generated["features"]["hooks"], True)
            self.assertEqual(
                generated["memories"]["extract_model"],
                "gpt-5.6-terra",
            )
            self.assertEqual(
                generated["mcp_servers"]["sequential-thinking"]["command"],
                "cmd",
            )
            self.assertFalse((target / ".codex" / "hooks.json").exists())
            self.assertFalse((target / ".jsfwork").exists())
            agent_dir = target / ".codex" / "agents"
            expected_agents = {
                "explore": (
                    "gpt-5.3-codex-spark",
                    "low",
                    "workspace-write",
                ),
                "orcheestrate-team-pl": (
                    "gpt-5.6-luna",
                    "high",
                    "read-only",
                ),
                "orcheestrate-team-developer": (
                    "gpt-5.6-terra",
                    "medium",
                    "workspace-write",
                ),
                "orcheestrate-team-qa": (
                    "gpt-5.6-luna",
                    "high",
                    "read-only",
                ),
            }
            self.assertEqual(len(expected_agents), 4)
            self.assertEqual(
                {path.stem for path in agent_dir.glob("*.toml")},
                set(expected_agents),
            )
            for agent_name, expected in expected_agents.items():
                with (agent_dir / f"{agent_name}.toml").open("rb") as stream:
                    profile = tomllib.load(stream)
                self.assertEqual(profile["name"], agent_name)
                self.assertEqual(
                    (
                        profile["model"],
                        profile["model_reasoning_effort"],
                        profile["sandbox_mode"],
                    ),
                    expected,
                )
                if agent_name == "explore":
                    instructions = profile["developer_instructions"]
                    self.assertIn("메모리 사용 금지", instructions)
                    self.assertIn("요약본 원문 파일 단 하나", instructions)
                if agent_name == "orcheestrate-team-pl":
                    instructions = profile["developer_instructions"]
                    self.assertRegex(instructions, r"Final Completion\s+Audit")
                    self.assertIn("whole-change audit disposition", instructions)
                    self.assertIn("Use send_message", instructions)
                    self.assertIn("type, node, intent, and data", instructions)
                    self.assertRegex(
                        instructions,
                        r"build, validate,\s+route, persist, or enforce packets",
                    )
                    self.assertIn("resolved BDD guide path", instructions)
                    self.assertIn("never send both", instructions)
                if agent_name == "orcheestrate-team-developer":
                    instructions = profile["developer_instructions"]
                    self.assertIn("Use send_message", instructions)
                    self.assertIn("type, node, intent, and data", instructions)
                    self.assertRegex(
                        instructions,
                        r"build, validate,\s+route, persist, or enforce packets",
                    )
                if agent_name == "orcheestrate-team-qa":
                    instructions = profile["developer_instructions"]
                    self.assertRegex(instructions, r"Final Completion\s+Audit")
                    self.assertIn("original user request", instructions)
                    self.assertIn("Use send_message", instructions)
                    self.assertIn("type, node, intent, and data", instructions)
                    self.assertRegex(
                        instructions,
                        r"build, validate,\s+route, persist, or enforce packets",
                    )

    def test_repository_skills_follow_context_line_budget(self) -> None:
        skills_dir = SCRIPT.parent.parent / "skills"
        violations = {}

        for skill_path in skills_dir.glob("*/SKILL.md"):
            if skill_path.parent.name == "setup":
                continue
            line_count = len(skill_path.read_text(encoding="utf-8").splitlines())
            if line_count > 300:
                violations[skill_path.parent.name] = line_count

        self.assertEqual(violations, {})

    def test_team_skill_uses_minimal_json_packet_handoff_contract(self) -> None:
        skill_path = (
            SCRIPT.parent.parent / "skills" / "orcheestrate-team" / "SKILL.md"
        )
        instructions = skill_path.read_text(encoding="utf-8")

        self.assertIn("only four top-level fields", instructions)
        self.assertIn('"type":"assign"', instructions)
        self.assertIn("send_message` as the primary handoff transport", instructions)
        self.assertIn("exact same JSON packet", instructions)
        self.assertIn("resolved guide path", instructions)
        self.assertIn("Do not create or call scripts", instructions)
        self.assertLessEqual(len(instructions.splitlines()), 300)

    def test_review_skill_preserves_intent_and_coverage_contract(self) -> None:
        skill_dir = SCRIPT.parent.parent / "skills" / "review"
        instructions = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
        interface = (skill_dir / "agents" / "openai.yaml").read_text(
            encoding="utf-8"
        )
        design = (
            SCRIPT.parent.parent / "doc" / "review" / "review-skill-design.md"
        ).read_text(encoding="utf-8")

        self.assertIn("Map each material requirement", instructions)
        self.assertIn("Coverage Manifest", instructions)
        for status in ("satisfied", "mismatched", "unverified"):
            self.assertIn(f"`{status}`", instructions)
        self.assertIn("overall user-intent status", instructions)
        self.assertIn("supporting checks", instructions)
        self.assertIn("coverage manifest", interface.lower())
        self.assertIn("intent status", interface.lower())
        self.assertIn("Coverage Manifest를 MVP 제외 대상으로 둔", design)
        self.assertIn("설명을 대체한다", design)
        self.assertFalse((skill_dir / "scripts").exists())
        for markdown in skill_dir.rglob("*.md"):
            self.assertLessEqual(
                len(markdown.read_text(encoding="utf-8").splitlines()),
                300,
                markdown,
            )

    def test_setup_skill_separates_reflection_evidence(self) -> None:
        skill_dir = SCRIPT.parent.parent / "skills" / "setup"
        instructions = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
        interface = (skill_dir / "agents" / "openai.yaml").read_text(
            encoding="utf-8"
        )

        for surface in (
            "Source package",
            "Project state",
            "Installed package",
            "Active session",
        ):
            self.assertIn(surface, instructions)
        self.assertIn("exact resolved `<plugin-root>`", instructions)
        self.assertIn("installed package is stale", instructions)
        self.assertIn("never refreshes the installed plugin cache", instructions)
        self.assertIn("`--check`", instructions)
        self.assertIn("proves only the project configuration", instructions)
        self.assertIn("explicit user request", instructions)
        self.assertIn("installed-package, and session reflection", interface)
        self.assertFalse((skill_dir / "scripts").exists())
        self.assertLessEqual(len(instructions.splitlines()), 300)

    def test_repository_config_matches_initializer_template(self) -> None:
        repository_root = SCRIPT.parent.parent
        source = repository_root / ".codex" / "config.toml"

        self.assertTrue(source.is_file(), source)
        self.assertEqual(
            source.read_bytes(),
            INIT_CODEX.TEMPLATE_PATH.read_bytes(),
        )

    def test_apply_preserves_existing_project_hooks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            hooks = target / ".codex" / "hooks.json"
            hooks.parent.mkdir()
            original = (
                b'{"hooks":{"PreToolUse":[{"matcher":"*",'
                b'"hooks":[{"type":"command","command":"graphify hook-check"}]}]}}\n'
            )
            hooks.write_bytes(original)

            applied = self.run_init(target, "--apply")
            checked = self.run_init(target, "--check")

            self.assertEqual(applied.returncode, 0, applied.stderr)
            self.assertEqual(checked.returncode, 0, checked.stderr)
            self.assertEqual(hooks.read_bytes(), original)
            self.assertFalse((target / ".jsfwork").exists())

    def test_repository_agent_profiles_match_initializer_templates(self) -> None:
        repository_root = SCRIPT.parent.parent
        source_dir = repository_root / ".codex" / "agents"
        template_dir = (
            repository_root / "init-script" / "templates" / "codex" / "agents"
        )
        expected_names = set(INIT_CODEX.REQUIRED_AGENT_NAMES)

        self.assertEqual(
            {path.stem for path in source_dir.glob("*.toml")},
            expected_names,
        )
        self.assertEqual(
            {path.stem for path in template_dir.glob("*.toml")},
            expected_names,
        )

        for agent_name in INIT_CODEX.REQUIRED_AGENT_NAMES:
            source = source_dir / f"{agent_name}.toml"
            template = template_dir / f"{agent_name}.toml"
            self.assertTrue(source.is_file(), source)
            self.assertTrue(template.is_file(), template)
            self.assertEqual(source.read_bytes(), template.read_bytes(), agent_name)

    def test_default_target_is_current_project(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)

            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--apply"],
                cwd=target,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            config = target / ".codex" / "config.toml"
            self.assertTrue(config.is_file())
            self.assertIn(str(config.resolve()), result.stdout)

    def test_user_home_is_rejected_as_a_project_target(self) -> None:
        result = self.run_init(Path.home(), "--apply")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("user home directory", result.stderr)

    def test_filesystem_root_is_rejected_as_a_project_target(self) -> None:
        filesystem_root = Path(Path.cwd().anchor)

        result = self.run_init(filesystem_root, "--apply")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("filesystem root", result.stderr)

    def test_effective_codex_home_is_not_treated_as_project_config(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            environment = os.environ.copy()
            environment["CODEX_HOME"] = str(target / ".codex")

            result = self.run_init(target, "--apply", env=environment)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("effective global Codex configuration", result.stderr)
            self.assertFalse((target / ".codex" / "config.toml").exists())

    def test_merge_preserves_existing_content_and_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            config = target / ".codex" / "config.toml"
            config.parent.mkdir()
            config.write_text(
                "# keep this comment\nmodel = \"gpt-test\"\n",
                encoding="utf-8",
            )

            first = self.run_init(target, "--apply")
            backups_after_first = list(
                config.parent.glob("config.toml.jsfwork-*.bak")
            )
            second = self.run_init(target, "--apply")
            backups_after_second = list(
                config.parent.glob("config.toml.jsfwork-*.bak")
            )

            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(second.returncode, 0, second.stderr)
            rendered = config.read_text(encoding="utf-8")
            self.assertIn("# keep this comment", rendered)
            self.assertIn('model = "gpt-test"', rendered)
            self.assertIn("multi_agent = true", rendered)
            self.assertIn("hooks = true", rendered)
            self.assertEqual(len(backups_after_first), 1)
            self.assertEqual(backups_after_first, backups_after_second)
            self.assertIn("Already configured", second.stdout)

    def test_false_requires_force_and_force_creates_backup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            config = target / ".codex" / "config.toml"
            config.parent.mkdir()
            original = "[features]\nmulti_agent = false # deliberate\n"
            config.write_text(original, encoding="utf-8")

            refused = self.run_init(target, "--apply")
            self.assertNotEqual(refused.returncode, 0)
            self.assertEqual(config.read_text(encoding="utf-8"), original)

            forced = self.run_init(target, "--apply", "--force")
            self.assertEqual(forced.returncode, 0, forced.stderr)
            rendered = config.read_text(encoding="utf-8")
            self.assertIn("multi_agent = true", rendered)
            self.assertIn("hooks = true", rendered)
            backups = list(config.parent.glob("config.toml.jsfwork-*.bak"))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_text(encoding="utf-8"), original)

    def test_hooks_false_requires_force(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            config = target / ".codex" / "config.toml"
            config.parent.mkdir()
            original = (
                "[features]\n"
                "multi_agent = true\n"
                "hooks = false # deliberate\n"
            )
            config.write_text(original, encoding="utf-8")

            refused = self.run_init(target, "--apply")

            self.assertNotEqual(refused.returncode, 0)
            self.assertIn("features.hooks", refused.stderr)
            self.assertEqual(config.read_text(encoding="utf-8"), original)

            forced = self.run_init(target, "--apply", "--force")

            self.assertEqual(forced.returncode, 0, forced.stderr)
            self.assertIn(
                "hooks = true # deliberate",
                config.read_text(encoding="utf-8"),
            )

    def test_check_requires_hooks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            config = target / ".codex" / "config.toml"
            config.parent.mkdir()
            config.write_text(
                "[features]\nmulti_agent = true\n",
                encoding="utf-8",
            )

            result = self.run_init(target, "--check")

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("features.hooks", result.stderr)

    def test_dotted_features_get_missing_hooks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            config = target / ".codex" / "config.toml"
            config.parent.mkdir()
            config.write_text(
                "# preserve\n"
                "features.multi_agent = true\n"
                'model = "gpt-test"\n',
                encoding="utf-8",
            )

            result = self.run_init(target, "--apply")

            self.assertEqual(result.returncode, 0, result.stderr)
            rendered = config.read_text(encoding="utf-8")
            self.assertIn("# preserve", rendered)
            self.assertIn('model = "gpt-test"', rendered)
            self.assertIn("features.hooks = true", rendered)
            with config.open("rb") as stream:
                data = tomllib.load(stream)
            self.assertIs(data["features"]["multi_agent"], True)
            self.assertIs(data["features"]["hooks"], True)

    def test_invalid_toml_is_never_modified(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            config = target / ".codex" / "config.toml"
            config.parent.mkdir()
            original = "[features\nmulti_agent = true\n"
            config.write_text(original, encoding="utf-8")

            result = self.run_init(target, "--apply")

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("not valid TOML", result.stderr)
            self.assertEqual(config.read_text(encoding="utf-8"), original)
            self.assertEqual(
                list(config.parent.glob("config.toml.jsfwork-*.bak")), []
            )
            self.assertFalse((target / ".codex" / "agents").exists())

    def test_conflicting_agent_profile_is_never_overwritten(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            profile = target / ".codex" / "agents" / "explore.toml"
            profile.parent.mkdir(parents=True)
            original = 'name = "my-explore"\n'
            profile.write_text(original, encoding="utf-8")

            result = self.run_init(target, "--apply")

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("will not overwrite", result.stderr)
            self.assertEqual(profile.read_text(encoding="utf-8"), original)
            self.assertFalse((target / ".codex" / "config.toml").exists())

    def test_each_legacy_team_developer_profile_warns_in_every_mode(
        self,
    ) -> None:
        legacy_filenames = (
            "orcheestrate-team-developer-1.toml",
            "orcheestrate-team-developer-2.toml",
        )
        for filename in legacy_filenames:
            with self.subTest(filename=filename):
                with tempfile.TemporaryDirectory() as temporary:
                    target = Path(temporary)
                    agent_dir = target / ".codex" / "agents"
                    agent_dir.mkdir(parents=True)
                    profile = agent_dir / filename
                    original = b"legacy developer profile\x00bytes"
                    profile.write_bytes(original)

                    preview = self.run_init(target)
                    applied = self.run_init(target, "--apply")
                    checked = self.run_init(target, "--check")

                    for mode, result in (
                        ("preview", preview),
                        ("apply", applied),
                        ("check", checked),
                    ):
                        with self.subTest(filename=filename, mode=mode):
                            self.assertEqual(
                                result.returncode, 0, result.stderr
                            )
                            self.assertIn(
                                "legacy JSFWORK developer profile(s) "
                                "remain unchanged",
                                result.stderr,
                            )
                            self.assertIn(filename, result.stderr)
                            self.assertEqual(profile.read_bytes(), original)
                    self.assertTrue(
                        (
                            agent_dir
                            / "orcheestrate-team-developer.toml"
                        ).is_file()
                    )

    def test_unrelated_custom_profile_is_preserved_without_warning(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            agent_dir = target / ".codex" / "agents"
            agent_dir.mkdir(parents=True)
            profile = agent_dir / "unrelated-custom-agent.toml"
            original = b"unrelated custom profile\x00bytes"
            profile.write_bytes(original)

            preview = self.run_init(target)
            applied = self.run_init(target, "--apply")
            checked = self.run_init(target, "--check")

            for mode, result in (
                ("preview", preview),
                ("apply", applied),
                ("check", checked),
            ):
                with self.subTest(mode=mode):
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertNotIn(
                        "legacy JSFWORK developer profile(s)",
                        result.stderr,
                    )
                    self.assertNotIn(profile.name, result.stderr)
                    self.assertEqual(profile.read_bytes(), original)

    def test_retired_explorer_profiles_are_removed_only_with_opt_in(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            initial = self.run_init(target, "--apply")
            self.assertEqual(initial.returncode, 0, initial.stderr)

            agent_dir = target / ".codex" / "agents"
            retired_paths = [
                agent_dir / f"{name}.toml"
                for name in INIT_CODEX.LEGACY_EXPLORER_PROFILE_NAMES
            ]
            for path in retired_paths:
                path.write_text(
                    f'name = "{path.stem}"\n',
                    encoding="utf-8",
                )
            unrelated = agent_dir / "unrelated-custom-agent.toml"
            unrelated.write_text('name = "unrelated"\n', encoding="utf-8")

            default_apply = self.run_init(target, "--apply")
            preview = self.run_init(
                target, "--remove-legacy-explorers"
            )

            self.assertEqual(default_apply.returncode, 0, default_apply.stderr)
            self.assertEqual(preview.returncode, 0, preview.stderr)
            self.assertTrue(all(path.is_file() for path in retired_paths))
            for path in retired_paths:
                self.assertIn(path.name, preview.stdout)

            removed = self.run_init(
                target, "--apply", "--remove-legacy-explorers"
            )
            checked = self.run_init(
                target, "--check", "--remove-legacy-explorers"
            )

            self.assertEqual(removed.returncode, 0, removed.stderr)
            self.assertEqual(checked.returncode, 0, checked.stderr)
            self.assertTrue(all(not path.exists() for path in retired_paths))
            self.assertTrue(unrelated.is_file())

    def test_preview_includes_agents_without_writing_them(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)

            result = self.run_init(target)

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("explore.toml", result.stdout)
            self.assertIn("orcheestrate-team-pl.toml", result.stdout)
            self.assertIn(
                "orcheestrate-team-developer.toml", result.stdout
            )
            self.assertNotIn(
                "orcheestrate-team-developer-1.toml", result.stdout
            )
            self.assertNotIn(
                "orcheestrate-team-developer-2.toml", result.stdout
            )
            self.assertFalse((target / ".codex").exists())

    def test_existing_features_table_gets_only_required_missing_keys(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            config = target / ".codex" / "config.toml"
            config.parent.mkdir()
            config.write_text(
                "[features]\nweb_search = true\n\n"
                "[history]\npersistence = \"none\"\n",
                encoding="utf-8",
            )

            result = self.run_init(target, "--apply")

            self.assertEqual(result.returncode, 0, result.stderr)
            rendered = config.read_text(encoding="utf-8")
            self.assertIn(
                "[features]\n"
                "multi_agent = true\n"
                "hooks = true\n"
                "web_search = true",
                rendered,
            )
            self.assertEqual(rendered.count("[features]"), 1)
            self.assertIn('[history]\npersistence = "none"', rendered)

    def test_file_set_is_rolled_back_when_a_later_write_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary).resolve()
            config = target / ".codex" / "config.toml"
            profile = target / ".codex" / "agents" / "explore.toml"
            config.parent.mkdir()
            original = b'model = "keep-me"\n'
            config.write_bytes(original)
            changes = [
                (config, 'model = "changed"\n', False, None),
                (profile, 'name = "explore"\n', False, None),
            ]
            real_atomic_write = INIT_CODEX.atomic_write
            calls = 0

            def fail_second_write(*args: object, **kwargs: object) -> None:
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("injected profile write failure")
                real_atomic_write(*args, **kwargs)

            with mock.patch.object(
                INIT_CODEX, "atomic_write", side_effect=fail_second_write
            ):
                with self.assertRaisesRegex(
                    INIT_CODEX.InitError, "rolled back"
                ):
                    INIT_CODEX.apply_file_changes(target, changes)

            self.assertEqual(config.read_bytes(), original)
            self.assertFalse(profile.exists())
            self.assertFalse(profile.parent.exists())

    def test_deleted_file_is_restored_when_a_later_write_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary).resolve()
            agent_dir = target / ".codex" / "agents"
            agent_dir.mkdir(parents=True)
            retired = agent_dir / "base-explorer.toml"
            original = b'retired profile original bytes\n'
            retired.write_bytes(original)
            config = target / ".codex" / "config.toml"
            profile = agent_dir / "explore.toml"
            changes = [
                (retired, None, False, None),
                (config, 'multi_agent = true\n', False, None),
                (profile, 'name = "explore"\n', False, None),
            ]
            real_atomic_write = INIT_CODEX.atomic_write
            calls = 0

            def fail_second_write(*args: object, **kwargs: object) -> None:
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("injected profile write failure")
                real_atomic_write(*args, **kwargs)

            with mock.patch.object(
                INIT_CODEX, "atomic_write", side_effect=fail_second_write
            ):
                with self.assertRaisesRegex(
                    INIT_CODEX.InitError, "rolled back"
                ):
                    INIT_CODEX.apply_file_changes(target, changes)

            self.assertEqual(retired.read_bytes(), original)
            self.assertFalse(config.exists())
            self.assertFalse(profile.exists())

    def test_permission_failure_rolls_back_and_removes_new_backup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary).resolve()
            config = target / ".codex" / "config.toml"
            profile = target / ".codex" / "agents" / "explore.toml"
            config.parent.mkdir()
            original = b'model = "keep-me"\n'
            config.write_bytes(original)
            changes = [
                (config, 'model = "changed"\n', False, None),
                (profile, 'name = "explore"\n', False, None),
            ]
            real_atomic_write = INIT_CODEX.atomic_write
            calls = 0

            def deny_second_write(*args: object, **kwargs: object) -> None:
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise PermissionError("injected access denied")
                real_atomic_write(*args, **kwargs)

            with mock.patch.object(
                INIT_CODEX, "atomic_write", side_effect=deny_second_write
            ):
                with self.assertRaisesRegex(
                    INIT_CODEX.InitPermissionError,
                    "permission denied.*rolled back",
                ):
                    INIT_CODEX.apply_file_changes(
                        target, changes, backup_config=config
                    )

            self.assertEqual(config.read_bytes(), original)
            self.assertFalse(profile.exists())
            self.assertFalse(profile.parent.exists())
            self.assertEqual(list(config.parent.glob("*.jsfwork-*.bak")), [])

    def test_main_prints_exact_permission_recovery_command(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary).resolve()
            stderr = io.StringIO()
            argv = [str(SCRIPT), "--target", str(target), "--apply"]

            with (
                mock.patch.object(sys, "argv", argv),
                mock.patch.object(
                    INIT_CODEX,
                    "run",
                    side_effect=INIT_CODEX.InitPermissionError(
                        "permission denied; all changes were rolled back"
                    ),
                ),
                mock.patch("sys.stderr", stderr),
            ):
                result = INIT_CODEX.main()

            output = stderr.getvalue()
            self.assertEqual(result, 1)
            self.assertIn("regular PowerShell", output)
            self.assertIn("'--target'", output)
            self.assertIn(f"'{target}'", output)
            self.assertIn("'--apply'", output)
            self.assertIn("--check", output)

    def test_codex_directory_link_outside_project_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / "project"
            outside = root / "outside"
            target.mkdir()
            outside.mkdir()
            try:
                (target / ".codex").symlink_to(
                    outside, target_is_directory=True
                )
            except OSError as exc:
                codex_dir = target / ".codex"
                codex_dir.mkdir()
                config = codex_dir / "config.toml"
                with mock.patch.object(
                    INIT_CODEX,
                    "is_link_or_junction",
                    side_effect=lambda path: path == codex_dir,
                ):
                    with self.assertRaisesRegex(
                        INIT_CODEX.InitError, "symlink or junction"
                    ):
                        INIT_CODEX.validate_project_paths(
                            target.resolve(), [config]
                        )
                self.assertFalse(config.exists(), str(exc))
                return

            result = self.run_init(target, "--apply")

            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(
                "escapes project root" in result.stderr
                or "symlink or junction" in result.stderr
            )
            self.assertFalse((outside / "config.toml").exists())


if __name__ == "__main__":
    unittest.main()
