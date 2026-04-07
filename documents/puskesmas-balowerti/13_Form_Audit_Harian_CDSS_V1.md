PEMERINTAH KOTA KEDIRI - DINAS KESEHATAN
PUSKESMAS BALOWERTI KOTA KEDIRI
Jl. Balowerti, Kota Kediri
======================================================
FORMULIR LAPORAN AUDIT HARIAN
PENGGUNAAN CLINICAL DECISION SUPPORT SYSTEM (CDSS)

Formulir ini digunakan oleh Kepala Poli atau Petugas Audit Mutu Puskesmas Balowerti untuk merekapitulasi efektivitas penggunaan modul Kecerdasan Buatan (Sentra Assist) setiap harinya.

I. IDENTITAS PELAKSANA AUDIT
Hari / Tanggal  : {{HARI}}, {{TANGGAL_HARI_INI}}
Nama Poli / Unit: {{NAMA_POLI_ATAU_UNIT_LAYANAN}}
Nama Pelapor    : {{NAMA_PETUGAS_AUDIT}}
Shift Jaga      : [ ] Pagi   [ ] Siang   [ ] Malam (Poned/UGD)

II. METRIK PENGGUNAAN SISTEM CDSS
| No | Indikator Evaluasi Harian | Jumlah Pasien / Keterangan |
|----|----------------------------------------------------------|----------------------------|
| 1. | Total Kunjungan Pasien di Poli Hari Ini | {{JUMLAH_TOTAL_KUNJUNGAN}} Pasien |
| 2. | Jumlah Kasus Diinput Menggunakan Sentra Assist (AI) | {{JUMLAH_PASIEN_DENGAN_AI}} Pasien |
| 3. | Peringatan Kritis TTV (*Red Flag Alert*) yang Terpicu | {{JUMLAH_RED_FLAG_MUNCUL}} Kali |
| 4. | Dari *Red Flag*, Jumlah yang Dinyatakan Valid oleh Nakes | {{JUMLAH_RED_FLAG_VALID}} Kasus |
| 5. | Peringatan Interaksi Obat Berbahaya (DDI Merah) Muncul | {{JUMLAH_DDI_MERAH_MUNCUL}} Kali |
| 6. | Resep Obat yang Berhasil Disubstitusi/Diganti akibat DDI | {{JUMLAH_RESEP_DIGANTI}} Kasus |

III. EVALUASI GANGGUAN / DOWNTIME
Apakah terjadi gangguan sistem (AI offline / error DOM / Internet mati) pada shift ini?
[ ] TIDAK ADA GANGGUAN
[ ] ADA GANGGUAN (Jelaskan durasi dan dampaknya):
    Rincian: {{JELASKAN_KENDALA_DAN_WAKTU_DOWNTIME_DI_SINI}}

IV. CATATAN TAMBAHAN MUTU PELAYANAN
{{TULISKAN_USULAN_ATAU_CATATAN_DARI_DOKTER_/PERAWAT_DI_SINI}}

Kediri, {{TANGGAL_HARI_INI}}
Petugas Audit (Kepala Poli / Tim Mutu)

(tanda tangan)
{{NAMA_PETUGAS_AUDIT}}
NIP/STR: {{NIP_PETUGAS_AUDIT}}

Checklist Verifikasi:
[ ] Ada header institusi
[ ] Kolom tanggal, poli, dan shift lengkap
[ ] Tabel metrik mencakup evaluasi validitas *Red Flag*
[ ] Tabel metrik mencakup data substitusi resep (DDI)
[ ] Ketersediaan kolom *Downtime*
[ ] Dapat dicetak atau diisi di aplikasi *Spreadsheet*
[ ] Tanda tangan petugas jelas

Metadata: Penulis: Tim Manajemen Mutu Puskesmas | Tanggal: 2026 | Versi: 1.0
Rekomendasi Tampilan: Cetak dalam kertas A4 Portrait. Buat garis tabel (*borders*) yang tegas agar mudah diisi secara manual dengan pulpen jika sistem digital sedang tidak dipakai.