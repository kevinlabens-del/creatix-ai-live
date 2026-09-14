import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const base = process.env.VITE_BASE_PATH || "/";

function localCatalogApi() {
  const seedPath = new URL("./public/data/seed-catalog.json", import.meta.url);
  return {
    name: "local-catalog-api",
    configureServer(server) {
      server.middlewares.use("/api/conferences", (_request, response) => {
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(readFileSync(seedPath, "utf8"));
      });
    },
  };
}

function supportButtonPlugin() {
  return {
    name: "cr3atix-support-button",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { src: `${base}support-button.js`, defer: true },
          injectTo: "body",
        },
      ];
    },
  };
}

export default defineConfig({
  base,
  plugins: [localCatalogApi(), supportButtonPlugin()],
  server: {
    host: process.env.VITE_HOST || "0.0.0.0",
    allowedHosts: ["terminal.local"],
  },
  build: {
    target: "es2020",
    sourcemap: true,
  },
});
