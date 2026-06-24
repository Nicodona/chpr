import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The build emits a CRA-style layout straight into the Django project root as
// `build/`: index.html at the root with hashed assets under static/ (assetsDir),
// referenced at /static/…. chpr_backend/urls.py serves build/static at /static/,
// so `npm run build` is the only step — no copying needed.
// In dev, the app runs from the root and proxies API/media calls to Django on :8000.
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    // Output to ../build (the project root, one level above frontend/).
    outDir: "../build",
    assetsDir: "static",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/media": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    css: false,
  },
});
