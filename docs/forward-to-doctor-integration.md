# Forward to Doctor Integration

## Tujuan

Dokumen ini menjelaskan flow `Forward to Doctor` pada Sentra Assist side panel, kontrak presence dokter online, dan payload consult yang dikirim ke Crew Dashboard.

## Flow Ringkas

1. Perawat membuka halaman RME pasien di ePuskesmas.
2. Side panel Sentra Assist memuat:
   - identitas pasien
   - riwayat penyakit kronis
   - 3 sampai 5 kunjungan terakhir bila tersedia
3. Perawat mengisi keluhan dan vital signs.
4. Sentra Assist memanggil `GET /api/doctors/online`.
5. Crew Dashboard mengembalikan daftar dokter yang masih aktif berdasarkan presence.
6. Perawat memilih dokter tujuan pada kolom `Dokter Online`.
7. Perawat menekan tombol `Forward to Doctor`.
8. Sentra Assist mengirim `POST /api/consult`.
9. Crew Dashboard menyimpan consult, audit trail, dan meneruskan notifikasi/inbox ke dokter tujuan.

## Presence Dokter

Server menjadi sumber kebenaran status dokter.

### Rule Presence

- `online`: heartbeat terakhir masih dalam TTL aktif
- `busy`: online tetapi sedang menangani consult atau queue aktif
- `away`: masih terhubung tetapi idle melewati ambang ringan
- `offline`: tidak ada heartbeat aktif

### Rekomendasi TTL

- interval heartbeat client: 20 sampai 30 detik
- TTL online server: 60 detik

## Endpoint

### GET `/api/doctors/online`

Mengembalikan daftar dokter online yang bisa dipilih dari Sentra Assist.

#### Response

```json
{
  "ok": true,
  "doctors": [
    {
      "id": "doc_123",
      "name": "dr. Aulia",
      "role": "dokter",
      "poli": "Umum",
      "location_name": "Puskesmas Balowerti",
      "room_name": "Ruang Poli 1",
      "availability_status": "online",
      "last_seen_at": "2026-04-06T10:15:22.000Z"
    }
  ]
}
```

### POST `/api/consult`

Mengirim consult klinis dari perawat di Sentra Assist ke dokter tujuan.

#### Request

```json
{
  "patient": {
    "name": "Siti Aminah",
    "age": 54,
    "gender": "P",
    "rm": "RM-001",
    "dob": "12-03-1972",
    "bpjsStatus": "aktif",
    "kelurahan": "Balowerti"
  },
  "ttv": {
    "sbp": "180",
    "dbp": "110",
    "hr": "98",
    "rr": "22",
    "temp": "37.8",
    "spo2": "97",
    "glucose": "286"
  },
  "keluhan_utama": "Pusing sejak 2 hari",
  "risk_factors": ["CRITICAL • Krisis hipertensi perlu eksklusi emergensi"],
  "anthropometrics": {
    "tinggi": 0,
    "berat": 0,
    "imt": 0,
    "hasil_imt": "",
    "lingkar_perut": 0
  },
  "penyakit_kronis": ["HT", "DM"],
  "alergi": ["Debu"],
  "status_kehamilan": "tidak_diisi",
  "clinical_context": {
    "facility_name": "BALOWERTI",
    "special_conditions": ["Risiko tinggi anemia"],
    "pregnancy_risk": "KSPR belum terisi"
  },
  "target_doctor_id": "doc_123",
  "sent_at": "2026-04-06T10:20:00.000Z"
}
```

#### Response

```json
{
  "ok": true,
  "consultId": "consult_20260406_001"
}
```

## Catatan Frontend

- base URL default bridge: `https://crew.puskesmasbalowerti.com`
- auth untuk endpoint dashboard lintas-origin memakai `CREW_ACCESS_AUTOMATION_TOKEN` yang harus sama antara dashboard dan Sentra Assist
- sebelum submit, kolom `Dokter Online` menampilkan `Consult Snapshot` yang secara eksplisit merangkum:
  - `BPJS / Penjamin`
  - `Penyakit Khusus`
  - `Risiko Kehamilan`
- footer kecil pada panel `Dokter Online` sekarang bersifat collapsible dan dapat menampilkan:
  - `Riwayat Alergi`
  - `Penyakit Khusus`
  - `Risiko Kehamilan`
    untuk dokter tujuan yang sedang dipilih, bila data extractor tersedia
- daftar dokter online diurutkan dengan prioritas:
  1. `online`
  2. `busy`
  3. `away`
  4. `offline`
- setelah status, sorting frontend mempertimbangkan:
  1. kecocokan `poli`
  2. kecocokan `facility_name/location_name`
  3. nama dokter
- daftar dokter online sekarang menampilkan marker kecil agar ranking transparan:
  - `matched poli` jika poli dokter cocok dengan prioritas klinis pasien/preset
  - `same facility` jika lokasi dokter cocok dengan `Nama Faskes` yang dibaca dari RME
- bila tidak ada dokter online, kolom `Dokter Online` tetap tampil dan memberi pesan bahwa data belum tersedia
- extractor RME prioritas saat ini membaca blok direct seperti `Penyakit Kronis`, `Penyakit Khusus`, `Risiko Kehamilan`, dan `Nama Faskes` bila tersedia di halaman
- extractor context juga mencoba membaca `Penjamin`, `BPJS`, atau `Cara Bayar` untuk memperjelas `BPJS / Penjamin` pada consult snapshot
- extractor context juga mencoba membaca `Riwayat Alergi` dan `Status Kehamilan` bila field tersebut tampil tegas di halaman RME

## Catatan Klinis

- target histori kunjungan: 5
- minimum histori usable: 3
- bila histori kurang dari 3, trajectory ditandai `Data not available`
