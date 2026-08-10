import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? "/Smart_Sportz/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("node_modules/react") || normalized.includes("node_modules/react-dom") || normalized.includes("node_modules/react-router-dom")) return "react";
          if (normalized.includes("node_modules/framer-motion")) return "motion";
          if (normalized.includes("node_modules/lucide-react")) return "icons";
          if (normalized.includes("node_modules/qrcode.react")) return "qrcode";
        },
      },
    },
  },
});
