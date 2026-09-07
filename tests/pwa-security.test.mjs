import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
const serviceWorker = readFileSync(new URL("../public/service-worker.js", import.meta.url), "utf8");
const player = readFileSync(new URL("../src/player.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const conferencesFunction = readFileSync(new URL("../netlify/functions/conferences.ts", import.meta.url), "utf8");

test("le manifeste possède les icônes d’installation requises", () => {
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  for (const size of [192, 512]) {
    assert.ok(manifest.icons.some((icon) => icon.sizes === `${size}x${size}`));
    assert.ok(existsSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url)));
  }
});

test("le service worker n’intercepte ni les flux vidéo ni les domaines distants", () => {
  assert.match(serviceWorker, /creatix-ai-live-v3\.2\.1/);
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /request\.destination === "video"/);
  assert.match(serviceWorker, /mp4\|webm\|m3u8\|ts/);
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
