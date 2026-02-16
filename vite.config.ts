import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as fs from "node:fs";

const copyViewcubeCss = {
  name: "copy-viewcube-css",
  closeBundle() {
    fs.copyFileSync("src/viewer/viewcube.css", "dist/viewcube.css");
  },
};

const sharedOutputOptions = {
  globals: {
    three: "THREE",
    react: "React",
    "react-dom": "ReactDOM",
    "react/jsx-runtime": "ReactJSXRuntime",
  },
};

export default defineConfig({
  plugins: [react(), copyViewcubeCss],
  build: {
    lib: {
      entry: {
        gviewer: "src/index.ts",
        viewer: "src/viewer/index.ts",
        react: "src/react/index.ts",
      },
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["three", /^three\/.*/, "react", "react-dom", "react/jsx-runtime"],
      output: [
        {
          format: "es",
          entryFileNames: "[name].js",
          ...sharedOutputOptions,
        },
        {
          format: "cjs",
          entryFileNames: "[name].cjs",
          ...sharedOutputOptions,
        },
      ],
    },
  },
});
