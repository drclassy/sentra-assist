# Spesifikasi Teknis: Audit Log Pengiriman Hasil Skrining
**Proyek:** Sentra Assist — Pilot Test Puskesmas  
**Versi:** 1.0.0  
**Tanggal:** 2026-04-07  
**Status:** Draft — Menunggu Persetujuan Tim  
**Penulis:** Claudesy (AI Principal Engineer)  

---

## 1. Ringkasan Singkat

### Tujuan

Setiap kali ASSIST mengirimkan hasil skrining klinis ke dokter, sistem **harus** mencatat peristiwa tersebut secara permanen, mengirimnya ke server database, dan menampilkannya di Intelligence Dashboard sebagai logbook audit. Tujuannya adalah:

- **Akuntabilitas klinis** — setiap keputusan/rekomendasi AI terdokumentasi dan dapat diaudit kapan saja.
- **Kepatuhan regulasi** — memenuhi kewajiban rekam medis elektronik sesuai Permenkes dan PDPRI 2024.
- **Deteksi anomali** — operator dapat mendeteksi kegagalan pengiriman, duplikat, atau pola tidak normal secara real-time.
- **Pilot test evidence** — menyediakan data empiris untuk evaluasi keberhasilan pilot.

### Gambaran Alur Tinggi

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ASSIST Chrome Extension                                                    │
│  1. Kirim hasil skrining ke dokter (via bridge / consultation API)        │
│  2. BERSAMAAN: POST event JSON ke /api/v1/logs/screening                  │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ HTTPS / TLS 1.3
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Ingest Service (Intelligence Dashboard Backend)                           │
│  3. Validasi schema + role auth                                           │
│  4. Generate immutable_hash (SHA-256)                                     │
│  5. Simpan ke PostgreSQL (screening_event_log)                            │
│  6. Append ke audit_events (immutable trail)                              │
│  7. Publish ke event bus (WebSocket / SSE)                                │
│  8. Balas ack ke ASSIST: { event_id, saved_at }                           │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ Internal event bus
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Intelligence Dashboard (Frontend)                                         │
│  9. Terima push dari event bus                                            │
│ 10. Render entri baru di Logbook Audit (≤ 5 detik dari event)            │
│ 11. Operator dapat filter, search, export, lihat detail                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Persyaratan Fungsional

- **FR-01** Setiap kali ASSIST mengirim hasil skrining ke dokter, sistem **harus** mencatat event secara otomatis dengan minimal fields wajib (lihat §4).
- **FR-02** Event harus tersedia di Intelligence Dashboard dalam **≤ 5 detik** sejak ASSIST mengirimkan request (P99 latency).
- **FR-03** Setiap event menerima konfirmasi penyimpanan (**ack**) yang dikembalikan ke ASSIST dalam response body: `{ event_id, saved_at }`.
- **FR-04** Sistem menyediakan API query log dengan filter, pagination, dan export (CSV, PDF, JSON).
- **FR-05** Dashboard menampilkan logbook dengan kemampuan filter (rentang tanggal, dokter, status, assist_id), pencarian teks bebas, dan pagination (≥ 50 baris per halaman).
- **FR-06** Akses baca dan tulis ke logbook dicatat di `audit_events` (who did what, when).
- **FR-07** Dokter dapat memberikan acknowledgement (ack) melalui dashboard atau callback; sistem merekam `ack_timestamp` dan `acknowledged_by_doctor`.
- **FR-08** Event bersifat **immutable** setelah tersimpan — perubahan apapun hanya menghasilkan record baru di `audit_events`, bukan overwrite.
- **FR-09** Duplicate event (same `event_id`) ditolak dengan HTTP 409 dan mengembalikan `event_id` asli.
- **FR-10** Saat DB tidak dapat dijangkau, sistem mengantri event ke durable queue dan merespons ASSIST dengan HTTP 202 (accepted, pending).

---

## 3. Persyaratan Non-Fungsional

| Kategori | Persyaratan | Target / Nilai |
|----------|-------------|---------------|
| **Keamanan — Transit** | TLS 1.2 minimum, TLS 1.3 direkomendasikan | Wajib di semua endpoint |
| **Keamanan — At-rest** | Enkripsi DB-level (AES-256); field `patient_id` dienkripsi/ditokenisasi | Wajib |
| **Autentikasi** | Bearer token (JWT OAuth2) untuk ASSIST; mTLS opsional untuk layanan internal | Wajib |
| **Otorisasi** | RBAC: role `assist_agent`, `operator`, `admin`, `auditor` | Wajib |
| **Privasi** | `patient_id` disimpan sebagai token pseudonim (PID service); log aplikasi tidak mengandung PHI | Wajib |
| **Idempotensi** | POST dengan `event_id` yang sama menghasilkan 409; tidak ada duplikat di DB | Wajib |
| **Ketahanan** | Retry exponential backoff (3x default, max 5x); dead-letter queue setelah maks retry | Wajib |
| **Ketersediaan** | Ingestion success rate ≥ 99,9% per hari | SLO Pilot |
| **Latency Ingestion** | P95 ≤ 500ms (DB write + ack); P99 ≤ 2s | SLO Pilot |
| **Throughput** | ≥ 100 event/menit (untuk kapasitas 10 puskesmas paralel) | Pilot sizing |
| **Waktu ke Dashboard** | Event muncul di UI ≤ 5 detik sejak ASSIST POST | SLO Pilot |
| **Retensi Log** | Log penuh (semua field): **7 tahun**; ringkasan agregasi: **2 tahun** | Permenkes |
| **Backup** | Backup harian ke offsite/GCS; RPO ≤ 1 jam; RTO ≤ 4 jam | Operasional |
| **Kepatuhan** | Sesuai PDPRI 2024, ITE Law, Permenkes No. 24/2022 | Wajib |
| **Audit Trail** | Setiap aksi baca PHI oleh user/operator dicatat di `audit_events` | Wajib |

