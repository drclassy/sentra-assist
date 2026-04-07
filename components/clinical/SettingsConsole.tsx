// Designed and constructed by Claudesy.

import { getAuthConfig, probeApiBaseUrl, saveAuthConfig } from '@/lib/api/auth-client'
import { getBridgeConfig, isBridgeReady, saveBridgeConfig } from '@/lib/api/bridge-client'
import { Bell, Database, Moon, RotateCcw, Save, Settings, Shield, Wifi } from 'lucide-react'
import React, { useEffect, useState } from 'react'

interface SettingItem {
  id: string
  label: string
  description: string
  enabled: boolean
}

const STORAGE_KEY = 'sentra-assist:settings'
const DEFAULT_WORKSPACE_URL = 'https://kotakediri.epuskesmas.id'
const DEFAULT_API_BASE_URL = 'https://crew.puskesmasbalowerti.com'

const DEFAULT_SETTINGS: SettingItem[] = [
  {
    id: 'auto-fill',
    label: 'Auto-fill EMR',
    description: 'Automatically fill ePuskesmas forms',
    enabled: true,
  },
  {
    id: 'alerts',
    label: 'Emergency Alerts',
    description: 'Show critical condition warnings',
    enabled: true,
  },
  {
    id: 'bridge',
    label: 'Dashboard Sync',
    description: 'Sync with Sentra Intelligence',
    enabled: true,
  },
  {
    id: 'sounds',
    label: 'Sound Notifications',
    description: 'Play sounds for alerts',
    enabled: false,
  },
  { id: 'dark-mode', label: 'Dark Mode', description: 'Use dark color scheme', enabled: true },
  {
    id: 'telemetry',
    label: 'Usage Analytics',
    description: 'Send anonymous usage data',
    enabled: false,
  },
]

function loadPersistedSettings(): {
  toggles: Record<string, boolean>
  workspaceUrl: string
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { toggles: Record<string, boolean>; workspaceUrl: string }
  } catch {
    return null
  }
}

