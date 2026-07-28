import { defineConfig } from "vite";
import { cpSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "copy-runtime-assets",
      closeBundle() {
        cpSync(resolve("assets"), resolve("dist/assets"), { recursive: true });
        cpSync(resolve("manifest.webmanifest"), resolve("dist/manifest.webmanifest"));
        cpSync(resolve("sw.js"), resolve("dist/sw.js"));
        writeFileSync(resolve("dist/.nojekyll"), "");
      }
    }
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
