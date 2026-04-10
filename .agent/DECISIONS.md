# DECISIONS.md — the-abyss (monorepo root)
<!-- Append-only. NEVER delete or edit existing entries. -->

---

### [2026-04-10] AGENTS.md as cross-tool source of truth
**Context:** Multiple AI tools (Claude Code, Cursor, Codex, Windsurf) need consistent instructions
**Decision:** AGENTS.md at root = single source of truth. Division AGENTS.md = scoped additions only. Sub-app AGENTS.md = thin bridge.
**Rejected alternatives:** CLAUDE.md only, .cursor/rules/ only
**Rationale:** AGENTS.md is Linux Foundation standard; widest tool support; prevents rule duplication
**Consequences:** Root AGENTS.md must stay lean; division files add domain rules only; never duplicate root content

### [2026-04-10] Dual session log protocol
**Context:** Two parallel session log systems existed (.agent/sessions/ and docs/sentratorium/) with no bridge
**Decision:** Both systems are mandatory. .agent/sessions/ = agent memory (context continuity). docs/sentratorium/ = audit trail (governance, CEO visibility).
**Rationale:** Different purposes: agent memory is for context recovery; Sentratorium is for audit and governance
**Consequences:** Every coding session must update both. HANDOFF.md explicitly states this requirement.

### [2026-04-10] .claude/ folder at monorepo root
**Context:** Claude Code settings.json, subagents, commands, and skills need a home
**Decision:** `.claude/` at monorepo root with agents/, commands/, skills/ subdirectories
**Rationale:** Claude Code reads .claude/ from project root; enables subagent delegation and custom commands
**Consequences:** settings.json needed; subagent definitions in agents/*.md; slash commands in commands/*.md

### [2026-04-10] Root .agent/ replaces wrong structure
**Context:** Root .agent/ had conductor/, memory/, projects/, rules/, workflows/ — wrong pattern
**Decision:** Replace with standard 5-file structure: CONTEXT, PROGRESS, HANDOFF, LESSONS, DECISIONS, sessions/
**Consequences:** Old structure folders preserved but ignored by agents; new structure is authoritative

### [2026-04-10] Sentra Assist uses `.agent/` as the only operational memory
**Context:** `docs/sentratorium/` and `docs/superpowers/` were left in active instructions even after the package adopted local `.agent/` memory files.
**Decision:** `sentra-assist` uses `.agent/` as its only operational memory and handoff system. `docs/` remains for technical documentation only.
**Rejected alternatives:** Dual logging to `.agent/` and `docs/sentratorium/`, keeping `docs/superpowers/plans/` as agent task memory
**Rationale:** One active memory system is easier to maintain, easier to audit, and avoids stale instructions.
**Consequences:** Remove stale references to `docs/sentratorium/`; remove obsolete `docs/superpowers/plans/`; keep session continuity in `.agent/sessions/`.

### [2026-04-10] Historical dual-log entries remain for audit only
**Context:** Older entries in `.agent/LESSONS.md` and `.agent/DECISIONS.md` still mention a dual-log protocol using `docs/sentratorium/`.
**Decision:** Those references remain as historical audit context only and do not override the current package rule.
**Rationale:** Preserving history is useful, but active behavior must stay unambiguous.
**Consequences:** Agents must follow `AGENTS.md` plus the most recent `.agent/*` entries, not older superseded workflow notes.

---
<!-- Agent: append new decisions below this line -->
