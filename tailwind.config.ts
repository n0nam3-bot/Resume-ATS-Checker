import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F1F2ED",
        "paper-dim": "#E7E8E1",
        ink: "#1C2321",
        "ink-soft": "#4A4F49",
        manila: "#DCC9A3",
        "manila-dark": "#B89B68",
        redpen: "#B7262C",
        "redpen-soft": "#F3DAD9",
        stamp: "#2F6B4F",
        "stamp-soft": "#DCE8DF",
      },
      fontFamily: {
        serif: ["var(--font-source-serif)", "Georgia", "serif"],
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      borderRadius: {
        card: "6px",
      },
      maxWidth: {
        prose: "68ch",
      },
    },
  },
  plugins: [],
};

export default config;
