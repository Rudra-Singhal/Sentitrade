/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#05070A",
        graphite: "#10151D",
        neon: "#39FF88",
        cyanline: "#58D5FF",
        warning: "#F6C85F",
        danger: "#FF5A7A"
      },
      boxShadow: {
        glow: "0 0 35px rgba(57, 255, 136, 0.18)",
        panel: "0 24px 80px rgba(0, 0, 0, 0.35)"
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out both"
      }
    }
  },
  plugins: []
};
