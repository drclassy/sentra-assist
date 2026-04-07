PUSKESMAS BALOWERTI KOTA KEDIRI
STANDAR OPERASIONAL PROSEDUR (SOP)
EKSTRAKSI DAN INTEGRASI DATA RME KE SENTRA ASSIST

1. TUJUAN
Menjamin kelancaran dan keamanan aliran data dari sistem RME lokal Puskesmas ke modul Clinical Decision Support Sentra Assist.

2. PETUGAS TERKAIT
Tim IT Puskesmas, Dokter, dan Perawat Poli.

3. LANGKAH-LANGKAH
a. Petugas IT memastikan ekstensi Sentra Assist (content script) aktif di peramban poli.
b. Saat Nakes membuka halaman Anamnesa RME, Sentra Assist secara otomatis mendeteksi elemen DOM.
c. Sistem melakukan pemetaan (mapping) data TTV tanpa mengekspor Nama dan NIK pasien keluar dari local bridge.
d. Jika terjadi kegagalan pemetaan (RME update antarmuka), Nakes dapat melakukan pengisian manual.
e. Nakes melaporkan kegagalan DOM ke tim IT untuk sinkronisasi ulang.

Ditetapkan di: Kediri
Kepala Puskesmas Balowerti Kota Kediri

(ttd/stempel)
drg. Endah W
NIP. {{NIP_KEPALA_PUSKESMAS}}

Checklist Verifikasi:
[ ] Menyebutkan RME
[ ] Proteksi identitas lokal
[ ] Penanganan kegagalan DOM
[ ] Melibatkan Tim IT
[ ] Kolom Pengesahan Kepala Puskesmas
[ ] Runtut dan ringkas

Metadata: Penulis: Tim IT Sentra | Tanggal: 2026 | Versi: 1.0
Rekomendasi Tampilan: Arial 11, Justify.