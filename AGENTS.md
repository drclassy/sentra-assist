# AGENTS.md — apps/healthcare/sentra-assist

<!-- Cross-tool agent instructions: Claude Code, Cursor, Codex, Windsurf, Copilot -->
<!-- Last updated: 2026-04-12 | Owner: Chief | Projects: Sentra / The Abyss -->

---

## 0. Standalone Repo Note

This is a **standalone repository** (`Claudesy/sentra-assist`). All agent rules are self-contained in this file.

**Never** run `terraform apply` / `terraform destroy` without explicit Chief approval.

---

## 1. Project Introduction

**Sentra Assist** (`@the-abyss/sentra-assist`) is a Browser extension delivering clinical decision support for safer diagnosis in ePuskesmas. It acts as an AI-driven sidekick that helps healthcare professionals identify potential diagnosis mismatches or missing clinical data.

**Tech stack:**

| Layer     | Technology                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Framework | WXT (Browser Extension Framework)                                                                     |
| UI        | React 18 (pinned in `package.json`; align with root stack when upgrading), Tailwind CSS, Lucide Icons |
| AI        | Vertex AI (`@google-cloud/vertexai`) via `lib/` abstraction                                           |
| Testing   | Vitest, Testing Library, Playwright                                                                   |
| Runtime   | Node.js ≥22, pnpm ≥9, TypeScript strict                                                               |

---

## 2. Mandatory Memory Protocol — READ THIS BEFORE ANYTHING ELSE

> **CRITICAL: Every agent MUST read the entire `.agent/` folder before performing any task.**
> Assume the context window can be reset at any moment. All status, decisions, and plans live in `.agent/`.

**Required reading order at session start:**

```
1. .agent/CONTEXT.md     → Understand architecture & stack
2. .agent/PROGRESS.md    → Know the current state of work
3. .agent/HANDOFF.md     → Read the plan & instructions for this session
4. .agent/LESSONS.md     → Avoid previously made mistakes
5. .agent/DECISIONS.md   → Understand prior architectural decisions
```

**Required writing at session end or after each completed JET phase:**

- Update `.agent/PROGRESS.md` — current status, next steps
- Append `.agent/sessions/YYYY-MM-DD.md` — session summary
- If an architectural decision was made → append `.agent/DECISIONS.md`
- If Chief issued a correction → append `.agent/LESSONS.md`

**Confirm readiness with:**

> ✅ AGENTS.md read. Reading `.agent/` now.

---

## 3. JET Workflow Protocol

Every non-trivial task (2+ steps) follows the JET Protocol per root `AGENTS.md` §2.

### 3.1 Task Classification (root §2.1)

| Class       | Risk Level | Examples                                               | JET Required | GO Gate               |
| ----------- | ---------- | ------------------------------------------------------ | ------------ | --------------------- |
| **Class A** | Minimal    | Read files, grep search, typo fix, rename variable     | J1-J4 only   | Auto-approve          |
| **Class B** | Standard   | New component, API endpoint, bug fix, refactor         | J1-J7        | Checkpoint (self-log) |
| **Class C** | High       | DB migration, terraform, security config, PHI handling | J1-J9 Full   | ⛔ Hard J5            |

**Classification heuristics:**

- Only reading/searching? → **Class A**
- Writing code in existing patterns? → **Class B**
- Touching infrastructure/database/PHI? → **Class C**

### 3.2 JET Phases

| Phase | Name          | Action                                                                                | Gate           |
| ----- | ------------- | ------------------------------------------------------------------------------------- | -------------- |
| J1    | **Context**   | Scan `.agent/`, repo, env vars → log confirmation                                     | Auto           |
| J2    | **Validate**  | Check against `.cursor/rules/` + `AGENTS.md` → report discrepancies, halt if critical | Auto           |
| J3    | **Diagnose**  | Identify root issues/needs → document in `HANDOFF.md`                                 | Auto           |
| J4    | **Plan**      | Write step-by-step `HANDOFF.md` + rollback plan                                       | Auto           |
| J5    | **Risk Gate** | Classify task → determine depth and GO requirement per §3.1                           | **Risk-based** |
| J6    | **Execute**   | Implement code changes (diff must be verifiable)                                      | Post-planning  |
| J7    | **Verify**    | Run tests → 100% pass or rollback                                                     | Post-execution |
| J8    | **Docs**      | Update `.agent/` + session log                                                        | Post-verify    |
| J9    | **Commit**    | `git commit` with trailer: `Agent: Claude · Phase: Execution · Handoff: [session-id]` | Post-docs      |

**GO status tracking:** Check `.agent/SESSION_STATE.md` or root `SESSION_STATE.md` before Class B or C tasks:

- If GO already granted for session scope → proceed
- If Class C and no GO → halt, request Chief "GO"
- If Class B and no GO → log plan, proceed (checkpoint mode)

**Note:** J5 hard gate still applies to Class C tasks regardless of session state.

---

## 4. Directory Structure

