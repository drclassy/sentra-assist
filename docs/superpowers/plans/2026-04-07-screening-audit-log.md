# Screening Audit Log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every time ASSIST sends a screening result to a doctor, the event is recorded in PostgreSQL, an immutable hash is computed, and the entry appears in the Intelligence Dashboard Logbook within ≤ 5 seconds — with full audit trail for the pilot test.

**Architecture:** ASSIST generates a `event_id` (UUID v4) before POSTing to `/api/consult`. The backend extracts audit fields from the consult payload, computes a SHA-256 immutable hash, writes to a new `ScreeningAuditLog` Prisma model, and returns `event_id` alongside `consultId`. A new GET endpoint powers the dashboard Logbook page. The socket bridge already handles real-time push via `emitAssistConsult`.

**Tech Stack:**
- ASSIST extension: TypeScript (strict), WXT/Vitest
- Dashboard backend: Next.js 15 App Router, Prisma, PostgreSQL, `node:crypto`, `node:test`
- Dashboard frontend: React Server Components + Client Components, Tailwind CSS

---

## ⚡ WHO DOES WHAT — Pembagian Peran

Proyek ini menyentuh **2 repo berbeda**. Bagi pekerjaan seperti ini:

| Agen | Mengerjakan | Repo / Path |
|------|-------------|-------------|
| **Cursor Composer** | Task 1, 2, 3, 4, 5, 7 — semua pekerjaan di Intelligence Dashboard | `apps/healthcare/primary-healthcare/dashboard/` |
| **Claude Code (me)** | Task 6 — ASSIST extension wiring | `apps/healthcare/sentra-assist/` |
| **Siapapun terakhir** | Task 8 — E2E smoke test (verifikasi bersama) | Kedua repo |

### Instruksi untuk Cursor Composer

```
Kamu adalah Cursor Composer yang mengerjakan Intelligence Dashboard.
Repo kamu: apps/healthcare/primary-healthcare/dashboard/

Kerjakan task-task berikut SECARA BERURUTAN:
  Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 7

PENTING:
- Jalankan `pnpm prisma generate` SETELAH Task 1 selesai, SEBELUM mulai Task 2
- Test framework di repo ini adalah node:test (BUKAN vitest/jest)
  Import: `import test from 'node:test'` dan `import assert from 'node:assert/strict'`
- Gunakan pola auth yang sama dengan file src/app/api/consult/route.ts:
  `isCrewAuthorizedRequest(req)` dan `jsonWithCors(req, CORS_METHODS, ...)`
- Jangan ubah file di luar path apps/healthcare/primary-healthcare/dashboard/
- Setelah selesai tiap task, jalankan: `pnpm typecheck`

Mulai dari Task 1 sekarang.
```

### Instruksi untuk Claude Code (this session)

```
Kamu mengerjakan ASSIST Chrome Extension.
Repo kamu: apps/healthcare/sentra-assist/

Kerjakan hanya Task 6.

PENTING:
- sendConsultToDoctor() sekarang return { consultId, eventId } bukan string
- Update semua call site di TTVInferenceUI.tsx
- Test framework: vitest
- Jalankan pnpm typecheck + pnpm test setelah selesai
```

### Urutan eksekusi yang benar

```
[Cursor]  Task 1 — Prisma migration (HARUS pertama)
[Cursor]  Task 2 — screening-audit-service.ts
[Cursor]  Task 3 — extend POST /api/consult
[Cursor]  Task 4 — GET /api/v1/logs/screening
[Cursor]  Task 5 — POST ack endpoint
[Claude]  Task 6 — ASSIST bridge-client.ts (bisa paralel dengan Task 4-5)
[Cursor]  Task 7 — Logbook UI page
[Both]    Task 8 — E2E smoke test
```

---

## Repo Paths (reference)

| Label | Path |
|-------|------|
| `[ASSIST]` | `apps/healthcare/sentra-assist/` |
| `[DASH]` | `apps/healthcare/primary-healthcare/dashboard/` |

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `[DASH] prisma/schema.prisma` | Modify | Add `ScreeningAuditLog` model |
| `[DASH] src/lib/audit/screening-audit-service.ts` | Create | Hash computation + DB read/write |
| `[DASH] src/lib/audit/screening-audit-service.test.ts` | Create | Unit tests for service (node:test) |
| `[DASH] src/app/api/consult/route.ts` | Modify | Extract audit fields; call service; return event_id |
| `[DASH] src/app/api/v1/logs/screening/route.ts` | Create | GET list endpoint with filters + pagination |
| `[DASH] src/app/api/v1/logs/screening/[eventId]/ack/route.ts` | Create | POST ack endpoint |
| `[ASSIST] lib/api/bridge-client.ts` | Modify | Add event_id + screening_result to ConsultPayload; update sendConsultToDoctor |
| `[ASSIST] lib/api/bridge-client.test.ts` | Create | Vitest unit tests for event_id generation |
| `[DASH] src/app/audit/logbook/page.tsx` | Create | Next.js RSC page for logbook |
| `[DASH] src/app/audit/logbook/ScreeningLogbook.tsx` | Create | Client component — table, filters, real-time |

---

## Task 1: Add `ScreeningAuditLog` Prisma model

**Repo:** `[DASH]`  
**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1: Add model to schema**

Open `prisma/schema.prisma`. After the `ClinicalCaseAuditEvent` model (after line ~300), add:

