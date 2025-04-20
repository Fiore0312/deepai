import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  // Imposta la base per GitHub Pages (nome-repository)
  // Imposta una stringa vuota per la build di produzione per supportare deployment relativo
  // In ambiente di sviluppo usa '/'
  base: process.env.NODE_ENV === "production" ? "" : "/",
});
