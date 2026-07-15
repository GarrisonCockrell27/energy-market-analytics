/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        bull: {
          DEFAULT: '#22c55e',
          dim: '#14532d'
        },
        bear: {
          DEFAULT: '#ef4444',
          dim: '#450a0a'
        },
        signal: {
          DEFAULT: '#f59e0b',
          dim: '#451a03'
        },
        terminal: {
          bg: '#09090b',
          panel: '#0f1012',
          border: '#27272a',
          text: '#e4e4e7',
          muted: '#71717a'
        }
      }
    }
  },
  plugins: []
};
