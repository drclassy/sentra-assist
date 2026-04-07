// Designed and constructed by Claudesy.

import { 
  Type, 
  Monitor, 
  Cloud, 
  Construction, 
  Clock, 
  ArrowRight,
  Sparkles,
  Zap,
  Globe
} from 'lucide-react';

interface PlaceholderConsoleProps {
  engineType: 'sentratype' | 'movi' | 'uplink';
}

interface EngineConfig {
  title: string;
  subtitle?: string;
  icon: JSX.Element;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  description: string;
  features: Array<{ icon: JSX.Element; text: string }>;
  status: string;
  eta: string;
}

const engineConfigs: Record<PlaceholderConsoleProps['engineType'], EngineConfig> = {
  sentratype: {
    title: 'SentraType',
    icon: <Type className="w-5 h-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    glowColor: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]',
    description: 'AI-powered medical transcription and documentation',
    features: [
      { icon: <Sparkles className="w-3 h-3" />, text: 'Voice-to-text conversion' },
      { icon: <Zap className="w-3 h-3" />, text: 'Smart abbreviation expansion' },
      { icon: <Type className="w-3 h-3" />, text: 'Auto-formatting SOAP notes' },
    ],
    status: 'In Development',
    eta: 'Q1 2025',
  },
  movi: {
    title: 'MOVI',
    subtitle: 'Medical Observation & Vital Intelligence',
    icon: <Monitor className="w-5 h-5" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    glowColor: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]',
    description: 'Real-time patient monitoring and trend analysis',
    features: [
      { icon: <Monitor className="w-3 h-3" />, text: 'Continuous vital monitoring' },
      { icon: <Zap className="w-3 h-3" />, text: 'Predictive deterioration alerts' },
      { icon: <Sparkles className="w-3 h-3" />, text: 'Trend visualization' },
    ],
    status: 'Beta Testing',
    eta: 'Coming Soon',
  },
  uplink: {
    title: 'Uplink',
    icon: <Cloud className="w-5 h-5" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    glowColor: 'shadow-[0_0_15px_rgba(34,211,238,0.2)]',
    description: 'Cloud sync and multi-device collaboration',
    features: [
      { icon: <Globe className="w-3 h-3" />, text: 'Cross-device sync' },
      { icon: <Cloud className="w-3 h-3" />, text: 'Backup & restore' },
      { icon: <Zap className="w-3 h-3" />, text: 'Team collaboration' },
    ],
    status: 'Planning',
    eta: 'Q2 2025',
  },
};

export function PlaceholderConsole({ engineType }: PlaceholderConsoleProps): JSX.Element {
  const config = engineConfigs[engineType];

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center fade-in">
      {/* Icon Container */}
      <div className={`relative mb-4`}>
        <div className={`w-16 h-16 rounded-2xl ${config.bgColor} ${config.borderColor} border
                        flex items-center justify-center ${config.color}
                        shadow-[3px_3px_6px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.03)]
                        ${config.glowColor}`}>
          {config.icon}
        </div>
        {/* Animated ring */}
        <div className={`absolute inset-0 rounded-2xl ${config.borderColor} border-2 opacity-30
                        animate-ping`} style={{ animationDuration: '3s' }} />
      </div>

      {/* Title */}
      <h2 className={`text-lg font-semibold ${config.color} mb-1`}>
        {config.title}
      </h2>
      {config.subtitle && (
        <p className="text-[10px] text-gray-500 mb-3">{config.subtitle}</p>
      )}

      {/* Description */}
      <p className="text-xs text-gray-400 mb-4 max-w-[200px] leading-relaxed">
        {config.description}
      </p>

      {/* Features List */}
      <div className="w-full max-w-[220px] space-y-2 mb-5">
        {config.features.map((feature, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-2 bg-[#0F1012] rounded-lg
                       shadow-[3px_3px_6px_rgba(0,0,0,0.3),-1px_-1px_3px_rgba(255,255,255,0.02)]"
          >
            <span className={config.color}>{feature.icon}</span>
            <span className="text-[10px] text-gray-400">{feature.text}</span>
          </div>
        ))}
      </div>

      {/* Status Badge */}
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                      ${config.bgColor} border ${config.borderColor}`}>
        <Construction className={`w-3 h-3 ${config.color}`} />
        <span className={`text-[10px] font-medium ${config.color}`}>{config.status}</span>
      </div>

      {/* ETA */}
      <div className="flex items-center gap-1.5 mt-3 text-gray-500">
        <Clock className="w-3 h-3" />
        <span className="text-[10px]">{config.eta}</span>
      </div>

      {/* Notify Me Button */}
      <button
        className="mt-5 flex items-center gap-2 px-4 py-2 bg-[#0F1012] rounded-lg
                   text-xs font-medium text-gray-300
                   shadow-[3px_3px_6px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.03)]
                   hover:text-white hover:shadow-[0_0_10px_rgba(16,185,129,0.2)]
                   active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.02)]
                   transition-all duration-200 group"
      >
        Notify me when ready
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}