export function SettingsConsole(): JSX.Element {
  const [settings, setSettings] = useState<SettingItem[]>(() => {
    const persisted = loadPersistedSettings()
    if (!persisted) return DEFAULT_SETTINGS
    return DEFAULT_SETTINGS.map((s) => ({
      ...s,
      enabled: persisted.toggles[s.id] ?? s.enabled,
    }))
  })

  const [workspaceUrl, setWorkspaceUrl] = useState<string>(() => {
    return loadPersistedSettings()?.workspaceUrl ?? DEFAULT_WORKSPACE_URL
  })
  const [authBaseUrl, setAuthBaseUrl] = useState(DEFAULT_API_BASE_URL)

  const [apiKey, setApiKey] = useState('••••••••••••••••')
  const [saved, setSaved] = useState(false)
  const [bridgeRuntimeStatus, setBridgeRuntimeStatus] = useState<
    'ready' | 'disabled' | 'auth_required' | 'error' | 'unknown'
  >('unknown')
  const [apiProbeStatus, setApiProbeStatus] = useState<{
    tone: 'neutral' | 'success' | 'error'
    text: string
  }>({
    tone: 'neutral',
    text: 'Belum dites',
  })
  const [isApiProbeLoading, setIsApiProbeLoading] = useState(false)

  // Expose workspaceUrl for other modules via localStorage
  useEffect(() => {
    localStorage.setItem('sentra-assist:workspaceUrl', workspaceUrl)
  }, [workspaceUrl])

  useEffect(() => {
    const syncBridgeRuntimeState = async (): Promise<void> => {
      try {
        const config = await getBridgeConfig()
        setSettings((prev) =>
          prev.map((item) => (item.id === 'bridge' ? { ...item, enabled: config.enabled } : item))
        )
        if (!config.enabled) {
          setBridgeRuntimeStatus('disabled')
          return
        }
        const ready = await isBridgeReady()
        setBridgeRuntimeStatus(ready ? 'ready' : 'auth_required')
      } catch {
        setBridgeRuntimeStatus('error')
      }
    }

    void syncBridgeRuntimeState()
  }, [])

  useEffect(() => {
    const syncAuthConfig = async (): Promise<void> => {
      try {
        const authConfig = await getAuthConfig()
        setAuthBaseUrl(authConfig.baseUrl || DEFAULT_API_BASE_URL)
      } catch {
        setAuthBaseUrl(DEFAULT_API_BASE_URL)
      }
    }
    void syncAuthConfig()
  }, [])

  const toggleSetting = (id: string) => {
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)))
  }

  const handleSave = async () => {
    const payload = {
      toggles: Object.fromEntries(settings.map((s) => [s.id, s.enabled])),
      workspaceUrl,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))

    const bridgeEnabled = settings.find((item) => item.id === 'bridge')?.enabled ?? true
    try {
      await saveAuthConfig({ baseUrl: authBaseUrl.trim() || DEFAULT_API_BASE_URL })
      await saveBridgeConfig({ enabled: bridgeEnabled })
      if (!bridgeEnabled) {
        setBridgeRuntimeStatus('disabled')
      } else {
        const ready = await isBridgeReady()
        setBridgeRuntimeStatus(ready ? 'ready' : 'auth_required')
      }
    } catch {
      setBridgeRuntimeStatus('error')
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    setSettings(DEFAULT_SETTINGS)
    setWorkspaceUrl(DEFAULT_WORKSPACE_URL)
    setAuthBaseUrl(DEFAULT_API_BASE_URL)
    setApiKey('••••••••••••••••')
    localStorage.removeItem(STORAGE_KEY)
    try {
      await saveAuthConfig({ baseUrl: DEFAULT_API_BASE_URL })
      const bridgeEnabled = DEFAULT_SETTINGS.find((item) => item.id === 'bridge')?.enabled ?? true
      await saveBridgeConfig({ enabled: bridgeEnabled })
      if (!bridgeEnabled) {
        setBridgeRuntimeStatus('disabled')
      } else {
        const ready = await isBridgeReady()
        setBridgeRuntimeStatus(ready ? 'ready' : 'auth_required')
      }
    } catch {
      setBridgeRuntimeStatus('error')
    }
    setApiProbeStatus({ tone: 'neutral', text: 'Belum dites' })
  }

  const handleTestApiBaseUrl = async () => {
    setIsApiProbeLoading(true)
    try {
      const result = await probeApiBaseUrl(authBaseUrl)
      setApiProbeStatus({
        tone: result.ok ? 'success' : 'error',
        text: result.message,
      })
    } finally {
      setIsApiProbeLoading(false)
    }
  }

  const bridgeRuntimeStatusLabel: Record<typeof bridgeRuntimeStatus, string> = {
    unknown: 'Runtime: loading',
    ready: 'Runtime: ready',
    disabled: 'Runtime: disabled',
    auth_required: 'Runtime: auth required',
    error: 'Runtime: error',
  }

  const settingIcons: Record<string, React.ReactNode> = {
    'auto-fill': <Database className="w-3.5 h-3.5" />,
    alerts: <Bell className="w-3.5 h-3.5" />,
    bridge: <Wifi className="w-3.5 h-3.5" />,
    sounds: <Bell className="w-3.5 h-3.5" />,
    'dark-mode': <Moon className="w-3.5 h-3.5" />,
    telemetry: <Shield className="w-3.5 h-3.5" />,
  }

  return (
    <div className="flex flex-col gap-4 p-4 fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-4 h-4 text-[#6B9B8A]" />
        <h2 className="text-sm font-semibold text-gray-200">Pengaturan</h2>
      </div>

      {/* Workspace Configuration */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Workspace
        </label>

        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">ePuskesmas URL</label>
            <input
              type="text"
              value={workspaceUrl}
              onChange={(e) => setWorkspaceUrl(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F1012] rounded-lg text-xs text-gray-200
                         shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.02)]
                         border-none outline-none placeholder:text-gray-600
                         focus:ring-1 focus:ring-[#6B9B8A]/30 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F1012] rounded-lg text-xs text-gray-200
                         shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.02)]
                         border-none outline-none placeholder:text-gray-600
                         focus:ring-1 focus:ring-[#6B9B8A]/30 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">Crew API Base URL</label>
            <input
              type="text"
              value={authBaseUrl}
              onChange={(e) => setAuthBaseUrl(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F1012] rounded-lg text-xs text-gray-200
                         shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.02)]
                         border-none outline-none placeholder:text-gray-600
                         focus:ring-1 focus:ring-[#6B9B8A]/30 transition-all"
              placeholder="https://crew.example.com"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleTestApiBaseUrl()}
                disabled={isApiProbeLoading}
                className="px-2.5 py-1.5 bg-[#0F1012] rounded-md text-[10px] text-gray-300
                           shadow-[3px_3px_6px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.03)]
                           hover:text-white transition-all duration-200 disabled:opacity-50"
              >
                {isApiProbeLoading ? 'Testing...' : 'Test API'}
              </button>
              <span
                className={`text-[10px] ${
                  apiProbeStatus.tone === 'success'
                    ? 'text-[#6B9B8A]'
                    : apiProbeStatus.tone === 'error'
                      ? 'text-[#ef4444]'
                      : 'text-gray-500'
                }`}
              >
                {apiProbeStatus.text}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Settings */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Features
        </label>
        <div className="space-y-2">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between p-2.5 bg-[#0F1012] rounded-lg
                         shadow-[3px_3px_6px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.03)]
                         hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.02)]
                         transition-all duration-200"
            >
              <div className="flex items-center gap-2.5">
                <div className="text-gray-500">{settingIcons[setting.id]}</div>
                <div>
                  <span className="text-xs text-gray-300 block">{setting.label}</span>
                  <span className="text-[10px] text-gray-500">{setting.description}</span>
                  {setting.id === 'bridge' ? (
                    <span className="text-[10px] text-[#6B9B8A]">
                      {bridgeRuntimeStatusLabel[bridgeRuntimeStatus]}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                onClick={() => toggleSetting(setting.id)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200
                           ${setting.enabled ? 'bg-[#6B9B8A]' : 'bg-gray-700'}
                           shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md
                             transition-transform duration-200
                             ${setting.enabled ? 'translate-x-4.5 left-0.5' : 'left-0.5'}`}
                  style={{ transform: setting.enabled ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSave}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium
                     shadow-[3px_3px_6px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.03)]
                     transition-all duration-200
                     ${
                       saved
                         ? 'bg-[#6B9B8A]/20 text-[#6B9B8A] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                         : 'bg-[#0F1012] text-gray-300 hover:text-white hover:shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                     }`}
        >
          <Save className="w-3.5 h-3.5" />
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0F1012] rounded-lg
                     text-xs font-medium text-gray-400
                     shadow-[3px_3px_6px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.03)]
                     hover:text-gray-200 hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.02)]
                     transition-all duration-200"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Version Info */}
      <div className="mt-auto pt-3 border-t border-[#1a1a1a]">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>Sentra Assist v2.1.0</span>
          <span>Build 2024.12.15</span>
        </div>
      </div>
    </div>
  )
}
