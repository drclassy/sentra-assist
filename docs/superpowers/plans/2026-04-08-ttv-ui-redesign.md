# TTVInferenceUI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 6 focused visual changes to TTVInferenceUI and SidePanelHeader — width, vitals grid layout, autocomplete consolidation, female indicator cleanup, action button sequence, and a new status bar.

**Architecture:** Pure UI/layout changes only. No data flow or logic changes. All logic props already exist — we add 3 new props to SidePanelHeader and 1 to TTVInferenceUI for new UI elements, and wire them in main.tsx.

**Tech Stack:** React 18, TypeScript strict, Vitest, Tailwind CSS + scoped CSS modules in style.css/globals.css

---

## File Map

| File | Role |
|------|------|
| `entrypoints/sidepanel/style.css` | CSS: fix `max-width` for width change |
| `components/clinical/TTVInferenceUI.tsx` | JSX: vitals grid, autocomplete, female indicators, action buttons |
| `components/sidepanel/SidePanelHeader.tsx` | JSX+props: new status bar component |
| `entrypoints/sidepanel/main.tsx` | Wire new props to SidePanelHeader and TTVInferenceUI |
| `components/clinical/TTVInferenceUI.test.tsx` | Tests for pink removal + autocomplete position |

---

## Task 1: Sidepanel Width — 400px → 440px

**Files:**
- Modify: `entrypoints/sidepanel/style.css:1173`

- [ ] **Step 1: Find all 400px constraints in style.css**

```bash
grep -n "max-width: 400px\|max-width:400px" entrypoints/sidepanel/style.css
```

Expected output includes line 1173 (`.sentra-card`) and possibly lines 627, 137.

- [ ] **Step 2: Update `.sentra-card` max-width**

In `entrypoints/sidepanel/style.css` at line 1173, change:
```css
/* BEFORE */
max-width: 400px;

/* AFTER */
max-width: 440px;
```

- [ ] **Step 3: Update any other 400px card constraints found in Step 1**

For each occurrence at other lines (627, 137, etc.):
```css
/* BEFORE */
max-width: 400px;

/* AFTER */
max-width: 440px;
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/style.css
git commit -m "style(sidepanel): widen panel max-width 400px → 440px"
```

---

## Task 2: Vital Signs Grid Restructure

**Files:**
- Modify: `components/clinical/TTVInferenceUI.tsx:2257-2312`

Current layout is a generic map over all vitals in a uniform grid. New layout: 3 explicit rows (2-col tensi, 3-col nadi/suhu/gula, 2-col pernafasan/saturasi). Each cell: `flex; label left; value flex:1 text-center`.

- [ ] **Step 1: Replace the vitals-grid JSX (lines 2257–2312)**

Replace the entire `<div className={`vitals-grid ...`}>...</div>` block with:

