/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        surface: {
          800: "#1e293b",
          850: "#0f172a",
          900: "#020617",
          950: "#010410",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        glow: "0 0 40px -10px rgba(14, 165, 233, 0.45)",
        "glow-lg": "0 0 60px -12px rgba(14, 165, 233, 0.5)",
        "glow-violet": "0 0 40px -10px rgba(139, 92, 246, 0.45)",
        "glow-cyan": "0 0 40px -10px rgba(6, 182, 212, 0.4)",
        "glow-pink": "0 0 40px -10px rgba(217, 70, 239, 0.4)",
        glass: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        "glass-lg": "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
        "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.2)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(var(--tw-gradient-stops))",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        "float-delayed": "float 7s ease-in-out infinite 1.5s",
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "fade-up": "fadeUp 0.6s ease-out forwards",
        "scale-in": "scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "slide-in-right": "slideInRight 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "typing-cursor": "typingCursor 1s step-end infinite",
        "orb-drift": "orbDrift 12s ease-in-out infinite",
        "gradient-shift": "gradientShift 8s ease-in-out infinite alternate",
        "scan-line": "scanLine 3s linear infinite",
        shake: "shake 0.4s cubic-bezier(0.36,.07,.19,.97) both",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-16px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(32px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        typingCursor: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        orbDrift: {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(30px, -20px) scale(1.08)" },
          "66%": { transform: "translate(-20px, 15px) scale(0.95)" },
          "100%": { transform: "translate(0, 0) scale(1)" },
        },
        gradientShift: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(1000%)", opacity: "0" },
        },
        shake: {
          "10%, 90%": { transform: "translate3d(-1px, 0, 0)" },
          "20%, 80%": { transform: "translate3d(2px, 0, 0)" },
          "30%, 50%, 70%": { transform: "translate3d(-3px, 0, 0)" },
          "40%, 60%": { transform: "translate3d(3px, 0, 0)" },
        },
      },
    },
  },
  plugins: [],
};
