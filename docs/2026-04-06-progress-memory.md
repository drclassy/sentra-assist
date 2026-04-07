# 2026-04-06 Progress Memory

- Sentra Assist sidepanel sudah dipoles untuk workflow klinis yang lebih ringkas dan konsisten.
- Extractor direct RME `Penyakit Kronis` berhasil dan sekarang sinkron ke row header `Riwayat Penyakit`, field `Riwayat Penyakit Kronis`, serta checkbox dropdown.
- `scanClinicalContext` diperkuat untuk membaca `Nama Faskes`, `Penjamin/BPJS/Cara Bayar/Jaminan`, `Penyakit Khusus`, `Risiko Kehamilan`, `Riwayat Alergi`, dan `Status Kehamilan` dengan traversal label, sibling, cell tabel, dan fallback regex ringan.
- `Forward to Doctor` sudah terhubung ke Crew Dashboard `https://crew.puskesmasbalowerti.com` lewat `getOnlineDoctors()` dan `sendConsultToDoctor()`.
- Ranking dokter online sekarang mempertimbangkan `availability_status`, kecocokan `poli`, dan kecocokan `facility_name/location_name`, serta ditampilkan transparan lewat badge `matched poli` dan `same facility`.
- Panel `Dokter Online` kini memiliki `Consult Snapshot` untuk `BPJS / Penjamin`, `Penyakit Khusus`, dan `Risiko Kehamilan`.
- Footer consult dokter tujuan sekarang collapsible dan dapat memuat `Riwayat Alergi`, `Penyakit Khusus`, dan `Risiko Kehamilan` bila data extractor tersedia.
- `SENAUTO` kini diposisikan ulang sebagai `AutoComplete+` dan memakai composer anamnesa deterministik untuk mengubah 3-4 gejala menjadi draft anamnesa yang langsung masuk ke kolom gejala.
- Efek text reveal untuk `AutoComplete+` kini memakai `components/ui/text-effect.tsx` berbasis `framer-motion`, dengan box gejala dijaga tetap stabil ukurannya selama animasi.
- `Status Kehamilan` kini punya rule UI eksplisit: pasien perempuan wajib memilih `Hamil` atau `Tidak Hamil` dengan lighting pink halus, sedangkan pasien laki-laki menampilkan field statis `Tidak relevan`.
- Form intake di bawah gejala kini memakai dua row dua kolom yang ringkas:
  - `Riwayat Alergi | Status Kehamilan`
  - `Disabilitas | Obesitas`
- Field `Disabilitas` dan `Obesitas` ditambahkan ke state form, summary `AutoComplete+`, dan consult payload.
- Desain dropdown custom baru dijadikan standar untuk `Riwayat Alergi`, `Disabilitas`, `Obesitas`, dan `AutoComplete+ Preset`.
- Build terakhir `.\node_modules\.bin\wxt.cmd build` sukses dan output terbaru default diarahkan ke `.output\chrome-mv3-dev`.

## Update Sesi Lanjutan

- Boundary arsitektur dikunci: `Assist` diposisikan sebagai `workflow-first UI/capture layer`, sedangkan `dashboard intelligence` menjadi `canonical clinical engine`.
- Dokumentasi tambahan dibuat untuk `vital sign algorithm map`, `executive brief`, `comparison matrix`, `assist-dashboard architecture`, `ADR-004`, `canonical clinical contract`, `trajectory endpoint blueprint`, dan `phase-1 implementation breakdown`.
- `ClinicalTrajectory` di Assist kini memanggil canonical engine dashboard dan menampilkan panel `CANONICAL ENGINE`, sementara hasil lokal ditandai sebagai `preview-only`.
- `ClinicalDifferential` kini canonical-first dengan fallback lokal; urutan diagnosis mulai mengikuti severity/action canonical saat response dashboard tersedia.
- `Forward to Doctor` kini membawa `canonical_clinical` yang memuat `NEWS2`, `overall_trend`, `overall_risk`, `deterioration_state`, `trajectory narrative`, dan `immediate_actions`.
- Dashboard telemedicine kini menampilkan `Canonical Clinical Snapshot` pada incoming consult dokter dan antrean consult mulai diurutkan menurut urgency canonical.
- Halaman `Vital Sign` kini dibelah jelas menjadi dua helper berbeda:
  - `AutoComplete+` anamnesis untuk area `Gejala / Keluhan`
  - `AutoComplete+` vital sign untuk area `Vital Signs - Cardiopulmonary Metrics`
- Engine `Vital Sign` lokal kini age-aware untuk cohort pediatrik, remaja, dan dewasa, termasuk threshold `hypotension`, `tachycardia`, `bradycardia`, `tachypnea`, `bradypnea`, dan `severe high BP`.
- `Pediatric screening mode` hanya boleh muncul bila context pasien benar-benar sudah termuat dan usia pasien `<18`.
- Pelajaran penting sesi ini: perubahan source code tidak boleh dianggap selesai sebelum hasil runtime yang dilihat user benar-benar tervalidasi; sesi ini sempat drift berat pada isu tombol/style karena verifikasi visual tidak cukup keras.
