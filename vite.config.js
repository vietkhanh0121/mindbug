import { defineConfig } from "vite";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
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
        const indexPath = resolve("dist/index.html");
        const indexHtml = readFileSync(indexPath, "utf8").replace(
          /href="\.\/assets\/manifest-[^"]+\.webmanifest"/,
          'href="./manifest.webmanifest"'
        );
        writeFileSync(indexPath, indexHtml);
        writeFileSync(
          resolve("dist/assets/index.html"),
          '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../"><script>location.replace("../")</script>'
        );
        writeFileSync(resolve("dist/.nojekyll"), "");
      }
    }
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
