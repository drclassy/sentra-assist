# HANDOFF.md — sentra-assist
<!-- Overwrite at the start of each new session. -->

## Session: 2026-04-10 — COMPLETED ✅

### Context
Chief menginstruksikan standarisasi seluruh file `AGENTS.md` di monorepo ke format 9 bagian sesuai template standar.

### Task Completed
Standarisasi **25 file `AGENTS.md`** telah selesai 100%:

| Divisi | Jumlah File |
|--------|-------------|
| Healthcare | 6 (division + 5 sub-apps) |
| Academic | 4 (division + 3 sub-apps) |
| Community | 4 (division + 3 sub-apps) |
| Coorporate | 4 (division + 3 sub-apps) |
| Prototype | 3 (division + 2 sub-apps) |
| Orchestrator | 1 |
| Flows | 1 |
| Infrastructure | 1 |
| Packages | 1 |
| **TOTAL** | **25** |

### Structure Applied (9 Sections)
1. Project Introduction (scoped per project)
2. Mandatory Memory Protocol (identical)
3. JET Workflow Protocol (identical)
4. Directory Structure (scoped per project)
5. Technical Conventions + Boundaries (scoped per project)
6. Commands & Setup (scoped per project)
7. Pre-PR Checklist + specific checks (scoped per project)
8. Documentation Requirements (identical)
9. Native Editor Preferences (identical)

### Critical Rules Preserved
- PHI/PII absolute rules (Healthcare)
- Boundaries for fhir-engine and iskandar-gatekeeper (Healthcare)
- Compliance guard for sentra-assist
- Infrastructure hard rules (terraform apply = Chief only)
- Package breaking change protocol
- All other division-specific constraints

---
**Status:** ✅ COMPLETE — Ready for next task
