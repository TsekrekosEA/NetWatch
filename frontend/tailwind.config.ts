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
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
      },
      animation: {
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "expand": "expand 0.25s ease-out",
        "pulse-critical": "pulseCritical 2s ease-in-out infinite",
        "glow-critical": "glowCritical 2s ease-in-out infinite",
        "skeleton": "skeleton 1.5s ease-in-out infinite",
        "banner-slide": "bannerSlide 0.3s ease-out",
      },
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        expand: {
          "0%": { opacity: "0", maxHeight: "0px" },
          "100%": { opacity: "1", maxHeight: "300px" },
        },
        pulseCritical: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        glowCritical: {
          "0%, 100%": { boxShadow: "0 0 4px 0px rgba(239, 68, 68, 0.4)" },
          "50%": { boxShadow: "0 0 8px 2px rgba(239, 68, 68, 0.6)" },
        },
        skeleton: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        bannerSlide: {
          "0%": { opacity: "0", transform: "translateY(-100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
