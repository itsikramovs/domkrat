import type { Config } from 'tailwindcss';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const animate = require('tailwindcss-animate');

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        hero: {
          DEFAULT: 'hsl(var(--hero))',
          foreground: 'hsl(var(--hero-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        sale: {
          DEFAULT: 'hsl(var(--sale))',
          foreground: 'hsl(var(--sale-foreground))',
        },
        hit: {
          DEFAULT: 'hsl(var(--hit))',
          foreground: 'hsl(var(--hit-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        // Мягкая многослойная тень для карточек (modern e-commerce depth)
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 2px 6px -1px rgb(15 23 42 / 0.06)',
        'card-hover': '0 10px 28px -8px rgb(15 23 42 / 0.16), 0 4px 10px -4px rgb(15 23 42 / 0.10)',
        elevated: '0 16px 40px -12px rgb(15 23 42 / 0.22)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, hsl(218 91% 56%), hsl(224 80% 45%))',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [animate],
};

export default config;
