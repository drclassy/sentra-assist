# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive documentation improvements: CONTRIBUTING.md, DEPLOYMENT.md, API.md, SECURITY.md, USER_GUIDE.md, WORKFLOW.md, and MAINTENANCE.md.
- Enhanced README.md with environment configuration, architecture overview, testing guide, troubleshooting, and deployment sections.
- Enhanced AGENTS.md with onboarding guide, emergency procedures, tool usage guidelines, and code review checklist.
- Enhanced CODING_STANDARD.md with security best practices, testing standards, error handling patterns, logging standards, and documentation standards.
- Standardized ADR format with metadata (decision date, reviewer, status, alternatives considered).

## [1.0.1] - 2026-04-06

### Added

- Extractor direct `Penyakit Kronis` dari RME kini sinkron ke header, field `Riwayat Penyakit Kronis`, dan payload consult.
- `scanClinicalContext` kini membaca `Nama Faskes`, `Penjamin/BPJS/Cara Bayar/Jaminan`, `Penyakit Khusus`, `Risiko Kehamilan`, `Riwayat Alergi`, dan `Status Kehamilan`.
- Flow `Forward to Doctor` kini memakai daftar dokter online tetap di form, bukan picker saat submit.
- `Consult Snapshot` kini menampilkan `BPJS / Penjamin`, `Penyakit Khusus`, dan `Risiko Kehamilan`.
- Footer consult dokter tujuan kini collapsible dan dapat memuat `Riwayat Alergi`, `Penyakit Khusus`, dan `Risiko Kehamilan`.
- Dokumentasi formal arsitektur dan ADR ditambahkan di `docs/architecture` dan `docs/adr`.
- `AutoComplete+` deterministik kini merangkai input gejala menjadi draft anamnesa langsung di kolom gejala.
- Field baru `Disabilitas` dan `Obesitas` kini tersedia di form intake dan consult payload.
- `components/ui/text-effect.tsx` ditambahkan sebagai komponen motion reusable berbasis `framer-motion`.
- Kontrak canonical `TriageInput` dan `ClinicalEngineOutput` ditambahkan ke dokumentasi arsitektur.
- Blueprint endpoint trajectory canonical dan breakdown sprint fase 1 ditambahkan ke dokumentasi arsitektur.

### Changed

- Ranking dokter online kini mempertimbangkan `availability_status`, kecocokan `poli`, dan kecocokan `facility`.
- Transparansi ranking dokter kini ditampilkan dengan marker ringan `matched poli` dan `same facility`.
- Aturan histori kunjungan dipertegas menjadi target 5 dan minimum usable 3.
- Label user-facing `SENAUTO` diganti menjadi `AutoComplete+`.
- Dropdown `Riwayat Alergi` dijadikan standar visual untuk `Disabilitas`, `Obesitas`, dan `AutoComplete+ Preset`.
- `Status Kehamilan` kini memakai rule UI berbasis gender: perempuan wajib isi, laki-laki tampil `Tidak relevan`.
- Wording `Obesitas` dilokalkan menjadi `Terkonfirmasi` dan `Tidak Terkonfirmasi`.

### Fixed

- `Riwayat Penyakit Kronis` tidak lagi hanya muncul di summary header; kini sinkron ke kontrol form.
- Extractor context RME kini lebih tahan terhadap variasi struktur row/tabel/label yang dibaca DAS.
- `Consult Snapshot` tidak lagi terlalu cepat jatuh ke fallback saat label RME tersedia dalam struktur field yang berbeda.
- Textarea gejala tidak lagi berubah ukuran saat draft `AutoComplete+` masuk.
- Mode laki-laki pada `Status Kehamilan` tidak lagi memakai disabled select native yang membuat row tidak simetris.

## [1.0.0] - 2026-03-01

### Added

- Initial release of Sentra Assist browser extension.
- Clinical decision support sidepanel for ePuskesmas integration.
- AI-powered diagnosis assistance via Vertex AI.
- Smart medication guidance with DDI checking.
- Dashboard-backed authentication and patient sync.
- RME extraction and form-filling capabilities.
- Forward to Doctor workflow for clinical consultations.