---

## 4. Skema Event (JSON)

### Contoh JSON Lengkap

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp_utc": "2026-04-07T08:15:30.000Z",
  "assist_id": "assist-RM001-1744015200000",
  "patient_id": "pid-token-7f3a91bc",
  "screening_id": "screen-d4e5f6a7-b8c9",
  "doctor_id": "doc-54321",
  "screening_result": {
    "status": "positive",
    "score": 85,
    "risk_level": "high",
    "summary": "HTN Crisis suspected, NEWS2 = 9",
    "raw_payload_ref": "gs://sentra-audit-bucket/2026/04/07/screen-d4e5f6a7.json.enc"
  },
  "delivery_status": "sent",
  "delivery_timestamp": "2026-04-07T08:15:32.000Z",
  "acknowledged_by_doctor": false,
  "ack_timestamp": null,
  "meta": {
    "app_version": "1.0.1",
    "extension_id": "chrome-ext-sentra-assist",
    "facility_id": "PKM-KEDIRI-01",
    "session_id": "sess-ab12cd34"
  },
  "audit": {
    "created_by": "system:assist-agent",
    "created_at": "2026-04-07T08:15:30.000Z",
    "immutable_hash": "sha256:a3f5c7b9d1e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4"
  }
}
```

### Deskripsi Field

| Field | Tipe | Wajib | Contoh Nilai | Alasan |
|-------|------|-------|--------------|--------|
| `event_id` | uuid (v4) | **Wajib** | `550e8400-...` | Identifikasi unik event; digunakan untuk idempotensi |
| `timestamp_utc` | ISO 8601 UTC | **Wajib** | `2026-04-07T08:15:30Z` | Waktu kejadian di sisi ASSIST; jangan gunakan server time |
| `assist_id` | string | **Wajib** | `assist-RM001-...` | Korelasi ke request canonical engine (lihat canonical-triage-builder.ts) |
| `patient_id` | string (token) | **Wajib** | `pid-token-7f3a91bc` | Pseudonim; **bukan** nomor rekam medis mentah |
| `screening_id` | string | **Wajib** | `screen-d4e5f6a7` | ID unik sesi skrining |
| `doctor_id` | string | **Wajib** | `doc-54321` | Dokter penerima hasil skrining |
| `screening_result.status` | enum | **Wajib** | `positive\|negative\|inconclusive` | Ringkasan hasil |
| `screening_result.score` | integer | Opsional | `85` | Skor numerik (mis. NEWS2); null jika tidak berlaku |
| `screening_result.risk_level` | enum | Opsional | `low\|medium\|high\|critical` | Klasifikasi risiko canonical |
| `screening_result.summary` | string | Opsional | `"HTN Crisis..."` | Teks ringkas untuk tampilan dashboard |
| `screening_result.raw_payload_ref` | string (URI) | Opsional | `gs://...` | Referensi ke payload penuh (terenkripsi) di object storage |
| `delivery_status` | enum | **Wajib** | `sent\|delivered\|failed\|pending` | Status pengiriman ke dokter |
| `delivery_timestamp` | ISO 8601 UTC | **Wajib** | `2026-04-07T08:15:32Z` | Waktu pengiriman ke dokter berhasil/gagal |
| `acknowledged_by_doctor` | boolean | **Wajib** | `false` | Apakah dokter sudah konfirmasi terima |
| `ack_timestamp` | ISO 8601 UTC | Opsional (null) | `null` | Waktu ack dokter; null jika belum |
| `meta.app_version` | string | **Wajib** | `"1.0.1"` | Versi ASSIST saat event terjadi |
| `meta.facility_id` | string | **Wajib** | `"PKM-KEDIRI-01"` | Kode fasilitas kesehatan |
| `meta.session_id` | string | Opsional | `"sess-ab12cd34"` | Session ID browser extension |
| `audit.created_by` | string | **Wajib** | `"system:assist-agent"` | Siapa yang membuat record |
| `audit.created_at` | ISO 8601 UTC | **Wajib** | `2026-04-07T08:15:30Z` | Waktu record dibuat (server-side) |
| `audit.immutable_hash` | string (sha256) | **Wajib** | `"sha256:a3f5..."` | Hash SHA-256 dari canonical fields; untuk integritas |

---

## 5. Skema Database (Relasional — PostgreSQL)

### Tabel: `screening_event_log`

```sql
CREATE TABLE screening_event_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID        NOT NULL UNIQUE,
    assist_id       VARCHAR(128) NOT NULL,
    patient_id      VARCHAR(256) NOT NULL,     -- disimpan sebagai token (encrypted)
    patient_id_hash VARCHAR(64)  NOT NULL,     -- SHA-256 dari token asli, untuk indexing
    screening_id    VARCHAR(128) NOT NULL,
    doctor_id       VARCHAR(128) NOT NULL,
    facility_id     VARCHAR(64)  NOT NULL,
    screening_status VARCHAR(20) NOT NULL      CHECK (screening_status IN ('positive','negative','inconclusive')),
    risk_level      VARCHAR(16)                CHECK (risk_level IN ('low','medium','high','critical')),
    score           INTEGER,                   -- nullable; NEWS2 atau skor klinis lain
    result_summary  TEXT,
    raw_payload_ref VARCHAR(512),              -- URI ke object storage; nullable
    delivery_status VARCHAR(20) NOT NULL       CHECK (delivery_status IN ('sent','delivered','failed','pending')),
    delivery_timestamp TIMESTAMPTZ NOT NULL,
    acknowledged    BOOLEAN     NOT NULL DEFAULT FALSE,
    ack_timestamp   TIMESTAMPTZ,               -- nullable
    app_version     VARCHAR(32),
    session_id      VARCHAR(128),
    immutable_hash  VARCHAR(80) NOT NULL,      -- "sha256:<hex>"
    meta_json       JSONB,                     -- semua meta fields lain
    created_by      VARCHAR(128) NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_sel_event_id    ON screening_event_log (event_id);
CREATE INDEX        idx_sel_patient     ON screening_event_log (patient_id_hash);
CREATE INDEX        idx_sel_doctor      ON screening_event_log (doctor_id);
CREATE INDEX        idx_sel_facility    ON screening_event_log (facility_id);
CREATE INDEX        idx_sel_created_at  ON screening_event_log (created_at DESC);
CREATE INDEX        idx_sel_status      ON screening_event_log (delivery_status, screening_status);
```

