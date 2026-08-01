# Research Matrix

Use this reference to select evidence sources and methods after identifying the
user's research purpose.

## Purpose matrix

| Purpose | Central question | Evidence needed |
| --- | --- | --- |
| Fact verification | Is this specific claim true under the stated conditions? | The most direct, current source and any material exception |
| Topic overview | What is this topic and how is it organized? | Representative authoritative sources covering the main concepts and issues |
| Comparison | How do the alternatives differ under shared criteria? | Comparable evidence for every alternative and criterion |
| Current state or recent change | What is true now and what changed? | Dated current sources plus the earlier state when change matters |
| Evidence synthesis | What does the body of available evidence support? | Multiple relevant sources with agreement, disagreement, and limitations preserved |

Do not classify broad research as a separate purpose. Increase source coverage
and verification depth while keeping the underlying purpose explicit.

## Target and method matrix

| Target | Typical sources | Preferred methods | Verify especially |
| --- | --- | --- | --- |
| Public web | Web pages, news, blogs | Focused web search, domain/date filters, browsing, original-page reading | Publication and event dates, original source, copied claims, snippet distortion |
| Official or primary sources | Product docs, release notes, laws, standards, filings, announcements, raw records | Direct lookup, official-site navigation, version/history comparison | Version, effective date, jurisdiction, applicability, amendments |
| Academic literature | Papers, proceedings, preprints, research reports | Scholarly search, citation tracing, original-paper reading, study comparison | Study design, sample, publication status, effect size, limitations |
| Supplied documents or files | PDF, office document, slides, image, archive | File inspection, OCR when needed, full-text search, page/section lookup | Missing pages, tables, footnotes, definitions, document boundaries |
| Codebase | Source, configuration, tests, history | File/symbol/reference search, call-path tracing, targeted execution | Current revision, runtime path, configuration, tests, docs-versus-code drift |
| Structured data | CSV, spreadsheet, database, API response | Schema inspection, filtering, query, aggregation, calculation | Units, period, denominator, missing values, duplicates, transformations |
| Community material | Forums, reviews, social posts | Multi-case search, pattern comparison, claim tracing | Selection bias, incentives, bots, anecdote-versus-fact distinction |
| Authorized internal material | Wiki, drive, tickets, work records | Permission-scoped search and document inspection | Access boundary, sensitivity, owner, status, as-of date |

Targets may overlap. An official API document is both public-web evidence and an
official source. A supplied paper is both a document and academic literature.
Apply every verification rule that materially affects the claim.

## Method selection

- Use **search** when the evidence location is unknown.
- Use **direct lookup** when the authoritative location is already known.
- Follow discovery with **original-source reading** before citing a claim.
- Use **full-text search** to locate relevant passages in long documents, then
  read the surrounding section.
- Use **code tracing** for implementation, control flow, configuration, and test
  behavior.
- Use **query and calculation** for claims derived from structured data, and
  retain enough detail to reproduce the result.
- Use **cross-checking** when a claim can change the conclusion or the first
  source has a meaningful reliability limitation.
- Use **comparison** only after defining shared criteria.
- Use **synthesis** to combine findings into an answer rather than presenting a
  sequence of disconnected summaries.

## Common combinations

| Request | Purpose | Target | Methods |
| --- | --- | --- | --- |
| Check the current price of a product | Fact verification | Official website | Direct lookup, date and region check |
| Explain a recent policy change | Current state | Official notices and public web | Date-filtered search, original reading, before/after comparison |
| Compare actual use of two tools | Comparison | Official docs and community material | Shared criteria, original reading, review cross-checking |
| Identify consensus across papers | Evidence synthesis | Academic literature | Scholarly search, paper appraisal, synthesis |
| Explain a repository's authentication flow | Topic overview | Codebase | Symbol search, call-path and test tracing |
| Calculate month-over-month change | Current state | Structured data | Schema check, filtering, aggregation, calculation |
| Find termination conditions in a contract | Fact verification | Supplied document | Full-text search, clause and page verification |

## Source selection priorities

Balance these properties rather than applying a fixed source count:

1. **Directness:** Prefer evidence that directly supports the claim.
2. **Authority:** Prefer the entity responsible for the fact when appropriate.
3. **Currency:** Match the source date and version to the question.
4. **Independence:** Distinguish independent confirmation from copied reporting.
5. **Coverage:** Include enough evidence to represent material alternatives,
   disagreement, or scope boundaries.

Authority is contextual. Official documentation is strongest for a product's
declared behavior, while independent tests or user reports may be stronger for
observed reliability or lived experience. State which kind of claim each source
can support.
