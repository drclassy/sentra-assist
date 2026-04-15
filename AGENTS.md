# AGENTS.md — apps/healthcare/sentra-assist

<!-- Cross-tool agent instructions -->
<!-- Last updated: 2026-04-15 | Owner: Chief | Projects: Sentra / The Abyss -->

---

## 0. Monorepo Root (SSOT)

Read the root [`AGENTS.md`](../../../AGENTS.md) first (JET Protocol, memory protocol, prohibitions).
This file adds **scoped** instructions for this package only. If anything conflicts, **root wins**.

**Also:** `packages/shared-types` for shared contracts; **never** run `terraform apply` / `terraform destroy` (Chief only).

---

## 1. Project Introduction

**Sentra Assist** (`@the-abyss/sentra-assist`) is a browser extension delivering clinical decision support for safer diagnosis in ePuskesmas.

**Tech stack:** WXT, React 18, Tailwind CSS, Lucide Icons, Vertex AI, Vitest, Playwright, Node.js ≥22, pnpm ≥9, TypeScript strict.

---

## 2. Mandatory Memory Protocol

> Every agent MUST read the entire `.agent/` folder before any task.

**Reading order:** `CONTEXT.md` → `PROGRESS.md` → `HANDOFF.md` → `LESSONS.md` → `DECISIONS.md`

Confirm readiness with:

> ✅ AGENTS.md read. Reading `.agent/` now.

**Wait for Chief confirmation before proceeding to J1.**

**Required writing after session:**

- Update `.agent/PROGRESS.md`
- Append `.agent/sessions/YYYY-MM-DD.md`
- New architectural decision → `.agent/DECISIONS.md`
- Chief correction → `.agent/LESSONS.md`

---

## 3. JET Workflow Protocol

Every non-trivial task follows JET per root `AGENTS.md` §2.

**Task classification:**

- Class A (read/search/typo): J1-J4
- Class B (component/bugfix/refactor): J1-J7
- Class C (security/PHI/infrastructure): J1-J9 full, ⛔ hard J5 gate

**Note:** Do NOT modify `wxt.config.ts` without Chief approval — it controls extension permissions.

---

## 4. Directory Structure

```text
sentra-assist/
├── entrypoints/
│   ├── sidepanel/             ← Main Assist UI
│   ├── login/                 ← Dashboard-backed auth UI
│   └── background.ts          ← Messaging, bridge orchestration
├── components/
│   ├── clinical/              ← TTV, diagnosis, settings, alerts, ResepForm
│   ├── cdss/                  ← CDSS widget, confidence meter, diagnosis cards
│   ├── sidepanel/             ← Dashboard, navigation, shell
│   ├── providers/             ← ThemeProvider
│   └── ui/                    ← ThemeToggle, shared UI primitives
├── lib/
│   ├── api/                   ← Auth, bridge, polling, authed fetch, audit-service
│   ├── clinical/              ← Inference, composition, rules, tenaga-medis
│   ├── scraper/               ← DOM scraping (static)
│   │   └── adaptive/          ← DAS: AI-powered adaptive field detection
│   ├── iskandar-diagnosis-engine/ ← Core diagnosis engine
│   ├── handlers/              ← Page-specific fill handlers
│   ├── rme/                   ← RME transfer and payload mapping
│   ├── rag/                   ← ICD-10 RAG search
│   ├── emergency-detector/    ← Glucose, HTN, shock detection
│   └── filler/                ← Form filling core (content script bridge)
├── utils/                     ← Shared utilities (audio, logger, messaging, sound)
├── types/                     ← API and global type definitions
├── data/                      ← Clinical data (DDI, field mappings)
├── public/                    ← Extension assets (icons, fonts, sounds)
├── scripts/
│   ├── build/                 ← Database optimization
│   ├── data/                  ← Data conversion scripts
│   └── dev/                   ← Dev automation and smoke tests
└── tests/                     ← Vitest setup
```

---

## 5. Commands & Setup

```powershell
# Dependencies
pnpm install

# Development
pnpm --filter @the-abyss/sentra-assist dev              # WXT dev (Chrome)
pnpm --filter @the-abyss/sentra-assist dev:firefox      # WXT dev (Firefox)

# Build
pnpm --filter @the-abyss/sentra-assist build
pnpm --filter @the-abyss/sentra-assist build:firefox

# Quality gates (must all pass before commit)
pnpm --filter @the-abyss/sentra-assist test
pnpm --filter @the-abyss/sentra-assist test:contract
pnpm --filter @the-abyss/sentra-assist lint
pnpm --filter @the-abyss/sentra-assist typecheck

# Single test / pattern
pnpm --filter @the-abyss/sentra-assist test -- lib/api/bridge-client.test.ts
pnpm --filter @the-abyss/sentra-assist test -- -t "event_id generation"

# Fix & format
pnpm --filter @the-abyss/sentra-assist lint:fix
pnpm --filter @the-abyss/sentra-assist format
```

---

## 6. Code Style Guidelines

### Language & Output

- Output language: **English** for all code, comments, docs, and agent communication.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- Commit trailer: `Agent: Claude · Phase: Execution · Handoff: [session-id]`

### Formatting

- Prettier config: `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: es5`, `printWidth: 100`.
- Run `pnpm --filter @the-abyss/sentra-assist format` before committing.

### Imports

- Use explicit `type` imports for types: `import type { Foo } from '@/lib/foo'`.
- Path aliases: prefer `@/` for first-party code. `~/` is also valid (legacy).
- Group imports: (1) external libs, (2) internal `@/` modules, (3) types, (4) relative (avoid if possible).

