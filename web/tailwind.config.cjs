/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        ink: "#0E1A16",
        pine: { DEFAULT: "#0F5B43", dark: "#0A4433", soft: "#E3EFE8", tint: "#F2F8F4" },
        lime: { DEFAULT: "#CDEB6B", soft: "#EEF6E0" },
        paper: "#F6F7F3",
        line: "#DCE2DC",
        muted: "#55625C",
        body: "#3E4B45",
        field: "#F1F3EF",
        warn: { DEFAULT: "#B54708", ink: "#5B2E07", bg: "#FDF3E7", line: "#F3D3B5" },
        danger: { DEFAULT: "#B42318", bg: "#FEF3F2" },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Geist"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        lift: "0 10px 30px -12px rgba(14,26,22,.25)",
        card: "0 30px 60px -36px rgba(14,26,22,.35)",
      },
    },
  },
  plugins: [],
};
