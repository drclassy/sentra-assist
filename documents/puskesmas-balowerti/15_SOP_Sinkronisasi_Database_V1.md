PEMERINTAH KOTA KEDIRI - DINAS KESEHATAN
PUSKESMAS BALOWERTI KOTA KEDIRI
Jl. Balowerti, Kota Kediri
======================================================
STANDAR OPERASIONAL PROSEDUR (SOP)
PEMELIHARAAN DAN SINKRONISASI DATABASE KLINIS (ICD-10 & OBAT)

1. TUJUAN
Memastikan modul diagnosis dan pengecekan Farmasi (Drug-Drug Interaction / DDI) pada Sentra Assist beroperasi dengan menggunakan referensi Kode ICD-10 medis terbaru dan *Database* Ketersediaan Stok Obat Formularium Nasional yang sesuai dengan kondisi nyata apotek Puskesmas Balowerti dan standar BPJS/Pcare.

2. RUANG LINGKUP
SOP ini ditujukan bagi Tim IT (Pengelola Sistem Informasi Puskesmas) dan Apoteker Utama (Instalasi Farmasi Puskesmas).

3. JADWAL SINKRONISASI RUTIN
Proses sinkronisasi database mutlak dilakukan secara berkala **setiap tanggal 1 pada awal bulan**, atau selambat-lambatnya tanggal 3, sebelum jam pelayanan pagi dimulai.

4. PROSEDUR SINKRONISASI OBAT DAN ICD-10
a. Apoteker mengekspor daftar ketersediaan obat (stok apotek) beserta harga terbaru dari aplikasi pengelola stok Puskesmas menjadi *file* dengan format CSV atau Excel.
b. Apoteker menyerahkan dokumen CSV tersebut kepada Petugas IT Puskesmas.
c. Tim IT Puskesmas menggunakan instrumen administratif (Console) untuk mengunggah (*upload*) atau memperbarui file data referensi (`stok_obat.json` atau struktur database lokal) di dalam sistem infrastruktur *backend* Sentra Assist.
d. Tim IT juga bertugas memperbarui kodifikasi ICD-10 versi Kementerian Kesehatan jika terdapat pembaruan (*patch*) regulasi terkait rujukan BPJS.
e. **Proses Uji Coba (*Testing*):** Setelah diunggah, Tim IT WAJIB melakukan uji fungsional *dummy* pada panel Poli dengan mencoba mengetik nama obat baru dan melihat apakah sistem memunculkan prediksi harga obat tersebut serta bisa mengenali interaksi obatnya.
f. Apabila pengujian sukses, Tim IT mencatat tanggal eksekusi ke dalam *Log Book Maintenance* Server.

Ditetapkan di: Kediri
Tanggal: {{TANGGAL_HARI_INI}}
Kepala Puskesmas Balowerti Kota Kediri

(ttd/stempel)
drg. Endah W
NIP. {{NIP_KEPALA_PUSKESMAS}}

Checklist Verifikasi:
[ ] Ada header institusi
[ ] Tujuan akurasi DDI dan Rujukan BPJS tertuang
[ ] Jadwal wajib sinkronisasi awal bulan ditekankan
[ ] Langkah ekspor data CSV oleh Apoteker jelas
[ ] Instruksi wajib *Testing/Uji Coba* oleh Tim IT tertuang
[ ] Pencatatan ke *Log Book Maintenance* disertakan
[ ] Tanda tangan Kepala Puskesmas sah

Metadata: Penulis: Tim IT & Farmasi Puskesmas | Tanggal: 2026 | Versi: 1.0
Rekomendasi Tampilan: Font Arial 11, Spasi 1.15. Highlight peran krusial antara Apoteker dan IT.