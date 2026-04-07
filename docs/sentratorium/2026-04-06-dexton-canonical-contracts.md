# 2026-04-06 - Dexton - Sentra Assist
## Phase: Architecture
## Context: Tim sudah menyepakati model `Assist-first UI, Dashboard-first canonical engine`, tetapi kontrak data dan rollout fase 1 belum ditulis detail.
## What Was Done: Menulis `docs/architecture/canonical-clinical-contract.md`, `docs/architecture/clinical-trajectory-endpoint-blueprint.md`, dan `docs/architecture/phase-1-implementation-task-breakdown.md`; memperbarui `docs/architecture/README.md` dan `CHANGELOG.md`.
## Decisions Made: Memilih kontrak canonical berbasis field nyata dari `Assist` dan tipe nyata dari `dashboard`; memilih endpoint utama `POST /api/clinical/engine/evaluate` dengan opsi endpoint khusus trajectory hanya sebagai adapter transisi.
## Technical Notes: `Assist` saat ini sudah membawa patient context, vitals, anamnesa draft, allergy, pregnancy, disability, obesity, special conditions, dan prefetched history; gap fase 1 utama ada pada `avpu`, `supplemental_o2`, `structured_signs_text`, dan `deterioration_summary_text`.
## Blockers: Tidak ada blocker dokumentasi; implementasi berikutnya membutuhkan keputusan tim apakah memakai satu endpoint canonical atau endpoint trajectory terpisah selama fase transisi.
## Next Steps: Implementasikan mapper `TriageInput` di Assist, expose endpoint canonical di dashboard, lalu render trajectory canonical di sidebar dengan marker source yang jelas.
## Files Modified: `docs/architecture/canonical-clinical-contract.md`, `docs/architecture/clinical-trajectory-endpoint-blueprint.md`, `docs/architecture/phase-1-implementation-task-breakdown.md`, `docs/architecture/README.md`, `CHANGELOG.md`, `docs/sentratorium/2026-04-06-dexton-canonical-contracts.md`
