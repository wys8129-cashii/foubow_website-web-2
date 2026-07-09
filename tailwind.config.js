/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./login.html",
    "./register.html",
    "./matierial.html",
    "./privacy.html",
    "./terms.html",
    "./public/js/*.js",
    "./src/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        "on-primary-fixed-variant": "#004e5c",
        "tertiary-container": "#97a8c1",
        "secondary-container": "#8fa7fe",
        "surface-container-high": "#e6e8ea",
        "on-tertiary": "#ffffff",
        "surface-variant": "#e0e3e5",
        "primary-fixed": "#acedff",
        "on-error": "#ffffff",
        "on-secondary": "#ffffff",
        "on-surface": "#191c1e",
        "tertiary": "#505f76",
        "surface": "#f7f9fb",
        "surface-bright": "#f7f9fb",
        "surface-container-low": "#f2f4f6",
        "outline-variant": "#bcc9cd",
        "outline": "#6d797d",
        "primary-container": "#06b6d4",
        "on-primary-fixed": "#001f26",
        "tertiary-fixed": "#d3e4fe",
        "primary": "#06B6D4",
        "inverse-primary": "#4cd7f6",
        "on-error-container": "#93000a",
        "on-secondary-fixed": "#00164e",
        "secondary-fixed-dim": "#b6c4ff",
        "surface-container-highest": "#e0e3e5",
        "surface-tint": "#06B6D4",
        "secondary": "#4059aa",
        "on-surface-variant": "#3d494c",
        "on-background": "#191c1e",
        "inverse-on-surface": "#eff1f3",
        "background": "#f7f9fb",
        "on-secondary-fixed-variant": "#264191",
        "on-primary": "#ffffff",
        "secondary-fixed": "#dce1ff",
        "surface-dim": "#d8dadc",
        "error": "#ba1a1a",
        "primary-fixed-dim": "#4cd7f6",
        "on-primary-container": "#00424f",
        "on-tertiary-container": "#2d3d52",
        "surface-container-lowest": "#ffffff",
        "error-container": "#ffdad6",
        "on-tertiary-fixed-variant": "#38485d",
        "inverse-surface": "#2d3133",
        "tertiary-fixed-dim": "#b7c8e1",
        "on-secondary-container": "#1d3989",
        "on-tertiary-fixed": "#0b1c30",
        "surface-container": "#eceef0"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1.5rem",
        full: "9999px"
      },
      spacing: {
        "margin-mobile": "20px",
        "gutter": "24px",
        "container-max": "1280px",
        "margin-desktop": "64px",
        "base": "8px"
      },
      fontFamily: {
        "headline-lg": ["Inter"],
        "body-lg": ["Inter"],
        "label-sm": ["JetBrains Mono"],
        "title-md": ["Inter"],
        "body-md": ["Inter"],
        "headline-lg-mobile": ["Inter"],
        "display-lg": ["Inter"],
        "material-symbols": ["'Material Symbols Outlined'"]
      },
      fontSize: {
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "500" }],
        "title-md": ["20px", { lineHeight: "28px", fontWeight: "500" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }]
      }
    },
  },
  plugins: [
    function({ addBase, addComponents, addUtilities }) {
      addComponents({
        '.material-symbols-outlined': {
          fontFamily: "'Material Symbols Outlined'",
          fontWeight: 'normal',
          fontStyle: 'normal',
          fontSize: '24px',
          lineHeight: 'normal',
          letterSpacing: 'normal',
          textTransform: 'none',
          display: 'inline-block',
          whiteSpace: 'nowrap',
          wordWrap: 'normal',
          direction: 'ltr',
          WebkitFontFeatureSettings: "'liga'",
          fontFeatureSettings: "'liga'",
          MozOsxFontFeatureSettings: "'liga'",
          fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        },
      })
    }
  ]
}
