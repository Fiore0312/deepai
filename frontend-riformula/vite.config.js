import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "generate-nojekyll",
      writeBundle() {
        // Crea il file .nojekyll nella directory dist
        fs.writeFileSync(resolve(process.cwd(), "dist", ".nojekyll"), "");
      },
    },
  ],
  server: {
    port: 5173,
    open: true,
  },
  // Imposta la base per GitHub Pages (nome-repository)
  base: "/deepai/", // Usa percorso assoluto al repository per GitHub Pages
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
  },
});
