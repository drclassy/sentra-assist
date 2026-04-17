// Designed and constructed by Claudesy.
import {
  evaluateCanonicalClinicalEngine,
  type CanonicalClinicalEngineOutput,
} from '@/lib/api/bridge-client';
import type {
  AutosenPreset,
  DisabilityType,
  ObesityConfirmation,
} from '@/lib/clinical/autosen-types';
import {
  buildCanonicalRequestId,
  buildCanonicalTriageInput,
} from '@/lib/clinical/canonical-triage-builder';
import {
  analyzeTrajectory,
  type ClinicalUrgencyTier,
  type GlobalDeteriorationState,
  type RiskLevel,
  type StabilityLabel,
  type TrajectoryAnalysis,
  type TrendDirection,
  type VitalTrend,
} from '@/lib/iskandar-diagnosis-engine/trajectory-analyzer';
import type { VisitRecord } from '@/lib/iskandar-diagnosis-engine/visit-history-store';
import { sendMessage } from '@/utils/messaging';
import React, { useEffect, useMemo, useState } from 'react';
import { CTHeader } from './CTHeader';
import { DosageCalculator } from './DosageCalculator';
import type { ScreeningAlert } from './TTVInferenceUI';

// Lazy import ApexCharts (default export typing vs React.lazy — align to ComponentType)
const Chart = React.lazy(() =>
  import('react-apexcharts').then((m) => ({
    default: m.default as React.ComponentType<Record<string, unknown>>,
  }))
);

