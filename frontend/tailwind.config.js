import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        'xs': '375px',  // iPhone SE 2nd gen
      },
      colors: {
        // Semantic mappings to CSS variables
        background: 'var(--color-bg-base)',
        foreground: 'var(--color-text-default)',

        card: {
          DEFAULT: 'var(--color-bg-muted)',
          foreground: 'var(--color-text-default)',
        },

        popover: {
          DEFAULT: 'var(--color-bg-subtle)',
          foreground: 'var(--color-text-default)',
        },

        primary: {
          DEFAULT: 'var(--color-accent-600)',
          foreground: '#FFFFFF',
        },

        secondary: {
          DEFAULT: 'var(--color-bg-muted)',
          foreground: 'var(--color-text-default)',
        },

        muted: {
          DEFAULT: 'var(--color-bg-subtle)',
          foreground: 'var(--color-text-muted)',
        },

        accent: {
          DEFAULT: 'var(--color-accent-600)',
          foreground: '#FFFFFF',
          50: 'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
        },

        destructive: {
          DEFAULT: 'var(--color-error-600)',
          foreground: '#FFFFFF',
        },

        success: {
          DEFAULT: 'var(--color-success-600)',
          foreground: '#FFFFFF',
        },

        warning: {
          DEFAULT: 'var(--color-warning-600)',
          foreground: '#FFFFFF',
        },

        info: {
          DEFAULT: 'var(--color-info-600)',
          foreground: '#FFFFFF',
        },

        border: 'var(--color-border-default)',
        input: 'var(--color-border-default)',
        ring: 'var(--color-accent-600)',

        highlight: {
          DEFAULT: 'var(--color-highlight-bg)',
          border: 'var(--color-highlight-border)',
          active: 'var(--color-highlight-active)',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Crimson Text', 'serif'],
        mono: ['Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      minHeight: {
        'screen-minus-nav': 'calc(100vh - 4rem)',
      }
    },
  },
  plugins: [
    plugin(function({ addVariant }) {
      addVariant('sepia-theme', '.sepia &');
    }),
    plugin(function({ addUtilities }) {
      addUtilities({
        // Safe area utilities for iOS notch/home indicator
        '.pt-safe': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.pl-safe': {
          paddingLeft: 'env(safe-area-inset-left)',
        },
        '.pr-safe': {
          paddingRight: 'env(safe-area-inset-right)',
        },
        '.mt-safe': {
          marginTop: 'env(safe-area-inset-top)',
        },
        '.mb-safe': {
          marginBottom: 'env(safe-area-inset-bottom)',
        },
        // Touch target utility (minimum 44px)
        '.touch-target': {
          minWidth: '44px',
          minHeight: '44px',
        },
      });
    }),
  ],
  darkMode: ['class', '[data-theme="dark"]'],
}