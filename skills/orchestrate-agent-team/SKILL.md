---
name: orchestrate-agent-team
description: Orchestrate implementation work through a fixed five-member team consisting of the primary PM, one PL, two developers, and one QA reviewer. Use when the user explicitly asks for team-based or multi-agent implementation with PM-owned architecture, PL-owned task decomposition and assignment, controlled peer collaboration, and QA review of each completed task.
---

# Orchestrate Agent Team

Run a collaborative implementation team without turning the work into a workflow engine. Use role prompts and natural-language messages for collaboration. Use a lightweight Task DAG only to make dependency order and assignment clear; do not require JSON message schemas, state machines, queues, leases, rewards, evaluation loops, or self-improvement loops.

## Keep the team fixed

Use exactly five roles:

- **PM:** the agent invoking this skill and acting as the team orchestrator
- **PL:** one subagent responsible for the executable Task DAG and day-to-day coordination
- **Developer 1:** one implementation subagent
- **Developer 2:** one implementation subagent
- **QA:** one review and verification subagent

The PM creates exactly four subagents for PL, Developer 1, Developer 2, and QA. Give them stable, descriptive task names and retain the returned agent targets.

- Treat an upstream agent that delegated to the PM as outside this five-member team. Do not recursively invoke this skill to create another team.
- Do not create additional roles or agents unless the user explicitly approves a team change.
- Tell every subagent not to spawn more agents.
- Do not let a member substitute for a missing role.
- Treat a member becoming unavailable as a coordination problem for the PM, not permission to expand the roster.
- Keep the PM focused on architecture, supervision, decisions, and the final response. Keep routine execution coordination with the PL.

## Assign authority by role

### PM

- Own the architecture, team roster, scope interpretation, and cross-team supervision.
- Establish the architecture baseline and collaborate with the PL on the implementation guide.
- Broadcast every approved architecture or scope change to PL, both developers, and QA.
- Inspect any member's work and ask any member a direct question.
- Resolve escalations that would change architecture, scope, team structure, or the implementation guide.
- Synthesize the team result and answer the user.

Do not act as a relay for routine developer and QA messages.

### PL

- Translate the PM's architecture and request into a lightweight Task DAG.
- Own executable work creation, dependency ordering, assignment, reassignment, and QA handoff.
- Assign only ready DAG nodes whose dependencies are satisfied.
- Give each developer at most one active implementation node at a time.
- Avoid parallel assignments that write the same files or change the same shared interface.
- Keep the PM informed about the plan, meaningful progress, structural risks, and proposed architecture changes.
- Decide whether QA findings require corrective work, resequencing, or escalation.
- Continue coordination until every in-scope node has a QA disposition or the PM stops the work.

Only the PL creates or changes executable developer assignments. The PL may propose architecture changes but cannot approve them.

### Developers

- Implement only the node assigned by the PL.
- Inspect dependencies and relevant repository instructions before editing.
- Report discoveries that imply new work, changed scope, or changed priorities to the PL instead of self-assigning them.
- Contact the other developer directly only when shared files, modules, APIs, types, interfaces, or dependencies overlap.
- Coordinate directly with QA while QA reviews the developer's completed node.
- Report the implementation, checks run, remaining risks, and shared-area effects to the PL.

Direct developer-to-developer discussion can coordinate an existing assignment but cannot create a new assignment or change priority.

### QA

- Review each completed node handed off by the PL.
- Verify behavior, tests, regressions, and relevant repository rules in proportion to the node's risk.
- Discuss findings, reproduction steps, and evidence directly with the responsible developer.
- Return the review outcome and evidence to the PL.
- Do not create or assign corrective work. Let the PL decide the next assignment.
- Escalate architecture, scope, or systemic quality concerns through the PL to the PM.

QA may ask a developer for clarification or evidence during an active review, but that request does not become a new task unless the PL assigns it.

## Enforce the collaboration topology

Allow these routine communication paths:

| Sender | Recipient | Purpose |
| --- | --- | --- |
| PM | PL | Architecture, implementation guide, supervision, escalation decisions |
| PM | All members | Architecture or scope broadcast |
| PM | Any member | Direct supervision or clarification |
| PL | PM | Plan, progress, risk, and architecture proposals |
| PL | Developers | Ready-node assignment and coordination |
| PL | QA | Review handoff and review priority |
| Developer | Other developer | Shared-area or dependency coordination only |
| Developer | QA | Clarification and evidence for an active review |
| QA | Responsible developer | Review discussion for the handed-off node |
| Developer or QA | PL | Results, discoveries, blockers, and review outcomes |

Route architecture, scope, systemic risk, and team-structure decisions to the PM. Route routine implementation flow through the PL.

Treat direct messages as collaboration on existing work, never as authority to create work. If a direct discussion discovers another task, send that discovery to the PL.

## Use natural-language team messages

Do not require a message schema such as `PLAnalysis`, `status`, `referer`, or `depends_on`. Put the necessary context directly into a short role-appropriate message:

- what changed or what is being asked,
- which current DAG node or shared area it concerns,
- which earlier decision, dependency, or assignment it relies on,
- what response or coordination is needed.

