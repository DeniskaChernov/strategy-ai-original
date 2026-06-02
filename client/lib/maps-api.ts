// Сетевой слой для карт и контент-плана.
// Работает через общий apiFetch / store из client/api, сам
// нормализует ответ и аккуратно падает в локальное хранилище,
// когда API_BASE не задан (локальная разработка без бэкенда).

import { API_BASE, apiFetch, store } from "../api";
import { normalizeMap, isUUID } from "./map-utils";

export async function getMaps(projectId: string): Promise<any[]> {
  if (API_BASE) {
    try {
      const d = await apiFetch(`/api/projects/${projectId}/maps`);
      return (d.maps || []).map(normalizeMap);
    } catch {
      return [];
    }
  }
  const a = (await store.get(`sa_maps_${projectId}`)) || [];
  return a.map(normalizeMap);
}

// Параллельная загрузка карт для нескольких проектов — устраняет N+1
// (раньше карты грузились последовательно в for-цикле await getMaps).
export async function getMapsByProject(projectIds: string[]): Promise<Record<string, any[]>> {
  const entries = await Promise.all(
    (projectIds || []).map(async (id) => {
      try {
        return [id, await getMaps(id)] as const;
      } catch {
        return [id, [] as any[]] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

export async function saveMap(projectId: string, map: any): Promise<any> {
  if (API_BASE) {
    try {
      const treatAsNew = map._new || !isUUID(map.id);
      const body = JSON.stringify({
        name: map.name,
        nodes: map.nodes,
        edges: map.edges,
        ctx: map.ctx,
        is_scenario: map.isScenario,
      });
      if (treatAsNew) {
        const d = await apiFetch(`/api/projects/${projectId}/maps`, { method: "POST", body });
        return normalizeMap(d.map) || map;
      }
      const d = await apiFetch(`/api/projects/${projectId}/maps/${map.id}`, { method: "PUT", body });
      return normalizeMap(d.map) || map;
    } catch (e: any) {
      // Раньше ошибка проглатывалась и возвращалась исходная карта —
      // из-за этого UI показывал «Сохранено», хотя данные не сохранились.
      // Пробрасываем ошибку, чтобы вызывающий код показал статус «Ошибка» / тост.
      throw e;
    }
  }
  const a = await getMaps(projectId);
  const i = a.findIndex((m: any) => m.id === map.id);
  await store.set(`sa_maps_${projectId}`, i >= 0 ? a.map((m: any) => (m.id === map.id ? map : m)) : [...a, map]);
  return map;
}

export async function deleteMap(projectId: string, mapId: string): Promise<void> {
  if (API_BASE) {
    try { await apiFetch(`/api/projects/${projectId}/maps/${mapId}`, { method: "DELETE" }); } catch { /* ignore */ }
    return;
  }
  const a = await getMaps(projectId);
  await store.set(`sa_maps_${projectId}`, a.filter((m: any) => m.id !== mapId));
}

export async function getContentPlan(projectId: string): Promise<any[]> {
  if (API_BASE) {
    try {
      const d = await apiFetch(`/api/projects/${projectId}/content-plan`);
      return d.items || [];
    } catch {
      return [];
    }
  }
  return (await store.get(`sa_content_${projectId}`)) || [];
}

export async function saveContentPlan(projectId: string, items: any[]): Promise<void> {
  if (API_BASE) {
    try {
      await apiFetch(`/api/projects/${projectId}/content-plan`, { method: "PUT", body: JSON.stringify({ items }) });
      return;
    } catch {
      throw new Error("Ошибка сохранения");
    }
  }
  await store.set(`sa_content_${projectId}`, items);
}
