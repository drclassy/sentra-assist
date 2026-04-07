# Audit Log — Agent Instructions

## Cursor Composer (Dashboard)

**Repo:** `apps/healthcare/primary-healthcare/dashboard/`

Do these tasks in order:

1. **Prisma migration** — add `ScreeningAuditLog` model to `prisma/schema.prisma`, then run `pnpm prisma migrate dev --name add_screening_audit_log` + `pnpm prisma generate`
2. **Audit service** — create `src/lib/audit/screening-audit-service.ts` (hash + DB write/query/ack)
3. **Extend consult route** — in `src/app/api/consult/route.ts`, extract `event_id` + `screening_result` from body, call `createScreeningAuditLog`, return `event_id` in response
4. **Query endpoint** — create `src/app/api/v1/logs/screening/route.ts` (GET with filters + pagination)
5. **Ack endpoint** — create `src/app/api/v1/logs/screening/[eventId]/ack/route.ts` (POST)
6. **Logbook UI** — create `src/app/audit/logbook/page.tsx` + `ScreeningLogbook.tsx` (table + filters + 5s auto-refresh)

Run `pnpm typecheck` after each task. Tests use `node:test` (not vitest).

---

## Claude Code (ASSIST Extension)

**Repo:** `apps/healthcare/sentra-assist/`

One task only — **Task 6:**

- Add `event_id`, `screening_result`, `patient_id_token`, `facility_id`, `app_version`, `assist_id` fields to `ConsultPayload` in `lib/api/bridge-client.ts`
- Update `sendConsultToDoctor()` to generate `crypto.randomUUID()` if `event_id` not provided, return `{ consultId, eventId }` instead of `string`
- Fix the call site in `components/clinical/TTVInferenceUI.tsx`
- Run `pnpm typecheck && pnpm test`

---

## Full spec

`docs/superpowers/specs/2026-04-07-audit-log-design.md`

## Detailed tasks with code

`docs/superpowers/plans/2026-04-07-screening-audit-log.md`
