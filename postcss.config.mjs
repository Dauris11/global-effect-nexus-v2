/**
 * PostCSS — Tailwind CSS 4 usa su propio plugin de PostCSS
 * (@tailwindcss/postcss), que ya incluye autoprefixer e import.
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
