# ADR-001: Direct RME Extraction First

## Status

Accepted

## Context

Awalnya ekstraksi riwayat penyakit terlalu bergantung pada tabel ICD dan scan text umum. Pada halaman RME nyata, `Penyakit Kronis` sering tampil sebagai field direct yang lebih akurat daripada tabel fallback.

## Decision

Sentra Assist menggunakan strategi `direct field first` untuk field klinis penting di RME.

Prioritas:

1. field direct berlabel jelas
2. row tabel / cell sebelah
3. fallback regex ringan atau text scan

## Consequences

### Positif

- akurasi extractor meningkat
- sinkronisasi ke UI lebih konsisten
- lebih tahan terhadap variasi tampilan tabel

### Negatif

- logic extractor lebih kompleks
- tetap bergantung pada kualitas label di DOM

## Scope Saat Ini

- `Penyakit Kronis`
- `Nama Faskes`
- `Penjamin / BPJS / Cara Bayar / Jaminan`
- `Penyakit Khusus`
- `Risiko Kehamilan`
- `Riwayat Alergi`
- `Status Kehamilan`
