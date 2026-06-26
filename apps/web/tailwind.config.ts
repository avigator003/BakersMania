import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        panel: "#ffffff",
        panel2: "#f6f8fb",
        line: "#dbe3ee",
        muted: "#687589",
        bread: "#fff5e7",
        berry: "#d14c6c",
        mint: "#1f9d83",
        saffron: "#d98519",
        night: "#f3f6fa",
        sidebar: "#102033",
        sidebar2: "#172b43"
      },
      boxShadow: {
        subtle: "0 18px 50px rgba(16, 32, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
