# AGENTS.md — Sentra Assist

Guide for **coding agents** (Cursor, Claude Code, Copilot, etc.) and humans working in the `@the-abyss/sentra-assist` package. This product is a **browser extension (WXT / Chrome MV3)** Clinical Decision Support System (CDSS) integrated with **ePuskesmas** — not a Next.js web app in this folder.

---

## Native folders to read (editor preferences)

| Platform | Path |
|----------|------|
| Claude | `C:\Users\claud\.claude\CLAUDE.md` |
| Codex | `C:\Users\claud\.codex\AGENTS.md` |
| Roo Code | `C:\Users\claud\roocode\AGENT.md` |
| Gemini | `C:\Users\claud\.gemini\GEMINI.md` |
| GitHub Copilot | `C:\Users\claud\.copilot\AGENTS..md` |
| Kilocode | `C:\Users\claud\.kilo\AGENTS.md` |

Monorepo context: `D:/Devop/abyss-monorepo/CLAUDE.md` and `apps/healthcare/AGENTS.md` (healthcare domain, PHI, test standards).

---

## What is this?

- **Package name:** `@the-abyss/sentra-assist`
- **Role:** Supports clinical workflows in electronic medical records — diagnosis suggestions (ICD-10), prescriptions/DDI, pediatric dosing, vital signs, RME transfer, DAS (DOM mapping), decision audit trails.
- **Runtime:** Service worker (background), side panel / login UI, content script on `*://*.epuskesmas.id/*`, separate inject bundle where applicable.

---

## Stack and conventions

| Area | Choice |
|------|--------|
| Language | TypeScript (strict), ES modules |
| UI | React, Tailwind (sidepanel / login) |
| State | Zustand + `chrome.storage` / `@wxt-dev/storage` |
| Extension | WXT, `@webext-core/messaging` (typed protocol) |
| Validation | Zod for external I/O (monorepo pattern) |
| Tests | Vitest (unit/integration), Playwright (e2e) |
| Package manager | **pnpm** from monorepo root or `pnpm --filter @the-abyss/sentra-assist` |

**Do not:** log free-text PII/PHI; commit `.env` or patient data; ignore `apps/healthcare/AGENTS.md` domain rules.

---

## Commands (from this app directory)

```powershell
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

App path: `D:/Devop/abyss-monorepo/apps/healthcare/sentra-assist`.

---

## Directory map (short)

| Path | Contents |
|------|----------|
| `entrypoints/` | `background.ts`, `content.ts`, `inject.content.ts`, `sidepanel/`, `login/` |
| `components/` | Clinical UI, sidepanel, medlink |
| `lib/` | API clients, Iskandar engine, ICD-10 RAG, DAS, audit, clinical store |
| `utils/` | `messaging.ts` (source of truth for message protocol), `types`, logger |
| `data/` | Static JSON (mappings, epidemiology, stock, etc.) |
| `docs/` | Internal architecture and specs |

---

## Capability surface: message protocol (Panel ↔ Worker ↔ Content)

All cross-context interactions must go through **`utils/messaging.ts`** (`ProtocolMap`). Adding a user-facing action without a typed entry here creates technical debt and hurts **action parity** for automation/agents.

**Example message groups (not exhaustive — see the file):**

- **Form / RME:** `fillResep`, `fillAnamnesa`, `fillDiagnosa`, `transferRME`, `cancelRMETransfer`
- **Scrape / status:** `execScrape`, `scrapeResult`, `pageReady`, `updateEncounter`, `encounterUpdated`
- **CDSS / API:** `getSuggestions`, `getRecommendations`, `checkInteractions`, `checkAllergies`, `calculatePediatricDose`, `getCDSSStatus`, `initializeCDSS`
- **Diagnostics and context:** `scanFields`, `scanMedicalHistory`, `scanVisitHistory`, `scanClinicalContext`, `resolveTenagaMedis`, `visitHistoryScraped`

Main handlers: `entrypoints/background.ts`. **Read `ProtocolMap` and handlers before changing message flows.**

---

## LLM and “agents” in the product

- Clinical inference uses **system prompt + structured JSON output** (`lib/api/prompt-templates.ts`, `lib/api/vertex-ai-client.ts`, `lib/iskandar-diagnosis-engine/llm-reasoner.ts`).
- This is **request/response**, not an **agent loop with tool calling** like Claude Code. Optional Google Search grounding in Vertex is not a generic in-app tool suite.

To move toward a more *agent-native* design (see audit below), typical strategies are: primitives over storage/RME/API, dynamic context injection, and explicit completion signals — without compromising patient safety.

---

## Agent-native architecture audit (summary scores)

Method: eight principles from the *Agent-Native Architecture Audit*, scored against the **current Sentra Assist codebase** (2026-04-07). Scores are **indicative** for planning, not certification.

| Principle | Score | % | Notes |
|-----------|-------|---|--------|
| 1. Action parity (UI vs structured agent affordances) | 0/12 | 0% | No end-user MCP agent; **coding agents** achieve parity by editing the same code/protocol as the UI |
| 2. Tools as primitives | 3/8 | 38% | Messaging calls are relatively atomic; LLM does not expose tool primitives to users |
| 3. Context injection | 4/10 | 40% | Clinical prompts include RAG/anonymized context; no full “workspace state” injection for an interactive agent |
| 4. Shared workspace | 7/8 | 88% | Users and CDSS share store + storage (`lib/store.ts`, audit) |
| 5. CRUD completeness (entities vs agent tools) | 2/10 | 20% | Encounter/prescription/diagnosis entities exist in UI; no open CRUD for external agents |
| 6. UI integration | 8/10 | 80% | `encounterUpdated` and store bind the panel; risk of “silent update” if store is bypassed |
| 7. Capability discovery | 2/7 | 29% | No agent `/help`; discovery via clinical UI and repo docs |
| 8. Prompt-native features | 5/10 | 50% | Much CDSS behavior lives in prompts + engine; substantial business rules remain in TypeScript |

**Rough combined score:** ~**35%** toward an ideal *agent-native product* — **expected** for a regulated CDSS focused on **controlled clinical suggestions**, not a fully autonomous agent.

### Strengths

- Typed, centralized messaging protocol — solid foundation for automation parity.
- Audit trail and anonymization separation for inference.
- Diagnosis engine + ICD-10 RAG integrated in one pipeline.

### High-impact gaps

1. **Parity:** every new UI action → `ProtocolMap` entry + one-line note in AGENTS.md or architecture docs.
2. **Context:** if adding an interactive agent, inject a non-PHI encounter state summary into the system prompt.
3. **Discovery:** onboarding or a “capabilities” panel for clinicians (not only for coding agents).

---

## Pre-PR checklist (agents / humans)

- [ ] `pnpm typecheck`, `pnpm lint`, and `pnpm test` (at least for this package)
- [ ] No new debug `console.log` on production paths (use the project logger)
- [ ] Message changes: update `ProtocolMap` + background handler + all callers
- [ ] No PII/PHI in fixtures, logs, or error strings
- [ ] Clinical safety–critical behavior: add or extend tests and audit where appropriate

---

## Sentratorium (monorepo governance)

After a session that changes repo artifacts, internal contributors update `docs/sentratorium/latest.md` and append one line to `docs/sentratorium/AGENT_SESSION_LOG.md` at the monorepo root (see Sentratorium HQ rule).

---

*Designed and constructed by Claudesy. Sentra Healthcare Artificial Intelligence.*