### Tabel: `audit_events` (Immutable Append-Only Trail)

```sql
CREATE TABLE audit_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_table       VARCHAR(64) NOT NULL,      -- 'screening_event_log'
    ref_id          UUID        NOT NULL,      -- FK ke record yang diubah/dibaca
    action          VARCHAR(32) NOT NULL       CHECK (action IN ('CREATE','READ_PHI','UPDATE_ACK','EXPORT','DELETE_REQUEST')),
    actor_id        VARCHAR(128) NOT NULL,     -- user_id atau 'system:...'
    actor_role      VARCHAR(64),
    ip_address      INET,
    changes_json    JSONB,                     -- untuk UPDATE: {before, after}; untuk READ: null
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tidak ada DELETE, UPDATE. Append-only enforced di application layer + DB policy.
CREATE INDEX idx_ae_ref_id     ON audit_events (ref_id);
CREATE INDEX idx_ae_actor_id   ON audit_events (actor_id);
CREATE INDEX idx_ae_created_at ON audit_events (created_at DESC);
```

### Tabel: `users` & `roles` (RBAC)

```sql
CREATE TABLE users (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(128) NOT NULL UNIQUE,
    email       VARCHAR(256) NOT NULL UNIQUE,
    role        VARCHAR(32) NOT NULL CHECK (role IN ('assist_agent','operator','admin','auditor','doctor')),
    facility_id VARCHAR(64),
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login  TIMESTAMPTZ
);
```

**Hak akses per role:**

| Role | POST ingest | GET list | GET detail | GET PHI fields | POST ack | Export | DELETE |
|------|-------------|----------|------------|----------------|----------|--------|--------|
| `assist_agent` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `operator` | ❌ | ✅ | ✅ | ❌ (tokenized) | ❌ | ✅ (masked) | ❌ |
| `doctor` | ❌ | ✅ (own) | ✅ (own) | ❌ | ✅ | ❌ | ❌ |
| `auditor` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ (masked) | ❌ |
| `admin` | ❌ | ✅ | ✅ | ✅ (unmasked) | ❌ | ✅ (full) | ❌ |

---

## 6. API Endpoints (Spesifikasi)

### Base URL
```
https://api.sentra-intelligence.id/api/v1
```

---

### `POST /logs/screening` — Ingest Event

**Autentikasi:** Bearer JWT (role: `assist_agent`)  
**Content-Type:** `application/json`

**Request Body:** Event JSON (lihat §4)

**Responses:**

| HTTP | Kondisi | Body |
|------|---------|------|
| `201 Created` | Berhasil disimpan | `{ "id": "uuid", "event_id": "uuid", "saved_at": "ISO8601" }` |
| `400 Bad Request` | Schema tidak valid / field wajib missing | `{ "error": "validation_failed", "details": [...] }` |
| `401 Unauthorized` | Token tidak valid/expired | `{ "error": "unauthorized" }` |
| `409 Conflict` | `event_id` sudah ada | `{ "error": "duplicate_event", "existing_event_id": "uuid", "original_saved_at": "ISO8601" }` |
| `202 Accepted` | DB unreachable, diantri ke queue | `{ "status": "queued", "queue_id": "q-uuid", "estimated_processing": "PT10S" }` |
| `503 Service Unavailable` | Queue juga penuh | `{ "error": "service_unavailable", "retry_after": 30 }` |

**Behavior:**
1. Validasi schema (Zod atau JSON Schema)
2. Cek duplikat berdasarkan `event_id` (return 409 jika ada)
3. Compute `immutable_hash`: `sha256(event_id + timestamp_utc + patient_id + doctor_id + screening_status + score)`
4. Simpan ke `screening_event_log`
5. Append ke `audit_events` (action: `CREATE`)
6. Publish event ke internal bus (WebSocket topic `audit-log:new`)
7. Return 201 dengan `{ id, event_id, saved_at }`

---

### `GET /logs/screening` — Query Logs

**Autentikasi:** Bearer JWT (role: `operator`, `auditor`, `admin`, `doctor`)

**Query Parameters:**

| Parameter | Tipe | Default | Keterangan |
|-----------|------|---------|------------|
| `page` | int | `1` | Halaman |
| `per_page` | int | `50` | Max 200 |
| `from` | ISO 8601 | -7d | Filter tanggal mulai |
| `to` | ISO 8601 | now | Filter tanggal akhir |
| `assist_id` | string | — | Filter by assist_id |
| `doctor_id` | string | — | Filter by doctor |
| `facility_id` | string | — | Filter by fasilitas |
| `screening_status` | enum | — | `positive\|negative\|inconclusive` |
| `delivery_status` | enum | — | `sent\|delivered\|failed\|pending` |
| `acknowledged` | boolean | — | Filter ack status |
| `q` | string | — | Full-text search di `result_summary` |

**Response 200:**
```json
{
  "data": [ ...array of event objects (PHI tokenized)... ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 1234,
    "total_pages": 25
  }
}
```

---

### `GET /logs/screening/{event_id}` — Detail Event

**Autentikasi:** Bearer JWT  
**Response 200:** Full event object (PHI level tergantung role)  
**Response 404:** `{ "error": "not_found" }`

---

### `POST /logs/screening/{event_id}/ack` — Rekam Acknowledgement Dokter

