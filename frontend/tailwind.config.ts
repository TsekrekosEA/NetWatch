import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Threat severity colors
        threat: {
          critical: "#FF0000",
          high: "#FF6B35",
          medium: "#FFD93D",
          low: "#6BCB77",
          info: "#9CA3AF",
        },
        // Dark theme palette - pure black background with noticeably lighter dark grey surfaces
        dark: {
          bg: "#222222",
          surface: "#1F1F1F",
          surface_2: "#2A2A2A",
          border: "#3A3A3A",
          text: "#F1F5F9",
          text_secondary: "#CBD5E1",
        },
        surface: {
          DEFAULT: "#05060a",
          card: "#0b0d12",
          hover: "#12151c",
        },
        accent: {
          blue: "#0369A1",
          green: "#6BCB77",
          amber: "#FFD93D",
          orange: "#FF6B35",
          red: "#FF0000",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"Fira Code"', "monospace"],
      },
      animation: {
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "expand": "expand 0.25s ease-out",
        "pulse-critical": "pulseCritical 2s ease-in-out infinite",
        "glow-critical": "glowCritical 2s ease-in-out infinite",
        "skeleton": "skeleton 1.5s ease-in-out infinite",
        "banner-slide": "bannerSlide 0.3s ease-out",
        "float": "float 3s ease-in-out infinite",
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
          "0%, 100%": { boxShadow: "0 0 4px 0px rgba(255, 0, 0, 0.4)" },
          "50%": { boxShadow: "0 0 8px 2px rgba(255, 0, 0, 0.6)" },
        },
        skeleton: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        bannerSlide: {
          "0%": { opacity: "0", transform: "translateY(-100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
