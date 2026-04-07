PEMERINTAH KOTA KEDIRI - DINAS KESEHATAN
PUSKESMAS BALOWERTI KOTA KEDIRI
Jl. Balowerti, Kota Kediri
======================================================
PROTOKOL KEAMANAN DATA KESEHATAN PASIEN
(PHI PROTECTION POLICY - SENTRA ASSIST)

Mengingat pemanfaatan teknologi *Large Language Model* (LLM) di lingkungan puskesmas melibatkan pemrosesan teks eksternal, Puskesmas Balowerti menetapkan protokol pelindungan Informasi Kesehatan Dilindungi (Protected Health Information / PHI) yang mengikat seluruh sivitas:

PASAL 1. KEBIJAKAN ANONIMISASI DATA (*ANONYMIZATION*)
Sistem Sentra Assist melalui modul *Local Isolator Engine* WAJIB secara otomatis menyamarkan, memotong, atau merahasiakan data identitas sensitif—meliputi Nama Lengkap, NIK, No. Kartu BPJS, Alamat detail (RT/RW/Jalan), dan Nomor Telepon—sebelum data klinis pasien ditransmisikan ke server *Cloud* LLM untuk keperluan *inference* diagnosis.

PASAL 2. KEPATUHAN TENAGA KESEHATAN
Tenaga Kesehatan (Dokter, Perawat, Bidan) DILARANG KERAS secara sengaja mengetikkan data identifikasi privat yang disebutkan pada Pasal 1 ke dalam kolom keluhan bebas/teks terbuka (*free text input*) yang akan dianalisis oleh AI.

PASAL 3. PENYIMPANAN LOKAL (*DATA RESIDENCY*)
Seluruh data mentah dan *database mapping* asli milik Puskesmas wajib tetap tersimpan utuh dan terenkripsi pada server lokal milik Puskesmas atau Dinas Kesehatan. Vendor Sentra Assist dilarang membuat replikasi database pasien ke pihak ketiga tanpa izin resmi tertulis.

PASAL 4. SANKSI PELANGGARAN
Kegagalan mematuhi protokol pelindungan data medis ini yang berakibat pada kebocoran data privasi pasien merupakan pelanggaran terhadap UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (PDP) dan dapat dikenai sanksi administratif indisipliner, teguran tertulis, hingga pelaporan pidana.

Ditetapkan di: Kediri
Tanggal: {{TANGGAL_HARI_INI}}
Kepala Puskesmas Balowerti Kota Kediri

(ttd/stempel)
drg. Endah W
NIP. {{NIP_KEPALA_PUSKESMAS}}

*(Catatan: Protokol hukum internal ini disusun sebagai panduan operasional administratif dan bukan merupakan dokumen hukum publik yang menggantikan regulasi Kemenkes).*

Checklist Verifikasi:
[ ] Ada header institusi
[ ] Definisi elemen PHI (Nama, NIK, dll) rinci
[ ] Menegaskan peran Isolator Engine/Anonimisasi
[ ] Larangan bagi Nakes untuk memasukkan NIK di input AI
[ ] Referensi UU PDP
[ ] Tanda tangan Kepala Puskesmas sah

Metadata: Penulis: Tim Legal / IT | Tanggal: 2026 | Versi: 1.0
Rekomendasi Tampilan: Font Times New Roman 12, Spasi 1.5, Justify. Gunakan format pasal resmi.