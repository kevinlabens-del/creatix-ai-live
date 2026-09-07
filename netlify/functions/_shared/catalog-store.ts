import { getDeployStore, getStore } from "@netlify/blobs";
import seedCatalogJson from "../../../public/data/seed-catalog.json";
import { discoverYouTubeCatalog } from "./discovery";
import type { CatalogPayload } from "./types";

const STORE_NAME = "creatix-ai-live-catalog";
const CATALOG_KEY = "catalog-v3.1";
const LEGACY_CATALOG_KEY = "catalog-v3";

export const fallbackCatalog = seedCatalogJson as CatalogPayload;

function catalogStore(deployContext = "dev") {
  return deployContext === "production"
    ? getStore({ name: STORE_NAME, consistency: "strong" })
    : getDeployStore({ name: STORE_NAME });
}

export async function readStoredCatalog(deployContext?: string) {
  try {
    return (await catalogStore(deployContext).get(CATALOG_KEY, {
      type: "json",
    })) as CatalogPayload | null;
  } catch {
    return null;
  }
}

export async function readLegacyCatalog(deployContext?: string) {
  try {
    return (await catalogStore(deployContext).get(LEGACY_CATALOG_KEY, {
      type: "json",
    })) as CatalogPayload | null;
  } catch {
    return null;
  }
}

export async function saveCatalog(catalog: CatalogPayload, deployContext?: string) {
  await catalogStore(deployContext).setJSON(CATALOG_KEY, catalog);
}

export function isCatalogStale(catalog: CatalogPayload | null, maxAgeMs = 6 * 3600_000) {
  if (!catalog?.generatedAt) return true;
  return Date.now() - new Date(catalog.generatedAt).getTime() > maxAgeMs;
}

export async function refreshCatalog(apiKey: string, deployContext?: string) {
  const stored = await readStoredCatalog(deployContext);
  const legacy = stored?.videos?.length ? null : await readLegacyCatalog(deployContext);
  const startingCatalog = stored?.videos?.length
    ? stored
    : legacy?.videos?.length
      ? legacy
      : fallbackCatalog;
  const refreshed = await discoverYouTubeCatalog(apiKey, startingCatalog.videos);
  await saveCatalog(refreshed, deployContext);
  return refreshed;
}
