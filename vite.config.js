import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

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

export default defineConfig({
  plugins: [localCatalogApi()],
  server: {
    host: process.env.VITE_HOST || "0.0.0.0",
    allowedHosts: ["terminal.local"],
  },
  build: {
    target: "es2020",
    sourcemap: true,
  },
});
