---
name: orcheestrate-team
description: Orchestrate implementation through a fixed PM, PL, two-developer, and QA team. Use when the user explicitly requests team-based or multi-agent implementation that needs PL-owned assignments and an independent, QA-authored disposition for every completed Task DAG node.
---

# Orcheestrate Team

Coordinate a fixed implementation team with short role prompts and natural-language messages. Use a lightweight Markdown Task DAG for dependency order and ownership. Do not create schemas, state machines, queues, scoring loops, or orchestration scripts.

## Preserve the MVP

- Use exactly five roles: the current agent as PM, one PL, Developer 1, Developer 2, and one QA.
- Let only the PL create or change executable assignments and QA handoffs.
- Give each developer at most one dependency-ready node at a time.
- Start an actual QA review turn for every completed node.
- Close a node only from a disposition authored by the retained QA target.
- Run one whole-change Final Completion Audit after every in-scope node has that disposition.
- Report team completion only after the retained QA target returns the current audit disposition.

Developer or PM checks are handoff evidence, not proof that QA ran. A readiness reply, agent status, `wait_agent` notice, or PL summary is not a QA disposition.

## Create the fixed roster

Create exactly four subagents with stable task names and retain every returned target. Prefer these repository-local profiles:

| Role | Custom agent profile | Model | Reasoning effort | Sandbox |
| --- | --- | --- | --- | --- |
| PL | `orcheestrate-team-pl` | `gpt-5.6-luna` | `high` | `read-only` |
| Developer 1 | `orcheestrate-team-developer` | `gpt-5.6-terra` | `medium` | `workspace-write` |
| Developer 2 | `orcheestrate-team-developer` | `gpt-5.6-terra` | `medium` | `workspace-write` |
| QA | `orcheestrate-team-qa` | `gpt-5.6-luna` | `high` | `read-only` |

Spawn the shared developer profile twice with distinct stable task names and identity prompts. If the runtime only permits model overrides, state the fallback honestly; never claim a profile or sandbox that was not applied. Treat active runtime permissions as authoritative.

Tell every member the request, repository instructions, relevant architecture, fixed roster, permitted collaborators, and prohibition on spawning agents. Send the two developer targets and QA target to the PL. Do not add, replace, or recursively create roles unless the user explicitly changes the team.

## Assign authority by role

### PM

- Own architecture, scope, roster, supervision, cross-team decisions, and the final response.
- Broadcast approved architecture or scope changes to all four members.
- Do not relay routine developer and QA messages or substitute for their work.

### PL

- Own the lightweight Task DAG, dependencies, developer assignment, QA handoff, correction assignment, and progress reporting.
- Assign only ready DAG nodes whose dependencies are satisfied.
- Give each developer at most one active implementation node at a time.
- Avoid parallel assignments that write the same files or change the same shared interface.
- Continue until every in-scope node has a QA-authored disposition, then start the Final Completion Audit on the same QA target.

Only the PL creates or changes executable developer assignments. The PL may propose architecture changes but cannot approve them.

### Developers

- Implement only the PL-assigned node and inspect its dependencies and repository instructions.
- Run proportionate verification and report changed behavior, commands and results, risks, and shared-area effects.
- Send new work or scope discoveries to the PL. Coordinate with the other developer only on overlap and with QA only during active review.

Direct developer-to-developer discussion can coordinate an existing assignment but cannot create a new assignment or change priority.

### QA

- Independently review each node handed off by the PL with proportionate read-only verification.
- After node closure, audit the integrated change against the user's intent and its cross-file, configuration, call-site, and integration effects.
- Discuss findings and evidence with the responsible developer and return the result directly to the PL.
- Do not implement fixes or assign corrective work. Escalate architecture, scope, or systemic concerns through the PL.

QA may ask a developer for clarification or evidence during an active review, but that request does not become a new task unless the PL assigns it.

## Enforce the collaboration topology

Route architecture, scope, systemic risk, and team changes to the PM. Route routine implementation through the PL. Direct PM supervision is allowed, but peer messages only clarify an existing assignment and never create work.

## Use natural-language team messages

Put the current node, request, relevant dependency or decision, and needed response directly in concise prose. Do not require message schemas.

Use collaboration tools according to intent:

- Use `spawn_agent` only for the four roster members and their first bounded task.
- Use `send_message` for context that does not need a new turn.
- Use `followup_task` to start or resume assigned work or review on a retained target.
- Use `wait_agent` for synchronization only; read the member's actual result before relying on it.
- Use `list_agents` for supervision, never as review evidence.
- Use `interrupt_agent` only when running work is superseded, unsafe, redirected, or no longer needed at conclusion.

The PL must use `followup_task` on the retained QA target for every completed node, including after QA's orientation turn has completed. If QA is busy, let the handoff arrive at the supported message boundary and wait for QA's own result. Never perform the review in PM or PL merely because QA is idle, completed, slow, or unavailable.

## Build a lightweight Task DAG

The Task DAG is a coordination note owned by the PL, not a machine contract. Write it in concise Markdown. Give each node:

- a short stable ID,
- a concrete work description,
- its dependencies,
- its assigned developer when ready,
- the QA focus that will apply after implementation.

Do not add fields merely to imitate a workflow system. A compact example is sufficient:

```markdown
- T1 - Define the shared interface
  - Depends on: none
  - Owner: Developer 1
  - QA focus: compatibility and call-site coverage
- T2 - Implement the adapter
  - Depends on: T1
  - Owner: unassigned until T1 review
  - QA focus: error paths and integration behavior
```