/**
 * ClinicalTrajectoryProps interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface ClinicalTrajectoryProps {
  vitals: {
    sbp: number;
    dbp: number;
    hr: number;
    rr: number;
    temp: number;
    spo2: number;
    glucose: number;
  };
  keluhanUtama: string;
  keluhanTambahan?: string;
  narrative: {
    keluhan_utama: string;
    lama_sakit: string;
    is_akut: boolean;
    confidence: number;
  };
  alerts: ScreeningAlert[];
  patientAge: number;
  patientGender: 'L' | 'P';
  patientName: string;
  patientRM: string;
  patientDOB?: string;
  patientBPJSStatus?: 'aktif' | 'nonaktif' | 'mandiri' | null;
  patientKelurahan?: string;
  patientFacilityName?: string;
  patientPayerLabel?: string;
  allergies?: string[];
  pregnancyStatus?: boolean | null;
  chronicHistorySummary?: string;
  extractedPregnancyRisk?: string;
  extractedSpecialConditions?: string[];
  disabilityType?: DisabilityType;
  obesityConfirmation?: ObesityConfirmation;
  autosenPreset?: AutosenPreset;
  symptomTextRaw?: string;
  encounterId?: string;
  prefetchedVisits?: VisitRecord[];
  prefetchedDiagnostics?: string[];
  prefetchedVisitStatus?: 'ready' | 'insufficient';
  onBack: () => void;
  onNextDifferential?: (
    trajectory: TrajectoryAnalysis,
    visitCount: number,
    canonicalOutput: CanonicalClinicalEngineOutput | null
  ) => void;
}

type Phase = 'loading' | 'error' | 'ready';

// Visual mappings
const TREND_ICON: Record<TrendDirection, string> = {
  improving: '↗',
  declining: '↘',
  stable: '→',
  insufficient_data: '—',
};

const TREND_COLOR: Record<TrendDirection, string> = {
  improving: '#6B9B8A',
  declining: '#EF4444',
  stable: '#06B6D4',
  insufficient_data: '#6B7280',
};

const TREND_LABEL: Record<TrendDirection, string> = {
  improving: 'MEMBAIK',
  declining: 'MEMBURUK',
  stable: 'STABIL',
  insufficient_data: 'DATA KURANG',
};

const RISK_STYLE: Record<RiskLevel, { color: string; bg: string; border: string }> = {
  low: { color: '#6B9B8A', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  moderate: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  high: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  critical: { color: '#DC2626', bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.5)' },
};

const URGENCY_STYLE: Record<
  ClinicalUrgencyTier,
  { color: string; bg: string; border: string; label: string }
> = {
  low: {
    color: '#6B9B8A',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.35)',
    label: 'ROUTINE 24H',
  },
  moderate: {
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
    label: 'REVIEW SAME DAY',
  },
  high: {
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    label: 'URGENT <6H',
  },
  immediate: {
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.16)',
    border: 'rgba(220,38,38,0.5)',
    label: 'EMERGENCY NOW',
  },
};

const DETERIORATION_STYLE: Record<
  GlobalDeteriorationState,
  { color: string; bg: string; border: string; label: string }
> = {
  improving: {
    color: '#6B9B8A',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.35)',
    label: 'IMPROVING',
  },
  stable: {
    color: '#06B6D4',
    bg: 'rgba(6,182,212,0.12)',
    border: 'rgba(6,182,212,0.35)',
    label: 'STABLE',
  },
  deteriorating: {
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
    label: 'DETERIORATING',
  },
  critical: {
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.16)',
    border: 'rgba(220,38,38,0.5)',
    label: 'CRITICAL',
  },
};

const STABILITY_STYLE: Record<StabilityLabel, { label: string; color: string }> = {
  true_stable: { label: 'TRUE STABLE', color: '#6B9B8A' },
  pseudo_stable: { label: 'PSEUDO STABLE', color: '#F59E0B' },
  unstable: { label: 'UNSTABLE', color: '#EF4444' },
};

function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'moderate';
  return 'low';
}

// PAGE_BG_STYLE → .ct-neu-shell (style.css)
// PAGE_TOP_GLOW_STYLE → .ct-top-glow (style.css)

function humanizeToken(value: string): string {
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

export const ClinicalTrajectory: React.FC<ClinicalTrajectoryProps> = ({
  vitals,
  keluhanUtama,
  keluhanTambahan,
  alerts,
  patientAge,
  patientGender,
  patientName,
  patientRM,
  patientDOB,
  patientBPJSStatus,
  patientKelurahan,
  patientFacilityName,
  patientPayerLabel,
  allergies,
  pregnancyStatus,
  chronicHistorySummary,
  extractedPregnancyRisk,
  extractedSpecialConditions,
  disabilityType,
  obesityConfirmation,
  autosenPreset,
  symptomTextRaw,
  encounterId,
  prefetchedVisits,
  prefetchedDiagnostics,
  prefetchedVisitStatus,
  onBack,
  onNextDifferential,
}) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [analysis, setAnalysis] = useState<TrajectoryAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [visitCount, setVisitCount] = useState(0);
  const [scrapeLog, setScrapeLog] = useState<string[]>([]);
  const [canonicalOutput, setCanonicalOutput] = useState<CanonicalClinicalEngineOutput | null>(
    null
  );
  const [canonicalError, setCanonicalError] = useState('');
  const [isCanonicalLoading, setIsCanonicalLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadTrajectory = async () => {
      console.warn('[Trajectory] Loading visit history...');
      setPhase('loading');
      setCanonicalError('');
      setCanonicalOutput(null);
      setIsCanonicalLoading(true);

      try {
        if (prefetchedVisitStatus === 'insufficient') {
          const diagLines =
            prefetchedDiagnostics && prefetchedDiagnostics.length > 0
              ? prefetchedDiagnostics
              : ['INSUFFICIENT_HISTORY: kurang dari 3 kunjungan historis'];
          setScrapeLog(diagLines);
          setVisitCount(prefetchedVisits?.length ?? 0);
          setErrorMsg('Data not available');
          setPhase('error');
          setIsCanonicalLoading(false);
          return;
        }

        const result =
          prefetchedVisitStatus === 'ready' && prefetchedVisits && prefetchedDiagnostics
            ? {
                success: true,
                diagnostics: prefetchedDiagnostics,
                visits: prefetchedVisits.map((visit) => ({
                  encounter_id: visit.encounter_id,
                  date: visit.timestamp,
                  vitals: visit.vitals,
                  keluhan_utama: visit.keluhan_utama,
                  diagnosa: visit.diagnosa ?? null,
                })),
              }
            : await sendMessage('scanVisitHistory', undefined);
        if (cancelled) return;

        // Capture diagnostics
        const diagLines = result.diagnostics || [];
        if (result.error) {
          diagLines.unshift(`ERROR: ${result.error}`);
        }
        if (diagLines.length === 0) {
          diagLines.push('No diagnostics returned — pipeline may have failed silently');
        }
        setScrapeLog(diagLines);
        console.warn('[Trajectory] Diagnostics:\n' + diagLines.join('\n'));
        console.warn(`[Trajectory] RECV: ${result.visits?.length ?? 0} visits`);

        const pastVisits: VisitRecord[] = (result.visits || []).map((v) => ({
          patient_id: patientRM,
          encounter_id: v.encounter_id,
          timestamp: v.date,
          vitals: v.vitals,
          keluhan_utama: v.keluhan_utama,
          diagnosa: v.diagnosa || undefined,
          source: 'scrape' as const,
        }));

        const currentVisit: VisitRecord = {
          patient_id: patientRM,
          encounter_id: encounterId || `current-${Date.now()}`,
          timestamp: new Date().toISOString(),
          vitals,
          keluhan_utama: keluhanUtama,
          source: 'uplink',
        };

        const visitMap = new Map<string, VisitRecord>();
        for (const v of pastVisits) visitMap.set(v.encounter_id, v);
        visitMap.set(currentVisit.encounter_id, currentVisit);

        const allVisits = Array.from(visitMap.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        console.warn(`[Trajectory] Analyzing ${allVisits.length} unique visits`);
        setVisitCount(allVisits.length);

        const trajectoryAnalysis = analyzeTrajectory(allVisits);
        console.warn(
          `[Trajectory] ANALYZED: trend=${trajectoryAnalysis.overallTrend}, risk=${trajectoryAnalysis.overallRisk}`
        );

        setAnalysis(trajectoryAnalysis);
        setPhase('ready');

        const requestId = buildCanonicalRequestId(patientRM);
        const requestTime = new Date().toISOString();
        const canonicalInput = buildCanonicalTriageInput({
          requestId,
          requestTime,
          patientName,
          patientGender,
          patientAge,
          patientRM,
          patientDOB,
          patientBPJSStatus,
          patientKelurahan,
          patientFacilityName,
          patientPayerLabel,
          vitals,
          symptomTextRaw,
          keluhanUtama,
          keluhanTambahan,
          chronicHistorySummary,
          allergies,
          pregnancyStatus,
          extractedPregnancyRisk,
          extractedSpecialConditions,
          disabilityType,
          obesityConfirmation,
          autosenPreset,
          prefetchedVisits: pastVisits,
        });

        try {
          const canonical = await evaluateCanonicalClinicalEngine(canonicalInput);
          if (!cancelled) {
            setCanonicalOutput(canonical);
          }
        } catch (error) {
          if (!cancelled) {
            // Canonical engine optional — silent fallback, never expose API errors to UI
            console.warn(
              '[Trajectory] Canonical engine fallback to local:',
              error instanceof Error ? error.name : String(error)
            );
            setCanonicalError('');
          }
        } finally {
          if (!cancelled) {
            setIsCanonicalLoading(false);
          }
        }
      } catch (error) {
        if (cancelled) return;
        const errStr = error instanceof Error ? error.message : String(error);
        console.error('[Trajectory] Load error:', errStr);
        setErrorMsg(errStr);
        setScrapeLog((prev) => (prev.length > 0 ? prev : [`PIPELINE_ERROR: ${errStr}`]));
        setPhase('error');
        setIsCanonicalLoading(false);
      }
    };

    loadTrajectory();
    return () => {
      cancelled = true;
    };
  }, [
    patientRM,
    encounterId,
    vitals,
    keluhanUtama,
    prefetchedVisits,
    prefetchedDiagnostics,
    prefetchedVisitStatus,
    patientName,
    patientGender,
    patientAge,
    patientDOB,
    patientBPJSStatus,
    patientKelurahan,
    patientFacilityName,
    patientPayerLabel,
    allergies,
    pregnancyStatus,
    chronicHistorySummary,
    extractedPregnancyRisk,
    extractedSpecialConditions,
    disabilityType,
    obesityConfirmation,
    autosenPreset,
    symptomTextRaw,
    keluhanTambahan,
  ]);

  // Chart config with EXACT TTVInferenceUI aesthetic
  const chartConfig = useMemo(() => {
    if (!analysis) return null;

    const bpTrend = analysis.vitalTrends.find((t) => t.parameter === 'sbp');
    const dbpTrend = analysis.vitalTrends.find((t) => t.parameter === 'dbp');
    const hrTrend = analysis.vitalTrends.find((t) => t.parameter === 'hr');
    const rrTrend = analysis.vitalTrends.find((t) => t.parameter === 'rr');
    const spo2Trend = analysis.vitalTrends.find((t) => t.parameter === 'spo2');
    const tempTrend = analysis.vitalTrends.find((t) => t.parameter === 'temp');
    const glucoseTrend = analysis.vitalTrends.find((t) => t.parameter === 'glucose');

    if (!bpTrend || bpTrend.values.length === 0) return null;

    const series = [
      { name: 'SBP', data: bpTrend.values },
      { name: 'DBP', data: dbpTrend?.values || [] },
      { name: 'HR', data: hrTrend?.values || [] },
      { name: 'RR', data: rrTrend?.values || [] },
      { name: 'SpO2', data: spo2Trend?.values || [] },
      { name: 'Temp×10', data: (tempTrend?.values || []).map((v) => Math.round(v * 10)) },
      { name: 'GDS÷10', data: (glucoseTrend?.values || []).map((v) => Math.round(v / 10)) },
    ].filter((s) => s.data.length > 0);

    const options: ApexCharts.ApexOptions = {
      chart: {
        type: 'area',
        height: 220,
        background: 'transparent',
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: "'JetBrains Mono', monospace",
        animations: {
          enabled: true,
          speed: 800,
          animateGradually: { enabled: true, delay: 150 },
          dynamicAnimation: { enabled: true, speed: 350 },
        },
      },
      theme: { mode: 'dark' },
      colors: [
        '#FFCC8C', // SBP — amber
        'rgba(255,204,140,0.45)', // DBP — amber faint
        '#60A5FA', // HR — blue
        '#34D399', // RR — green
        '#A78BFA', // SpO2 — purple
        '#FB923C', // Temp×10 — orange
        '#F87171', // GDS÷10 — red
      ],
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: { opacityFrom: 0.25, opacityTo: 0.05, shadeIntensity: 1 },
      },
      xaxis: {
        categories: bpTrend.dates,
        labels: {
          style: {
            colors:
              getComputedStyle(document.documentElement)
                .getPropertyValue('--text-tertiary')
                .trim() || '#9a9aa2',
            fontSize: '9px',
            fontFamily: "'JetBrains Mono', monospace",
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: {
            colors:
              getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() ||
              '#c0bbb2',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
          },
        },
      },
      grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 },
      dataLabels: { enabled: false },
      tooltip: {
        theme: 'dark',
        style: { fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" },
        x: { show: true },
      },
      legend: {
        position: 'top',
        fontSize: '10px',
        labels: { colors: '#c0bbb2' },
        markers: { size: 4 },
      },
      annotations: {
        yaxis: [
          {
            y: 140,
            borderColor: 'rgba(239,68,68,0.3)',
            label: {
              text: 'HT',
              style: { color: '#EF4444', background: 'transparent', fontSize: '8px' },
            },
          },
        ],
      },
    };

    return { series, options };
  }, [analysis]);

  // Render: Loading
  if (phase === 'loading') {
    return (
      <div className="ct-neu-shell relative min-h-screen w-full p-5">
        <div
          className="ct-top-glow absolute top-0 left-0 right-0 h-40 pointer-events-none"
        />
        <CTHeader
          title="Sentra Assist"
          subtitle="Architected by dr Ferdi Iskandar"
          sectionLabel="Clinical Trajectory"
          meta="Analisis perjalanan klinis dan risiko perburukan pasien"
          onBack={onBack}
        />
        <div className="ttv-section p-8 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-3 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-small text-muted">Menganalisis riwayat kunjungan...</p>
        </div>
      </div>
    );
  }

  // Render: Error
  if (phase === 'error') {
    return (
      <div className="ct-neu-shell relative min-h-screen w-full p-5">
        <div
          className="ct-top-glow absolute top-0 left-0 right-0 h-40 pointer-events-none"
        />
        <CTHeader
          title="Sentra Assist"
          subtitle="Architected by dr Ferdi Iskandar"
          sectionLabel="Clinical Trajectory"
          meta="Analisis perjalanan klinis dan risiko perburukan pasien"
          onBack={onBack}
        />
        <div className="ttv-section p-6 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-critical/20 border border-critical/50 flex items-center justify-center">
            <span className="text-2xl text-critical">!</span>
          </div>
          <p className="text-small text-critical">{errorMsg || 'Gagal memuat data trajectory'}</p>
          <button
            onClick={() => setPhase('loading')}
            className="neu-tab py-2 px-4 rounded-lg border border-[rgba(255,255,255,0.06)] text-small font-medium text-platinum cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
        {scrapeLog.length > 0 && (
          <div className="neu-card-inset mt-4 p-4">
            <div className="ttv-label mb-2 ct-warning-label">
              ERROR DIAGNOSTICS
            </div>
            {scrapeLog.map((line, i) => (
              <div key={i} className="text-tiny text-muted font-mono mb-1">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render: Ready
  if (!analysis) return null;

  const activeTrends = analysis.vitalTrends.filter(
    (t) => t.values.length > 0 && !t.values.every((v) => v === 0)
  );
  const canonicalTrajectory = canonicalOutput?.trajectory;
  const canonicalNews2 = canonicalOutput?.scoring.news2;
  const canonicalAlertCount = canonicalOutput?.alerts.length ?? 0;
  const canonicalImmediateActions = canonicalOutput?.recommendations.immediate_actions ?? [];
  const canonicalMonitoringActions = canonicalOutput?.recommendations.monitoring_actions ?? [];
  const canonicalReferralActions = canonicalOutput?.recommendations.referral_actions ?? [];
  const canonicalOverallTrend = canonicalTrajectory?.overall_trend
    ? TREND_LABEL[canonicalTrajectory.overall_trend]
    : 'TIDAK TERSEDIA';
  const canonicalOverallRisk = canonicalTrajectory?.overall_risk
    ? humanizeToken(canonicalTrajectory.overall_risk).toUpperCase()
    : 'TIDAK TERSEDIA';
  const canonicalDeteriorationState = canonicalTrajectory?.deterioration_state
    ? humanizeToken(canonicalTrajectory.deterioration_state).toUpperCase()
    : 'TIDAK TERSEDIA';
  const canonicalMomentum = canonicalTrajectory?.momentum_level
    ? humanizeToken(canonicalTrajectory.momentum_level).toUpperCase()
    : 'TIDAK TERSEDIA';
  const urgencyStyle = URGENCY_STYLE[analysis.mortality_proxy.clinical_urgency_tier];
  const acuteRiskCards = [
    { label: 'HT Crisis', value: analysis.acute_attack_risk_24h.hypertensive_crisis_risk },
    { label: 'Glycemic Crisis', value: analysis.acute_attack_risk_24h.glycemic_crisis_risk },
    {
      label: 'Sepsis-like',
      value: analysis.acute_attack_risk_24h.sepsis_like_deterioration_risk,
    },
    {
      label: 'Shock/Decomp',
      value: analysis.acute_attack_risk_24h.shock_decompensation_risk,
    },
    {
      label: 'Stroke/ACS Susp',
      value: analysis.acute_attack_risk_24h.stroke_acs_suspicion_risk,
    },
  ];
  const etaEntries = Object.entries(analysis.time_to_critical_estimate).filter(
    ([, value]) => value !== null
  );
  const deteriorationStyle = DETERIORATION_STYLE[analysis.global_deterioration.state];
  const stabilityStyle = STABILITY_STYLE[analysis.trajectory_volatility.stability_label];
  const highAcuteRiskCount = acuteRiskCards.filter((risk) => risk.value >= 60).length;
  const criticalEtaCount = etaEntries.filter(([, value]) => (value ?? 999) <= 24).length;
  const breachCards = [
    { label: 'SBP >= 160', count: analysis.early_warning_burden.breach_breakdown.sbp_ge_160_count },
    {
      label: 'TEMP >= 38.5',
      count: analysis.early_warning_burden.breach_breakdown.temp_ge_38_5_count,
    },
    { label: 'GDS >= 300', count: analysis.early_warning_burden.breach_breakdown.gds_ge_300_count },
    { label: 'HR ekstrem', count: analysis.early_warning_burden.breach_breakdown.hr_extreme_count },
    { label: 'RR ekstrem', count: analysis.early_warning_burden.breach_breakdown.rr_extreme_count },
  ];
  const activeBreaches = breachCards.filter((item) => item.count > 0);

  return (
    <div
      className="ct-neu-shell relative min-h-screen w-full p-5 flex flex-col gap-4"
    >
      <div
        className="ct-top-glow absolute top-0 left-0 right-0 h-40 pointer-events-none"
      />
      <CTHeader
        title="Sentra Assist"
        subtitle="Architected by dr Ferdi Iskandar"
        sectionLabel="Clinical Trajectory"
        meta="Analisis perjalanan klinis dan risiko perburukan pasien"
        onBack={onBack}
      />


      <div className="ttv-section p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="ttv-section-title mb-2">CANONICAL ENGINE</h3>
            <p className="text-small text-muted leading-relaxed">
              Dashboard engine menjadi source of truth. Analisis trajectory lokal di bawah tetap
              ditampilkan sebagai preview transisi agar workflow bedside tidak putus.
            </p>
          </div>
          <span
            className="ct-neu-chip"
            style={{
              '--ct-c': canonicalOutput ? 'var(--ct-green)' : canonicalError ? 'var(--ct-amber)' : 'var(--text-muted)',
              '--ct-bc': canonicalOutput ? 'var(--ct-green-border-strong)' : undefined,
            } as React.CSSProperties}
          >
            {isCanonicalLoading ? 'SYNCING' : canonicalOutput ? 'CANONICAL READY' : 'PREVIEW ONLY'}
          </span>
        </div>

        {isCanonicalLoading ? (
          <div className="text-small text-muted">Meminta hasil canonical dari dashboard...</div>
        ) : canonicalOutput ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="neu-card-inset p-3">
              <div className="ttv-label text-tertiary mb-1">NEWS2 Canonical</div>
              <div className="text-small font-mono text-platinum">
                {canonicalNews2
                  ? `${canonicalNews2.score} • ${canonicalNews2.risk_level.toUpperCase()}`
                  : 'Tidak tersedia'}
              </div>
            </div>
            <div className="neu-card-inset p-3">
              <div className="ttv-label text-tertiary mb-1">Alert Canonical</div>
              <div className="text-small font-mono text-platinum">{canonicalAlertCount} alert</div>
            </div>
            <div className="neu-card-inset p-3">
              <div className="ttv-label text-tertiary mb-1">Trend Canonical</div>
              <div className="text-small font-mono text-platinum">{canonicalOverallTrend}</div>
            </div>
            <div className="neu-card-inset p-3">
              <div className="ttv-label text-tertiary mb-1">Risk Canonical</div>
              <div className="text-small font-mono text-platinum">{canonicalOverallRisk}</div>
            </div>
            <div className="neu-card-inset p-3">
              <div className="ttv-label text-tertiary mb-1">Deterioration</div>
              <div className="text-small font-mono text-platinum">
                {canonicalDeteriorationState}
              </div>
            </div>
            <div className="neu-card-inset p-3">
              <div className="ttv-label text-tertiary mb-1">Momentum</div>
              <div className="text-small font-mono text-platinum">{canonicalMomentum}</div>
            </div>
            <div className="neu-card-inset p-3 col-span-2">
              <div className="ttv-label text-tertiary mb-1">Trajectory Canonical</div>
              <div className="text-small text-platinum leading-relaxed">
                {canonicalTrajectory?.available
                  ? canonicalTrajectory.narrative ||
                    'Trajectory canonical tersedia tanpa narasi tambahan.'
                  : 'Trajectory canonical belum tersedia untuk data kunjungan ini.'}
              </div>
              {canonicalImmediateActions.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-2">
                  {canonicalImmediateActions.slice(0, 3).map((item, index) => (
                    <span
                      key={`${item}-${index}`}
                      className="ct-neu-chip ct-neu-chip--muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {canonicalMonitoringActions.length > 0 ? (
              <div className="neu-card-inset p-3 col-span-2">
                <div className="ttv-label text-tertiary mb-2">Monitoring Actions</div>
                <div className="flex flex-wrap gap-1">
                  {canonicalMonitoringActions.slice(0, 3).map((item, index) => (
                    <span
                      key={`${item}-${index}`}
                      className="ct-neu-chip ct-neu-chip--muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {canonicalReferralActions.length > 0 ? (
              <div className="neu-card-inset p-3 col-span-2">
                <div className="ttv-label text-tertiary mb-2">Referral Actions</div>
                <div className="flex flex-wrap gap-1">
                  {canonicalReferralActions.slice(0, 3).map((item, index) => (
                    <span
                      key={`${item}-${index}`}
                      className="ct-neu-chip ct-neu-chip--muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="neu-card-inset p-3">
            <div className="text-small text-muted leading-relaxed">
              {canonicalError
                ? `Canonical engine belum tersedia: ${canonicalError}`
                : 'Canonical engine belum memberikan hasil. Preview lokal tetap ditampilkan untuk continuity UX.'}
            </div>
          </div>
        )}
      </div>

      {/* TREND VISUALIZATION - Moved to top */}
      {chartConfig && (
        <div className="ttv-section p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="ttv-section-title">TREND VITAL SIGNS (7 PARAMETER)</h3>
            <span
              className="ct-neu-chip ct-neu-chip--muted"
            >
              {visitCount} kunjungan
            </span>
          </div>
          <div className="rounded overflow-hidden">
            <React.Suspense
              fallback={<div className="text-small text-muted p-4">Memuat chart...</div>}
            >
              <Chart
                options={chartConfig.options}
                series={chartConfig.series}
                type="area"
                height={220}
              />
            </React.Suspense>
          </div>
        </div>
      )}

      {/* Screening Alerts */}
      {alerts.length > 0 && (
        <div className="ttv-section p-4">
          <h3 className="ttv-section-title mb-3">SCREENING ALERTS</h3>
          <div className="flex flex-col gap-2">
            {alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="neu-card-inset px-3 py-2 flex items-center gap-2 border-l-2 border-critical"
              >
                <span className="ttv-label text-critical">{alert.severity}</span>
                <span className="text-small text-platinum">{alert.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trajectory Status - Expanded */}
      <div className="ttv-section p-5">
        <div className="flex items-start gap-4 mb-4">
          <span className="ct-trend-icon" style={{ '--ct-c': TREND_COLOR[analysis.overallTrend] } as React.CSSProperties}>
            {TREND_ICON[analysis.overallTrend]}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="ct-neu-chip"
                style={{ '--ct-c': TREND_COLOR[analysis.overallTrend], '--ct-bc': TREND_COLOR[analysis.overallTrend] } as React.CSSProperties}
              >
                {TREND_LABEL[analysis.overallTrend]}
              </span>
              <span
                className="ct-neu-chip"
                style={{ '--ct-c': RISK_STYLE[analysis.overallRisk].color, '--ct-bg': RISK_STYLE[analysis.overallRisk].bg, '--ct-bc': RISK_STYLE[analysis.overallRisk].border } as React.CSSProperties}
              >
                {humanizeToken(analysis.overallRisk).toUpperCase()}
              </span>
            </div>
            <div className="text-body text-muted leading-relaxed">{analysis.summary}</div>
            <div className="text-tiny text-muted mt-2">
              Preview lokal untuk continuity UX. Severity canonical mengikuti hasil `CANONICAL
              ENGINE`.
            </div>
          </div>
        </div>

        {/* Analysis Detail Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="neu-card-inset p-3">
            <div className="ttv-label text-tertiary mb-1">Overall Trend</div>
            <div className="text-small font-mono text-platinum">
              {TREND_LABEL[analysis.overallTrend]}
            </div>
          </div>
          <div className="neu-card-inset p-3">
            <div className="ttv-label text-tertiary mb-1">Risk Level</div>
            <div
              className="ct-metric-value"
              style={{ '--ct-c': RISK_STYLE[analysis.overallRisk].color } as React.CSSProperties}
            >
              {humanizeToken(analysis.overallRisk).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Command Panel */}
      <div className="ttv-section p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="ttv-section-title mb-2">CLINICAL COMMAND PANEL (24H)</h3>
            <p className="text-small text-platinum mt-1">
              {analysis.clinical_safe_output.recommended_action}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="ct-neu-chip"
              style={{ '--ct-c': urgencyStyle.color, '--ct-bg': urgencyStyle.bg, '--ct-bc': urgencyStyle.border } as React.CSSProperties}
            >
              {urgencyStyle.label}
            </span>
            <span
              className="ct-neu-chip"
              style={{ '--ct-c': deteriorationStyle.color, '--ct-bg': deteriorationStyle.bg, '--ct-bc': deteriorationStyle.border } as React.CSSProperties}
            >
              {deteriorationStyle.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <MetricTile
            label="Deterioration Score"
            value={analysis.global_deterioration.deterioration_score}
            tone={scoreToRiskLevel(analysis.global_deterioration.deterioration_score)}
          />
          <MetricTile
            label="Mortality Proxy"
            value={analysis.mortality_proxy.mortality_proxy_score}
            tone={analysis.clinical_safe_output.risk_tier}
          />
          <MetricTile
            label="Clinical Confidence"
            value={`${(analysis.clinical_safe_output.confidence * 100).toFixed(0)}%`}
            tone="moderate"
          />
          <MetricTile
            label="Review Window"
            value={analysis.clinical_safe_output.review_window}
            tone="low"
          />
        </div>

        {analysis.clinical_safe_output.drivers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {analysis.clinical_safe_output.drivers.slice(0, 3).map((driver, i) => (
              <span
                key={i}
                className="ct-neu-chip ct-neu-chip--muted"
              >
                {humanizeToken(driver)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Progressive disclosure: acute risk matrix */}
      <details
        className="ttv-section p-4"
        open={analysis.overallRisk === 'high' || analysis.overallRisk === 'critical'}
      >
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-muted text-sm">▸</span>
              <h3 className="text-small font-bold text-platinum uppercase tracking-wide">
                ACUTE ATTACK RISK (24H)
              </h3>
            </div>
            <span className="ct-section-meta">
              high/critical: {highAcuteRiskCount}/5
            </span>
          </div>
        </summary>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {acuteRiskCards.map((risk) => {
            const level = scoreToRiskLevel(risk.value);
            const style = RISK_STYLE[level];
            return (
              <div key={risk.label} className="ct-neu-cell" style={{ '--ct-bc': style.border } as React.CSSProperties}>
                <div className="ct-neu-cell-label">{risk.label}</div>
                <div className="ct-metric-value" style={{ '--ct-c': style.color } as React.CSSProperties}>
                  {risk.value}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {/* Progressive disclosure: early warning, volatility, eta */}
      <details className="ttv-section p-4">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-muted text-sm">▸</span>
              <h3 className="text-small font-bold text-platinum uppercase tracking-wide">
                EARLY WARNING + VOLATILITY
              </h3>
            </div>
            <span className="ct-section-meta">
              breaches: {analysis.early_warning_burden.total_breaches_last5} | volatility:{' '}
              {analysis.trajectory_volatility.volatility_index}
            </span>
          </div>
        </summary>
        <div className="grid grid-cols-2 gap-2 mb-3 mt-3">
          <MetricTile
            label="Total Breaches (5 visits)"
            value={analysis.early_warning_burden.total_breaches_last5}
            tone={analysis.early_warning_burden.total_breaches_last5 >= 4 ? 'high' : 'moderate'}
          />
          <div className="neu-card-inset p-2.5">
            <div className="ttv-label text-tertiary">Stability Label</div>
            <div
              className="ct-metric-value"
              style={{ '--ct-c': stabilityStyle.color } as React.CSSProperties}
            >
              {stabilityStyle.label}
            </div>
          </div>
        </div>

        {activeBreaches.length > 0 && (
          <div className="mb-3">
            <div className="text-tiny font-bold text-muted uppercase tracking-wide mb-1">
              BREACH BREAKDOWN
            </div>
            <div className="flex flex-wrap gap-1">
              {activeBreaches.map((item) => (
                <span
                  key={item.label}
                  className="ct-neu-chip ct-neu-chip--muted"
                >
                  {item.label}: {item.count}
                </span>
              ))}
            </div>
          </div>
        )}

        {etaEntries.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-tiny font-bold text-muted uppercase tracking-wide">
                TIME-TO-CRITICAL ESTIMATE
              </div>
              <div className="text-tiny font-mono text-muted">within 24h: {criticalEtaCount}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {etaEntries.map(([key, value]) => (
                <span
                  key={key}
                  className="ct-neu-chip ct-neu-chip--muted"
                >
                  {humanizeToken(key.replace('_hours_to_critical', '')).toUpperCase()}: {value}h
                </span>
              ))}
            </div>
          </div>
        )}
      </details>

      {/* Progressive disclosure: explanatory data safety */}
      {(analysis.clinical_safe_output.missing_data.length > 0 ||
        analysis.clinical_safe_output.drivers.length > 0) && (
        <details className="ttv-section p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-muted text-sm">▸</span>
                <h3 className="text-small font-bold text-platinum uppercase tracking-wide">
                  RISK DRIVERS + DATA GAPS
                </h3>
              </div>
              <span className="ct-section-meta">
                drivers: {analysis.clinical_safe_output.drivers.length} | missing:{' '}
                {analysis.clinical_safe_output.missing_data.length}
              </span>
            </div>
          </summary>
          <div className="mt-3">
            {analysis.clinical_safe_output.drivers.length > 0 && (
              <div className="mb-3">
                <div className="text-tiny font-bold text-muted uppercase tracking-wide mb-1">
                  TOP DRIVERS
                </div>
                <div className="flex flex-col gap-1">
                  {analysis.clinical_safe_output.drivers.map((driver, i) => (
                    <div key={i} className="text-small text-muted">
                      • {humanizeToken(driver)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {analysis.clinical_safe_output.missing_data.length > 0 && (
              <div>
                <div
                  className="text-tiny font-bold uppercase tracking-wide mb-1 ct-warning-label"
                >
                  MISSING DATA
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.clinical_safe_output.missing_data.slice(0, 8).map((item, i) => (
                    <span
                      key={i}
                      className="ct-neu-chip ct-neu-chip--muted"
                    >
                      {humanizeToken(item)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Vital Trend Cards */}
      {activeTrends.length > 0 && (
        <div className="ttv-section p-4 mb-4">
          <h3 className="ttv-section-title mb-3">VITAL TRENDS</h3>
          <div className="flex flex-col gap-2">
            {activeTrends.map((trend) => (
              <TrendCard key={trend.parameter} trend={trend} />
            ))}
          </div>
        </div>
      )}

      {/* SenCal Medical Calculators */}
      <details className="mb-4">
        <summary className="ttv-section p-4 cursor-pointer list-none">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-muted text-sm">▸</span>
              <h3 className="text-small font-bold text-platinum uppercase tracking-wide">SenCal</h3>
            </div>
            <span className="ct-section-meta">
              kalkulator medis
            </span>
          </div>
        </summary>
        <div className="mt-0">
          <DosageCalculator patientAge={patientAge} patientWeight={undefined} />
        </div>
      </details>

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="ttv-section p-4">
          <h3 className="ttv-section-title mb-3">REKOMENDASI</h3>
          <div className="flex flex-col gap-2">
            {analysis.recommendations.map((rec, i) => (
              <div key={i} className="neu-card-inset px-3 py-2.5 flex items-start gap-2">
                <span
                  className={`ttv-label flex-shrink-0 mt-0.5 ct-priority--${rec.priority}`}
                >
                  {rec.priority}
                </span>
                <span className="ct-rec-text">
                  {rec.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scraper Diagnostics (only when ≤1 visit) */}
      {scrapeLog.length > 0 && visitCount <= 1 && (
        <div className="neu-card-inset p-4">
          <div className="ttv-label mb-2 ct-warning-label">
            SCRAPER DIAGNOSTICS
          </div>
          {scrapeLog.map((line, i) => (
            <div key={i} className="text-tiny text-muted font-mono mb-1">
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Next Step Flow */}
      {onNextDifferential && analysis && (
        <div className="neu-card-inset p-1.5 relative z-10">
          <button
            onClick={() => onNextDifferential(analysis, visitCount, canonicalOutput)}
            className="motion-press w-full py-2 px-2 rounded-lg text-body relative neu-tab text-muted font-medium hover:text-platinum transition-all flex items-center justify-center gap-2"
          >
            <span className="text-base">⚕</span>
            Differential Diagnosis
          </button>
        </div>
      )}
    </div>
  );
};

// Sub-components

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: RiskLevel;
}) {
  const toneStyle = RISK_STYLE[tone];
  const displayValue = typeof value === 'string' ? humanizeToken(value) : value;
  return (
    <div className="neu-card-inset p-2.5 ct-metric-tile" style={{ '--ct-bc': toneStyle.border } as React.CSSProperties}>
      <div className="ttv-label text-tertiary">{label}</div>
      <div className="ct-metric-value" style={{ '--ct-c': toneStyle.color } as React.CSSProperties}>
        {displayValue}
      </div>
    </div>
  );
}

function TrendCard({ trend }: { trend: VitalTrend }) {
  const riskStyle = RISK_STYLE[trend.risk];
  const trendColor = TREND_COLOR[trend.trend];

  return (
    <div className="neu-card-inset p-3 flex items-center gap-3">
      <div className="flex items-center gap-2 flex-1">
        <span
          className="ct-neu-chip"
          style={{ '--ct-c': trendColor, '--ct-bc': trendColor } as React.CSSProperties}
        >
          {TREND_ICON[trend.trend]} {trend.label}
        </span>
        <span
          className="ct-neu-chip"
          style={{ '--ct-c': riskStyle.color, '--ct-bg': riskStyle.bg, '--ct-bc': riskStyle.border } as React.CSSProperties}
        >
          {trend.risk.toUpperCase()}
        </span>
        <span className="text-small font-mono font-bold text-muted">
          {trend.changePercent > 0 ? '+' : ''}
          {trend.changePercent.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
