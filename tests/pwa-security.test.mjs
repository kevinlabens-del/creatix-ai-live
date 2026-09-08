import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
const serviceWorker = readFileSync(new URL("../public/service-worker.js", import.meta.url), "utf8");
const player = readFileSync(new URL("../src/player.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
const pagesWorkflow = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const pagesCatalog = readFileSync(new URL("../scripts/prepare-pages-catalog.mjs", import.meta.url), "utf8");
const conferencesFunction = readFileSync(new URL("../netlify/functions/conferences.ts", import.meta.url), "utf8");

test("le manifeste possède les icônes d’installation requises", () => {
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  for (const size of [192, 512]) {
    assert.ok(manifest.icons.some((icon) => icon.sizes === `${size}x${size}`));
    assert.ok(manifest.icons.every((icon) => !icon.src.startsWith("/")));
    assert.ok(existsSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url)));
  }
});

test("le service worker n’intercepte ni les flux vidéo ni les domaines distants", () => {
  assert.match(serviceWorker, /creatix-ai-live-v3\.2\.2-pages/);
  assert.match(serviceWorker, /self\.registration\.scope/);
  assert.match(serviceWorker, /APP_BASE/);
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /request\.destination === "video"/);
  assert.match(serviceWorker, /mp4\|webm\|m3u8\|ts/);
});

test("les chemins de l’application s’adaptent au sous-dossier GitHub Pages", () => {
  assert.match(viteConfig, /VITE_BASE_PATH/);
  assert.match(main, /import\.meta\.env\.BASE_URL/);
  assert.match(main, /VITE_STATIC_CATALOG/);
  assert.match(main, /data\/catalog\.json/);
  assert.match(html, /%BASE_URL%manifest\.webmanifest/);
  assert.doesNotMatch(main, /src="\/icons\//);
});

test("le workflow GitHub Pages construit, actualise et publie l’application", () => {
  assert.match(pagesWorkflow, /cron: "15 \*\/6 \* \* \*"/);
  assert.match(pagesWorkflow, /actions\/upload-pages-artifact@v4/);
  assert.match(pagesWorkflow, /actions\/deploy-pages@v4/);
  assert.match(pagesWorkflow, /VITE_BASE_PATH: \/creatix-ai-live\//);
  assert.match(pagesWorkflow, /VITE_STATIC_CATALOG: "true"/);
  assert.match(pagesCatalog, /YOUTUBE_API_KEY/);
  assert.match(pagesCatalog, /CATALOG_SOURCE_URL/);
});

test("le catalogue réseau évite les réponses périmées et tolère un démarrage mobile lent", () => {
  assert.match(main, /CATALOG_REQUEST_TIMEOUT_MS = 30_000/);
  assert.match(main, /cache: "no-store"/);
  assert.match(main, /scheduleCatalogRecovery/);
  assert.match(conferencesFunction, /"Cache-Control": "no-store, max-age=0"/);
});

test("le lecteur bloque les ouvertures et navigations sortantes", () => {
  assert.match(player, /"allow-scripts allow-same-origin allow-presentation allow-forms"/);
  assert.doesNotMatch(player, /allow-popups|allow-top-navigation/);
  assert.doesNotMatch(`${main}\n${html}`, /target=["']_blank|window\.open\s*\(/);
  assert.doesNotMatch(`${main}\n${html}`, /youtube\.com\/watch|youtu\.be\//);
});

test("aucune clé YouTube n’est compilée dans le frontend", () => {
  assert.doesNotMatch(`${main}\n${html}\n${player}`, /YOUTUBE_API_KEY|AIza[\w-]{20,}/);
});