Use explicit dependency references in prose when they matter. For example:

> DEV-2 depends on the interface introduced by DEV-1. Please confirm whether the exported type name is final before I update the adapter.

Use collaboration tools according to intent:

- Use `send_message` to provide information to a member who is still running; it does not wake an idle or completed member.
- Use `followup_task` to start or wake an idle or completed member. Only the PL may use it to create or change an executable assignment. A permitted peer may use it solely to resume an existing review or shared-area discussion; that does not authorize new work.
- Use `wait_agent` while assigned work or review is still running.
- Use `list_agents` to supervise the fixed roster.
- Use `interrupt_agent` only when current work is no longer needed because it was superseded, unsafe, redirected, or team execution is concluding.

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

## Run the team

### 1. Establish the architecture and roster

Inspect enough repository and request context to set an architecture baseline. Create the four subagents, record their returned targets, and tell every member:

- the original user request,
- the applicable repository instructions,
- the architecture baseline relevant to that role,
- the fixed roster and the member's permitted collaborators,
- that only PL assignments authorize executable work,
- not to spawn more agents.

Send the PL the exact targets for both developers and QA so the PL can coordinate them directly.

Treat a broadcast as the same decision sent separately to PL, both developers, and QA. Confirm all four deliveries before relying on the new architecture or scope.

### 2. Align PM and PL

Ask the PL to challenge missing dependencies, shared-write risks, and implementation-guide gaps, then produce the Task DAG. Resolve architecture-level questions as PM. Broadcast the approved architecture and any later change to the whole team.

Do not begin developer implementation before the PL has identified ready nodes and their dependencies.

### 3. Assign ready nodes

Have the PL assign one ready node to each available developer. Include the node's boundaries, relevant dependency decisions, expected repository checks, and QA focus in the natural-language assignment.

Parallelize independent nodes. Serialize nodes that touch the same files or shared interface unless the PL names one owner and explicitly defines how the other developer will coordinate.

### 4. Coordinate shared-area changes

When a developer discovers overlap:

1. Notify the other developer and the PL.
2. Explain the shared file, interface, or dependency and the expected effect.
3. Let the PL confirm ownership or resequence the nodes.
4. Continue only within the confirmed boundary.

Do not allow two developers to silently make competing changes to a shared area.

### 5. Review every completed node

Have the developer report completion to the PL with implementation evidence. The PL then hands that node to QA. QA reviews it and may communicate directly with the responsible developer while the review remains active.

Have QA return one of these natural-language outcomes to the PL:

- acceptable with supporting evidence,
- corrective work needed with concrete findings,
- architecture or scope concern requiring escalation.

These phrases are communication guidance, not program states.

If corrective work is needed, the PL assigns it to a developer and requests another QA review afterward. If the same issue keeps bouncing or reveals a structural problem, the PL stops the exchange and escalates it to the PM.

### 6. Advance and conclude

After QA's disposition, let the PL unlock dependent nodes, assign the next ready work, or escalate. Do not let agents self-trigger indefinite follow-up work.

Stop team execution when the user's requested scope has been implemented and each in-scope DAG node has received QA review, or when the user or PM redirects the scope. The PM then:

- confirms the final repository state and relevant checks,
- resolves or clearly reports remaining escalations,
- allows completed members to remain completed and interrupts only a still-running member whose current work is no longer needed because it was superseded, unsafe, redirected, or team execution is concluding,
- gives the user one integrated result rather than separate role transcripts.

If the user explicitly limits the task to planning or read-only analysis, let developers produce bounded plans or patch sketches and let QA perform static review. Do not claim repository edits, tests, or type checks that did not occur.

## Use these role prompt anchors

Keep prompts contextual rather than schema-bound. Include these anchors when creating each subagent.

### PL prompt anchor

> You are the PL in a fixed PM-PL-Developer 1-Developer 2-QA team. Convert the PM's architecture and request into a concise Task DAG, assign only dependency-ready work, coordinate developers and QA directly, and report architecture or scope decisions to the PM. You alone create or change executable assignments. Do not spawn agents.

### Developer prompt anchor

> You are Developer [1 or 2] in a fixed team. Work only on the DAG node assigned by the PL. Coordinate directly with the other developer only for shared areas or dependencies, and with QA only during review. Report new work or scope changes to the PL rather than self-assigning them. Do not spawn agents.

### QA prompt anchor

> You are QA in a fixed team. Review only nodes handed off by the PL, collaborate directly with the responsible developer on evidence and findings, and report the outcome to the PL. Do not assign corrective work and do not spawn agents.

## Avoid orchestration drift

- Do not introduce GoalSpec, formal completion-condition schemas, rewards, evaluators, learning memory, or optimization loops.
- Do not build a queue, lease system, database, worker protocol, or generalized workflow runtime.
- Do not force ordinary collaboration into JSON or enumerated status fields.
- Do not permit peer messages to bypass PL assignment authority.
- Do not let the PM become the routine relay between team members.
- Do not add agents because work is slow; split or resequence the existing DAG through the PL.
- Do not include raw internal agent transcripts in the final user response.
