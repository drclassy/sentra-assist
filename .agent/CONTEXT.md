# CONTEXT.md — sentra-assist
<!-- Static. Update only when stack or architecture changes. -->
<!-- Last updated: 2026-04-10 -->

## Project Identity

| Field | Value |
|-------|-------|
| Name | Sentra Assist |
| Package | `@the-abyss/sentra-assist` |
| Type | WXT browser extension |
| Domain | Healthcare clinical decision support |
| Runtime | Node 22+, pnpm 9+, TypeScript strict |
| UI stack | React 18, Tailwind CSS, Lucide |
| Test stack | Vitest, Testing Library, Playwright |

## Main Surfaces

| Surface | Path | Purpose |
|---------|------|---------|
| Sidepanel | `entrypoints/sidepanel/` | Main Assist UI |
| Login | `entrypoints/login/` | Dashboard-backed auth UI |
| Background | `entrypoints/background.ts` | Messaging, bridge orchestration, runtime wiring |
| Clinical UI | `components/clinical/` | TTV, diagnosis, settings, alerts |
| Sidepanel UI | `components/sidepanel/` | Dashboard, navigation, shared shell |
| API layer | `lib/api/` | Auth, bridge, polling, authed fetch |
| Clinical logic | `lib/clinical/` | Inference, composition, rules |

## Source of Truth

- Session state, progress, handoff, lessons, and decisions live in `.agent/`
- Technical documentation lives in `docs/`
- ADRs live in `docs/adr/`
- Legacy systems `docs/sentratorium/` and `docs/superpowers/` are deprecated and must not be used as operational memory

## Critical Commands

- Dev: `pnpm --filter @the-abyss/sentra-assist dev`
- Build: `pnpm --filter @the-abyss/sentra-assist build`
- Typecheck: `pnpm --filter @the-abyss/sentra-assist typecheck`
- Tests: `pnpm --filter @the-abyss/sentra-assist test`
- Contract tests: `pnpm --filter @the-abyss/sentra-assist test:contract`

## Hard Constraints

- Do not modify `wxt.config.ts` without Chief approval
- Do not log PHI/PII or secrets
- Treat Dashboard server as auth source of truth
- Consider bridge/sync successful only after server ack
- Update `.agent/` at every meaningful session end