**Autentikasi:** Bearer JWT (role: `doctor`)

**Request Body:**
```json
{
  "acknowledged_by": "doc-54321",
  "ack_timestamp": "2026-04-07T08:16:00Z",
  "note": "Pasien sudah dihubungi" 
}
```

**Responses:**

| HTTP | Kondisi |
|------|---------|
| `200 OK` | Ack berhasil direkam |
| `404 Not Found` | event_id tidak ditemukan |
| `409 Conflict` | Sudah di-ack sebelumnya |

**Behavior:** Update field `acknowledged = true` dan `ack_timestamp`. Append ke `audit_events` (action: `UPDATE_ACK`). **Tidak** mengubah `immutable_hash` (hash mencakup data immutable saja).

---

### `POST /api/v1/integrations/assist/delivery-status` — Webhook Delivery Report

**Autentikasi:** HMAC signature (header `X-Sentra-Signature`)

**Request Body:**
```json
{
  "event_id": "550e8400-...",
  "delivery_status": "delivered",
  "delivery_timestamp": "2026-04-07T08:15:45Z"
}
```

**Response 200:** `{ "updated": true }`

---

### `GET /logs/screening/export` — Export

**Parameters:** Sama dengan GET list + `format` (`csv\|pdf\|json`) + `mask_phi` (boolean, default true)  
**Response:** File attachment dengan `Content-Disposition: attachment`

---

## 7. Alur Kerja (Sequence)

```
ASSIST Extension          Ingest Service           PostgreSQL DB         Event Bus         Dashboard UI
      │                        │                        │                    │                   │
      │ 1. sendToDoctor()       │                        │                    │                   │
      │ ──────────────────────► │                        │                    │                   │
      │                        │ (parallel below)        │                    │                   │
      │ 2. POST /logs/screening │                        │                    │                   │
      │ ──────────────────────► │                        │                    │                   │
      │                        │ 3. Validate schema      │                    │                   │
      │                        │ 4. Check duplicate      │                    │                   │
      │                        │ ─────────────────────► │ SELECT event_id    │                   │
      │                        │ ◄───────────────────── │ (not found → ok)   │                   │
      │                        │ 5. Compute hash         │                    │                   │
      │                        │ 6. INSERT row           │                    │                   │
      │                        │ ─────────────────────► │                    │                   │
      │                        │ ◄───────────────────── │ ok                 │                   │
      │                        │ 7. INSERT audit_events  │                    │                   │
      │                        │ ─────────────────────► │                    │                   │
      │                        │ 8. Publish event        │                    │                   │
      │                        │ ──────────────────────────────────────────► │                   │
      │ 9. Return 201 + ack     │                        │                    │                   │
      │ ◄────────────────────── │                        │                    │                   │
      │                        │                        │                    │ 10. Push WS/SSE   │
      │                        │                        │                    │ ─────────────────► │
      │                        │                        │                    │                   │ 11. Render entry
      │                        │                        │                    │                   │
      │ (later) doctor ack      │                        │                    │                   │
      │ POST /ack               │                        │                    │                   │
      │ ──────────────────────► │                        │                    │                   │
      │                        │ UPDATE acknowledged     │                    │                   │
      │                        │ ─────────────────────► │                    │                   │
      │                        │ INSERT audit_events     │                    │                   │
      │                        │ ─────────────────────► │                    │                   │
      │                        │ Publish ack event       │                    │                   │
      │                        │ ──────────────────────────────────────────► │                   │
      │ 200 OK                  │                        │                    │ Push update ──── ► │
      │ ◄────────────────────── │                        │                    │                   │
```

**Catatan penting:**
- Langkah 1 (kirim ke dokter) dan Langkah 2 (POST log) dilakukan **paralel/hampir bersamaan** dari ASSIST — bukan sequential, agar latency pengiriman ke dokter tidak terhambat logging.
- Jika Langkah 2 gagal (DB down), ASSIST tetap melanjutkan pengiriman ke dokter, tapi menyimpan event di **local pending queue** untuk retry.

---

## 8. Idempotensi dan Deduplikasi

### Strategi `event_id`

- **Sumber utama:** ASSIST **wajib** mengirim `event_id` (UUID v4) yang di-generate saat event dibuat. Ini memungkinkan safe retry.
- **Jika ASSIST tidak kirim `event_id`:** Server generate UUID v4 baru dan balas di response body. Sisi ASSIST harus menyimpan `event_id` dari response untuk tracking.
- **Deduplikasi di server:** `UNIQUE` constraint pada kolom `event_id` di DB memastikan tidak ada duplikat fisik.

### Alur Retry di ASSIST

```
ASSIST POSTs event
  ├── 201 Created → simpan event_id, tandai "logged"
  ├── 409 Conflict → log sudah ada (misal retry sukses sebelumnya) → abaikan, tandai "logged"
  ├── 202 Accepted → catat queue_id, polling atau tunggu webhook
  ├── 4xx (validation error) → log error, JANGAN retry (payload invalid)
  └── 5xx / timeout → simpan ke local_pending_queue, retry sesuai backoff
```

### Deterministic UUID (opsional, lebih kuat)

Untuk kasus di mana `event_id` mungkin tidak disimpan ASSIST sebelum crash, gunakan UUID v5:

```
event_id = uuidv5(
  NAMESPACE_OID,
  sha256(assist_id + screening_id + timestamp_utc)
)
```

Ini memungkinkan ASSIST merekonstruksi `event_id` yang sama dari data yang sama.

---

## 9. Error Handling & Offline Behavior

### Kondisi DB Unreachable