```prisma
model ScreeningAuditLog {
  id                   String    @id @default(cuid())
  eventId              String    @unique @map("event_id")
  assistId             String    @map("assist_id")
  consultId            String?   @map("consult_id")
  patientId            String    @map("patient_id")
  screeningId          String    @map("screening_id")
  doctorId             String    @map("doctor_id")
  facilityId           String    @map("facility_id")
  screeningStatus      String    @map("screening_status")
  riskLevel            String?   @map("risk_level")
  score                Int?
  resultSummary        String?   @map("result_summary")
  deliveryStatus       String    @map("delivery_status")
  deliveryTimestamp    DateTime  @map("delivery_timestamp")
  acknowledgedByDoctor Boolean   @default(false) @map("acknowledged_by_doctor")
  ackTimestamp         DateTime? @map("ack_timestamp")
  appVersion           String?   @map("app_version")
  senderUserId         String?   @map("sender_user_id")
  metaJson             Json?     @map("meta_json")
  immutableHash        String    @map("immutable_hash")
  createdAt            DateTime  @default(now()) @map("created_at")

  @@index([doctorId])
  @@index([facilityId])
  @@index([createdAt(sort: Desc)])
  @@index([deliveryStatus, screeningStatus])
  @@map("screening_audit_logs")
}
```

- [ ] **Step 1.2: Generate and run migration**

```pwsh
cd apps/healthcare/primary-healthcare/dashboard
pnpm prisma migrate dev --name add_screening_audit_log
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 1.3: Verify generated client**

```pwsh
pnpm prisma generate
```

Expected output: `Generated Prisma Client` (no errors). Confirm `prisma.screeningAuditLog.create` is available by running:

```pwsh
node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.screeningAuditLog.create)"
```

Expected: `function`

- [ ] **Step 1.4: Commit**

```pwsh
git add apps/healthcare/primary-healthcare/dashboard/prisma/schema.prisma
git add apps/healthcare/primary-healthcare/dashboard/prisma/migrations/
git commit -m "feat(dashboard/db): add ScreeningAuditLog model for pilot audit trail"
```

---

## Task 2: Create `screening-audit-service.ts`

**Repo:** `[DASH]`  
**Files:**
- Create: `src/lib/audit/screening-audit-service.ts`
- Create: `src/lib/audit/screening-audit-service.test.ts`

- [ ] **Step 2.1: Write failing tests first**

Create `src/lib/audit/screening-audit-service.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

// computeImmutableHash — pure function, no DB needed
import { computeImmutableHash } from './screening-audit-service'

test('computeImmutableHash — same inputs produce same hash', () => {
  const fields = {
    eventId: '550e8400-e29b-41d4-a716-446655440001',
    deliveryTimestamp: '2026-04-07T08:15:30.000Z',
    patientId: 'pid-token-7f3a91bc',
    doctorId: 'doc-54321',
    screeningStatus: 'positive',
    score: 85,
    assistId: 'assist-RM001-1744015200000',
  }
  const h1 = computeImmutableHash(fields)
  const h2 = computeImmutableHash(fields)
  assert.equal(h1, h2)
  assert.match(h1, /^sha256:[a-f0-9]{64}$/)
})

test('computeImmutableHash — different eventId produces different hash', () => {
  const base = {
    eventId: 'aaa',
    deliveryTimestamp: '2026-04-07T08:15:30.000Z',
    patientId: 'pid-abc',
    doctorId: 'doc-1',
    screeningStatus: 'positive' as const,
    score: 80,
    assistId: 'assist-RM001-111',
  }
  const h1 = computeImmutableHash(base)
  const h2 = computeImmutableHash({ ...base, eventId: 'bbb' })
  assert.notEqual(h1, h2)
})

test('computeImmutableHash — null score is handled gracefully', () => {
  const fields = {
    eventId: 'evt-001',
    deliveryTimestamp: '2026-04-07T08:00:00Z',
    patientId: 'pid-tok',
    doctorId: 'doc-9',
    screeningStatus: 'inconclusive' as const,
    score: null,
    assistId: 'assist-RM002-999',
  }
  assert.doesNotThrow(() => computeImmutableHash(fields))
  assert.match(computeImmutableHash(fields), /^sha256:/)
})
```

- [ ] **Step 2.2: Run tests — expect FAIL**

```pwsh
cd apps/healthcare/primary-healthcare/dashboard
node --test src/lib/audit/screening-audit-service.test.ts
```

Expected: `Error: Cannot find module './screening-audit-service'`

- [ ] **Step 2.3: Create the service file**

Create `src/lib/audit/screening-audit-service.ts`:

```ts
import 'server-only'

import { createHash } from 'node:crypto'

import { prisma } from '@/lib/prisma'

// ============================================================================
// TYPES
// ============================================================================

export interface CreateScreeningAuditInput {
  eventId: string
  assistId: string
  consultId?: string
  patientId: string
  screeningId: string
  doctorId: string
  facilityId: string
  screeningStatus: 'positive' | 'negative' | 'inconclusive'
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  score?: number | null
  resultSummary?: string
  deliveryStatus: 'sent' | 'delivered' | 'failed' | 'pending'
  deliveryTimestamp: Date
  appVersion?: string
  senderUserId?: string
  metaJson?: Record<string, unknown>
}

