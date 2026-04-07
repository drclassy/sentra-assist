// Designed and constructed by Claudesy.
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { fontFamily } = require('tailwindcss/defaultTheme')

module.exports = {
  content: ['./entrypoints/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Carbon Surface Theme — Ghost Protocols
        carbon: {
          50: '#f0f0f0',
          100: '#d9d9d9',
          200: '#bfbfbf',
          300: '#8c8c8c',
          400: '#595959',
          500: '#34343e', // surface-hover
          600: '#2e2e38', // surface-elevated
          700: '#2e2e36', // carbon-700
          800: '#22222a', // surface-secondary
          900: '#1a1b1c', // surface-primary
          950: '#101012', // deep void
        },
        // Warm Neutral Text Palette
        platinum: '#f4efe6',
        cream: '#dcd7cc',
        muted: '#c0bbb2',
        // Accent: Pulse Red-Orange — Sentra brand
        pulse: {
          400: '#ff5722',
          500: '#ff4500',
          600: '#e53935',
        },
        // Status Colors (Medical)
        status: {
          safe: '#22c55e',
          warning: '#f59e0b',
          critical: '#ef4444',
          info: '#3b82f6',
        },
        // Sentra Dark Theme — New Design
        sentra: {
          bg: '#050505',
          card: '#0F1012',
          border: '#1a1a1a',
          green: '#10B981',
          'green-dark': '#059669',
          muted: '#6B7280',
        },
        // A.C.E. bridge palette - isolated from legacy carbon scale to avoid regressions
        ace: {
          carbon: {
            700: '#0F1012',
            800: '#0A0A0C',
            900: '#050505',
          },
          platinum: '#F4EFE6',
          silver: '#737373',
          medical: '#10B981',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif', ...fontFamily.sans],
        heading: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        inter: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        // Realistic Carbon Shadows - Multi-layer depth
        carbon:
          '0 1px 1px rgba(0,0,0,0.3), 0 2px 2px rgba(0,0,0,0.25), 0 4px 4px rgba(0,0,0,0.2), 0 8px 8px rgba(0,0,0,0.15), 0 16px 16px rgba(0,0,0,0.1)',
        'carbon-sm':
          '0 1px 1px rgba(0,0,0,0.25), 0 2px 2px rgba(0,0,0,0.2), 0 4px 4px rgba(0,0,0,0.15)',
        'carbon-lg':
          '0 2px 2px rgba(0,0,0,0.3), 0 4px 4px rgba(0,0,0,0.25), 0 8px 8px rgba(0,0,0,0.2), 0 16px 16px rgba(0,0,0,0.15), 0 32px 32px rgba(0,0,0,0.1)',
        'carbon-inset': 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 2px rgba(255,255,255,0.03)',
        'carbon-pressed':
          'inset 0 3px 6px rgba(0,0,0,0.5), inset 0 -1px 1px rgba(255,255,255,0.02)',
        highlight: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        'glow-pulse': '0 0 20px rgba(255,69,0,0.4), 0 0 40px rgba(255,69,0,0.2)',
        // Neumorphic Shadows - Exact Specifications
        'neu-btn': '3px 3px 6px rgba(0,0,0,0.5), -1px -1px 3px rgba(255,255,255,0.03)',
        'neu-btn-hover': '4px 4px 8px rgba(0,0,0,0.6), -1px -1px 3px rgba(255,255,255,0.05)',
        'neu-btn-active': 'inset 2px 2px 4px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.02)',
        'neu-input': 'inset 2px 2px 4px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.02)',
        'neu-inset': 'inset 2px 2px 4px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.02)',
        'neu-card': '0 0 0 1px rgba(255,255,255,0.05), 0 20px 40px -10px rgba(0,0,0,0.8)',
        'glow-green': '0 0 10px rgba(16, 185, 129, 0.5), 0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-green-soft': '0 0 12px rgba(16, 185, 129, 0.2)',
        'top-glow': 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      borderColor: {
        glow: 'rgba(255, 255, 255, 0.12)',
        subtle: 'rgba(255, 255, 255, 0.06)',
        medical: '#10B981',
      },
      backgroundImage: {
        // Ghost Protocols carbon gradients
        'carbon-surface': 'linear-gradient(145deg, #22222a 0%, #1a1b1c 100%)',
        'carbon-card': 'linear-gradient(155deg, #24242a 0%, #202026 100%)',
        'carbon-raised': 'linear-gradient(145deg, #2a2a32 0%, #22222a 100%)',
        'carbon-pressed': 'linear-gradient(145deg, #1a1b1c 0%, #16161a 100%)',
        'pulse-gradient': 'linear-gradient(135deg, #ff4500 0%, #ff5722 50%, #e53935 100%)',
        'highlight-edge': 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 50%)',
        // Sentra Dark Theme Gradients
        'sentra-radial': 'radial-gradient(ellipse at center top, rgba(20, 20, 25, 0.8) 0%, transparent 70%)',
        'sentra-card': 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 10%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-green': 'pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-green': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 0 6px rgba(16, 185, 129, 0)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
