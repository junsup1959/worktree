import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / "skills" / "requirement" / "SKILL.md"
RENDERER = (
    ROOT / "skills" / "requirement" / "scripts" / "render_specification.py"
)


def sample_baseline() -> dict:
    return {
        "metadata": {
            "title": "Requirement regression fixture",
            "version": "1",
            "status": "submitted",
        },
        "sources": [
            {"id": "SRC-PROMPT-001", "description": "Original request"}
        ],
        "requirements": [
            {
                "id": "RQ-001",
                "type": "functional",
                "statement": "The system records an explicit user decision.",
                "status": "accepted",
                "source_ids": ["SRC-PROMPT-001"],
                "acceptance": [
                    {
                        "id": "AC-001",
                        "criterion": "A submitted decision is visible.",
                        "verification": "automated test",
                    }
                ],
            }
        ],
        "submission": {"decision": "Submit this baseline"},
    }


class RequirementSkillRegressionTests(unittest.TestCase):
    def run_renderer(self, baseline: dict, output: Path) -> subprocess.CompletedProcess:
        input_path = output.parent / "baseline.json"
        input_path.write_text(
            json.dumps(baseline, ensure_ascii=False), encoding="utf-8"
        )
        return subprocess.run(
            [
                sys.executable,
                str(RENDERER),
                "--input",
                str(input_path),
                "--output",
                str(output),
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )

    def test_submit_boundary_and_numbered_fallback_are_explicit(self):
        text = SKILL.read_text(encoding="utf-8")
        submit = text.split("## Obtain explicit Submit", 1)[1].split(
            "## Prepare an optional team handoff", 1
        )[0]
        handoff = text.split("## Prepare an optional team handoff", 1)[1]

        self.assertIn(
            "Only `Submit this baseline` creates a `submitted baseline`", submit
        )
        self.assertIn("require exactly one number", submit)
        self.assertNotIn("downstream action", submit)
        self.assertIn("After—not before—Submit", handoff)
        self.assertIn("separately requested `jswork:orcheestrate-team`", handoff)
        self.assertIn("Reply with compatible numbers", text)
        self.assertIn("separated by commas", text)
        self.assertIn("Other — provide your own answer", text)

    def test_duplicate_ids_across_the_baseline_are_rejected(self):
        duplicate_source = sample_baseline()
        duplicate_source["sources"].append(
            {"id": "SRC-PROMPT-001", "description": "Duplicate source"}
        )

        duplicate_requirement = sample_baseline()
        second = copy.deepcopy(duplicate_requirement["requirements"][0])
        second["acceptance"][0]["id"] = "AC-002"
        duplicate_requirement["requirements"].append(second)

        duplicate_acceptance = sample_baseline()
        second = copy.deepcopy(duplicate_acceptance["requirements"][0])
        second["id"] = "RQ-002"
        duplicate_acceptance["requirements"].append(second)

        cases = [
            (duplicate_source, "duplicate id: SRC-PROMPT-001"),
            (duplicate_requirement, "duplicate id: RQ-001"),
            (duplicate_acceptance, "duplicate id: AC-001"),
        ]
        for baseline, expected in cases:
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as tmp:
                result = self.run_renderer(baseline, Path(tmp) / "specification.md")
                self.assertEqual(2, result.returncode)
                self.assertIn(expected, result.stderr)

    def test_renderer_creates_advisory_requirements_specification(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "specification.md"
            result = self.run_renderer(sample_baseline(), output)

            self.assertEqual(0, result.returncode, result.stderr)
            rendered = output.read_text(encoding="utf-8")
            self.assertIn("# Requirement regression fixture", rendered)
            self.assertIn("Advisory requirements specification", rendered)
            self.assertIn("### RQ-001", rendered)
            self.assertIn("AC-001", rendered)
            self.assertIn("## Traceability guidance", rendered)
            self.assertNotIn("Downstream selection", rendered)

    def test_renderer_preserves_existing_output_without_force(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "specification.md"
            output.write_text("keep existing output\n", encoding="utf-8")

            result = self.run_renderer(sample_baseline(), output)

            self.assertEqual(2, result.returncode)
            self.assertIn("output already exists", result.stderr)
            self.assertEqual(
                "keep existing output\n", output.read_text(encoding="utf-8")
            )


if __name__ == "__main__":
    unittest.main()
