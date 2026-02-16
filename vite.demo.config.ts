import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: "demo",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@src": resolve(__dirname, "src") },
  },
  build: {
    outDir: resolve(__dirname, "demo-dist"),
    emptyOutDir: true,
  },
});