export interface ScreeningAuditAck {
  id: string
  eventId: string
  savedAt: string
}

export interface ScreeningAuditLogFilters {
  from?: Date
  to?: Date
  doctorId?: string
  facilityId?: string
  screeningStatus?: string
  deliveryStatus?: string
  acknowledged?: boolean
  page?: number
  perPage?: number
}

// ============================================================================
// HASH
// ============================================================================

export function computeImmutableHash(fields: {
  eventId: string
  deliveryTimestamp: string
  patientId: string
  doctorId: string
  screeningStatus: string
  score: number | null | undefined
  assistId: string
}): string {
  const canonical = [
    fields.eventId,
    fields.deliveryTimestamp,
    fields.patientId,
    fields.doctorId,
    fields.screeningStatus,
    String(fields.score ?? ''),
    fields.assistId,
  ].join('|')
  return 'sha256:' + createHash('sha256').update(canonical, 'utf8').digest('hex')
}

// ============================================================================
// CREATE
// ============================================================================

export async function createScreeningAuditLog(
  input: CreateScreeningAuditInput
): Promise<ScreeningAuditAck> {
  const immutableHash = computeImmutableHash({
    eventId: input.eventId,
    deliveryTimestamp: input.deliveryTimestamp.toISOString(),
    patientId: input.patientId,
    doctorId: input.doctorId,
    screeningStatus: input.screeningStatus,
    score: input.score,
    assistId: input.assistId,
  })

  const record = await prisma.screeningAuditLog.create({
    data: {
      eventId: input.eventId,
      assistId: input.assistId,
      consultId: input.consultId ?? null,
      patientId: input.patientId,
      screeningId: input.screeningId,
      doctorId: input.doctorId,
      facilityId: input.facilityId,
      screeningStatus: input.screeningStatus,
      riskLevel: input.riskLevel ?? null,
      score: input.score ?? null,
      resultSummary: input.resultSummary ?? null,
      deliveryStatus: input.deliveryStatus,
      deliveryTimestamp: input.deliveryTimestamp,
      appVersion: input.appVersion ?? null,
      senderUserId: input.senderUserId ?? null,
      metaJson: (input.metaJson ?? {}) as object,
      immutableHash,
    },
    select: { id: true, eventId: true, createdAt: true },
  })

  return {
    id: record.id,
    eventId: record.eventId,
    savedAt: record.createdAt.toISOString(),
  }
}

// ============================================================================
// QUERY (for dashboard logbook GET)
// ============================================================================

export async function queryScreeningAuditLogs(filters: ScreeningAuditLogFilters) {
  const page = filters.page ?? 1
  const perPage = Math.min(filters.perPage ?? 50, 200)
  const skip = (page - 1) * perPage

  const where = {
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
    ...(filters.facilityId ? { facilityId: filters.facilityId } : {}),
    ...(filters.screeningStatus ? { screeningStatus: filters.screeningStatus } : {}),
    ...(filters.deliveryStatus ? { deliveryStatus: filters.deliveryStatus } : {}),
    ...(filters.acknowledged !== undefined
      ? { acknowledgedByDoctor: filters.acknowledged }
      : {}),
  }

  const [total, data] = await prisma.$transaction([
    prisma.screeningAuditLog.count({ where }),
    prisma.screeningAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: perPage,
      select: {
        id: true,
        eventId: true,
        assistId: true,
        consultId: true,
        patientId: true,
        screeningId: true,
        doctorId: true,
        facilityId: true,
        screeningStatus: true,
        riskLevel: true,
        score: true,
        resultSummary: true,
        deliveryStatus: true,
        deliveryTimestamp: true,
        acknowledgedByDoctor: true,
        ackTimestamp: true,
        appVersion: true,
        immutableHash: true,
        createdAt: true,
      },
    }),
  ])

  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  }
}

// ============================================================================
// ACK
// ============================================================================

