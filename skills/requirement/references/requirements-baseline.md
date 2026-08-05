# Requirements baseline and specification

Use this reference when reviewing a candidate baseline or preparing the JSON
input for `scripts/render_specification.py`.

## Baseline status

A baseline can be `draft`, `submitted`, or `superseded`. `submitted` means the
user explicitly approved this recorded version. It is not proof of completeness,
feasibility, correctness, consensus, implementation, verification, or delivery.

The original prompt is a source such as `SRC-PROMPT-001`. It is never copied
unchanged into a completion condition.

## Minimum review model

Present these areas before the final Submit:

- metadata: title, version, status, submission time if known;
- problem: current problem, desired outcomes, observable success signals;
- stakeholders: role, interest, authority, and confirmation state;
- sources: stable ID, description, and evidence or origin;
- scope: in scope, out of scope, system boundaries, external interfaces;
- scenarios: normal, alternate, failure, recovery, migration, permission;
- requirements: stable ID, type, statement, rationale, source IDs, priority,
  status, dependencies, and assumptions;
- acceptance: stable ID, observable criterion, and verification method;
- conflicts and unresolved items: impact, state, resolution or owner;
- decisions: selected answer, rationale, alternatives, and source;
- submission: explicit user decision and accepted unresolved items.

Omit an irrelevant area only after recording why it is not applicable. Mark an
unknown area as unknown; do not fabricate content to make the baseline look full.
Do not make a downstream choice part of the final Submit review.

## ID and trace rules

Use stable, unique IDs within one baseline:

- `SRC-*` for sources;
- `SC-*` for scenarios;
- `DEC-*` for user decisions;
- `RQ-*` for requirements;
- `AC-*` for acceptance criteria;
- `CF-*` for conflicts;
- `UN-*` for unresolved items.

Do not encode priority or mutable status into an ID. Preserve old IDs when a
baseline is revised; use a new ID only for a genuinely distinct item. Maintain
at least `source -> decision -> requirement -> acceptance criterion` links when
the evidence supports them. Mark a missing link instead of inventing one.

## Requirement quality check

Each accepted requirement should:

- identify an actor or system boundary where relevant;
- state one necessary observable behavior or quality;
- avoid embedding a design choice unless that design is itself an approved
  constraint;
- use defined quantities and terms instead of subjective adjectives;
- include failure or boundary behavior when material;
- carry an observable acceptance criterion and a feasible verification method;
- expose assumptions, dependencies, and source IDs.

Quality findings inform another user decision. They do not authorize the agent
to change or reject a requirement on the user's behalf.

## Renderer input

The renderer accepts one UTF-8 JSON object. It recognizes these keys:

```json
{
  "metadata": {"title": "Example", "version": "1", "status": "submitted"},
  "problem": {"statement": "...", "outcomes": ["..."], "success_signals": ["..."]},
  "stakeholders": [{"role": "User", "interest": "...", "confirmation": "confirmed"}],
  "sources": [{"id": "SRC-PROMPT-001", "description": "Original request"}],
  "scope": {"in": ["..."], "out": ["..."], "boundaries": ["..."]},
  "scenarios": [{"id": "SC-001", "type": "normal", "description": "..."}],
  "requirements": [{
    "id": "RQ-001", "type": "functional", "statement": "...",
    "rationale": "...", "source_ids": ["SRC-PROMPT-001"],
    "priority": "must", "status": "accepted", "dependencies": [],
    "assumptions": [],
    "acceptance": [{"id": "AC-001", "criterion": "...", "verification": "test"}]
  }],
  "conflicts": [],
  "unresolved": [],
  "decisions": [],
  "submission": {"decision": "Submit this baseline", "unresolved_accepted": []}
}
```

Unknown keys are ignored. Missing optional sections render as `Not recorded`.
Every rendered requirement must have a non-empty `id` and `statement`, and every
acceptance criterion must have a non-empty `id`. All explicit IDs in recognized
baseline sections must be unique. These checks protect document integrity. The
renderer does not decide whether a baseline was submitted or enforce a workflow.

## Optional team handoff

Only after Submit and a separate request to use `jswork:orcheestrate-team`, the
rendered requirements specification becomes advisory input. It is not an
execution gate or proof of completion. The requirement skill does not create the
Task DAG or alter the team skill. A later PL may map a DAG node to multiple
`RQ-*` and `AC-*` IDs, and one ID may map to multiple nodes. The mapping remains
a PL-maintained coordination aid.
