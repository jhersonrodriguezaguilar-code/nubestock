/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages sirve el sitio en /<repositorio>/. Se puede cambiar con VITE_BASE.
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? (process.env.VITE_BASE ?? "/nubestock/") : "/",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
}));
