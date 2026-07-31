---
name: bdd
description: Apply focused behavior-driven development by defining an actor, an external trigger, observable failing behavior, the minimum successful implementation, and a safe refactor boundary. Use when the user asks for BDD, behavior-driven development, behavioral scenarios, Red-Green-Refactor testing, or implementation driven by externally observable behavior.
---

# BDD

Use behavior scenarios to drive a concrete implementation change. Keep each
scenario narrow enough to guide development and verification. Do not create a
single overarching scenario for an entire product, project, or business flow.

## Define the behavior

Begin with a small Feature and one or more focused scenarios.

For each scenario, identify:

- **Actor:** the person, client, system, developer, operating system, or library
  that initiates the behavior.
- **When:** the input that crosses the outer boundary of the code under test.
  Prefer a button click or form input for UI work, an HTTP request or message
  for backend work, and a command, parameter, function call, or system API
  input for CLI and system work.
- **Observable result:** the output, state change, response, exit code, rendered
  result, or other effect visible at that boundary.

Do not replace an external behavior with an internal implementation detail
unless the user explicitly asks to test that internal contract.

## Apply Red, Green, and Refactor

Follow this order for every applicable scenario:

1. **Red:** express the expected behavior as a check that fails for the intended
   reason. Run it before implementation when the environment permits, and
   record the actual failure rather than inventing evidence.
2. **Green:** implement the smallest complete change that makes the same
   scenario pass. Re-run the Red check and record the successful result.
3. **Refactor:** only after Green passes, improve structure, naming, reuse, or
   performance without changing the scenario's behavior. Re-run the scenario
   and relevant regression checks after refactoring.

If a requested behavior already passes, report that no valid Red baseline was
observed. Do not break correct code merely to manufacture a failure. If the
environment prevents a check from running, state the limitation precisely.

## Use the boundary guide

| Category | UI | API or backend | System app or CLI |
| --- | --- | --- | --- |
| **Actor** | Human user | Frontend or another backend | Developer, OS, or another library |
| **When** | Button click, form input, swipe | HTTP request, Kafka message | CLI command, parameter, function call |
| **Red** | Expected result is not rendered | Wrong status or response body | Wrong exit code, standard output, or return value |
| **Green** | Handle the event and render the result | Implement controller or service behavior and persistence | Parse input and implement the required calculation or stream behavior |
| **Refactor** | Reuse components and organize styles | Optimize queries and clarify layers | Optimize memory or buffers and modularize |

Adapt the examples to the repository's actual interface and test framework.
Repository instructions, the user's scope, and existing public contracts remain
authoritative.

## Report the evidence

At completion, report:

- the Feature or focused scenario,
- Actor, When, and observable result,
- the Red command or check and its observed failure,
- the Green implementation and passing result,
- any Refactor performed and the post-refactor result,
- relevant regression checks and any limitations.

Never claim a check ran or passed without evidence from the current work.