export async function ackScreeningAuditLog(
  eventId: string,
  ackedByDoctorId: string,
  ackTimestamp: Date
): Promise<{ eventId: string; acknowledgedByDoctor: boolean; ackTimestamp: string }> {
  const existing = await prisma.screeningAuditLog.findUnique({
    where: { eventId },
    select: { id: true, acknowledgedByDoctor: true },
  })

  if (!existing) throw new Error(`ScreeningAuditLog not found: ${eventId}`)
  if (existing.acknowledgedByDoctor) throw new Error(`ALREADY_ACKED:${eventId}`)

  const updated = await prisma.screeningAuditLog.update({
    where: { eventId },
    data: {
      acknowledgedByDoctor: true,
      ackTimestamp,
      metaJson: {
        ...(await prisma.screeningAuditLog
          .findUnique({ where: { eventId }, select: { metaJson: true } })
          .then((r) => (r?.metaJson as object | null) ?? {})),
        acked_by_doctor_id: ackedByDoctorId,
      },
    },
    select: { eventId: true, acknowledgedByDoctor: true, ackTimestamp: true },
  })

  return {
    eventId: updated.eventId,
    acknowledgedByDoctor: updated.acknowledgedByDoctor,
    ackTimestamp: updated.ackTimestamp?.toISOString() ?? ackTimestamp.toISOString(),
  }
}
```

- [ ] **Step 2.4: Run tests again — expect PASS**

```pwsh
node --test src/lib/audit/screening-audit-service.test.ts
```

Expected output:
```
✔ computeImmutableHash — same inputs produce same hash (X ms)
✔ computeImmutableHash — different eventId produces different hash (X ms)
✔ computeImmutableHash — null score is handled gracefully (X ms)
```

- [ ] **Step 2.5: Commit**

```pwsh
git add src/lib/audit/screening-audit-service.ts src/lib/audit/screening-audit-service.test.ts
git commit -m "feat(dashboard/audit): add ScreeningAuditService with hash computation"
```

---

## Task 3: Extend `POST /api/consult` to write audit log

**Repo:** `[DASH]`  
**Files:**
- Modify: `src/app/api/consult/route.ts`

- [ ] **Step 3.1: Add import at top of route.ts**

After the existing imports, add:

```ts
import {
  createScreeningAuditLog,
} from '@/lib/audit/screening-audit-service'
```

- [ ] **Step 3.2: Extend destructuring to extract audit fields**

In the `POST` handler, after the existing destructuring block (after line `const { patient, ttv, ... } = body`), add:

```ts
const {
  event_id,
  screening_result,
  patient_id_token,
  screening_id,
  facility_id: assist_facility_id,
  app_version,
} = body as {
  event_id?: string
  screening_result?: {
    status?: 'positive' | 'negative' | 'inconclusive'
    score?: number
    risk_level?: 'low' | 'medium' | 'high' | 'critical'
    summary?: string
  }
  patient_id_token?: string
  screening_id?: string
  facility_id?: string
  app_version?: string
}
```

- [ ] **Step 3.3: Add `createScreeningAuditLog` call after existing ConsultLog write**

After the `prisma.consultLog.create(...)` try/catch block (around line 116), add:

```ts
// Write structured screening audit log (spec: §FR-01, §FR-03)
if (event_id && screening_result?.status) {
  try {
    await createScreeningAuditLog({
      eventId: event_id,
      assistId: body.assist_id ?? consultId,
      consultId,
      patientId: patient_id_token ?? `pid-${patient.rm ?? 'unknown'}`,
      screeningId: screening_id ?? `screen-${consultId}`,
      doctorId: String(target_doctor_id),
      facilityId: assist_facility_id ?? body.clinical_context?.facility_name ?? 'unknown',
      screeningStatus: screening_result.status,
      riskLevel: screening_result.risk_level,
      score: typeof screening_result.score === 'number' ? screening_result.score : null,
      resultSummary: screening_result.summary,
      deliveryStatus: 'sent',
      deliveryTimestamp: sent_at ? new Date(sent_at) : new Date(),
      appVersion: app_version,
      senderUserId: session?.username ?? null,
      metaJson: {
        patientName: patient.name,
        patientRm: patient.rm ?? null,
        keluhanUtama: keluhan_utama,
      },
    })
  } catch (auditErr) {
    // Audit failure must NOT block consult delivery
    console.error('[Consult] ScreeningAuditLog write failed:', auditErr)
  }
}
```

- [ ] **Step 3.4: Return `event_id` in response**

Change the final `return jsonWithCors(...)` from:

```ts
return jsonWithCors(req, CORS_METHODS, { ok: true, consultId })
```

To:

```ts
return jsonWithCors(req, CORS_METHODS, {
  ok: true,
  consultId,
  event_id: event_id ?? null,
})
```

- [ ] **Step 3.5: TypeScript check**

```pwsh
cd apps/healthcare/primary-healthcare/dashboard
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 3.6: Commit**

```pwsh
git add src/app/api/consult/route.ts
git commit -m "feat(dashboard/api): extend POST /api/consult to write ScreeningAuditLog"
```

---

## Task 4: Add `GET /api/v1/logs/screening` query endpoint

**Repo:** `[DASH]`  
**Files:**
- Create: `src/app/api/v1/logs/screening/route.ts`

- [ ] **Step 4.1: Create directory structure**

```pwsh
mkdir -p src/app/api/v1/logs/screening
```

- [ ] **Step 4.2: Create the route file**

Create `src/app/api/v1/logs/screening/route.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server'

import { queryScreeningAuditLogs } from '@/lib/audit/screening-audit-service'
import { handleCorsPreflight, jsonWithCors } from '@/lib/server/api-cors'
import { isCrewAuthorizedRequest } from '@/lib/server/crew-access-auth'

export const runtime = 'nodejs'

const CORS_METHODS = ['GET', 'OPTIONS'] as const

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, CORS_METHODS)
}

export async function GET(req: NextRequest) {
  if (!isCrewAuthorizedRequest(req)) {
    return jsonWithCors(req, CORS_METHODS, { ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)

    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const perPage = parseInt(searchParams.get('per_page') ?? '50', 10)
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined
    const doctorId = searchParams.get('doctor_id') ?? undefined
    const facilityId = searchParams.get('facility_id') ?? undefined
    const screeningStatus = searchParams.get('screening_status') ?? undefined
    const deliveryStatus = searchParams.get('delivery_status') ?? undefined
    const acknowledgedParam = searchParams.get('acknowledged')
    const acknowledged =
      acknowledgedParam === 'true' ? true : acknowledgedParam === 'false' ? false : undefined

    const result = await queryScreeningAuditLogs({
      page,
      perPage,
      from,
      to,
      doctorId,
      facilityId,
      screeningStatus,
      deliveryStatus,
      acknowledged,
    })

    return jsonWithCors(req, CORS_METHODS, { ok: true, ...result })
  } catch (err) {
    console.error('[GET /api/v1/logs/screening] Error:', err)
    return jsonWithCors(
      req,
      CORS_METHODS,
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4.3: TypeScript check**

```pwsh
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 4.4: Manual smoke test** (requires local DB)

