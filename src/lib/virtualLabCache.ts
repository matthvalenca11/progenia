import type { VirtualLab } from "@/services/virtualLabService";
import { isNativeLabRuntime } from "@/lib/labRuntime";

const CACHE_KEY = "progenia_virtual_labs_v1";

type LabCache = Record<string, VirtualLab>;

function readCache(): LabCache {
  if (!isNativeLabRuntime) return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LabCache;
  } catch {
    return {};
  }
}

function writeCache(cache: LabCache) {
  if (!isNativeLabRuntime) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota ou modo privado — ignorar
  }
}

export function getCachedVirtualLab(labId: string): VirtualLab | null {
  if (!labId) return null;
  return readCache()[labId] ?? null;
}

export function cacheVirtualLab(lab: VirtualLab) {
  if (!lab.id) return;
  const cache = readCache();
  cache[lab.id] = lab;
  writeCache(cache);
}
