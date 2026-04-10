# AGENTS.md — apps/healthcare/sentra-assist
<!-- Scoped to sentra-assist only. Root + division apply first. -->
<!-- Last updated: 2026-04-10 | Owner: Chief -->

Root AGENTS.md and division [`../AGENTS.md`](../AGENTS.md) apply first. This file is the operational source of truth for `sentra-assist`.

> ✅ Root AGENTS.md → `apps/healthcare/AGENTS.md` → This file. Now applying sentra-assist scope.

---

## Sub-app: Sentra Assist

**Package:** `@the-abyss/sentra-assist`  
**Purpose:** Browser extension delivering clinical decision support for safer diagnosis in ePuskesmas  
**Division AGENTS.md:** [`../AGENTS.md`](../AGENTS.md)

---

## Mandatory Memory Protocol — Read This Before Anything Else

> **CRITICAL: Every agent MUST read the entire `.agent/` folder before performing any task.**
> Assume the context window can be reset at any moment. All current status, session plans, lessons, and architectural decisions for this app live in `.agent/`.

**Required reading order at session start:**

1. `.agent/CONTEXT.md` — understand architecture, stack, and active boundaries
2. `.agent/PROGRESS.md` — know the current state of work
3. `.agent/HANDOFF.md` — read the active session plan and next actions
4. `.agent/LESSONS.md` — avoid repeating previous mistakes
5. `.agent/DECISIONS.md` — understand prior architectural decisions

**Required writing at session end or after each completed JET phase:**

- Update `.agent/PROGRESS.md`
- Append `.agent/sessions/YYYY-MM-DD.md`
- If an architectural decision was made, append `.agent/DECISIONS.md`
- If Chief issued a correction, append `.agent/LESSONS.md`

**Confirm readiness with:**
> ✅ AGENTS.md read. Reading `.agent/` now.

**Single source of truth rule:**
- For `sentra-assist`, `.agent/` is the only authoritative memory system
- Do not rely on legacy session-log systems or deprecated planning folders
- `docs/` remains for technical documentation, ADRs, and product-facing specs only

---

## Sentra Assist-Specific Constraints

**Extension framework (WXT) — not standard Next.js:**
- Dev: `pnpm --filter @the-abyss/sentra-assist dev`
- Build: `pnpm --filter @the-abyss/sentra-assist build`
- Do NOT modify `wxt.config.ts` without Chief approval — it controls extension permissions

**Contract test gate:**
- Run `pnpm --filter @the-abyss/sentra-assist test:contract` before every PR
- Compliance guard: `lib/api/bridge-client.test.ts`

**AI calls:**
- All Vertex AI calls must go through `lib/` abstraction
- Never call Vertex AI directly from UI components

**Server-backed truth policy:**
- Dashboard server is the source of truth for auth
- Assist is healthy only if server-backed auth/session verification succeeds
- Sync/consult actions count as success only after server ack, not local UI optimism

---

## Pre-PR Checklist

- [ ] All tests pass: `pnpm test`
- [ ] Lint clean: `pnpm lint`
- [ ] TypeScript valid: `pnpm typecheck`
- [ ] No secrets or PHI/PII in the diff
- [ ] `.agent/PROGRESS.md` updated
- [ ] `.agent/sessions/YYYY-MM-DD.md` written
- [ ] `HANDOFF.md` reflects current state
- [ ] Commit message follows Conventional Commits
- [ ] Commit trailer present: `Agent: Claude · Phase: Execution · Handoff: Review diffs`
- [ ] No unnecessary new files created
- [ ] If healthcare division: `pnpm security:primary-healthcare` passed
- [ ] If shared packages changed: `pnpm turbo run build` passes for all consumers

---

## Documentation Requirements

- Session log is required at every session end: `.agent/sessions/YYYY-MM-DD.md`
- Architectural decisions go to `.agent/DECISIONS.md`
- Chief corrections go to `.agent/LESSONS.md`
- Technical docs belong in `docs/`
- ADRs belong in `docs/adr/`
