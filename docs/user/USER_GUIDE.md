# Sentra Assist User Guide

Selamat datang di **Sentra Assist** — asisten klinis berbasis AI untuk tenaga medis di ePuskesmas. Panduan ini akan membantu Anda memahami fitur-fitur utama dan cara menggunakannya dengan efektif.

---

## Daftar Isi

1. [Memulai](#memulai)
2. [Fitur Utama](#fitur-utama)
3. [Cara Menggunakan](#cara-menggunakan)
   4 [Tips dan Trik](#tips-dan-trik)
4. [Pemecahan Masalah](#pemecahan-masalah)
5. [FAQ](#faq)

---

## Memulai

### Instalasi

1. Pastikan ekstensi **Sentra Assist** sudah diinstal di browser Chrome atau Firefox Anda.
2. Pin ikon Sentra Assist ke toolbar untuk akses cepat.
3. Buka halaman **ePuskesmas** dan login seperti biasa.
4. Klik ikon Sentra Assist di toolbar untuk membuka **sidepanel**.

### Login Pertama Kali

Sentra Assist menggunakan autentikasi terintegrasi dengan Dashboard Sentra. Saat pertama kali membuka sidepanel:

1. Klik tombol **Login**.
2. Masukkan kredensial Dashboard Sentra Anda.
3. Setelah berhasil, sidepanel akan menampilkan data pasien aktif.

---

## Fitur Utama

### 1. Ringkasan Pasien (Patient Summary)

Sidepanel secara otomatis membaca data pasien dari halaman RME yang sedang terbuka, termasuk:

- Nama, No. RM, dan usia pasien
- Tanda-tanda vital (TTV) terbaru
- Riwayat penyakit kronis
- Alergi dan penyakit khusus
- Status kehamilan (jika relevan)

### 2. AutoComplete+ (Bantuan Diagnosis)

Fitur ini membantu Anda merangkai gejala pasien menjadi draft anamnesa dan memberikan saran diagnosis berdasarkan data klinis.

**Cara menggunakan:**

1. Masukkan gejala utama pasien di kolom **Keluhan Utama**.
2. Sentra Assist akan menganalisis keluhan beserta TTV dan riwayat pasien.
3. Saran diagnosis dengan kode ICD-10 akan muncul di panel diagnosis.
4. Klik diagnosis yang sesuai untuk memindahkannya ke daftar diagnosis aktif.

### 3. Pemeriksaan DDI (Drug-Drug Interaction)

Saat Anda menambahkan resep obat, Sentra Assist akan:

- Memeriksa interaksi obat secara otomatis
- Memberikan peringatan jika ada kontraindikasi
- Menyarankan alternatif jika diperlukan

### 4. Forward to Doctor (Konsultasi ke Dokter)

Jika pasien memerlukan konsultasi dokter, Anda dapat meneruskannya dengan mudah:

1. Isi form intake pasien (keluhan, diagnosis, TTV, riwayat).
2. Klik tombol **Forward to Doctor**.
3. Pilih dokter yang tersedia dari daftar.
4. Dokter akan menerima notifikasi konsultasi lengkap dengan data pasien.

**Tip:** Dokter diurutkan berdasarkan ketersediaan, kecocokan poli, dan fasilitas untuk memudahkan pemilihan.

### 5. Clinical Trajectory (Riwayat Kunjungan)

Lihat tren kondisi pasien berdasarkan kunjungan sebelumnya:

- Grafik perubahan TTV dari waktu ke waktu
- Ringkasan diagnosis historis
- Peringatan jika ada perubahan signifikan

**Catatan:** Fitur ini memerlukan minimal **3 kunjungan** dalam histori pasien.

---

## Cara Menggunakan

### Alur Kerja Umum

```
Buka RME Pasien → Klik Sentra Assist → Review Ringkasan
    ↓
Masukkan Keluhan → Terima Saran Diagnosis
    ↓
Tambahkan Resep → Periksa Peringatan DDI
    ↓
Isi Form Intake → Forward ke Dokter (jika perlu)
    ↓
Sinkronkan ke RME
```

### Mengisi Form Intake

Pastikan field berikut diisi dengan lengkap sebelum mengirim konsultasi:

- **Keluhan Utama** — gejala yang dikeluhkan pasien
- **Diagnosis** — kode ICD-10 yang sesuai
- **TTV** — tekanan darah, nadi, suhu, respirasi, SpO2
- **Riwayat Alergi** — pilih dari dropdown jika ada
- **Penyakit Khusus** — kondisi kronis atau penyerta
- **Disabilitas** — pilih status disabilitas pasien
- **Obesitas** — pilih status obesitas (Terkonfirmasi / Tidak Terkonfirmasi)
- **Status Kehamilan** — hanya muncul untuk pasien perempuan

---

## Tips dan Trik

### Pintasan Keyboard

- **Tab** — berpindah antar field di form intake
- **Enter** — konfirmasi pemilihan dari dropdown
- **Esc** — tutup panel saran diagnosis

### Efisiensi Kerja

1. **Gunakan AutoComplete+** untuk merangkai gejala lebih cepat daripada mengetik ulang.
2. **Periksa ringkasan pasien** sebelum membuat diagnosis — data TTV dan riwayat sering memberikan petunjuk penting.
3. **Manfaatkan Forward to Doctor** untuk kasus yang memerlukan second opinion tanpa harus meninggalkan halaman RME.

---

## Pemecahan Masalah

### Sidepanel tidak terbuka

- Pastikan Anda berada di halaman ePuskesmas yang didukung.
- Coba muat ulang (refresh) halaman ePuskesmas.
- Pastikan ekstensi diaktifkan di `chrome://extensions/`.

### Data pasien tidak muncul

- Pastikan halaman RME pasien sudah sepenuhnya dimuat.
- Klik tombol **Refresh** di sidepanel jika tersedia.
- Periksa koneksi internet Anda.

### Login gagal

- Pastikan kredensial Dashboard Sentra Anda benar.
- Hubungi admin jika akun Anda terkunci.

### Saran diagnosis tidak muncul

- Pastikan kolom **Keluhan Utama** sudah diisi.
- Periksa apakah fitur AI diagnosis aktif (hubungi admin IT).

---

## FAQ

**Q: Apakah Sentra Assist menyimpan data pasien?**  
A: Tidak. Sentra Assist membaca data dari halaman RME yang sedang aktif dan tidak menyimpan data pasien secara permanen di perangkat Anda.

**Q: Bisakah saya menggunakan Sentra Assist di perangkat seluler?**  
A: Saat ini Sentra Assist tersedia sebagai ekstensi desktop untuk Chrome dan Firefox.

**Q: Apakah saran diagnosis dari AI bisa dipercaya?**  
A: Saran diagnosis adalah **bantuan klinis**, bukan pengganti pertimbangan tenaga medis. Selalu verifikasi diagnosis berdasarkan pemeriksaan fisik dan klinis Anda.

**Q: Bagaimana cara melaporkan bug atau masalah?**  
A: Hubungi tim IT atau admin Sentra di fasilitas Anda.

**Q: Apakah saya perlu training khusus untuk menggunakan Sentra Assist?**  
A: Tidak. Antarmuka Sentra Assist dirancang intuitif. Panduan ini sudah mencakup semua fitur utama.

---

_Terakhir diperbarui: 16 April 2026_