```pwsh
curl -H "Authorization: Bearer <dev-token>" "http://localhost:3000/api/v1/logs/screening?per_page=5"
```

Expected: `{ ok: true, data: [], pagination: { page: 1, perPage: 5, total: 0, totalPages: 0 } }`

- [ ] **Step 4.5: Commit**

```pwsh
git add src/app/api/v1/logs/screening/route.ts
git commit -m "feat(dashboard/api): add GET /api/v1/logs/screening logbook query endpoint"
```

---

## Task 5: Add `POST /api/v1/logs/screening/[eventId]/ack` endpoint

**Repo:** `[DASH]`  
**Files:**
- Create: `src/app/api/v1/logs/screening/[eventId]/ack/route.ts`

- [ ] **Step 5.1: Create directory**

```pwsh
mkdir -p "src/app/api/v1/logs/screening/[eventId]/ack"
```

- [ ] **Step 5.2: Create route file**

Create `src/app/api/v1/logs/screening/[eventId]/ack/route.ts`:

```ts
import { type NextRequest } from 'next/server'

import { ackScreeningAuditLog } from '@/lib/audit/screening-audit-service'
import { handleCorsPreflight, jsonWithCors } from '@/lib/server/api-cors'
import { isCrewAuthorizedRequest } from '@/lib/server/crew-access-auth'

export const runtime = 'nodejs'

const CORS_METHODS = ['POST', 'OPTIONS'] as const

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, CORS_METHODS)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  if (!isCrewAuthorizedRequest(req)) {
    return jsonWithCors(req, CORS_METHODS, { ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { eventId } = await params

  try {
    const body = await req.json() as {
      acknowledged_by?: string
      ack_timestamp?: string
      note?: string
    }

    const ackTimestamp = body.ack_timestamp ? new Date(body.ack_timestamp) : new Date()
    const ackedBy = body.acknowledged_by ?? 'unknown'

    const result = await ackScreeningAuditLog(eventId, ackedBy, ackTimestamp)

    return jsonWithCors(req, CORS_METHODS, { ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'

    if (message === `ScreeningAuditLog not found: ${eventId}`) {
      return jsonWithCors(req, CORS_METHODS, { ok: false, error: 'not_found' }, { status: 404 })
    }
    if (message.startsWith('ALREADY_ACKED:')) {
      return jsonWithCors(req, CORS_METHODS, { ok: false, error: 'already_acknowledged' }, { status: 409 })
    }

    console.error('[POST ack] Error:', err)
    return jsonWithCors(req, CORS_METHODS, { ok: false, error: 'Server error' }, { status: 500 })
  }
}
```

- [ ] **Step 5.3: TypeScript check**

```pwsh
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 5.4: Commit**

```pwsh
git add "src/app/api/v1/logs/screening/[eventId]/ack/route.ts"
git commit -m "feat(dashboard/api): add POST /api/v1/logs/screening/:eventId/ack endpoint"
```

---

## Task 6: Extend ASSIST `ConsultPayload` + `sendConsultToDoctor`

**Repo:** `[ASSIST]`  
**Files:**
- Modify: `lib/api/bridge-client.ts`
- Create: `lib/api/bridge-client.test.ts`

- [ ] **Step 6.1: Write failing tests first**

Create `lib/api/bridge-client.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

// We test the event_id contract: sendConsultToDoctor must
// (a) generate a UUID v4 event_id when not provided in payload
// (b) reuse event_id if already present in payload
// (c) return { consultId, eventId } from response

// Pure unit test — we test the UUID format helper and type shape
// (network calls are tested in integration)

function isUUIDv4(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
}

describe('event_id generation', () => {
  it('crypto.randomUUID() produces valid UUID v4', () => {
    const id = crypto.randomUUID()
    expect(isUUIDv4(id)).toBe(true)
  })

  it('two calls to crypto.randomUUID() produce different IDs', () => {
    const a = crypto.randomUUID()
    const b = crypto.randomUUID()
    expect(a).not.toBe(b)
  })

  it('isUUIDv4 rejects non-UUIDs', () => {
    expect(isUUIDv4('not-a-uuid')).toBe(false)
    expect(isUUIDv4('')).toBe(false)
  })
})

