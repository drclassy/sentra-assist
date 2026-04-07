PEMERINTAH KOTA KEDIRI - DINAS KESEHATAN
PUSKESMAS BALOWERTI KOTA KEDIRI
Jl. Balowerti, Kota Kediri
======================================================
STANDAR OPERASIONAL PROSEDUR (SOP)
VERIFIKASI TANDA-TANDA VITAL (TTV) DAN CLINICAL INFERENCE

1. TUJUAN
Memastikan validitas dan akurasi pengukuran Tanda-Tanda Vital (TTV) serta meminimalisasi *medical error* akibat bias ketergantungan yang berlebihan (automation bias) terhadap inferensi klinis yang dihasilkan oleh sistem Kecerdasan Buatan (Sentra Assist).

2. RUANG LINGKUP
SOP ini ditujukan bagi Perawat Triage dan Dokter Penanggung Jawab Pasien di seluruh unit pelayanan Puskesmas Balowerti.

3. PROSEDUR PELAKSANAAN
a. Perawat melakukan pengukuran fisik TTV pasien secara langsung (Sistolik, Diastolik, Nadi, Suhu tubuh, Laju Pernapasan).
b. Perawat memasukkan angka hasil pengukuran ke dalam sistem RME yang terhubung dengan Sentra Assist.
c. Sentra Assist akan memproses angka tersebut dan menampilkan *badge* peringatan warna:
   - **Hijau:** Parameter Normal.
   - **Kuning:** Waspada (Terdapat parameter yang mulai di luar batas normal fisiologis).
   - **Merah:** Kritis / *Emergency* (Parameter sangat abnormal).
d. **Cross-Check Visual:** Sebelum menyetujui inferensi sistem, Perawat WAJIB melihat klinis fisik pasien (contoh: apakah pasien tampak sesak, pucat, berkeringat dingin) dan membandingkannya dengan *badge* AI. Jika alat medis dicurigai rusak sehingga hasil TTV tak sesuai klinis, ulangi pengukuran dengan alat berbeda.
e. Jika AI memunculkan rekomendasi *Clinical Inference* spesifik (contoh: "Terdapat pola hipotensi yang menyertai takikardia, curiga hipovolemia"), Dokter Poli WAJIB mengonfirmasi hal ini melalui Anamnesa mendalam dan Pemeriksaan Fisik lanjutan.
f. **Batas Kewenangan:** Label inferensi AI (*Clinical Inference*) TIDAK BOLEH dicatat sebagai Diagnosis Kerja (ICD-10) secara mentah tanpa dasar verifikasi observasi klinis holistik oleh Dokter yang memegang SIP.

Ditetapkan di: Kediri
Tanggal: {{TANGGAL_HARI_INI}}
Kepala Puskesmas Balowerti Kota Kediri

(ttd/stempel)
drg. Endah W
NIP. {{NIP_KEPALA_PUSKESMAS}}

Checklist Verifikasi:
[ ] Ada header institusi
[ ] Menyebutkan jenis parameter TTV
[ ] Klasifikasi indikator warna dijelaskan
[ ] Instruksi wajib *Cross-Check* visual klinis pasien
[ ] Kewajiban Pemeriksaan Fisik oleh Dokter
[ ] Penegasan bahwa AI bukan alat diagnostik absolut
[ ] Tanda tangan Kepala Puskesmas sah

Metadata: Penulis: Tim Medis Sentra | Tanggal: 2026 | Versi: 1.0
Rekomendasi Tampilan: Font Arial 11, Spasi 1.15. Highlight warna pada teks indikator Hijau/Kuning/Merah jika memungkinkan saat cetak.