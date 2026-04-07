// Designed and constructed by Claudesy.

import React, { useState } from 'react';
import { AlertTriangle, Heart, Brain, Droplets, Wind, Activity } from 'lucide-react';

interface EmergencyAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  icon: React.ReactNode;
}

export function EmergencyConsole(): JSX.Element {
  const [activeAlerts] = useState<EmergencyAlert[]>([
    {
      id: '1',
      type: 'critical',
      title: 'Hypertensive Crisis',
      message: 'BP >180/120 - Immediate intervention required',
      icon: <Activity className="w-4 h-4" />,
    },
    {
      id: '2',
      type: 'warning',
      title: 'Occult Shock Risk',
      message: 'Lactate elevated, monitor for deterioration',
      icon: <Droplets className="w-4 h-4" />,
    },
  ]);

  const getAlertStyles = (type: EmergencyAlert['type']) => {
    switch (type) {
      case 'critical':
        return {
          border: 'border-red-500/50',
          bg: 'bg-red-500/10',
          icon: 'text-red-500',
          glow: 'shadow-[0_0_10px_rgba(239,68,68,0.3)]',
        };
      case 'warning':
        return {
          border: 'border-amber-500/50',
          bg: 'bg-amber-500/10',
          icon: 'text-amber-500',
          glow: 'shadow-[0_0_10px_rgba(245,158,11,0.3)]',
        };
      default:
        return {
          border: 'border-blue-500/50',
          bg: 'bg-blue-500/10',
          icon: 'text-blue-500',
          glow: 'shadow-[0_0_10px_rgba(59,130,246,0.3)]',
        };
    }
  };

  const emergencyActions = [
    { id: 'htn', label: 'HTN Crisis', icon: <Activity className="w-3.5 h-3.5" />, color: 'text-red-400' },
    { id: 'hypo', label: 'Hypoglycemia', icon: <Droplets className="w-3.5 h-3.5" />, color: 'text-amber-400' },
    { id: 'shock', label: 'Occult Shock', icon: <Wind className="w-3.5 h-3.5" />, color: 'text-orange-400' },
    { id: 'stroke', label: 'Stroke Code', icon: <Brain className="w-3.5 h-3.5" />, color: 'text-purple-400' },
    { id: 'cardiac', label: 'Cardiac', icon: <Heart className="w-3.5 h-3.5" />, color: 'text-rose-400' },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <h2 className="text-sm font-semibold text-gray-200">Emergency Detection</h2>
      </div>

      {/* Active Alerts Section */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Active Alerts ({activeAlerts.length})
        </label>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {activeAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-[#0F1012] flex items-center justify-center mb-2
                              shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.02)]">
                <Activity className="w-5 h-5 text-[#10B981]" />
              </div>
              <span className="text-xs text-gray-500">No active alerts</span>
              <span className="text-[10px] text-gray-600">Patient vitals within normal range</span>
            </div>
          ) : (
            activeAlerts.map((alert) => {
              const styles = getAlertStyles(alert.type);
              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${styles.border} ${styles.bg} ${styles.glow}
                              shadow-[3px_3px_6px_rgba(0,0,0,0.3),-1px_-1px_3px_rgba(255,255,255,0.02)]`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 ${styles.icon}`}>{alert.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-200">{alert.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium uppercase
                                         ${alert.type === 'critical' ? 'bg-red-500/20 text-red-400' : 
                                           alert.type === 'warning' ? 'bg-amber-500/20 text-amber-400' : 
                                           'bg-blue-500/20 text-blue-400'}`}>
                          {alert.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{alert.message}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Quick Actions</label>
        <div className="grid grid-cols-3 gap-2">
          {emergencyActions.map((action) => (
            <button
              key={action.id}
              className="flex flex-col items-center gap-1.5 p-2.5 bg-[#0F1012] rounded-lg
                         shadow-[3px_3px_6px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.03)]
                         hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.02)]
                         active:scale-[0.98]
                         transition-all duration-200"
            >
              <span className={action.color}>{action.icon}</span>
              <span className="text-[10px] text-gray-400 text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Detection Status */}
      <div className="p-3 bg-[#0F1012] rounded-lg border border-[#1a1a1a]
                      shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Auto-Detection</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10B981] pulse-green" />
            <span className="text-[10px] text-[#10B981] font-medium">Active</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[#1a1a1a]">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-500">Last Scan</span>
            <span className="text-gray-400 font-mono">2s ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
