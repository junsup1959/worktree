---
name: requirement
description: Elicit, analyze, validate, specify, and explicitly submit a traceable requirements baseline before design or implementation. Use when a request is ambiguous, stakeholders and scope need discovery, selectable decisions are useful, acceptance criteria or requirement IDs are needed, or a downstream engineering skill needs a requirements specification. Do not use as a loop controller or Goal wrapper.
---

# Requirement

Turn a request into a user-submitted, traceable requirements baseline. Treat the
initial prompt as one source of evidence, never as the completion condition.

## Preserve the boundary

- Never call `create_goal`, `get_goal`, or `update_goal`, directly or through
  delegation.
- Do not create a loop controller, completion loop, or automatic re-entry path.
- Do not infer submission from silence, implementation requests, or tool calls.
- Do not modify, invoke, or govern a downstream skill unless the user separately
  requests that action.
- Keep requirements, design choices, implementation tasks, and completion proof
  distinct.
- A submitted baseline records the user's current decision. It does not prove
  completeness, correctness, feasibility, stakeholder consensus, or delivery.

## Elicit the requirement space

1. Record the original prompt as `SRC-PROMPT-001`.
2. Frame the problem, desired outcomes, observable success signals, affected
   system boundary, and material risks.
3. Identify users, operators, maintainers, approvers, external systems, and any
   unrepresented stakeholder. Mark inferred stakeholders as unconfirmed.
4. Separate candidate functional requirements, quality requirements,
   constraints, assumptions, dependencies, design preferences, and acceptance
   criteria.
5. Cover normal, alternate, failure, recovery, permission, migration, and
   compatibility scenarios in proportion to risk.
6. Assign stable IDs to sources, decisions, requirements, acceptance criteria,
   conflicts, and unresolved items. Do not recycle an ID within the baseline.

Read [references/requirements-baseline.md](references/requirements-baseline.md)
before preparing the review summary or a persisted specification.

## Ask selectable questions

Ask only decisions that materially change scope, behavior, risk, or verification.
Use the platform's selectable-question mechanism when available.

- Use single choice for mutually exclusive alternatives.
- Use multi-select only when every selected option can coexist. If native
  multi-select is unavailable, ask per-item `accept`, `reject`, or `defer`
  questions instead of simulating ambiguous checkbox input.
- For high-impact candidate requirements, collect an explicit per-item
  `accept`, `reject`, or `defer` decision.
- Always preserve an `Other` route for user-authored input. Treat it as a
  replacement in single-choice questions and an addition in multi-select
  questions unless it conflicts with another selection.
- Distinguish `none`, `unknown`, `deferred`, and unanswered. Never infer one
  from another.
- State the recommended option first only when there is a concrete reason, and
  include the tradeoff rather than hiding it in the label.
- Ask one to three decision-sized questions per turn. Resolve contradictions
  before asking dependent questions.

When the selectable-question mechanism is unavailable, use this numbered
fallback explicitly:

1. Number every option and put `Other — provide your own answer` last.
2. State either `Reply with one number` or `Reply with compatible numbers
   separated by commas`. Allow the latter only after checking that the listed
   choices can coexist.
3. Reject out-of-range, contradictory, or ambiguous input. Do not treat silence,
   prose outside the stated format, or tool activity as a selection.
4. Echo the parsed selection before applying it. Selecting `Other` opens a
   follow-up for free-form user input; it never implies Submit.
5. Keep high-impact per-item decisions as numbered `accept`, `reject`, or
   `defer` questions rather than combining them into one ambiguous selection.

## Analyze before submission

Check the candidate baseline for:

- scope, stakeholder, requirement, constraint, scenario, and quality gaps;
- contradictions between choices, requirements, constraints, and assumptions;
- ambiguous actors, triggers, quantities, boundaries, error behavior, or terms;
- non-observable acceptance criteria or missing verification methods;
- unsupported design choices presented as requirements;
- dependencies and assumptions whose failure changes the solution;
- absent source-to-decision-to-requirement-to-acceptance traceability.

Resolve material contradictions with another user choice. Preserve unresolved
items with impact and owner; never silently choose a winner.

## Obtain explicit Submit

Before the last question, show a compact review containing accepted and deferred
requirements, in/out scope, assumptions, conflicts, unresolved items, acceptance
criteria, verification methods, and excluded or unrepresented sources.

Make the final user decision an explicit selectable action:

- `Submit this baseline`
- `Revise before Submit`
- `Defer Submit`
- `Other` user input

Only `Submit this baseline` creates a `submitted baseline`. If material conflicts
remain, label them and require the user to choose whether to revise or submit
with those items unresolved.

If the selectable-question mechanism is unavailable, present these four actions
as numbered options and require exactly one number. Only the number corresponding
to `Submit this baseline` counts as Submit; `Revise`, `Defer`, and `Other` do not.

## Prepare an optional team handoff

After—not before—Submit, the user may separately choose a downstream action.
When and only when both conditions are true—(1) the user explicitly submitted the
baseline and (2) separately requested `jswork:orcheestrate-team`—render a project
requirements specification with:

```text
python scripts/render_specification.py --input <baseline.json> --output <requirements-specification.md>
```

Resolve the script path relative to this skill directory. Use an explicit
project-local output path and report it. The renderer serializes the submitted
data and checks document-level ID integrity only; it does not determine submission,
call the team, create a Task DAG, validate team work, or make the specification a
workflow gate. Do not run it for another downstream choice. Do not invoke the
team merely because the specification was rendered.

The requirements specification owns `RQ-*` and `AC-*` IDs. A later PL may cite
them from Task DAG nodes, but the PL remains the owner of that DAG and may revise
its mapping as implementation evidence changes.