```
1. Ingest Service mendeteksi DB timeout / connection error
2. Event ditulis ke Durable Queue (Kafka / Cloud Tasks / SQS)
   - Key: event_id (untuk dedup di consumer)
   - TTL: 48 jam
3. Response ke ASSIST: 202 Accepted + { queue_id }
4. Queue consumer mencoba INSERT ke DB saat DB kembali online
5. Jika consumer berhasil: trigger event bus notification ke Dashboard
6. Jika TTL habis tanpa sukses: kirim ke Dead-Letter Queue (DLQ)
7. Alert ops bila queue backlog > 100 events atau DLQ > 0
```

### Retry Policy

| Attempt | Delay | Keterangan |
|---------|-------|------------|
| 1 | 1 detik | Immediate retry |
| 2 | 5 detik | Short backoff |
| 3 | 30 detik | Medium backoff |
| 4 | 5 menit | Long backoff |
| 5 | 30 menit | Final retry |
| DLQ | — | Alert ke ops |

### ASSIST Offline (Extension tidak bisa POST)

1. ASSIST menyimpan event ke `chrome.storage.local` (IndexedDB) sebagai `pending_audit_events[]`
2. Saat koneksi pulih, ASSIST mem-flush queue satu per satu (dengan `event_id` tetap sama)
3. Server menerima dengan idempotensi normal (duplikat → 409, bukan error)
4. Setelah flush berhasil, hapus dari local storage

### Malformed Payload

- Return 400 dengan detail field yang gagal validasi
- ASSIST **tidak** boleh retry payload yang sama — perlu fix di sisi ASSIST dahulu
- Log validation error ke monitoring (tanpa PHI) untuk debugging

---

## 10. Keamanan & Privasi (Detail)

### Transport

- **TLS 1.3** untuk semua koneksi eksternal (ASSIST ↔ Ingest Service)
- **mTLS** untuk komunikasi internal (Ingest Service ↔ DB, Ingest Service ↔ Event Bus)
- Certificate pinning di ASSIST extension (opsional untuk pilot, wajib untuk produksi)

### Autentikasi & Otorisasi

- **JWT OAuth2:** ASSIST menerima service account token dengan scope `audit:write`. Rotasi setiap 1 jam.
- **API Key** (alternatif untuk pilot): static key per fasilitas, disimpan di `chrome.storage.local` (bukan hardcoded)
- **RBAC:** Setiap endpoint memverifikasi role dari JWT claim `role`

### Enkripsi & Pseudonimisasi

- `patient_id` di DB disimpan sebagai ciphertext (AES-256-GCM, key di GCP Secret Manager)
- Index menggunakan `patient_id_hash` (SHA-256 dari token) — bukan nilai asli
- Application logs **tidak boleh** mencatat `patient_id`, nama pasien, atau data klinis mentah
- `raw_payload_ref` merujuk ke file terenkripsi di GCS — bukan payload inline di DB

### Immutability

- `screening_event_log`: record tidak pernah diupdate atau didelete (kecuali field ack yang memang mutable)
- `audit_events`: append-only, tidak ada privilege UPDATE/DELETE bahkan untuk admin
- `immutable_hash` dihitung dari subset fields yang tidak boleh berubah: `event_id`, `timestamp_utc`, `patient_id`, `doctor_id`, `screening_status`, `score`, `assist_id`

### Audit Trail Akses

- Setiap GET yang mengakses field PHI (admin `unmasked=true`) → INSERT ke `audit_events` (action: `READ_PHI`)
- Setiap Export → INSERT ke `audit_events` (action: `EXPORT`)

---

## 11. Dashboard: Fitur & Tampilan Logbook

### Tampilan Utama (Logbook Table)

Kolom yang ditampilkan (default):

| Kolom | Keterangan | Lebar |
|-------|------------|-------|
| Timestamp | Waktu event (relative + absolute on hover) | 120px |
| Assist ID | ID sesi ASSIST (terpotong) | 150px |
| Fasilitas | Kode puskesmas | 100px |
| Dokter | ID/nama dokter | 120px |
| Hasil | Badge warna: hijau/kuning/merah/abu | 90px |
| Risiko | Badge: low/med/high/critical | 80px |
| Status Kiriman | Badge: sent/delivered/failed | 100px |
| Ack | Ikon centang / jam | 50px |
| Aksi | Tombol: View, Export row | 80px |

