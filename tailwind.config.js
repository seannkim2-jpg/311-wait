/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Restrained palette: ink does most of the work; colour only ever encodes data.
      // Contrast ratios against white are in docs/UI-VISUAL-PLAN.md §4.
      colors: {
        // ink-3 is the lightest text tone: 5.0:1 on mist, 5.45:1 on white (axe-checked).
        ink: { DEFAULT: '#15171C', 2: '#4A505C', 3: '#636A76' },
        mist: '#F4F5F7',
        rule: '#E6E7EA',
        data: { DEFAULT: '#2F4BD0', soft: '#EBEEFB' }, // what the data shows
        city: { DEFAULT: '#7A818D', text: '#5E6676' }, // what the city reports
        notfixed: '#A35F00', // closed as Noted / Transitioned
        overdue: { DEFAULT: '#C8242D', soft: '#F8E3E4' }, // still open, past deadline
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Public Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        // From the `animate` skill: strong curves, never the weak built-ins.
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      maxWidth: { page: '1200px' },
    },
  },
  plugins: [],
}
