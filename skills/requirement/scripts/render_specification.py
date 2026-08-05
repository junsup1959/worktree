#!/usr/bin/env python3
"""Render a requirements baseline JSON object as an advisory specification."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render requirements JSON as an advisory Markdown specification."
    )
    parser.add_argument("--input", required=True, help="UTF-8 JSON path, or - for stdin")
    parser.add_argument("--output", required=True, help="Explicit Markdown output path")
    parser.add_argument(
        "--force", action="store_true", help="Replace an existing output file"
    )
    return parser.parse_args()


def load_input(value: str) -> dict[str, Any]:
    raw = sys.stdin.read() if value == "-" else Path(value).read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("input root must be a JSON object")
    return data


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def scalar(value: Any, default: str = "Not recorded") -> str:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, (str, int, float)):
        return str(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def item_text(item: Any) -> str:
    if isinstance(item, dict):
        label = item.get("id") or item.get("role") or item.get("name")
        detail = (
            item.get("description")
            or item.get("statement")
            or item.get("interest")
            or item.get("decision")
        )
        parts = [scalar(value, "") for value in (label, detail) if value not in (None, "")]
        remainder = {
            key: value
            for key, value in item.items()
            if key
            not in {
                "id",
                "role",
                "name",
                "description",
                "statement",
                "interest",
                "decision",
            }
            and value not in (None, "", [], {})
        }
        text = " - ".join(parts) or "Not recorded"
        return f"{text}; {scalar(remainder, '')}" if remainder else text
    return scalar(item)


def bullets(values: Any) -> list[str]:
    items = as_list(values)
    return [f"- {item_text(item)}" for item in items] or ["- Not recorded"]


def validate_ids(data: dict[str, Any]) -> None:
    """Protect document identity; do not infer or enforce workflow state."""
    locations_by_id: dict[str, str] = {}

    def record_id(value: Any, location: str, required: bool = False) -> str:
        item_id = scalar(value, "").strip()
        if not item_id:
            if required:
                raise ValueError(f"{location} requires a non-empty id")
            return ""
        previous = locations_by_id.get(item_id)
        if previous:
            raise ValueError(f"duplicate id: {item_id} ({previous} and {location})")
        locations_by_id[item_id] = location
        return item_id

    for section in ("sources", "scenarios", "conflicts", "unresolved", "decisions"):
        for index, item in enumerate(as_list(data.get(section)), start=1):
            if isinstance(item, dict):
                record_id(item.get("id"), f"{section}[{index}]")

    for index, requirement in enumerate(as_list(data.get("requirements")), start=1):
        if not isinstance(requirement, dict):
            raise ValueError(f"requirements[{index}] must be an object")
        location = f"requirements[{index}]"
        req_id = record_id(requirement.get("id"), location, required=True)
        statement = scalar(requirement.get("statement"), "").strip()
        if not statement:
            raise ValueError(f"{location} requires a non-empty statement")
        for ac_index, criterion in enumerate(as_list(requirement.get("acceptance")), start=1):
            if not isinstance(criterion, dict):
                raise ValueError(f"{req_id}.acceptance[{ac_index}] must be an object")
            record_id(
                criterion.get("id"),
                f"{req_id}.acceptance[{ac_index}]",
                required=True,
            )


def add_mapping(lines: list[str], title: str, mapping: Any) -> None:
    lines.extend([f"## {title}", ""])
    values = as_dict(mapping)
    if not values:
        lines.extend(["Not recorded", ""])
        return
    for key, value in values.items():
        if isinstance(value, list):
            lines.append(f"### {key.replace('_', ' ').title()}")
            lines.append("")
            lines.extend(bullets(value))
            lines.append("")
        else:
            lines.append(f"- {key.replace('_', ' ').title()}: {scalar(value)}")
    lines.append("")


def add_collection(lines: list[str], title: str, values: Any) -> None:
    lines.extend([f"## {title}", ""])
    lines.extend(bullets(values))
    lines.append("")


def render(data: dict[str, Any]) -> str:
    validate_ids(data)
    metadata = as_dict(data.get("metadata"))
    title = scalar(metadata.get("title"), "Requirements Specification")
    lines = [
        f"# {title}",
        "",
        "> Advisory requirements specification: this document is not an execution",
        "> gate, a Task DAG, or proof of implementation, verification, or completion.",
        "",
        "## Baseline",
        "",
        f"- Version: {scalar(metadata.get('version'))}",
        f"- Status: {scalar(metadata.get('status'))}",
        f"- Submitted at: {scalar(metadata.get('submitted_at'))}",
        "",
    ]
    add_mapping(lines, "Problem and outcomes", data.get("problem"))
    add_collection(lines, "Stakeholders", data.get("stakeholders"))
    add_collection(lines, "Sources", data.get("sources"))
    add_mapping(lines, "Scope", data.get("scope"))
    add_collection(lines, "Scenarios", data.get("scenarios"))
    lines.extend(["## Requirements", ""])
    requirements = as_list(data.get("requirements"))
    if not requirements:
        lines.extend(["Not recorded", ""])
    for requirement in requirements:
        req = as_dict(requirement)
        lines.extend(
            [
                f"### {scalar(req.get('id'))} - {scalar(req.get('statement'))}",
                "",
                f"- Type: {scalar(req.get('type'))}",
                f"- Status: {scalar(req.get('status'))}",
                f"- Priority: {scalar(req.get('priority'))}",
                f"- Rationale: {scalar(req.get('rationale'))}",
                f"- Sources: {', '.join(map(str, as_list(req.get('source_ids')))) or 'Not recorded'}",
                f"- Dependencies: {', '.join(map(str, as_list(req.get('dependencies')))) or 'None recorded'}",
                f"- Assumptions: {', '.join(map(str, as_list(req.get('assumptions')))) or 'None recorded'}",
                "",
                "Acceptance criteria:",
                "",
            ]
        )
        criteria = as_list(req.get("acceptance"))
        if not criteria:
            lines.append("- Not recorded")
        for criterion in criteria:
            ac = as_dict(criterion)
            lines.append(
                f"- {scalar(ac.get('id'))}: {scalar(ac.get('criterion'))} "
                f"(verification: {scalar(ac.get('verification'))})"
            )
        lines.append("")
    add_collection(lines, "Conflicts", data.get("conflicts"))
    add_collection(lines, "Unresolved items", data.get("unresolved"))
    add_collection(lines, "Decisions", data.get("decisions"))
    add_mapping(lines, "Submission", data.get("submission"))
    lines.extend(
        [
            "## Traceability guidance",
            "",
            "A downstream PL may reference `RQ-*` and `AC-*` IDs from Task DAG nodes.",
            "The mapping may be many-to-many and remains an advisory coordination aid",
            "owned by the PL. This document does not invoke or constrain the team skill.",
            "",
        ]
    )
    return "\n".join(lines)


def write_output(path_value: str, content: str, force: bool) -> Path:
    output = Path(path_value)
    output.parent.mkdir(parents=True, exist_ok=True)
    if force:
        output.write_text(content, encoding="utf-8", newline="\n")
        return output
    try:
        with output.open("x", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
    except FileExistsError as exc:
        raise FileExistsError(
            f"output already exists: {output}; pass --force to replace it"
        ) from exc
    return output


def main() -> int:
    args = parse_args()
    try:
        data = load_input(args.input)
        output = write_output(args.output, render(data), args.force)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