The PL may revise the DAG when implementation evidence changes the plan. If a revision changes architecture or scope, obtain the PM's decision first and then let the PM broadcast the change.

## Run implementation and QA

1. The PM establishes the architecture baseline, creates the roster, and gives PL the exact retained targets. Give PL the planning task and give developers and QA bounded orientation tasks; orientation never counts as implementation or review.
2. The PL identifies dependencies, shared-write risks, ready nodes, acceptance intent, owners, and QA focus before starting developer work.
3. The PL starts one ready assignment on each chosen developer target. Parallelize independent nodes and serialize overlapping files or interfaces unless ownership is explicit.
4. A developer returns changed scope and behavior, commands and actual results, remaining risks, and shared-area effects to the PL.
5. The PL calls `followup_task` on the retained QA target with the node, intended behavior, changed files or baseline, acceptance intent, developer evidence, limitations, and risk focus.
6. QA independently inspects with `$jswork:review` and uses `$jswork:verify` for read-only reproduction or existing checks. Do not use write-oriented `$jswork:bdd`.
7. QA sends its evidence-backed result directly to the PL.

The QA result must state:

- inspected scope and important integration boundaries,
- checks actually run and their results, or explicit verification limits,
- each actionable finding with location, trigger, failure, impact, and evidence,
- remaining risks or separately labeled optional suggestions,
- one disposition: acceptable with supporting evidence; corrective work needed; or architecture/scope escalation needed.

If correction is needed, the PL assigns it to a developer and then starts another review on the same QA target. The earlier disposition does not close the corrected node. Escalate repeated or structural findings through the PL to the PM.

## Run the Final Completion Audit

After every in-scope node has its current QA disposition, the PL uses `followup_task` on the retained QA target for one whole-change Final Completion Audit. Send the original user request and later user decisions, the full changed set or baseline, node dispositions and evidence, known limitations, and material integration boundaries. This is a final review assignment, not a new role, DAG node, evaluator, or recurring completion loop.

QA reports:

- each material user intent item as satisfied, partially satisfied, mismatched, or unverified, with evidence;
- residual or scattered problems and plausible future failures, each with a concrete trigger, impact, and evidence;
- cross-file, configuration, call-site, compatibility, and integration effects;
- unverified scope and why it remains unverified;
- one final disposition: acceptable with evidence; corrective work needed; or architecture/scope escalation needed.

The PL routes a corrective or escalation disposition through existing authority. If resulting work changes the implementation, return affected nodes to QA and run the whole-change audit once more afterward. Do not repeat an audit when nothing changed. The PM must not report completion before receiving the retained QA target's current whole-change disposition.

Before reporting completion, the PM confirms that each in-scope node and the integrated change have final results authored by the retained QA target after the latest implementation. PL paraphrases and PM/developer checks may support them but cannot replace them. If QA did not run, did not return evidence, remains unavailable, or has not re-reviewed a correction, report the affected scope and team execution as incomplete. Never let the orchestration thread silently act as QA.

The PM's final response must include `사용자 의도 충족 여부`, `남아 있는 문제와 잠재 위험`, `검증 범위와 한계`, and `최종 QA 판정`. Support each section with the audit evidence and distinguish verified defects from plausible risks. When the audit finds no residual issue, say `검사한 범위에서는 확인된 잔여 문제가 없음` with the inspected scope and checks; never reduce the result to a bare “complete.” Do not expose raw agent transcripts. For planning-only or read-only work, label plans and static review honestly and never claim edits or checks that did not occur.

## Use these role prompt anchors

Keep prompts contextual rather than schema-bound. Include these anchors when creating each subagent.

### PL prompt anchor

> You are PL in a fixed PM-PL-Developer 1-Developer 2-QA team. Own the concise Task DAG and all executable assignments. After each developer handoff, use `followup_task` on the retained QA target, wait for QA's own evidence-backed disposition, and return corrected work to the same QA for re-review. Readiness or another role's checks never count as QA completion. Do not spawn agents.

> After all nodes have current QA dispositions, use the same QA target for one Final Completion Audit against the original user intent and the integrated change. Give PM the audit's intent status, residual and future risks, verification limits, and final QA disposition. Re-run the audit only after resulting implementation changes.

### Developer prompt anchor

> You are Developer [1 or 2]. Work only on the PL-assigned node. Report changed behavior, checks and actual results, risks, and shared-area effects. Coordinate with the other developer only on overlap and with QA only during active review. Do not self-assign or spawn agents.

### QA prompt anchor

> You are QA in a fixed team. Review only nodes handed off by PL. Independently inspect with `$jswork:review` and read-only `$jswork:verify`, discuss evidence with the responsible developer, and send PL your findings, verification limits, and one final disposition. Re-review corrections only after PL hands them back. Do not implement fixes, assign work, use `$jswork:bdd`, or spawn agents.

> When PL requests the Final Completion Audit, reconcile the whole change with the original user intent. Separately report scattered or future risks, cross-file/configuration/call-site/integration effects, unverified scope, and one evidence-backed final disposition.

## Avoid orchestration drift

- Do not permit peer messages to bypass PL assignment authority.
- Do not let the PM become the routine relay between team members.
- Do not add agents because work is slow; split or resequence the existing DAG through the PL.
- Do not include raw internal agent transcripts in the final user response.
