/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: '#050508',
        surface: '#0d0d14',
        panel: '#12121e',
        border: '#1e1e30',
        accent: '#6ee7f7',
        accentDim: '#3a9ab0',
        warning: '#f7c96e',
        danger: '#f76e6e',
        success: '#6ef7a8',
        muted: '#4a4a6a',
        text: '#c8c8e8',
        textDim: '#7a7a9a',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Space Mono"', 'monospace'],
        body: ['"DM Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(110,231,247,0.15)',
        glowStrong: '0 0 40px rgba(110,231,247,0.3)',
        panel: '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
