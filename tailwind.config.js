/** Tailwind wird zur Build-Zeit kompiliert (kein CDN). */
module.exports = {
  content: ['./index.html', './index_script.js', './script.js', './i18n.js', './gutschein.js'],
  theme: { extend: {
    colors: { brand: { light: '#FAF9F6', beige: '#E5D3B3', gold: '#C5A880', dark: '#000000', muted: '#4B4B4B' } },
    fontFamily: { sans: ['Montserrat', 'sans-serif'], serif: ['Playfair Display', 'serif'] }
  } },
  plugins: []
};
