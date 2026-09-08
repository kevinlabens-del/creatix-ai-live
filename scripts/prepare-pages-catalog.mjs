import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverYouTubeCatalog } from "../netlify/functions/_shared/discovery.ts";

const seedUrl = new URL("../public/data/seed-catalog.json", import.meta.url);
const outputUrl = new URL("../public/data/catalog.json", import.meta.url);

function isUsableCatalog(payload) {
  return (
    payload &&
    Array.isArray(payload.videos) &&
    payload.videos.length > 0 &&
    payload.videos.every(
      (video) =>
        typeof video?.id === "string" &&
        typeof video?.title === "string" &&
        video?.embeddable === true,
    )
  );
}

async function readSeedCatalog() {
  return JSON.parse(await readFile(seedUrl, "utf8"));
}

async function discoverWithYouTube(apiKey, seedCatalog) {
  if (!apiKey) return null;
  try {
    return await discoverYouTubeCatalog(apiKey, seedCatalog.videos);
  } catch (error) {
    console.warn(
      `YouTube discovery unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return null;
  }
}

async function readMigrationBridge(sourceUrl) {
  if (!sourceUrl) return null;
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:") throw new Error("CATALOG_SOURCE_URL must use HTTPS");
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return isUsableCatalog(payload) ? payload : null;
  } catch (error) {
    console.warn(
      `Catalog bridge unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return null;
  }
}

const seedCatalog = await readSeedCatalog();
const apiKey = process.env.YOUTUBE_API_KEY?.trim() || "";
const sourceUrl = process.env.CATALOG_SOURCE_URL?.trim() || "";

const discoveredCatalog = await discoverWithYouTube(apiKey, seedCatalog);
const bridgedCatalog = discoveredCatalog ? null : await readMigrationBridge(sourceUrl);
const selectedCatalog = discoveredCatalog || bridgedCatalog || {
  ...seedCatalog,
  notice: "Catalogue de secours GitHub Pages actif.",
};

if (!isUsableCatalog(selectedCatalog)) {
  throw new Error("No usable conference catalog could be prepared");
}

await mkdir(dirname(fileURLToPath(outputUrl)), { recursive: true });
await writeFile(outputUrl, `${JSON.stringify(selectedCatalog, null, 2)}\n`, "utf8");

const source = discoveredCatalog
  ? "YouTube Data API"
  : bridgedCatalog
    ? "migration bridge"
    : "verified fallback";
console.log(`Prepared ${selectedCatalog.videos.length} conferences from ${source}.`);
