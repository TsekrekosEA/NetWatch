import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f1117",
          card: "#161922",
          hover: "#1e2130",
        },
        accent: {
          blue: "#3b82f6",
          green: "#22c55e",
          amber: "#f59e0b",
          orange: "#f97316",
          red: "#ef4444",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
