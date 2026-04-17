# AGENTS.md — apps/healthcare/sentra-assist

<!-- Cross-tool agent instructions -->
<!-- Last updated: 2026-04-17 | Owner: Chief | Projects: Sentra / The Abyss -->

---

## 0. Monorepo Root (SSOT)

Read the root [`AGENTS.md`](../../../AGENTS.md) first (JET Protocol, memory protocol, prohibitions).
This file adds **scoped** instructions for this package only. If anything conflicts, **root wins**.

**Also:** `packages/shared-types` for shared contracts; **never** run `terraform apply` / `terraform destroy` (Chief only).

---

## 1. Project Identity

**Sentra Assist** (`@the-abyss/sentra-assist`) is a WXT browser extension delivering clinical decision support inside ePuskesmas via a sidepanel.

**Tech stack:** WXT, React 18, Tailwind CSS, Lucide Icons, Vertex AI, Vitest + jsdom + Testing Library, Playwright, Node.js ≥22, pnpm ≥9, TypeScript `strict`.

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
│   ├── sidepanel/             ← Main Assist UI (React)
│   ├── login/                 ← Auth entrypoint (separate bundle)
│   ├── background.ts          ← MV3 background script, bridge orchestration
│   ├── content.ts             ← Content script (DAS extraction)
│   └── inject.content.ts      ← Injected content script
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
│   ├── iskandar-diagnosis-engine/ ← Core diagnosis engine (8-step pipeline)
│   ├── handlers/              ← Page-specific fill handlers (anamnesa, diagnosa, resep)
│   ├── rme/                   ← RME transfer orchestrator + payload mapping
│   ├── rag/                   ← ICD-10 RAG search
│   ├── emergency-detector/    ← 4-gate emergency detection (TTV, HTN, Glucose, Shock)
│   └── filler/                ← Form filling core (content script bridge)
├── utils/                     ← Shared utilities (audio, logger, messaging, sound)
├── types/                     ← API and global type definitions
├── data/                      ← Clinical data (DDI, field mappings)
├── public/                    ← Extension assets (icons, fonts, sounds)
├── scripts/                   ← Build optimization, data conversion, dev automation
└── tests/                     ← Vitest setup (jsdom globals)
```

---

## 5. Commands

```powershell
# Install (run from monorepo root)
pnpm install

# Development
pnpm --filter @the-abyss/sentra-assist dev              # Chrome MV3 hot reload
pnpm --filter @the-abyss/sentra-assist dev:firefox      # Firefox MV2

# Build
pnpm --filter @the-abyss/sentra-assist build            # Chrome MV3
pnpm --filter @the-abyss/sentra-assist build:firefox    # Firefox MV2
pnpm --filter @the-abyss/sentra-assist zip              # Chrome Web Store ZIP
pnpm --filter @the-abyss/sentra-assist zip:firefox      # Firefox ZIP

# Quality gates (must all pass before commit)
pnpm --filter @the-abyss/sentra-assist test
pnpm --filter @the-abyss/sentra-assist test:contract    # Bridge API contract guard
pnpm --filter @the-abyss/sentra-assist lint
pnpm --filter @the-abyss/sentra-assist typecheck        # tsc --noEmit strict

# Single test / pattern
pnpm --filter @the-abyss/sentra-assist test -- lib/api/bridge-client.test.ts
pnpm --filter @the-abyss/sentra-assist test -- -t "event_id generation"

# Fix & format
pnpm --filter @the-abyss/sentra-assist lint:fix
pnpm --filter @the-abyss/sentra-assist format
```

---

## 6. WXT & Extension Quirks

- **Entrypoints:** WXT auto-discovers files in `entrypoints/`. `*.content.ts` = content scripts, `*.html` dirs = pages, `background.ts` = service worker.
- **No popup:** The action button opens the sidepanel, not a popup. `login/` is a separate page bundle — do not merge it into `sidepanel/`.
- **Build output:** `.output/chrome-mv3-dev/` (dev) and `.output/chrome-mv3-prod/` (build). Load unpacked from these paths, not `dist/`.
- **Env loading:** Vite env vars use `import.meta.env.VITE_*`. `VITE_DEBUG=true` enables scoped debug logging; `VITE_DEBUG_*` controls per-module channels (background, content, filler, riwayat).
- **Content Security Policy:** Defined in `wxt.config.ts`. External scripts are blocked; inline styles are blocked. Use Tailwind classes only.
- **Postinstall:** `wxt prepare` runs automatically after `pnpm install` to generate `.wxt/` types.

---

## 7. Code Style

### Formatting

- Prettier: `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: es5`, `printWidth: 100`.
- Run `pnpm --filter @the-abyss/sentra-assist format` before committing.

### Imports

- Explicit `type` imports for types: `import type { Foo } from '@/lib/foo'`.
- Path aliases: prefer `@/` for first-party code. `~/` is also valid (legacy).
- Group: (1) external libs, (2) internal `@/` modules, (3) types, (4) relative (avoid if possible).

### Types & Naming

- TypeScript `strict: true`. Explicit return types on exported functions.
- Interfaces over `type` for object shapes.
- PascalCase: components, interfaces, types, enums. camelCase: functions, variables, hooks. SCREAMING_SNAKE_CASE: true constants.
- React: prefer `export function ComponentName(props: Props)` over `React.FC`.

### Error Handling

- **No silent catch blocks.** Always log or re-throw.
- ESLint `no-console` is active (allow: `warn`, `error`). Use `createLogger()` from `~/utils/logger` for app logs.
- `utils/logger.ts` is the **only** file exempt from `no-console`.
- Logger auto-redacts PHI/PII keys (patient, nama, NIK, alamat, keluhan, diagnosa, resep, etc.).
- Prefer typed error checks: `error instanceof Error ? error.message : String(error)`.

### React Patterns

- Functional components only.
- Props interface above component.
- Hooks named `usePascalCase`.
- Tailwind classes for styling; avoid inline `style` except for dynamic values.

### Testing

- Unit: Vitest + jsdom + Testing Library. **Globals enabled** (`expect`, `describe`, `it` available without import).
- Setup file: `tests/setup.ts` (imports `@testing-library/jest-dom/vitest`).
- Co-locate tests as `*.test.ts` or `*.test.tsx` next to source.
- **Contract guard:** `lib/api/bridge-client.test.ts` must pass for any bridge interaction change.
- E2E: Playwright in `tests/e2e/`.

---

## 8. Technical Constraints

**Always do:**

- Server-backed truth: Dashboard server is source of truth for auth.
- AI abstraction: All Vertex AI calls go through `lib/` abstractions. Never call Vertex AI directly from UI components.
- Sync policy: Sync/consult actions count as success only after server ack.
- Prefer edit over create; max 1 new file per session.

**Never do:**

- Log, print, or commit credentials, API keys, or patient data (PII/PHI).
- Modify `wxt.config.ts` without Chief approval.
- Fabricate test results or command output.

---

## 9. Pre-PR Checklist

- [ ] `test`, `test:contract`, `lint`, `typecheck` all pass
- [ ] No secrets or PII in diff
- [ ] `.agent/PROGRESS.md` updated
- [ ] `.agent/sessions/YYYY-MM-DD.md` written
- [ ] Commit follows Conventional Commits + trailer present
- [ ] No unnecessary new files
- [ ] `wxt.config.ts` unchanged (unless Chief approved)