**Koding warna:**
- `positive` + `critical` → merah (#eb5939)
- `positive` + `high` → oranye
- `positive` + `medium/low` → kuning
- `negative` → hijau
- `inconclusive` → abu-abu
- `delivery_status: failed` → border merah pada row

### Panel Detail Per Event

Klik row → slide-in panel:
- Header: event_id, timestamps, status badges
- Bagian **Hasil Skrining**: summary, score, risk_level, raw_payload_ref link
- Bagian **Metadata**: facility_id, app_version, session_id
- Bagian **Audit History**: timeline semua `audit_events` terkait (action, actor, timestamp)
- Bagian **Immutability**: tampilkan immutable_hash + tombol "Verify Hash"
- PHI: `patient_id` ditampilkan sebagai token kecuali user `admin`

### Filter & Pencarian

- Date range picker (from/to)
- Multi-select: facility, doctor, status, risk_level
- Text search: free-text di summary
- Toggle: "Hanya belum di-ack", "Hanya failed"

### Export

- Format: CSV (default), PDF (formatted table), JSON (full raw)
- PHI masking: aktif by default, admin dapat nonaktifkan
- Range: semua halaman yang difilter, bukan hanya halaman aktif
- Log export ke `audit_events`

### Realtime Push

- WebSocket connection ke `/ws/audit-log`
- Saat event baru masuk: insert row animasi di atas tabel + toast notification
- Saat ack update: update icon di row tanpa reload
- Reconnect otomatis dengan exponential backoff

---

## 12. Monitoring, Alerting & SLA

### Metrics (Prometheus / Google Cloud Monitoring)

| Metric | Tipe | Keterangan |
|--------|------|------------|
| `audit_ingest_total` | Counter | Total event berhasil diingest |
| `audit_ingest_errors_total` | Counter | Total error (by reason) |
| `audit_ingest_latency_ms` | Histogram | Latency POST ingest (P50, P95, P99) |
| `audit_db_write_latency_ms` | Histogram | Latency tulis DB |
| `audit_queue_depth` | Gauge | Jumlah event di durable queue |
| `audit_duplicate_total` | Counter | Event yang tertolak karena 409 |
| `audit_dlq_total` | Counter | Event di dead-letter queue |
| `audit_ws_connected_clients` | Gauge | Jumlah dashboard yang terkoneksi |
| `audit_time_to_dashboard_ms` | Histogram | Waktu dari POST sampai render di UI |

### Alert Rules

| Alert | Kondisi | Severity | Aksi |
|-------|---------|----------|------|
| IngestionFailureSpike | Error rate > 1% dalam 5 menit | Critical | Page on-call |
| QueueBacklogHigh | queue_depth > 100 | Warning | Slack notif |
| DLQNewItems | dlq_total increases | Critical | Page on-call |
| DashboardLatencyHigh | P99 time_to_dashboard > 10s | Warning | Slack notif |
| DBWriteLatencyHigh | P95 db_write_latency > 1s | Warning | Slack notif |
| DuplicateRateHigh | duplicate_total > 5% dalam 1 jam | Warning | Investigate ASSIST retry bug |

### SLOs (Pilot Test)

| SLO | Target | Measurement Window |
|-----|--------|-------------------|
| Ingestion success rate | ≥ 99.9% | Per hari |
| Ingest P99 latency | ≤ 2 detik | Per jam |
| Time to dashboard | ≤ 5 detik (P99) | Per jam |
| DB availability | ≥ 99.5% | Per minggu |
| Queue backlog cleared | ≤ 1 jam setelah DB recovery | Per insiden |

---

## 13. Kriteria Penerimaan (Acceptance Criteria)

| ID | Kriteria | Cara Ukur | Target |
|----|----------|-----------|--------|
| **AC-01** | Setiap event skrining yang dikirim ASSIST tercatat di DB dalam ≤ 2 detik | Monitoring `audit_ingest_latency_ms` P95 | 100% event dalam ≤ 2s (P95) |
| **AC-02** | Event muncul di Intelligence Dashboard dalam ≤ 5 detik sejak ASSIST POST | Monitoring `audit_time_to_dashboard_ms` P99 | ≥ 99% event dalam ≤ 5s |
| **AC-03** | Duplicate event (same event_id) tidak menghasilkan row baru di DB | Kirim event yang sama 2x; hitung rows | Tepat 1 row; response 409 di attempt ke-2 |
| **AC-04** | Saat DB unreachable, ASSIST menerima 202 dan event masuk ke queue; tersimpan di DB setelah DB pulih | Simulasi DB down → send event → restore DB → query | 0 event hilang |
| **AC-05** | Immutable hash dapat diverifikasi ulang oleh auditor kapan saja | Compute ulang hash dari fields DB; bandingkan | Hash cocok 100% untuk semua record |
| **AC-06** | Akses PHI (unmasked) oleh admin tercatat di `audit_events` dengan actor dan timestamp | Login as admin → GET detail unmasked → query audit_events | Setiap akses PHI punya 1 record di audit_events |
| **AC-07** | Operator dapat filter, sort, dan export 50 entri terakhir dalam ≤ 3 detik | Stopwatch dari klik filter → hasil tampil | ≤ 3 detik untuk dataset pilot (< 10.000 rows) |
| **AC-08** | Log penuh tersimpan ≥ 7 tahun; sistem memblokir DELETE pada `screening_event_log` | Coba DELETE sebagai admin → harus gagal | DELETE returns 405/403; no cascade delete |
| **AC-09** | RBAC bekerja: `operator` tidak bisa lihat unmasked PHI; `assist_agent` tidak bisa GET logs | Login as each role → attempt unauthorized action | HTTP 403 untuk semua aksi di luar hak role |
| **AC-10** | Real-time push: saat event baru masuk, dashboard menampilkan tanpa refresh manual | Kirim event dari ASSIST; observasi dashboard | Row baru muncul tanpa reload halaman dalam ≤ 5s |

---

## 14. Rencana Pengujian & Sample Test Cases

### Unit Tests

| Test ID | Deskripsi | Expected |
|---------|-----------|----------|
| UT-01 | Schema validation — field wajib missing | 400 dengan detail field |
| UT-02 | Schema validation — `screening_status` invalid enum | 400 |
| UT-03 | `immutable_hash` generation konsisten untuk input sama | Hash identik |
| UT-04 | `immutable_hash` berbeda jika satu field berubah | Hash berbeda |
| UT-05 | Duplicate detection logic (in-memory) | Return existing event_id |
| UT-06 | UUID v5 deterministic generation | Same input → same UUID |

### Integration Tests

| Test ID | Deskripsi | Expected |
|---------|-----------|----------|
| IT-01 | POST event valid → DB row ada → Dashboard WS menerima push | 201, row di DB, WS message |
| IT-02 | POST event duplikat | 409, 1 row di DB |
| IT-03 | POST event saat DB down | 202, event di queue, row muncul setelah DB pulih |
| IT-04 | GET list dengan filter tanggal | Hanya rows dalam range |
| IT-05 | POST ack → `acknowledged=true` di DB → Dashboard update | 200, DB updated, WS push |
| IT-06 | Export CSV → file berisi data → PHI termasking | File didownload, patient_id = token |
| IT-07 | Akses GET detail sebagai `operator` → patient_id = token | PHI masked |
| IT-08 | Akses GET detail sebagai `admin` → patient_id = real | PHI unmasked; audit_events record created |

### Failure Scenarios

| Test ID | Deskripsi | Expected |
|---------|-----------|----------|
| FS-01 | DB connection drop selama ingest | 202 + queue; tidak ada 500 ke ASSIST |
| FS-02 | Malformed JSON body | 400; tidak crash service |
| FS-03 | JWT expired | 401 |
| FS-04 | `assist_agent` mencoba GET logs | 403 |
| FS-05 | DLQ consumer: event gagal 5x | Event di DLQ; alert dikirim |
| FS-06 | WebSocket disconnect saat event masuk | Dashboard reconnect otomatis; tidak ada event hilang (missed events di-fetch via GET) |

### Compliance Test

| Test ID | Deskripsi | Expected |
|---------|-----------|----------|
| CT-01 | Verifikasi TLS 1.2+ di semua endpoint | SSL scan: tidak ada TLS 1.0/1.1 |
| CT-02 | Application logs tidak mengandung patient_id | Log scan: zero PHI |
| CT-03 | DELETE pada `screening_event_log` diblokir | 403/405 untuk semua roles |
| CT-04 | RBAC matrix diuji semua kombinasi role × endpoint | Sesuai tabel di §5 |

---

## 15. Contoh Payload & Respons

### Contoh 1 — Event Normal (Positive Result)

**Request:**
```http
POST /api/v1/logs/screening
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "event_id": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp_utc": "2026-04-07T08:15:30.000Z",
  "assist_id": "assist-RM001-1744015200000",
  "patient_id": "pid-token-7f3a91bc",
  "screening_id": "screen-d4e5f6a7-b8c9",
  "doctor_id": "doc-54321",
  "screening_result": {
    "status": "positive",
    "score": 85,
    "risk_level": "high",
    "summary": "HTN Crisis suspected, NEWS2 = 9"
  },
  "delivery_status": "sent",
  "delivery_timestamp": "2026-04-07T08:15:32.000Z",
  "acknowledged_by_doctor": false,
  "ack_timestamp": null,
  "meta": {
    "app_version": "1.0.1",
    "facility_id": "PKM-KEDIRI-01",
    "session_id": "sess-ab12cd34"
  },
  "audit": {
    "created_by": "system:assist-agent",
    "created_at": "2026-04-07T08:15:30.000Z"
  }
}
```

**Response 201:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "event_id": "550e8400-e29b-41d4-a716-446655440001",
  "saved_at": "2026-04-07T08:15:30.412Z"
}
```

---

### Contoh 2 — Event dengan Doctor Ack

**Request (POST /ack):**
```http
POST /api/v1/logs/screening/550e8400-e29b-41d4-a716-446655440001/ack
Authorization: Bearer eyJyb2xlIjoiZG9jdG9yIn0...
Content-Type: application/json