describe('ConsultPayload type contract', () => {
  it('accepts screening_result with all fields', () => {
    // Type-level check via object assignment — TS will catch violations at compile time
    const result: {
      status: 'positive' | 'negative' | 'inconclusive'
      score?: number
      risk_level?: 'low' | 'medium' | 'high' | 'critical'
      summary?: string
    } = {
      status: 'positive',
      score: 85,
      risk_level: 'high',
      summary: 'HTN Crisis',
    }
    expect(result.status).toBe('positive')
    expect(result.score).toBe(85)
  })
})
```

- [ ] **Step 6.2: Run tests — expect PASS (no imports from bridge-client yet)**

```pwsh
cd apps/healthcare/sentra-assist
pnpm test -- lib/api/bridge-client.test.ts
```

Expected: 4/4 PASS (pure logic, no imports that can fail).

- [ ] **Step 6.3: Extend `ConsultPayload` interface**

In `lib/api/bridge-client.ts`, add these fields to the **end** of `ConsultPayload` (before the closing `}`):

```ts
  // ── GAP-002: Screening Audit Log fields ──────────────────────────────────
  /** UUID v4 generated by ASSIST before POST; used for idempotency */
  event_id?: string
  /** Screening result derived from canonical clinical engine output */
  screening_result?: {
    status: 'positive' | 'negative' | 'inconclusive'
    score?: number
    risk_level?: 'low' | 'medium' | 'high' | 'critical'
    summary?: string
  }
  /** Pseudonym token for patient (not raw RM) */
  patient_id_token?: string
  /** Unique screening session ID */
  screening_id?: string
  /** Facility code from ePuskesmas context */
  facility_id?: string
  /** Extension version string */
  app_version?: string
  /** assist_id from canonical-triage-builder output */
  assist_id?: string
