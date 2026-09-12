/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eef6ff',
          100: '#dbeeff',
          200: '#bfddff',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554',
          950: '#0f172a',
        },

        cyan: {
          50:  '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },

        slate: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },

        /* ✅ SUCCESS (مكمل) */
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },

        /* ✅ WARNING (مكمل) */
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },

        /* ✅ DANGER (المهم هنا) */
        danger: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },

        medical: {
          bg:          '#f0f5fb',
          card:        '#ffffff',
          border:      '#e2eaf4',
          sidebar:     '#0b1e40',
          sidebarDeep: '#060f22',
          sidebarText: '#8daecf',
          accent:      '#0ea5e9',
        },
      },

      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },

      boxShadow: {
        'card':       '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        'card-hover': '0 4px 12px rgba(15,23,42,0.10), 0 2px 4px rgba(15,23,42,0.06)',
        'modal':      '0 20px 60px rgba(15,23,42,0.25)',
        'sidebar':    '4px 0 20px rgba(6,15,34,0.25)',
        'glow-blue':  '0 0 20px rgba(37,99,235,0.35)',
        'glow-cyan':  '0 0 20px rgba(6,182,212,0.35)',
        'inner-md':   'inset 0 2px 6px rgba(15,23,42,0.06)',
      },

      backgroundImage: {
        'gradient-medical':  'linear-gradient(135deg, #1d4ed8 0%, #0891b2 100%)',
        'gradient-sidebar':  'linear-gradient(180deg, #0b1e40 0%, #060f22 100%)',
        'gradient-card':     'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        'dot-pattern':       'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
      },

      backgroundSize: {
        'dot-sm': '16px 16px',
      },

      animation: {
        'fade-in':        'fadeIn 0.3s ease-out',
        'slide-up':       'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft':     'pulseSoft 2s ease-in-out infinite',
        'shimmer':        'shimmer 1.5s infinite',
      },

      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
