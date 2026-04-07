# TTVInferenceUI Redesign — Design Spec
**Date:** 2026-04-08  
**Scope:** TTVInferenceUI + SidePanelShell visual improvements  
**Status:** Approved by Chief

---

## Summary

5 perubahan visual terfokus pada TTVInferenceUI. Tidak ada perubahan logika/data flow — pure UI/layout. Consult Snapshot section dikecualikan dari scope ini.

---

## 1. Lebar Sidepanel

**Change:** `min-width` sidepanel shell dari ~400px → **440px**

**Where:** `entrypoints/sidepanel/style.css` — selector `.sentra-card` atau root shell container  
**Detail:** Tambah `+40px` horizontal space. Tidak mengubah Chrome extension manifest — sidepanel width diatur via CSS, user masih bisa resize manual.

---

## 2. Vital Signs Grid Layout

**Change:** Grid uniform 2-kolom diganti layout mixed berdasarkan pasangan klinis.

**Layout baru:**
```
Row 1 — 2 kolom, border teal highlight:
  [Sistolik]  [Diastolik]

Row 2 — 3 kolom:
  [Nadi]  [Suhu]  [Gula]

Row 3 — 2 kolom:
  [Pernafasan]  [Saturasi O₂]
```

**Cell anatomy:**  
Setiap cell: `display:flex; align-items:center`  
- Label: kiri, `font-size: 9px`, `text-transform: uppercase`, warna muted  
- Nilai: `flex:1; text-align:center`, `font-size: 14–15px`, `font-weight: 600`, warna parchment  

Row Tensi mendapat `border: 1px solid rgba(107,155,138,0.3)` — highlight teal subtle.

---

## 3. AutoComplete Buttons

**Change:** 2 tombol besar di atas form → 1 tombol compact di **bawah** semua field input.

**Before:** 2 tombol `AutoComplete+` dan `Quick Fill` di area paling atas, mendominasi visual dan mendorong field penting ke bawah.

**After:** 
- 1 tombol `✨ AutoComplete+ — Isi otomatis dari konteks`
- Full-width, style secondary/ghost
- Posisi: setelah semua input field, sebelum section Dokter Online
- Tombol kedua dihapus (duplikat)

---

## 4. Teks Indikator Pasien Perempuan

**Change:** Multiple warning text warna pink → satu teks netral `"Mohon diisi"`

**Before:** Beberapa baris teks `⚠ ...` warna `#ff69b4` / pink untuk field gender-specific (kehamilan, trimester, risiko).

**After:**
- Satu placeholder teks: `"Mohon diisi"`  
- Warna: `--text-muted` (`#737373`) — sama dengan placeholder field lain  
- Font style: italic  
- Tidak ada icon warning, tidak ada warna pink  
- Berlaku untuk SEMUA field kosong gender-specific, bukan hanya kehamilan

---

## 5. Action Buttons — Sentra Uplink & Kirim Dokter

**Change:** Tombol aksi setelah section Dokter Online diatur sequential dengan visual flow.

**Layout:**
```
[📡 Sentra Uplink →]  ›  [→ Kirim Dokter]
```

- **Horizontal side-by-side**, `flex:1` masing-masing
- Separator `›` di antara keduanya (warna muted)
- **Sentra Uplink** = primary style (border teal, bg teal-subtle)
- **Kirim Dokter** = disabled state sampai Uplink selesai (`opacity:0.4`, `cursor:not-allowed`, border abu-abu)
- Setelah Uplink berhasil → Kirim Dokter aktif (enabled)
- Helper text di bawah: `"Selesaikan Uplink untuk mengaktifkan Kirim Dokter"` — hilang setelah Uplink done

---

## Out of Scope

- **Consult Snapshot section** (BPJS/Penjamin, Penyakit Khusus, Risiko Kehamilan) — ditunda, tidak diubah
- Logic/data flow TTVInferenceUI — tidak ada perubahan
- Tab navigasi (VS / Emergency / Settings)
- ClinicalTrajectory, ClinicalDifferential

---

## Files yang Akan Diubah

| File | Perubahan |
|------|-----------|
| `entrypoints/sidepanel/style.css` | `min-width: 440px` pada shell/card container |
| `components/clinical/TTVInferenceUI.tsx` | Grid vitals, posisi AutoComplete, teks placeholder, tombol aksi |
| `entrypoints/sidepanel/globals.css` | (opsional) variable lebar jika ada CSS custom property |

---

## Acceptance Criteria

- [ ] Sidepanel minimum 440px lebar
- [ ] Vital signs tampil 3 row (2-col / 3-col / 2-col), label kiri angka tengah
- [ ] Row tensi punya border teal subtle
- [ ] AutoComplete hanya 1 tombol, posisi di bawah form
- [ ] Tidak ada teks/warna pink untuk pasien perempuan
- [ ] Field gender-specific kosong tampil "Mohon diisi" italic muted
- [ ] Tombol Kirim Dokter disabled sampai Sentra Uplink selesai
- [ ] Visual separator `›` antara dua tombol aksi
