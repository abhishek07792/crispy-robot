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
        // Dark navy primary palette
        navy: {
          950: '#020B18',
          900: '#040F1E',
          850: '#071425',
          800: '#0A1929',
          700: '#0D2137',
          600: '#122845',
          500: '#1A3A5C',
          400: '#2557A7',
          300: '#7894B8',
          200: '#A8BCD4',
        },
        // Accent - cybersecurity teal/cyan
        accent: {
          50: '#E0F9FF',
          100: '#B3F0FF',
          200: '#66DDFF',
          300: '#19CAFF',
          400: '#00B8F5',
          500: '#0099D6',
          600: '#007AB0',
          700: '#005C8A',
        },
        // Risk tiers
        critical: { DEFAULT: '#FF2D55', dark: '#CC1A3A' },
        high: { DEFAULT: '#FF6B35', dark: '#CC4A1A' },
        medium: { DEFAULT: '#FFB800', dark: '#CC9200' },
        low: { DEFAULT: '#34C759', dark: '#1E8432' },
        info: { DEFAULT: '#007AFF', dark: '#0056CC' },
        verify: { DEFAULT: '#AF52DE', dark: '#7B2CAA' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': "url('/grid.svg')",
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
}