```tsx
<div className={`vitals-grid vitals-grid--redesign ${isGhostFillAnimating ? 'vitals-grid--ghosting' : ''}`}>
  {/* Row 1 — Tensi (2-col, teal highlight) */}
  <div className="vitals-row vitals-row--2col vitals-row--tensi">
    <div className={getVitalGhostItemClassName('bp')}>
      <span className="vital-label-inline">Sistolik</span>
      <input
        type="text"
        className="vital-input vital-input--centered"
        placeholder="---"
        value={displayedVitalValue('sbp')}
        onChange={(event) => updateField('sbp', event.target.value)}
        aria-label="Sistolik"
        disabled={isGhostFillAnimating}
      />
    </div>
    <div className={getVitalGhostItemClassName('bp')}>
      <span className="vital-label-inline">Diastolik</span>
      <input
        type="text"
        className="vital-input vital-input--centered"
        placeholder="---"
        value={displayedVitalValue('dbp')}
        onChange={(event) => updateField('dbp', event.target.value)}
        aria-label="Diastolik"
        disabled={isGhostFillAnimating}
      />
    </div>
  </div>

  {/* Row 2 — Nadi / Suhu / Gula (3-col) */}
  <div className="vitals-row vitals-row--3col">
    {[
      { key: 'hr' as const, label: 'Nadi', lane: 'hr' as const },
      { key: 'temp' as const, label: 'Suhu', lane: 'temp' as const },
      { key: 'glucose' as const, label: 'Gula', lane: 'glucose' as const },
    ].map((item) => (
      <div key={item.key} className={getVitalGhostItemClassName(item.lane)}>
        <span className="vital-label-inline">{item.label}</span>
        <input
          type="text"
          className="vital-input vital-input--centered"
          placeholder="---"
          value={displayedVitalValue(item.key)}
          onChange={(event) => updateField(item.key, event.target.value)}
          aria-label={item.label}
          disabled={isGhostFillAnimating}
        />
      </div>
    ))}
  </div>

  {/* Row 3 — Pernafasan / Saturasi O2 (2-col) */}
  <div className="vitals-row vitals-row--2col">
    {[
      { key: 'rr' as const, label: 'Pernafasan', lane: 'rr' as const },
      { key: 'spo2' as const, label: 'Saturasi O₂', lane: 'spo2' as const },
    ].map((item) => (
      <div key={item.key} className={getVitalGhostItemClassName(item.lane)}>
        <span className="vital-label-inline">{item.label}</span>
        <input
          type="text"
          className="vital-input vital-input--centered"
          placeholder="---"
          value={displayedVitalValue(item.key)}
          onChange={(event) => updateField(item.key, event.target.value)}
          aria-label={item.label}
          disabled={isGhostFillAnimating}
        />
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Add CSS for new vitals grid classes**

In `entrypoints/sidepanel/style.css`, append after the existing `.vitals-grid` rules:

```css
/* Redesigned vitals grid — mixed column layout */
.vitals-grid--redesign {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.vitals-row {
  display: grid;
  gap: 5px;
}

.vitals-row--2col {
  grid-template-columns: 1fr 1fr;
}

.vitals-row--3col {
  grid-template-columns: 1fr 1fr 1fr;
}

.vitals-row--tensi > div {
  border-color: rgba(107, 155, 138, 0.3) !important;
}

/* Cell layout: label left, value centered in remaining space */
.vitals-grid--redesign .vital-ghost-item,
.vitals-grid--redesign [class*="vital-ghost-item"] {
  display: flex;
  align-items: center;
  padding: 7px 10px;
}

.vital-label-inline {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-muted, #737373);
  white-space: nowrap;
  flex-shrink: 0;
}

.vital-input--centered {
  flex: 1;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-main, #F4EFE6);
}

.vitals-row--tensi .vital-input--centered {
  font-size: 15px;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/clinical/TTVInferenceUI.tsx entrypoints/sidepanel/style.css
git commit -m "style(ttv): redesign vitals grid — 2/3/2 col layout, label-left value-center"
```

---

## Task 3: AutoComplete Button — Consolidate and Move Down

**Files:**
- Modify: `components/clinical/TTVInferenceUI.tsx` (lines ~1920 and ~2245)

There are 2 AutoComplete+ buttons: one in the anamnesis section header (~1920) and one in the vitals section header (~2245). Remove both from section headers. Add one compact full-width button after all input fields, before the doctor picker section.

- [ ] **Step 1: Remove the vitals section AutoComplete button (lines ~2245–2255)**

Find this block:
```tsx
<button
  type="button"
  onClick={handleAnalyzeVitals}
  disabled={isAnalyzingVitals || isCanonicalLoading}
  className="engine-btn engine-btn--autocomplete rounded-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
  aria-label="Jalankan AutoComplete+ Vital Sign"
>
  <span>
    {isAnalyzingVitals || isCanonicalLoading ? 'Processing...' : 'AutoComplete+'}
  </span>
</button>
```

Delete it. Keep the surrounding `<div className="form-group-header">` and its title only.

- [ ] **Step 2: Remove the anamnesis section AutoComplete button (lines ~1920–1930)**

Find this block:
```tsx
<button type="button"
  className={`engine-btn engine-btn--autocomplete rounded-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${hasSymptomDraftPending ? 'engine-btn--pulse' : ''}`}
  onClick={handleAnalyze}
  aria-label="Jalankan AutoComplete+"
  disabled={isAnalyzing}>
  <span className={hasSymptomDraftPending ? 'engine-btn__text--pulse' : ''}>
    {isAnalyzing ? 'Processing...' : 'AutoComplete+'}
  </span>
</button>
```

Delete it.

- [ ] **Step 3: Add single AutoComplete button after all input fields, before doctor picker**

Find the doctor picker section start (look for `<div className="doctor-picker-panel"` or the section that contains "Pilih dokter online terlebih dahulu"). Insert this block BEFORE it:

```tsx
{/* AutoComplete — single consolidated button, bottom of form */}
<div className="autocomplete-bar">
  <button
    type="button"
    onClick={() => {
      void handleAnalyze()
      void handleAnalyzeVitals()
    }}
    disabled={isAnalyzing || isAnalyzingVitals || isCanonicalLoading}
    className="autocomplete-bar__btn engine-btn--autocomplete disabled:cursor-not-allowed disabled:opacity-50"
    aria-label="Jalankan AutoComplete+"
  >
    <span>
      {isAnalyzing || isAnalyzingVitals || isCanonicalLoading
        ? 'Processing...'
        : '✨ AutoComplete+ — Isi otomatis dari konteks'}
    </span>
  </button>
</div>
```

- [ ] **Step 4: Add CSS for autocomplete-bar**

In `entrypoints/sidepanel/style.css`, append:

```css
.autocomplete-bar {
  padding: 8px 0 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.autocomplete-bar__btn {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(107, 155, 138, 0.08);
  border: 1px solid rgba(107, 155, 138, 0.25);
  color: #6B9B8A;
  cursor: pointer;
  text-align: center;
}

.autocomplete-bar__btn:hover:not(:disabled) {
  background: rgba(107, 155, 138, 0.14);
}
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/clinical/TTVInferenceUI.tsx entrypoints/sidepanel/style.css
git commit -m "style(ttv): consolidate AutoComplete to single button at bottom of form"
```

---

## Task 4: Remove Pink Female Indicators → Neutral "Mohon diisi"

**Files:**
- Modify: `components/clinical/TTVInferenceUI.tsx` (lines ~2008–2065)
- Modify: `entrypoints/sidepanel/style.css` (lines ~2423, ~2447, ~2458–2466, ~3237–3253)

- [ ] **Step 1: Write a test for absence of pink indicators**

In `components/clinical/TTVInferenceUI.test.tsx`, add:

```ts
import { render, screen } from '@testing-library/react'
import { TTVInferenceUI } from './TTVInferenceUI'

it('shows neutral "Mohon diisi" for female patient with empty pregnancy status, no pink text', () => {
  render(
    <TTVInferenceUI
      patientGender="P"
      ttvState={{ ...DEFAULT_STATE, pregnancyStatus: null }}
    />
  )
  // Should have neutral placeholder, not pink warning
  expect(screen.queryByText(/wajib/i)).toBeNull()
  expect(screen.queryByText(/pilih hamil atau tidak hamil/i)).toBeNull()
  expect(screen.getByText('Mohon diisi')).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- components/clinical/TTVInferenceUI.test.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — "Mohon diisi" not found.

- [ ] **Step 3: Replace pink indicator JSX in TTVInferenceUI.tsx**

Find (around line 2008) the pregnancy status form-group section. Replace the indicator spans:

```tsx
{/* BEFORE — multiple pink indicators */}
{isFemalePatient ? (
  extractedPregnancyRisk ? (
    <span className="field-extracted-indicator">risiko terdeteksi</span>
  ) : isPregnancyStatusRequired ? (
    <span className="field-required-indicator">wajib</span>
  ) : null
) : null}
```

```tsx
{/* AFTER — single neutral indicator */}
{isFemalePatient && !extractedPregnancyRisk && !state.pregnancyStatus ? (
  <span className="field-placeholder-hint">Mohon diisi</span>
) : null}
```

Also find and remove the pink context note (around line 2058):
```tsx
{/* REMOVE THIS BLOCK */}
{isFemalePatient ? (
  extractedPregnancyRisk ? (
    <div className="field-context-note">RME: {extractedPregnancyRisk}</div>
  ) : isPregnancyStatusRequired ? (
    <div className="field-context-note field-context-note--required">
      Pilih hamil atau tidak hamil
    </div>
  ) : null
) : null}
```

Replace with:
```tsx
{isFemalePatient && extractedPregnancyRisk ? (
  <div className="field-context-note">RME: {extractedPregnancyRisk}</div>
) : null}
```

Also remove `pregnancy-select--required` class from the select element (line ~2039):
```tsx
{/* BEFORE */}
className={`neu-select field-summary-prominent select-prominent ${
  isPregnancyStatusRequired ? 'pregnancy-select--required' : ''
}`}

{/* AFTER */}
className="neu-select field-summary-prominent select-prominent"
```

- [ ] **Step 4: Add neutral hint CSS, remove pink CSS**

In `entrypoints/sidepanel/style.css`:

**Add:**
```css
.field-placeholder-hint {
  font-size: 10px;
  font-style: italic;
  color: var(--text-muted, #737373);
}
```

**Remove or comment out** these pink rules (find by line numbers from Step 1 grep):
- `.field-required-indicator { color: rgba(244, 114, 182, ...) }` → delete or set `display: none`
- `.field-context-note--required { color: ... pink ... }` → delete
- `.pregnancy-select--required { ... animation: sentra-pink-breathe ... }` → delete
- `@keyframes sentra-pink-breathe { ... }` → delete

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test -- components/clinical/TTVInferenceUI.test.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/clinical/TTVInferenceUI.tsx entrypoints/sidepanel/style.css components/clinical/TTVInferenceUI.test.tsx
git commit -m "style(ttv): replace pink female indicators with neutral 'Mohon diisi' hint"
```

---

## Task 5: Action Buttons — Sequential Sentra Uplink → Kirim Dokter

**Files:**
- Modify: `components/clinical/TTVInferenceUI.tsx` (lines ~2527–2537, props interface ~line 110)
- Modify: `entrypoints/sidepanel/main.tsx` (wire `onSentraUplink` prop)

- [ ] **Step 1: Add `onSentraUplink` prop to TTVInferenceUIProps**

In `TTVInferenceUIProps` interface (line 110), add:
```ts
onSentraUplink?: () => void | Promise<void>
```

- [ ] **Step 2: Add `uplinkDone` state inside TTVInferenceUI component**

Inside the component function body (near other `useState` calls), add:
```ts
const [uplinkDone, setUplinkDone] = React.useState(false)

const handleSentraUplink = React.useCallback(async () => {
  if (!props.onSentraUplink) return
  await props.onSentraUplink()
  setUplinkDone(true)
}, [props.onSentraUplink])
```

Note: destructure `onSentraUplink` from props at the component signature (line ~989):
```ts
}: TTVInferenceUIProps): JSX.Element {
```
Add `onSentraUplink` to the destructured props at line 989.

- [ ] **Step 3: Replace action-bar JSX (lines ~2527–2537)**

```tsx
{/* BEFORE */}
<div className="action-bar">
  <button
    type="button"
    className="btn btn-secondary flex flex-1 items-center justify-center gap-2"
    onClick={() => void handleForwardToDoctor()}
    disabled={!canForwardToDoctor}
  >
    <SendHorizontal className={`h-4 w-4 ${isSendingConsult ? 'animate-pulse' : ''}`} />
    Forward to Doctor
  </button>
</div>
```

```tsx
{/* AFTER */}
<div className="action-bar action-bar--sequential">
  <button
    type="button"
    className="action-btn action-btn--primary"
    onClick={() => void handleSentraUplink()}
    disabled={!onSentraUplink}
    aria-label="Sentra Uplink — isi RME otomatis"
  >
    📡 Sentra Uplink →
  </button>
  <span className="action-bar__sep" aria-hidden="true">›</span>
  <button
    type="button"
    className={`action-btn action-btn--secondary ${!uplinkDone ? 'action-btn--disabled' : ''}`}
    onClick={() => void handleForwardToDoctor()}
    disabled={!canForwardToDoctor || !uplinkDone}
    aria-label="Kirim konsultasi ke dokter"
  >
    → Kirim Dokter
  </button>
</div>
{!uplinkDone && onSentraUplink ? (
  <p className="action-bar__hint">Selesaikan Uplink untuk mengaktifkan Kirim Dokter</p>
) : null}
```

- [ ] **Step 4: Add CSS for sequential action bar**

In `entrypoints/sidepanel/style.css`, append:

```css
.action-bar--sequential {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  flex: 1;
  padding: 8px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: opacity 0.15s;
}

.action-btn--primary {
  background: rgba(107, 155, 138, 0.12);
  border: 1px solid rgba(107, 155, 138, 0.45);
  color: #6B9B8A;
}

.action-btn--secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #b7ab98;
}

.action-btn--disabled,
.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.action-bar__sep {
  color: #444;
  font-size: 16px;
  flex-shrink: 0;
  user-select: none;
}

.action-bar__hint {
  font-size: 9px;
  color: #555;
  text-align: center;
  margin-top: 4px;
}
```

- [ ] **Step 5: Wire `onSentraUplink` in main.tsx**

In `entrypoints/sidepanel/main.tsx`, find where `<TTVInferenceUI ... />` is rendered. Add the prop:

```tsx
onSentraUplink={async () => {
  await sendMessage('transferRME', {
    source: 'ttv',
    patientRM: patientData?.rm,
  })
}}
```

Import `sendMessage` if not already imported:
```ts
import { sendMessage } from '~/utils/messaging'
```

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add components/clinical/TTVInferenceUI.tsx entrypoints/sidepanel/main.tsx entrypoints/sidepanel/style.css
git commit -m "feat(ttv): add sequential Sentra Uplink → Kirim Dokter action flow"
```

---

## Task 6: Status Bar in SidePanelHeader

**Files:**
- Modify: `components/sidepanel/SidePanelHeader.tsx` (add 3 props + new JSX block)
- Modify: `entrypoints/sidepanel/main.tsx` (pass new props)
- Modify: `entrypoints/sidepanel/style.css` (status bar CSS)

- [ ] **Step 1: Add 3 new props to `SidePanelHeaderProps` interface (line 28)**

```ts
interface SidePanelHeaderProps {
  // ... existing props ...
  doctorOnlineCount?: number       // 0 = Offline, >0 = Online
  onInitialisasi?: () => void      // reset + reload RME data
}
```

(`demographicStatus` prop already exists — reuse it: `'syncing'|'standby'` = SYN, `'ready'` = OK)

- [ ] **Step 2: Destructure new props in component signature (line 47)**

```ts
export const SidePanelHeader: React.FC<SidePanelHeaderProps> = ({
  // ... existing destructures ...
  doctorOnlineCount = 0,
  onInitialisasi,
}) => {
```

- [ ] **Step 3: Add derived state for status bar**

After the existing `const statusLabel = ...` line, add:

```ts
const demogReady = demographicStatus === 'ready'
const doctorOnline = (doctorOnlineCount ?? 0) > 0
```

- [ ] **Step 4: Add status bar JSX above the engine-row (before line 125)**

Insert this block between `</div> {/* end header-top */}` and `<div className="engine-row engine-tablist"`:

```tsx
{/* Status bar — Inisialisasi | Demograf | Dokter */}
<div className="status-bar" role="group" aria-label="Status sistem">
  <button
    type="button"
    className="status-chip status-chip--action"
    onClick={onInitialisasi}
    disabled={!onInitialisasi}
    aria-label="Inisialisasi — reset dan muat ulang data RME"
  >
    <span className="status-chip__icon" aria-hidden="true">🔄</span>
    <span className="status-chip__label">Inisialisasi</span>
  </button>

  <div
    className={`status-chip ${demogReady ? 'status-chip--ready' : 'status-chip--syn'}`}
    aria-label={`Demografi: ${demogReady ? 'Siap' : 'Sinkronisasi'}`}
    role="status"
  >
    <span className="status-chip__icon status-chip__icon--text">
      {demogReady ? 'OK' : 'SYN'}
    </span>
    <span className="status-chip__label">Demograf</span>
  </div>

  <div
    className={`status-chip ${doctorOnline ? 'status-chip--ready' : 'status-chip--offline'}`}
    aria-label={`Dokter: ${doctorOnline ? 'Online' : 'Offline'}`}
    role="status"
  >
    <span className="status-chip__icon status-chip__icon--text">
      {doctorOnline ? 'ON' : 'OFF'}
    </span>
    <span className="status-chip__label">Dokter</span>
  </div>
</div>
```

- [ ] **Step 5: Add status bar CSS**

In `entrypoints/sidepanel/style.css`, append:

```css
/* Status bar */
.status-bar {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 5px;
  padding: 6px 0 2px;
}

.status-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 5px;
  background: #161616;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: default;
  user-select: none;
}

.status-chip--action {
  cursor: pointer;
}

.status-chip--action:hover:not(:disabled) {
  background: #1e1e1e;
}

.status-chip--ready {
  background: rgba(107, 155, 138, 0.08);
  border-color: rgba(107, 155, 138, 0.35);
}

.status-chip--syn {
  border-color: rgba(184, 134, 11, 0.4);
}

.status-chip--offline {
  border-color: rgba(204, 85, 85, 0.4);
}

.status-chip__icon {
  font-size: 13px;
  flex-shrink: 0;
  line-height: 1;
}

.status-chip__icon--text {
  font-size: 10px;
  font-weight: 700;
}

.status-chip--ready .status-chip__icon--text {
  color: #6B9B8A;
}

.status-chip--syn .status-chip__icon--text {
  color: #b8860b;
}

.status-chip--offline .status-chip__icon--text {
  color: #cc5555;
}

.status-chip__label {
  font-size: 8.5px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #888;
}

.status-chip--ready .status-chip__label {
  color: rgba(107, 155, 138, 0.7);
}
```

- [ ] **Step 6: Wire new props in main.tsx**

Find `<SidePanelHeader ... />` in `entrypoints/sidepanel/main.tsx`. Add:

```tsx
doctorOnlineCount={onlineDoctors?.length ?? 0}
onInitialisasi={() => {
  // Reset patient data and trigger re-scan
  setPatientData(null)
  setClinicalContext(null)
  void refreshPatientData()
}}
```

Note: `onlineDoctors`, `setPatientData`, `setClinicalContext`, `refreshPatientData` — use whatever state variables already exist in main.tsx for doctor list and patient refresh. Check the existing code for exact names before wiring.

- [ ] **Step 7: Typecheck**

```bash
pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add components/sidepanel/SidePanelHeader.tsx entrypoints/sidepanel/main.tsx entrypoints/sidepanel/style.css
git commit -m "feat(header): add status bar — Inisialisasi, Demograf state, Dokter state"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
pnpm test 2>&1 | tail -30
```
Expected: all passing, no regressions.

- [ ] **Run typecheck**

```bash
pnpm typecheck
```
Expected: 0 errors.

- [ ] **Manual smoke check**
  - Sidepanel ≥440px wide
  - Vitals grid shows 3 rows (2/3/2), label left, value center, tensi row has teal border
  - Single AutoComplete button at bottom of form
  - No pink text for female patient with empty pregnancy field — shows "Mohon diisi" italic gray
  - `[Sentra Uplink →] › [→ Kirim Dokter]` layout, Kirim Dokter disabled initially
  - Status bar visible above VS/Emergency/Settings tabs
