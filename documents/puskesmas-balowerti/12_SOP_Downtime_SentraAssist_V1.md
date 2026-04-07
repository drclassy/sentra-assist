PEMERINTAH KOTA KEDIRI - DINAS KESEHATAN
PUSKESMAS BALOWERTI KOTA KEDIRI
Jl. Balowerti, Kota Kediri
======================================================
STANDAR OPERASIONAL PROSEDUR (SOP)
PENANGANAN DOWNTIME / GANGGUAN SISTEM AI SENTRA ASSIST

1. TUJUAN
Memastikan pelayanan medis dan farmasi pasien di Puskesmas Balowerti tetap berjalan dengan aman, tertib, dan tanpa penundaan signifikan meskipun terjadi gangguan jaringan internet atau server AI eksternal sedang mengalami *downtime*.

2. KONDISI DOWNTIME (FALLBACK)
Kondisi gangguan dinyatakan terjadi apabila Nakes mendapati:
- Indikator *Offline* merah menyala di aplikasi Sentra Assist.
- *Loading spinner* (animasi memuat) berputar terus-menerus melampaui waktu 10-15 detik tanpa mengeluarkan *output* apa pun.

3. PROSEDUR PELAYANAN MANUAL
a. **Penghentian Paksa:** Nakes segera mematikan saklar (toggle switch "Power/Enable") Sentra Assist pada ekstensi peramban agar tidak mengganggu kinerja sistem RME internal.
b. **Input Manual:** Perawat dan Dokter melakukan anamnesa dan pemeriksaan fisik, serta mencatat keluhan langsung (tanpa ketikan otomatis/AutoComplete+) ke dalam sistem RME.
c. **Peralihan Validasi Farmasi:** Apoteker secara penuh mengambil alih pengecekan keamanan interaksi obat (DDI) secara manual menggunakan buku panduan formularium nasional standar atau instrumen MIMS, tanpa bantuan AI.
d. **Tanpa Retrospektif AI:** Pasien yang dilayani secara manual selama masa *downtime* tidak perlu dimasukkan ulang atau dianalisis ulang oleh AI setelah sistem kembali menyala (*online*). Layanan terus berjalan maju.

4. PELAPORAN GANGGUAN
a. Staf poli melaporkan kejadian *offline* kepada Tim IT/Admin Puskesmas.
b. Tim IT melakukan *restart* router atau *refresh cache*.
c. Jika *downtime* berasal dari server LLM/Sentra, Tim IT segera melaporkan hal tersebut kepada tim *support* vendor Sentra Healthcare.

Ditetapkan di: Kediri
Tanggal: {{TANGGAL_HARI_INI}}
Kepala Puskesmas Balowerti Kota Kediri

(ttd/stempel)
drg. Endah W
NIP. {{NIP_KEPALA_PUSKESMAS}}

Checklist Verifikasi:
[ ] Ada header institusi
[ ] Kriteria indikator *downtime* (loading > 10 detik) dicantumkan
[ ] Instruksi mematikan ekstensi (*Power Toggle*) ada
[ ] Peralihan validasi DDI ke farmakologi manual oleh Apoteker ditegaskan
[ ] Instruksi bebas retroaktif (tidak input ulang) ada
[ ] Alur pelaporan *troubleshooting* jelas
[ ] Tanda tangan Kepala Puskesmas sah

Metadata: Penulis: Tim IT Puskesmas | Tanggal: 2026 | Versi: 1.0
Rekomendasi Tampilan: Font Arial 11, Spasi 1.15. Blok atau beri sorotan pada poin *Peralihan Validasi Farmasi* dan *Tanpa Retrospektif AI*.