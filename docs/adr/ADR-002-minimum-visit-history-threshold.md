# ADR-002: Minimum Visit History Threshold

## Status

Accepted

## Context

Clinical trajectory membutuhkan histori yang cukup agar pola kunjungan sebelumnya masih bermakna. Histori yang terlalu sedikit berisiko menghasilkan interpretasi yang menyesatkan.

## Decision

Gunakan aturan:

- target histori: 5 kunjungan
- minimum usable: 3 kunjungan
- jika histori hanya 1-2 kunjungan, status menjadi `insufficient`

## Consequences

### Positif

- mencegah overclaim dari histori yang terlalu dangkal
- membuat fallback lebih eksplisit
- mudah dijelaskan ke pengguna klinis

### Negatif

- beberapa pasien tidak akan mendapat trajectory walau ada histori parsial

## UI / Runtime Effect

- `prefetchedVisitHistory.status = ready | insufficient`
- trajectory menampilkan `Data not available` bila histori < 3