{
  "acknowledged_by": "doc-54321",
  "ack_timestamp": "2026-04-07T08:16:00.000Z",
  "note": "Pasien sudah dihubungi via telepon"
}
```

**Response 200:**
```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440001",
  "acknowledged": true,
  "ack_timestamp": "2026-04-07T08:16:00.000Z",
  "updated_at": "2026-04-07T08:16:00.187Z"
}
```

---

### Contoh 3 — Event Gagal Kirim (Delivery Failed)

**Request:**
```json
{
  "event_id": "660f9511-f3ac-52e5-b827-557766551112",
  "timestamp_utc": "2026-04-07T09:30:00.000Z",
  "assist_id": "assist-RM002-1744019400000",
  "patient_id": "pid-token-8a4b92cd",
  "screening_id": "screen-e5f6a7b8-c9d0",
  "doctor_id": "doc-99887",
  "screening_result": {
    "status": "inconclusive",
    "score": null,
    "risk_level": "medium",
    "summary": "Data vital tidak lengkap, perlu pemeriksaan ulang"
  },
  "delivery_status": "failed",
  "delivery_timestamp": "2026-04-07T09:30:05.000Z",
  "acknowledged_by_doctor": false,
  "ack_timestamp": null,
  "meta": {
    "app_version": "1.0.1",
    "facility_id": "PKM-PARE-02",
    "session_id": "sess-xy56zw78"
  },
  "audit": {
    "created_by": "system:assist-agent",
    "created_at": "2026-04-07T09:30:00.000Z"
  }
}
```

**Response 201:** *(event tetap dilog meskipun delivery failed)*
```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "event_id": "660f9511-f3ac-52e5-b827-557766551112",
  "saved_at": "2026-04-07T09:30:00.523Z"
}
```

**Contoh response 409 (duplicate):**
```json
{
  "error": "duplicate_event",
  "message": "Event dengan event_id ini sudah ada",
  "existing_event_id": "550e8400-e29b-41d4-a716-446655440001",
  "original_saved_at": "2026-04-07T08:15:30.412Z"
}
```

---

## 16. Contoh Query SQL untuk Dashboard

### Query 1 — 50 Event Terbaru dengan Filter

```sql
SELECT
    sel.event_id,
    sel.assist_id,
    sel.facility_id,
    sel.doctor_id,
    sel.screening_status,
    sel.risk_level,
    sel.score,
    sel.result_summary,
    sel.delivery_status,
    sel.delivery_timestamp,
    sel.acknowledged,
    sel.ack_timestamp,
    sel.created_at,
    sel.meta_json->>'app_version' AS app_version
FROM screening_event_log sel
WHERE
    sel.created_at >= NOW() - INTERVAL '7 days'
    -- AND sel.doctor_id = 'doc-54321'          -- filter opsional
    -- AND sel.screening_status = 'positive'     -- filter opsional
    -- AND sel.delivery_status = 'failed'        -- filter opsional
    -- AND sel.acknowledged = FALSE              -- filter opsional
ORDER BY sel.created_at DESC
LIMIT 50 OFFSET 0;  -- OFFSET = (page - 1) * per_page
```

### Query 2 — Agregasi Harian per Status

```sql
SELECT
    DATE_TRUNC('day', created_at) AS event_date,
    screening_status,
    delivery_status,
    COUNT(*) AS total_events,
    SUM(CASE WHEN acknowledged THEN 1 ELSE 0 END) AS acked_count,
    AVG(EXTRACT(EPOCH FROM (ack_timestamp - delivery_timestamp))) AS avg_ack_delay_sec
