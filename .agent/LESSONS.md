# LESSONS.md — the-abyss (monorepo root)
<!-- Append-only. Agent MUST read before starting any work. -->

---

### [2026-04-10] Sub-app AGENTS.md files were full root copies
**Mistake:** Every apps/*/AGENTS.md was an identical verbatim copy of the root AGENTS.md
**New rule:** Division AGENTS.md = scoped rules only (division intro, sub-app list, division constraints, commands, boundaries). Sub-app AGENTS.md = thin bridge pointing to division file. NEVER copy root content into division or sub-app files.
**Trigger:** Any time a new AGENTS.md is created in a subdirectory

### [2026-04-10] Root .agent/ had wrong structure
**Mistake:** Root .agent/ contained conductor/, memory/, projects/, rules/, workflows/ instead of the standard 5-file structure
**New rule:** .agent/ at ANY level = CONTEXT.md, PROGRESS.md, HANDOFF.md, LESSONS.md, DECISIONS.md, sessions/ — nothing else at root level of the folder
**Trigger:** Any .agent/ initialization or audit

### [2026-04-10] Session logs written only to .agent/sessions/ missing Sentratorium
**Mistake:** Agent wrote session log to .agent/sessions/ but did not update docs/sentratorium/latest.md and AGENT_SESSION_LOG.md
**New rule:** Every session that changes code MUST update BOTH: (1) .agent/sessions/YYYY-MM-DD.md AND (2) docs/sentratorium/latest.md + docs/sentratorium/AGENT_SESSION_LOG.md
**Trigger:** Every session end, every JET J9 commit

### [2026-04-10] AGENTS.md Section 8 pointed to wrong docs path
**Mistake:** AGENTS.md said documentation goes to /documentation/ — but real system is docs/sentratorium/
**New rule:** All documentation path references in AGENTS.md must point to docs/sentratorium/ for session logs and docs/adr/ for architectural decisions
**Trigger:** Any update to AGENTS.md documentation section

### [2026-04-10] Sentra Assist kept two memory systems after deprecating one
**Mistake:** `sentra-assist` kept referencing `docs/sentratorium/` and `docs/superpowers/` after the team decided `.agent/` should be the only operational memory system.
**New rule:** For `sentra-assist`, `.agent/` is the only operational memory source. Legacy systems may exist in history, but they must not stay in active instructions, handoff flow, or checklists.
**Trigger:** Any update to `AGENTS.md`, `.agent/*`, or session logging workflow

### [2026-04-10] Dual-log rule is superseded for sentra-assist
**Mistake:** Historical entries in this file still describe a dual-log workflow using `docs/sentratorium/`.
**New rule:** For `sentra-assist`, those entries are historical only. The active rule is singular: update `.agent/PROGRESS.md` and `.agent/sessions/YYYY-MM-DD.md`.
**Trigger:** Any time an agent reads older entries and is unsure which rule is active

---
<!-- Agent: append new lessons below this line -->
