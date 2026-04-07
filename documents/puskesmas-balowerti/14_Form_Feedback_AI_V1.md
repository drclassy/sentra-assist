PEMERINTAH KOTA KEDIRI - DINAS KESEHATAN
PUSKESMAS BALOWERTI KOTA KEDIRI
Jl. Balowerti, Kota Kediri
======================================================
FORMULIR UMPAN BALIK (FEEDBACK REPORT)
PELAPORAN BIAS / HALUSINASI / KETIDAKAKURATAN AI

Sistem Sentra Assist di Puskesmas Balowerti wajib diawasi secara proaktif oleh Tenaga Kesehatan. Gunakan formulir ini (Bentuk Tiket) apabila Nakes menemukan "Halusinasi AI" — yakni sistem memberikan *output* yang salah, tidak relevan, salah membaca angka, atau membahayakan klinis.

No. Tiket Pelaporan: {{GENERATE_NO_TIKET}}
Tanggal Kejadian   : {{TANGGAL_KEJADIAN}}

BAGIAN I: IDENTITAS PELAPOR
Nama Dokter/Perawat : {{NAMA_PELAPOR}}
Poli Penugasan      : {{NAMA_POLI_PENUGASAN}}

BAGIAN II: KONTEKS KLINIS KASUS (PENTING: JANGAN CANTUMKAN NAMA PASIEN)
No. RM / ID Pasien  : {{KODE_ATAU_NO_REKAM_MEDIS}}
Usia / Jenis Kelamin: {{USIA_TAHUN}} / {{LAKI_LAKI_ATAU_PEREMPUAN}}
Keluhan Utama       : {{SINGKATAN_KELUHAN_YANG_DIMASUKKAN}}

BAGIAN III: KATEGORI KESALAHAN SISTEM (Pilih Salah Satu/Lebih)
[ ] **Halusinasi AutoComplete+** (Kalimat yang dirangkai AI bertolak belakang dengan input awal).
[ ] **Diagnosis Banding Tidak Relevan** (Saran penyakit AI sama sekali tidak masuk akal secara klinis).
[ ] **Kesalahan Ekstraksi TTV** (AI salah membaca angka Tensi/Nadi sehingga memicu *Red Flag* palsu).
[ ] **Drug-Drug Interaction (DDI) Palsu** (Sistem melarang gabungan obat yang sebenarnya aman).

BAGIAN IV: DESKRIPSI ERROR DAN KOREKSI KLINIS
1. Apa yang ditampilkan oleh AI secara keliru?
   Penjelasan Output Salah: {{TULISKAN_OUTPUT_YANG_KELIRU_DARI_LAYAR_AI}}
2. Bagaimana koreksi sebenarnya menurut ilmu kedokteran/klinis yang benar?
   Koreksi Seharusnya   : {{TULISKAN_SEHARUSNYA_BAGAIMANA}}

BAGIAN V: TINDAK LANJUT
Formulir ini diserahkan kepada Tim IT Puskesmas untuk diteruskan ke tim pengembang (*Vendor Sentra Healthcare*) sebagai bahan re-training (pembelajaran ulang) algoritma mesin demi keselamatan pasien (*Patient Safety*).

Pelapor (Tenaga Kesehatan),               Diterima Oleh (Tim IT / Mutu),

(tanda tangan)                            (tanda tangan)
{{NAMA_PELAPOR}}                          {{NAMA_PENERIMA_IT}}

Checklist Verifikasi:
[ ] Ada header institusi
[ ] Peringatan keras melarang penulisan Nama Pasien tertera
[ ] Konteks Usia dan Keluhan tersedia
[ ] Kotak centang Kategori Kesalahan/Bias AI mencakup berbagai jenis modul
[ ] Ruang deskripsi kesalahan dan koreksi medis (Ground Truth) jelas
[ ] Ada alur serah-terima ke Tim IT/Vendor
[ ] Tanda tangan Pelapor dan Penerima sah

Metadata: Penulis: Komite Keselamatan Pasien | Tanggal: 2026 | Versi: 1.0
Rekomendasi Tampilan: Font Arial 11. Sediakan baris kosong (spasi) yang luas pada Bagian IV (Deskripsi Error) agar dokter leluasa menulis.