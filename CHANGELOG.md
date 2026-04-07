# Changelog

## 2026-04-06

### Added

- extractor direct `Penyakit Kronis` dari RME kini sinkron ke header, field `Riwayat Penyakit Kronis`, dan payload consult
- `scanClinicalContext` kini membaca `Nama Faskes`, `Penjamin/BPJS/Cara Bayar/Jaminan`, `Penyakit Khusus`, `Risiko Kehamilan`, `Riwayat Alergi`, dan `Status Kehamilan`
- flow `Forward to Doctor` kini memakai daftar dokter online tetap di form, bukan picker saat submit
- `Consult Snapshot` kini menampilkan `BPJS / Penjamin`, `Penyakit Khusus`, dan `Risiko Kehamilan`
- footer consult dokter tujuan kini collapsible dan dapat memuat `Riwayat Alergi`, `Penyakit Khusus`, dan `Risiko Kehamilan`
- dokumentasi formal arsitektur dan ADR ditambahkan di `docs/architecture` dan `docs/adr`
- `AutoComplete+` deterministik kini merangkai input gejala menjadi draft anamnesa langsung di kolom gejala
- field baru `Disabilitas` dan `Obesitas` kini tersedia di form intake dan consult payload
- `components/ui/text-effect.tsx` ditambahkan sebagai komponen motion reusable berbasis `framer-motion`
- kontrak canonical `TriageInput` dan `ClinicalEngineOutput` ditambahkan ke dokumentasi arsitektur
- blueprint endpoint trajectory canonical dan breakdown sprint fase 1 ditambahkan ke dokumentasi arsitektur

### Changed

- ranking dokter online kini mempertimbangkan `availability_status`, kecocokan `poli`, dan kecocokan `facility`
- transparansi ranking dokter kini ditampilkan dengan marker ringan `matched poli` dan `same facility`
- aturan histori kunjungan dipertegas menjadi target 5 dan minimum usable 3
- label user-facing `SENAUTO` diganti menjadi `AutoComplete+`
- dropdown `Riwayat Alergi` dijadikan standar visual untuk `Disabilitas`, `Obesitas`, dan `AutoComplete+ Preset`
- `Status Kehamilan` kini memakai rule UI berbasis gender: perempuan wajib isi, laki-laki tampil `Tidak relevan`
- wording `Obesitas` dilokalkan menjadi `Terkonfirmasi` dan `Tidak Terkonfirmasi`

### Fixed

- `Riwayat Penyakit Kronis` tidak lagi hanya muncul di summary header; kini sinkron ke kontrol form
- extractor context RME kini lebih tahan terhadap variasi DOM row/tabel/label
- `Consult Snapshot` tidak lagi terlalu cepat jatuh ke fallback saat label RME tersedia dalam struktur DOM yang berbeda
- textarea gejala tidak lagi berubah ukuran saat draft `AutoComplete+` masuk
- mode laki-laki pada `Status Kehamilan` tidak lagi memakai disabled select native yang membuat row tidak simetris
