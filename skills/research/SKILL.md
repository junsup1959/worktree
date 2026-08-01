---
name: research
description: Conduct general-purpose, source-backed research by selecting the research purpose, target sources, and evidence-gathering methods. Use when the user asks to research, look up, verify, compare, find current information, synthesize multiple sources, inspect supplied documents, investigate a codebase, or analyze structured data, unless a more specialized skill owns the task.
---

# Research

Investigate the user's question directly and return an evidence-backed answer.
Keep three decisions separate throughout the work:

- **Purpose:** why the information is needed
- **Target:** where the relevant evidence exists
- **Method:** how to find and verify that evidence

Perform the research as a direct task. Keep the scope limited to locating,
checking, and synthesizing evidence for the user's question.

## Frame the investigation

Identify the following from the request. Infer reasonable defaults when the
request is already clear; ask only when different interpretations would
materially change the result.

1. Select one or more purposes:
   - fact verification,
   - topic overview,
   - comparison,
   - current state or recent change,
   - evidence synthesis.
2. Select one or more targets:
   - public web,
   - official or primary sources,
   - academic literature,
   - supplied documents or files,
   - codebase,
   - structured data,
   - community material,
   - authorized internal material.
3. Select methods that fit those targets:
   - search,
   - browsing and original-source reading,
   - full-text search,
   - code search and execution-path tracing,
   - data query and calculation,
   - cross-checking,
   - comparison,
   - synthesis.
4. Set the breadth from the user's needs. Treat a narrow or broad investigation
   as a scope choice, not as a different research purpose.

Read [references/research-matrix.md](references/research-matrix.md) when the
request spans multiple target types, the appropriate method is unclear, or
source-specific verification rules matter.

## Gather evidence

Use the most direct available source and tool for the selected target.

1. Discover candidate sources with focused terms, domain filters, date filters,
   repository search, document search, or data queries as appropriate.
2. Open the original material. Do not treat a search-result snippet, generated
   summary, index page, or third-party quotation as the final evidence when the
   original is available.
3. Prefer official or primary sources for claims about specifications, policy,
   law, standards, releases, pricing, and current product behavior.
4. Use secondary and community sources when they add interpretation, lived
   experience, criticism, or coverage unavailable from primary sources. Label
   anecdotal evidence as such.
5. Collect only evidence that helps answer the question. Do not accumulate
   sources merely to increase the source count.

For current or unstable information, verify it during the task using live
sources and record the relevant date, version, or effective period. For a
codebase, inspect current source, configuration, tests, and repository guidance
rather than relying only on prose documentation. For structured data, verify
the schema, units, time range, denominator, and missing values before
calculating.

## Verify important claims

Match each conclusion-changing claim to evidence that directly supports it.

- Check whether the source actually states the claim under the same conditions.
- Check date, version, jurisdiction, population, or other scope boundaries.
- Cross-check claims when a source is indirect, disputed, commercially
  motivated, anecdotal, or capable of changing the conclusion.
- Preserve meaningful disagreement instead of forcing sources into one answer.
- Distinguish observed facts, source interpretations, and your own inference.
- State what could not be verified. Never invent access, tool results, facts,
  quotations, or citations.

Use independent confirmation where it adds confidence. Repetition among pages
that copy the same original source is not independent confirmation.

## Synthesize the answer

Lead with the answer, not the search history. Adapt the structure to the purpose:

- **Fact verification:** answer, conditions or exceptions, direct source
- **Topic overview:** organizing concepts, main components, important issues
- **Comparison:** shared criteria, material differences, fit to the user's needs
- **Current state:** present status, date, what changed, practical impact
- **Evidence synthesis:** areas of agreement, disagreements, limitations, gaps

Cite claims near the text they support using the host's supported citation
format. Link to the exact web page rather than a search-results page. For local
evidence, cite the file and line, page, section, symbol, query, or calculation
needed to locate it again.

Keep the response proportional to the request. Include uncertainty and source
limitations when they affect the answer, but do not bury a clear conclusion
under a source-by-source diary.

## Finish when the answer is supported

Conclude the investigation when all of the following hold:

- the user's actual question has been answered,
- conclusion-changing claims have direct support,
- material conflicts and uncertainty are visible,
- citations allow the evidence to be located again,
- additional sources would be mostly redundant.

If access, missing data, or unavailable sources prevent a supported answer,
report the precise limitation and the strongest conclusion the available
evidence permits.
