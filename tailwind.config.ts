import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
      },
      colors: {
        ap: {
          primary: "#7c3aed",
          secondary: "#8b5cf6",
          bg: "#faf5ff",
          card: "#ffffff",
          muted: "#f7f3fd",
          border: "#efe7fc",
          ink: "#0f172a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
