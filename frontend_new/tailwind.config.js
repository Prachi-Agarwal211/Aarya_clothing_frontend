/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
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
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /**
         * AARYA Royal — matte black/grey + cool royal blue + white/beige text + gold
         * Research-aligned luxury fashion (navy + cream + black reads premium).
         */
        brand: {
          bg: '#0D0D0D',
          ink: '#111111',
          card: '#161616',
          surface: '#1C1C1C',
          elevated: '#252525',
          grey: '#2A2A2A',
          // Cool royal blue family
          royal: '#1E3A5F',
          royalMid: '#2C4A7C',
          royalSoft: '#3D5A80',
          // Text
          white: '#FFFFFF',
          ivory: '#F7F4EE',
          beige: '#F5F0E8',
          beigeMuted: '#C8BFAF',
          // Accents
          gold: '#D4AF37',
          goldBright: '#E8C547',
          goldPale: '#F0D78C',
          steel: '#A8B4C8',
          steelDim: '#7A8494',
          // legacy aliases
          cream: '#F5F0E8',
          navy: '#1E3A5F',
          navyDeep: '#152238',
          rose: '#A8B4C8',
          violet: '#1E3A5F',
          dark: '#161616',
        },
      },
      fontFamily: {
        cinzel: ['var(--font-cinzel)', 'Cinzel', 'serif'],
        playfair: ['var(--font-playfair)', 'Playfair Display', 'serif'],
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'luxury-sm': '0 2px 8px -2px rgba(0, 0, 0, 0.55)',
        luxury: '0 4px 20px -4px rgba(0, 0, 0, 0.6)',
        'luxury-lg': '0 12px 40px -8px rgba(0, 0, 0, 0.65)',
        'luxury-xl': '0 20px 50px -12px rgba(0, 0, 0, 0.7)',
        'luxury-glow': '0 0 28px rgba(212, 175, 55, 0.08)',
        'luxury-gold': '0 0 24px rgba(212, 175, 55, 0.15)',
        'royal-glow': '0 0 32px rgba(30, 58, 95, 0.25)',
        metallic: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.5)',
        'metallic-sm': 'inset 0 1px 0 rgba(255,255,255,0.03), 0 2px 8px rgba(0,0,0,0.4)',
        card: '0 1px 3px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.35)',
        'card-hover': '0 16px 40px -12px rgba(0,0,0,0.75)',
        elevated: '0 24px 60px -15px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'matte-panel':
          'linear-gradient(160deg, #1C1C1C 0%, #141414 45%, #0D0D0D 100%)',
        'royal-fade':
          'radial-gradient(ellipse 90% 55% at 50% -15%, rgba(30, 58, 95, 0.4) 0%, transparent 55%)',
        'gold-line':
          'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)',
        'beige-fade':
          'linear-gradient(180deg, rgba(245,240,232,0.08) 0%, transparent 40%)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        '.panel-matte': {
          background: 'linear-gradient(160deg, #1C1C1C 0%, #141414 50%, #111111 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 28px rgba(0,0,0,0.45)',
        },
        '.panel-royal': {
          background:
            'linear-gradient(145deg, rgba(30,58,95,0.35) 0%, rgba(20,20,20,0.95) 40%, rgba(13,13,13,0.98) 100%)',
          border: '1px solid rgba(61,90,128,0.35)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 32px rgba(0,0,0,0.5)',
        },
        '.text-ivory': { color: '#F7F4EE' },
        '.text-beige': { color: '#F5F0E8' },
        '.text-gold-gradient': {
          backgroundImage:
            'linear-gradient(135deg, #F0D78C 0%, #D4AF37 45%, #B8962E 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        },
      });
    },
  ],
};