FROM screening_event_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, total_events DESC;
```

### Query 3 — Time-Series Events per Jam

```sql
SELECT
    DATE_TRUNC('hour', created_at) AS hour_bucket,
    COUNT(*) AS total_events,
    SUM(CASE WHEN screening_status = 'positive' THEN 1 ELSE 0 END) AS positive_count,
    SUM(CASE WHEN delivery_status = 'failed' THEN 1 ELSE 0 END) AS failed_deliveries
FROM screening_event_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

### Query 4 — Audit Trail untuk Satu Event

```sql
SELECT
    ae.action,
    ae.actor_id,
    ae.actor_role,
    ae.ip_address,
    ae.created_at,
    ae.changes_json
FROM audit_events ae
WHERE ae.ref_table = 'screening_event_log'
  AND ae.ref_id = (
      SELECT id FROM screening_event_log WHERE event_id = '550e8400-e29b-41d4-a716-446655440001'
  )
ORDER BY ae.created_at ASC;
```

### Query 5 — Events Failed Delivery yang Belum Diack (Perlu Perhatian)

```sql
SELECT
    event_id,
    assist_id,
    facility_id,
    doctor_id,
    delivery_status,
    created_at,
    NOW() - created_at AS age
FROM screening_event_log
WHERE delivery_status = 'failed'
  AND acknowledged = FALSE
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at ASC;
```

---

## 17. Checklist Implementasi (Milestones)

| # | Milestone | Deliverable | Kriteria Done |
|---|-----------|-------------|---------------|
| **M1** | API Contract Finalized | Dokumen spec ini disetujui tim | Sign-off dari dev, QA, klinis |
| **M2** | DB Schema Migration | Migration file PostgreSQL | Migration up/down berjalan; semua indexes terbuat |
| **M3** | Ingest Service — Core | POST endpoint, validate, hash, persist | Unit tests hijau; IT-01 s/d IT-03 pass |
| **M4** | Queue & Retry | Durable queue integration; retry policy | FS-01 pass; DLQ teruji |
| **M5** | Auth & RBAC | JWT validation; role middleware | CT-04 pass; semua role matrix benar |
| **M6** | Dashboard API | GET list, detail, ack endpoints | IT-04 s/d IT-08 pass |
| **M7** | Dashboard UI — Logbook | Table, filter, detail panel | AC-07, AC-10 pass (manual) |
| **M8** | Real-time Push | WebSocket / SSE integration | AC-02 pass (P99 ≤ 5s terukur) |
| **M9** | Security Review | Pen-test ringan; TLS scan; RBAC audit | CT-01 s/d CT-04 pass |
| **M10** | Compliance Sign-off | Privacy impact assessment; log review | Tidak ada PHI di logs; DELETE diblokir |
| **M11** | End-to-End Test & UAT | Semua acceptance criteria diuji | AC-01 s/d AC-10 pass |
| **M12** | Pilot Rollout | Deploy ke PKM-KEDIRI-01 | Monitoring aktif; SLO terpantau hari pertama |

**Urutan prioritas untuk pilot (MVP):** M1 → M2 → M3 → M5 → M6 → M7 → M11 → M12  
Queue (M4) dan real-time push (M8) bisa ditambahkan setelah MVP berjalan.

---

## 18. Catatan Operasi & Maintenance

### Rotasi Encryption Keys

- Encryption key untuk `patient_id` di-rotate setiap **90 hari** via GCP Secret Manager
- Rotasi menggunakan key versioning — record lama tetap dapat didekripsi dengan key versi lama
- Re-encrypt batch dengan key baru setelah rotasi (background job, tidak memblokir operasi)

### DB Vacuum & Archival

- PostgreSQL `VACUUM ANALYZE` dijalankan otomatis via `autovacuum` — monitor bloat quarterly
- Setelah 2 tahun: archive `screening_event_log` (non-critical fields) ke cold storage (GCS Nearline)
- Data asli tetap di DB sampai 7 tahun; setelah itu export ke archive-grade storage (GCS Archive)
- `audit_events` dipertahankan penuh selama 7 tahun (jangan di-archive partial)

### Periodic Audit Log Review

- Review bulanan oleh auditor internal: cek anomali (spike DLQ, akses PHI tidak biasa, hash mismatch)
- Laporan kuartalan ke manajemen: event volume, ack rate, failed delivery trend
- Laporan tahunan untuk kepatuhan regulasi

### Long-Term Archive Export

```sql
-- Ekspor record lebih dari 2 tahun ke CSV untuk cold storage
COPY (
    SELECT * FROM screening_event_log
    WHERE created_at < NOW() - INTERVAL '2 years'
)
TO '/tmp/archive-2024.csv' WITH (FORMAT csv, HEADER true);
```

File diupload ke GCS dengan lifecycle rule `Archive` → hapus dari hot DB setelah konfirmasi upload.

### Key Contact & Escalation

| Kondisi | Eskalasi Pertama | Eskalasi Kedua |
|---------|-----------------|----------------|
| DLQ > 0 | Backend on-call | Lead Backend Engineer |
| DB down > 5 menit | DBA on-call | Infrastructure Lead |
| PHI di application log | Security Officer | CTO |
| Hash mismatch detected | Auditor + Security | Legal |

---

*Dokumen ini siap digunakan sebagai dasar implementasi. Revisi diperlukan hanya jika ada perubahan arsitektur atau keputusan regulasi baru.*

---
**Versi History:**

| Versi | Tanggal | Perubahan | Penulis |
|-------|---------|-----------|---------|
| 1.0.0 | 2026-04-07 | Initial draft | Claudesy |
