import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Firebase in un file a parte: cambia di rado, così resta nella cache del browser.
        manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage"] },
      },
    },
  },
  test: { environment: "node" },
});