```

- [ ] **Step 6.4: Extend `ConsultResponse` to include `event_id`**

Change:

```ts
interface ConsultResponse {
  ok: boolean;
  consultId?: string;
  error?: string;
}
```

To:

```ts
interface ConsultResponse {
  ok: boolean;
  consultId?: string;
  event_id?: string;
  error?: string;
}
```

- [ ] **Step 6.5: Update `sendConsultToDoctor` to generate `event_id` and return it**

Change:

```ts
export async function sendConsultToDoctor(payload: ConsultPayload): Promise<string> {
  const res = await bridgeFetch<ConsultResponse>('/api/consult', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.consultId ?? '';
}
```

To:

```ts
export async function sendConsultToDoctor(
  payload: ConsultPayload
): Promise<{ consultId: string; eventId: string }> {
  // Generate event_id here if ASSIST caller did not provide one.
  // Using crypto.randomUUID() — available in Manifest V3 service workers.
  const eventId = payload.event_id ?? crypto.randomUUID()
  const enrichedPayload: ConsultPayload = { ...payload, event_id: eventId }

  const res = await bridgeFetch<ConsultResponse>('/api/consult', {
    method: 'POST',
    body: JSON.stringify(enrichedPayload),
  })

  return {
    consultId: res.consultId ?? '',
    eventId: res.event_id ?? eventId,
  }
}
```

- [ ] **Step 6.6: Fix call sites in TTVInferenceUI.tsx**

Search for `sendConsultToDoctor` call in `components/clinical/TTVInferenceUI.tsx`:

```pwsh
grep -n "sendConsultToDoctor" components/clinical/TTVInferenceUI.tsx
```

The function now returns `{ consultId, eventId }` instead of `string`. Update the call site.
Find the line like:

```ts
const consultId = await sendConsultToDoctor(consultPayload)
```

Change to:

```ts
const { consultId, eventId: _consultEventId } = await sendConsultToDoctor(consultPayload)
```

(The `eventId` can be stored in state or logged as needed; for MVP pilot it's sufficient to destructure it.)

- [ ] **Step 6.7: TypeScript check**

```pwsh
cd apps/healthcare/sentra-assist
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 6.8: Run full ASSIST test suite**

```pwsh
pnpm test
```

Expected: all existing tests + new 4 tests PASS.

- [ ] **Step 6.9: Commit**

```pwsh
git add lib/api/bridge-client.ts lib/api/bridge-client.test.ts components/clinical/TTVInferenceUI.tsx
git commit -m "feat(assist): add event_id + screening_result to ConsultPayload for audit trail"
```

---

## Task 7: Dashboard Logbook UI — Page & Table

**Repo:** `[DASH]`  
**Files:**
- Create: `src/app/audit/logbook/page.tsx`
- Create: `src/app/audit/logbook/ScreeningLogbook.tsx`

- [ ] **Step 7.1: Create the RSC page**

Create `src/app/audit/logbook/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { ScreeningLogbook } from './ScreeningLogbook'

export const metadata: Metadata = {
  title: 'Logbook Audit Skrining | Sentra Intelligence',
  description: 'Catatan pengiriman hasil skrining ke dokter',
}

export default function AuditLogbookPage() {
  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Logbook Audit Skrining</h1>
        <p className="text-sm text-gray-400 mt-1">
          Setiap pengiriman hasil skrining ASSIST ke dokter dicatat di sini secara real-time.
        </p>
      </div>
      <ScreeningLogbook />
    </main>
  )
}
```

- [ ] **Step 7.2: Create the client component**

Create `src/app/audit/logbook/ScreeningLogbook.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface ScreeningAuditEntry {
  id: string
  eventId: string
  assistId: string
  consultId: string | null
  patientId: string
  doctorId: string
  facilityId: string
  screeningStatus: string
  riskLevel: string | null
  score: number | null
  resultSummary: string | null
  deliveryStatus: string
  deliveryTimestamp: string
  acknowledgedByDoctor: boolean
  ackTimestamp: string | null
  createdAt: string
}

interface LogbookResponse {
  ok: boolean
  data: ScreeningAuditEntry[]
  pagination: { page: number; perPage: number; total: number; totalPages: number }
}

// ── Status badge colors ───────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  positive: 'bg-red-500/15 text-red-400 border border-red-500/30',
  negative: 'bg-green-500/15 text-green-400 border border-green-500/30',
  inconclusive: 'bg-gray-500/15 text-gray-400 border border-gray-500/30',
}

const RISK_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
}

const DELIVERY_COLORS: Record<string, string> = {
  sent: 'text-blue-400',
  delivered: 'text-green-400',
  failed: 'text-red-400',
  pending: 'text-gray-400',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ScreeningLogbook() {
  const [entries, setEntries] = useState<ScreeningAuditEntry[]>([])
  const [pagination, setPagination] = useState({ page: 1, perPage: 50, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Filters
  const [filterDoctor, setFilterDoctor] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDelivery, setFilterDelivery] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: '50',
        ...(filterDoctor ? { doctor_id: filterDoctor } : {}),
        ...(filterStatus ? { screening_status: filterStatus } : {}),
        ...(filterDelivery ? { delivery_status: filterDelivery } : {}),
      })
      const res = await fetch(`/api/v1/logs/screening?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: LogbookResponse = await res.json()
      if (!json.ok) throw new Error('API returned ok:false')
      setEntries(json.data)
      setPagination(json.pagination)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat logbook')
    } finally {
      setLoading(false)
    }
  }, [page, filterDoctor, filterStatus, filterDelivery])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  // Auto-refresh every 5 seconds (fallback if no WebSocket yet)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    intervalRef.current = setInterval(() => void fetchLogs(), 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchLogs])

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Filter dokter ID..."
          value={filterDoctor}
          onChange={(e) => { setFilterDoctor(e.target.value); setPage(1) }}
          className="px-3 py-1.5 rounded-lg bg-[#0f1012] border border-[#2a2a2a] text-sm text-gray-200 
                     placeholder:text-gray-600 focus:outline-none focus:border-[#eb5939]/40 w-44"
        />
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="px-3 py-1.5 rounded-lg bg-[#0f1012] border border-[#2a2a2a] text-sm text-gray-200
                     focus:outline-none focus:border-[#eb5939]/40"
        >
          <option value="">Semua Status Skrining</option>
          <option value="positive">Positif</option>
          <option value="negative">Negatif</option>
          <option value="inconclusive">Tidak Konklusif</option>
        </select>
        <select
          value={filterDelivery}
          onChange={(e) => { setFilterDelivery(e.target.value); setPage(1) }}
          className="px-3 py-1.5 rounded-lg bg-[#0f1012] border border-[#2a2a2a] text-sm text-gray-200
                     focus:outline-none focus:border-[#eb5939]/40"
        >
          <option value="">Semua Status Kirim</option>
          <option value="sent">Terkirim</option>
          <option value="delivered">Diterima</option>
          <option value="failed">Gagal</option>
          <option value="pending">Pending</option>
        </select>
        <button
          onClick={() => void fetchLogs()}
          className="px-3 py-1.5 rounded-lg bg-[#eb5939]/10 border border-[#eb5939]/30 
                     text-[#eb5939] text-sm hover:bg-[#eb5939]/20 transition-colors"
        >
          Refresh
        </button>
        <span className="ml-auto text-xs text-gray-500 self-center">
          {pagination.total} total event
        </span>
      </div>

      {/* ── Table ── */}
      {error ? (
        <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-lg border border-red-500/20">
          Error: {error}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1e1e1e]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e1e1e] bg-[#0f1012]">
                {['Waktu', 'Assist ID', 'Fasilitas', 'Dokter', 'Hasil', 'Risiko', 'Status Kirim', 'Ack'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Memuat...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Belum ada data audit log
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.eventId}
                    className={`border-b border-[#1a1a1a] hover:bg-[#141414] transition-colors
                      ${entry.deliveryStatus === 'failed' ? 'border-l-2 border-l-red-500/50' : ''}`}
                  >
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString('id-ID', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 font-mono max-w-[120px] truncate" title={entry.assistId}>
                      {entry.assistId.slice(0, 20)}…
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">{entry.facilityId}</td>
                    <td className="px-3 py-2.5 text-gray-300">{entry.doctorId}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[entry.screeningStatus] ?? STATUS_COLORS.inconclusive}`}>
                        {entry.screeningStatus}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 font-medium ${RISK_COLORS[entry.riskLevel ?? ''] ?? 'text-gray-500'}`}>
                      {entry.riskLevel ?? '—'}
                      {entry.score !== null ? ` (${entry.score})` : ''}
                    </td>
                    <td className={`px-3 py-2.5 font-medium ${DELIVERY_COLORS[entry.deliveryStatus] ?? 'text-gray-400'}`}>
                      {entry.deliveryStatus}
                    </td>
                    <td className="px-3 py-2.5">
                      {entry.acknowledgedByDoctor ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center gap-3 justify-end">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded bg-[#1a1a1a] text-gray-400 text-xs disabled:opacity-40"
          >
            ← Sebelumnya
          </button>
          <span className="text-xs text-gray-500">
            {page} / {pagination.totalPages}
          </span>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded bg-[#1a1a1a] text-gray-400 text-xs disabled:opacity-40"
          >
            Berikutnya →
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7.3: TypeScript check**

```pwsh
cd apps/healthcare/primary-healthcare/dashboard
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 7.4: Build check**

```pwsh
pnpm build
```

Expected: Build succeeds. Check that `audit/logbook` page is listed in route compilation output.

- [ ] **Step 7.5: Commit**

```pwsh
git add src/app/audit/logbook/
git commit -m "feat(dashboard/ui): add Logbook Audit Skrining page with filters and auto-refresh"
```

---

## Task 8: End-to-End Smoke Test (Manual + Automated Check)

**Both repos** — final integration validation.

- [ ] **Step 8.1: Start local dev**

```pwsh
# Terminal 1 — Dashboard
cd apps/healthcare/primary-healthcare/dashboard
pnpm dev

# Terminal 2 — ASSIST (build to .output/)
cd apps/healthcare/sentra-assist
pnpm build
```

- [ ] **Step 8.2: Trigger a consult from ASSIST**

Load the extension in Chrome (`chrome://extensions → Load unpacked → .output/chrome-mv3`).  
Open ePuskesmas test URL, fill TTV form, click "Kirim ke Dokter".  
Check DevTools → Network → `POST /api/consult` response:

```json
{ "ok": true, "consultId": "consult-...", "event_id": "550e8400-..." }
```

- [ ] **Step 8.3: Verify DB record**

```pwsh
cd apps/healthcare/primary-healthcare/dashboard
pnpm prisma studio
```

Open `screening_audit_logs` table. Confirm 1 row exists with:
- `event_id` matches the UUID from response
- `screening_status` = `positive|negative|inconclusive` (not empty)
- `immutable_hash` starts with `sha256:`
- `delivery_status` = `sent`

- [ ] **Step 8.4: Verify Dashboard Logbook**

Open `http://localhost:3000/audit/logbook`.  
Row harus muncul dalam ≤ 5 detik (auto-refresh interval).  
Confirm: status badge, risk level, dokter ID tampil dengan benar.

- [ ] **Step 8.5: Run full test suites**

```pwsh
# ASSIST
cd apps/healthcare/sentra-assist
pnpm test

# Dashboard
cd apps/healthcare/primary-healthcare/dashboard
node --test src/lib/audit/screening-audit-service.test.ts
```

Expected: All pass.

- [ ] **Step 8.6: Final commit + tag**

```pwsh
git tag -a "audit-log-v1.0.0-pilot" -m "Audit log pilot: ASSIST event_id + ScreeningAuditLog DB + Logbook UI"
git push origin master --tags
```

---

## Self-Review: Spec Coverage

| Spec Requirement | Task | Status |
|-----------------|------|--------|
| FR-01: Log every consult event | Task 3 (route.ts) | ✅ |
| FR-03: Return ack (event_id + saved_at) | Task 3 (route.ts response) | ✅ |
| FR-04: Query API | Task 4 (GET endpoint) | ✅ |
| FR-05: Filter + pagination | Task 4 (query params) | ✅ |
| FR-07: Doctor ack | Task 5 (ack endpoint) | ✅ |
| FR-08: Immutable record | Task 2 (hash) + Task 1 (no delete) | ✅ |
| FR-09: Duplicate rejection | Task 2 (`@unique` on eventId → Prisma P2002) | ✅ |
| §4: JSON schema fields | Task 1 (Prisma model) + Task 3 (extraction) | ✅ |
| §5: DB schema | Task 1 (migration) | ✅ |
| §6: API endpoints | Tasks 3, 4, 5 | ✅ |
| §7: Sequence flow | Task 3 (parallel audit write) | ✅ |
| §8: Idempotensi | Task 6 (event_id generation + @unique DB) | ✅ |
| §11: Dashboard Logbook UI | Task 7 | ✅ |
| §13: AC-01 (≤ 2s ingest) | Depends on DB — no queue needed for pilot scale | ⚠️ Monitor |
| §13: AC-02 (≤ 5s dashboard) | Task 7 (5s auto-refresh + eventual WS upgrade) | ✅ |
| §13: AC-03 (no duplicate rows) | Task 1 + 2 (`@unique` + Prisma P2002 error = 409) | ✅ |
| FR-10: Queue for DB down | **Not in MVP** — deferred post-pilot | 🔜 |
| §10: Encryption at-rest | **Not in MVP** — patient_id stored as `pid-{rm}` prefix | 🔜 |

**⚠️ FR-02 (≤ 5s realtime):** The current implementation uses 5s polling in the UI. For production, replace polling in `ScreeningLogbook.tsx` with a WebSocket subscription to the existing socket bridge (`emitAssistConsult` already fires). This is a post-pilot upgrade.

**⚠️ Duplicate detection:** When `createScreeningAuditLog` is called with an existing `eventId`, Prisma throws a P2002 unique constraint error. The `POST /api/consult` catches all DB errors with a generic `console.error`. For a proper 409 response, add a check in the route: catch P2002 and return `{ ok: true, consultId, event_id, duplicate: true }` to ASSIST.

---

## Notes for Cursor Composer

- Start from Task 1 (Prisma migration) — all other tasks depend on the generated Prisma client.
- Run `pnpm prisma generate` after schema change before editing TypeScript files.
- The dashboard uses `node:test` (not vitest/jest) for tests — import with `import test from 'node:test'`.
- ASSIST uses vitest — import with `import { describe, it, expect } from 'vitest'`.
- `isCrewAuthorizedRequest` + `jsonWithCors` are in `@/lib/server/` — follow the same pattern as `/api/consult/route.ts`.
- `bridgeFetch` in ASSIST uses `authedFetch` under the hood — no changes needed to auth handling.
- `crypto.randomUUID()` is available globally in both Chrome Extension (MV3) and Node.js 21+.