```text
sentra-assist/
├── AGENTS.md                  ← This file (Sentra Assist scoped instructions)
├── entrypoints/
│   ├── sidepanel/             ← Main Assist UI
│   ├── login/                 ← Dashboard-backed auth UI
│   └── background.ts          ← Messaging, bridge orchestration, runtime wiring
├── components/
│   ├── clinical/              ← TTV, diagnosis, settings, alerts
│   └── sidepanel/             ← Dashboard, navigation, shared shell
├── lib/
│   ├── api/                   ← Auth, bridge, polling, authed fetch
│   └── clinical/              ← Inference, composition, rules
├── tests/                     ← Vitest and Playwright test suites
└── scripts/                   ← Build and utility scripts
```

---

## 5. Technical Conventions

**Always do:**

- Output language: **English** for all code, comments, docs, and agent communication
- Commit messages: Conventional Commits format (`feat:`, `fix:`, `docs:`, `chore:`)
- Error handling: always explicit — no silent catch blocks
- Prefer edit over create: modify existing files before creating new ones
- Max 1 new file per session — fix the same artifact on failure, do not create a replacement
- **Server-backed truth:** Dashboard server is the source of truth for auth. Assist is healthy only if server-backed auth/session verification succeeds.
- **AI constraints:** All Vertex AI calls must go through `lib/` abstraction. Never call Vertex AI directly from UI components.
- **Sync policy:** Sync/consult actions count as success only after server ack, not local UI optimism.
- **Compliance guard:** `lib/api/bridge-client.test.ts` must pass for all bridge interactions.

**Never do:**

- Log, print, or commit credentials, API keys, or patient data (PII)
- Execute any action before J5 GO is received
- Fabricate test results, logs, or command output — state uncertainty explicitly
- Create new files without strong justification
- **Extension constraints:** Do NOT modify `wxt.config.ts` without Chief approval — it controls extension permissions.

---

## 6. Commands & Setup

```powershell
# Dependencies
pnpm install

# Development
pnpm --filter @the-abyss/sentra-assist dev        # WXT dev server

# Build
pnpm --filter @the-abyss/sentra-assist build

# Quality gates (must all pass before commit)
pnpm --filter @the-abyss/sentra-assist test
pnpm --filter @the-abyss/sentra-assist test:contract
pnpm --filter @the-abyss/sentra-assist lint
pnpm --filter @the-abyss/sentra-assist typecheck
```

---

## 7. Pre-PR Checklist

Before creating a PR or committing to main:

- [ ] All tests pass (`pnpm --filter @the-abyss/sentra-assist test`)
- [ ] Contract tests pass (`pnpm --filter @the-abyss/sentra-assist test:contract`)
- [ ] Lint clean (`pnpm --filter @the-abyss/sentra-assist lint`)
- [ ] TypeScript valid (`pnpm --filter @the-abyss/sentra-assist typecheck`)
- [ ] No secrets or PII in the diff
- [ ] `.agent/PROGRESS.md` updated
- [ ] `.agent/sessions/YYYY-MM-DD.md` written
- [ ] `HANDOFF.md` reflects current state
- [ ] Commit message follows Conventional Commits
- [ ] Commit trailer present: `Agent: Claude · Phase: Execution · Handoff: Review diffs`
- [ ] No unnecessary new files created

---

## 8. Documentation Requirements

**Session log** — required at every session end. File: `.agent/sessions/YYYY-MM-DD.md`

```markdown
# Session: YYYY-MM-DD

## Goal

[What this session aimed to achieve]

## Actions Taken

- [Action 1]
- [Action 2]

## Files Modified

- `path/to/file.ts` — [description of change]

## Results

[What succeeded, what failed]

## Next Steps

[What the next session should pick up]

## Blockers

[Any blockers, or "None"]
```

- Architectural decisions → always append to `.agent/DECISIONS.md` with date
- Chief corrections → always append to `.agent/LESSONS.md` as a prevention rule
- Technical documentation → `docs/` folder, updated at JET J8

---

## 9. Native Editor Preferences

**Claude Code:**

- Config: `.claude/settings.json`
- Subagents: `.claude/agents/*.md` (YAML frontmatter: `name`, `description`, `tools`, `model`, `permissionMode`)
- Memory: `.agent/` folder (see Section 2)
- Auto-memory: enable via `CLAUDE_CODE_DISABLE_AUTO_MEMORY=0`
- Context hygiene: run `/compact` manually at 50% context usage, `/clear` between unrelated tasks

**Cursor 3.0 + Composer 2:**

- Rules: `.cursor/rules/*.mdc` (scoped per glob pattern)
- Agents Window: use for isolated parallel tasks
- Design Mode: for UI/frontend work
- Parallel agents: `/best-of-n` for experiments
- **Monorepo-wide** source of truth: root [`AGENTS.md`](../../../AGENTS.md) (see §0).

**Cross-tool principle:**

- Root `AGENTS.md` is the single source of truth for monorepo-wide rules.
- This file adds **package-specific** instructions only; do not contradict root `AGENTS.md`.
- Tool-specific config files only for features that cannot be represented in markdown.

---

_Every agent reading this file must confirm with:_

> ✅ AGENTS.md read. Reading `.agent/` now.
