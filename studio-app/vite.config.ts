import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The Studio is served from https://brighttrailspublishing.com/studio/
// and builds straight into the site's publish folder (./studio at the repo root).
export default defineConfig({
  base: "/studio/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../studio",
    emptyOutDir: true,
  },
});