### Types & Naming

- TypeScript `strict: true`. Enable explicit return types on exported functions.
- Interfaces over `type` for object shapes.
- PascalCase for components, interfaces, types, enums.
- camelCase for functions, variables, hooks.
- SCREAMING_SNAKE_CASE for true constants.
- React components: prefer `export function ComponentName(props: Props)` over `React.FC`.

### Error Handling

- **No silent catch blocks.** Always log or re-throw.
- ESLint `no-console` is active (allow: `warn`, `error`). Use `createLogger()` from `~/utils/logger` for app logs.
- Prefer `try/catch` with typed error checks: `error instanceof Error ? error.message : String(error)`.

### React Patterns

- Functional components only.
- Props interface defined above component.
- Hooks named `usePascalCase`.
- Tailwind classes for styling; avoid inline `style` except for dynamic values.

### Testing

- Unit: Vitest + jsdom + Testing Library. Globals enabled.
- Test files: co-locate as `*.test.ts` or `*.test.tsx` next to source.
- Contract guard: `lib/api/bridge-client.test.ts` must pass for all bridge interactions.
- E2E: Playwright in `tests/e2e/`.

---

## 7. Technical Constraints

**Always do:**

- Server-backed truth: Dashboard server is source of truth for auth.
- AI constraints: All Vertex AI calls must go through `lib/` abstraction. Never call Vertex AI directly from UI components.
- Sync policy: Sync/consult actions count as success only after server ack.
- Prefer edit over create; max 1 new file per session.

**Never do:**

- Log, print, or commit credentials, API keys, or patient data (PII/PHI).
- Modify `wxt.config.ts` without Chief approval.
- Fabricate test results or command output.

---

## 9. Onboarding New Team Members

Welcome to Sentra Assist. Follow this checklist to get up to speed:

1. **Read Documentation in Order:**
   - `README.md`
   - `AGENTS.md`
   - `CODING_STANDARD.md`
   - `docs/architecture/`
   - `docs/adr/`

2. **Set Up Local Development Environment:**
   - Install Node.js ≥22 and pnpm ≥9
   - Run `pnpm install`
   - Copy `.env.example` to `.env.local`
   - Load the unpacked extension in Chrome

3. **Complete First Contribution:**
   - Pick a `good first issue` or small bug fix
   - Follow the JET Workflow Protocol (§3)
   - Request code review from a senior team member

4. **Participate in Code Review:**
   - Review at least one PR before merging your own
   - Understand the Pre-PR Checklist (§8)

---

## 10. Emergency Procedures

If you encounter a **critical issue** (production outage, data breach, patient safety concern, or security vulnerability):

1. **Stop all changes** immediately. Do not commit or push.
2. **Document the issue** in `.agent/HANDOFF.md` with:
   - What happened
   - When it happened
   - Impact assessment
   - Steps taken so far
3. **Contact the Primary Contact:** Chief / Claudesy (Project Owner)
4. **Escalation Path:**
   - Level 1: Chief / Claudesy
   - Level 2: Sentra (Principal Infrastructure Engineer)
   - Level 3: Healthcare compliance officer (for PHI/PHI issues)
5. **Do not attempt a fix alone** for Class C issues (security/PHI/infrastructure).

---

## 11. Tool Usage Guidelines

### IDE & Editor

- Use VS Code with the recommended extensions (see `.vscode/extensions.json` if present).
- Enable Format on Save with Prettier.
- Use the TypeScript strict language server.

### Git

- Commit early, commit often.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- Always include the commit trailer: `Agent: Claude · Phase: Execution · Handoff: [session-id]`.
- Never commit `.env.local`, secrets, or patient data.

### Debugging

- Use `VITE_DEBUG=true` for verbose logging during development.
- Use Chrome DevTools for background script and content script debugging.
- Use `console.warn` and `console.error` sparingly; prefer `createLogger()` from `~/utils/logger`.

### AI Assistants

- All AI-generated code must be reviewed before commit.
- Never ask AI to generate or refactor code that handles PHI/PHI without human oversight.
- AI must follow JET Protocol for all non-trivial tasks.

---

## 12. Code Review Checklist

Reviewers must verify the following before approving a PR:

- [ ] **Functionality:** The code does what it claims to do.
- [ ] **Type Safety:** No `any` types; strict TypeScript compliance.
- [ ] **Error Handling:** No silent catch blocks; all errors are logged or re-thrown.
- [ ] **Security:** No secrets, credentials, or PHI/PHI in the diff.
- [ ] **Testing:** New code has corresponding tests; all tests pass.
- [ ] **Performance:** No obvious N+1 queries or unnecessary re-renders.
- [ ] **Accessibility:** Interactive elements are keyboard-accessible and have proper ARIA attributes.
- [ ] **Documentation:** Public APIs have JSDoc comments; ADRs are updated for architectural changes.
- [ ] **Style:** Follows Prettier and ESLint rules; imports are grouped correctly.
- [ ] **WXT Safety:** `wxt.config.ts` was not modified without explicit Chief approval.

---

## 8. Pre-PR Checklist

- [ ] `test`, `test:contract`, `lint`, `typecheck` all pass
- [ ] No secrets or PII in diff
- [ ] `.agent/PROGRESS.md` updated
- [ ] `.agent/sessions/YYYY-MM-DD.md` written
- [ ] Commit follows Conventional Commits + trailer present
- [ ] No unnecessary new files
